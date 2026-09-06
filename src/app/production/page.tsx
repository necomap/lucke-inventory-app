'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, updateDoc, doc, addDoc, serverTimestamp, increment, where } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { Factory, Loader2, Plus, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { useRouter } from 'next/navigation';

// 単位変換ヘルパー関数
const getConvertedAmountAndUnit = (
  ingredientAmount: number,
  ingredientUnit: string,
  stockUnit: string
) => {
  if (!ingredientUnit || !stockUnit) return { amount: ingredientAmount, unit: stockUnit, factor: 1 };
  
  const ingUnitNorm = ingredientUnit.toLowerCase().trim();
  const stkUnitNorm = stockUnit.toLowerCase().trim();

  // 1. 重量: 在庫が kg で レシピが g の場合
  if (stkUnitNorm === 'kg' && ingUnitNorm === 'g') {
    return { amount: ingredientAmount / 1000, unit: 'kg', factor: 0.001 };
  }
  // 在庫が g で レシピが kg の場合
  if (stkUnitNorm === 'g' && ingUnitNorm === 'kg') {
    return { amount: ingredientAmount * 1000, unit: 'g', factor: 1000 };
  }

  // 2. 容量: 在庫が L で レシピが ml / cc の場合
  if (stkUnitNorm === 'l' && (ingUnitNorm === 'ml' || ingUnitNorm === 'cc')) {
    return { amount: ingredientAmount / 1000, unit: 'L', factor: 0.001 };
  }
  // 在庫が ml / cc で レシピが L の場合
  if ((stkUnitNorm === 'ml' || stkUnitNorm === 'cc') && ingUnitNorm === 'l') {
    return { amount: ingredientAmount * 1000, unit: stkUnitNorm, factor: 1000 };
  }

  // 変換なし
  return { amount: ingredientAmount, unit: stockUnit, factor: 1 };
};

export default function ProductionPage() {
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useInventorySettings();
  const router = useRouter();
  
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [produceQty, setProduceQty] = useState<number>(1);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 2026-09新設: FoodLabel Pro連携が未設定の場合に案内を出すためのフラグ
  const [foodlabelNotConfigured, setFoodlabelNotConfigured] = useState(false);
  // 2026-09新設: FoodLabel Pro連携はproプラン限定機能。未加入の場合に案内を出すためのフラグ
  const [planRequired, setPlanRequired] = useState(false);

  useEffect(() => {
    if (settingsLoading) return;

    if (settings && !settings.businessTypes?.manufacturing) {
      router.push('/inventory');
      return;
    }

    const fetchData = async () => {
      try {
        if (user) {
          // レシピの取得 (FoodLabel API経由。自分のアカウントに紐づくAPIキーで
          // 認証されるため、自分のレシピだけが返る。2026-09セキュリティ修正)
          const res = await fetch(`/api/foodlabel/recipes?userId=${user.uid}`);
          if (res.ok) {
            const data = await res.json();
            setRecipes(data.recipes || []);
            setFoodlabelNotConfigured(!!data.notConfigured);
            setPlanRequired(!!data.planRequired);
          }

          // 現在の在庫データの取得
          const q = query(collection(db, 'items'), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
          setInventoryItems(items);
        }
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, settings, settingsLoading, router]);

  const handleProduce = async () => {
    if (!selectedRecipe || !user) return;
    setIsSubmitting(true);

    try {
      // 1. 完成品の在庫を増やす処理
      // （アプリ内に既に完成品として登録されているか名前で検索。なければ新規作成）
      let finishedItemRef = null;
      let finishedItemId = null;
      const existingProduct = inventoryItems.find(item => item.name === selectedRecipe.name);
      
      if (existingProduct) {
        finishedItemRef = doc(db, 'items', existingProduct.id);
        finishedItemId = existingProduct.id;
        await updateDoc(finishedItemRef, {
          currentStock: increment(produceQty),
          lastUpdated: serverTimestamp(),
          updatedBy: user.displayName || user.email || 'Unknown'
        });
      } else {
        // 新規作成
        const newItemData = {
          name: selectedRecipe.name,
          category: '完成品',
          currentStock: produceQty,
          unit: '個',
          minStock: 0,
          status: 'available',
          userId: user.uid,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          updatedBy: user.displayName || user.email || 'Unknown'
        };
        const docRef = await addDoc(collection(db, 'items'), newItemData);
        finishedItemId = docRef.id;
      }

      // トランザクション記録 (入庫)
      await addDoc(collection(db, 'transactions'), {
        itemId: finishedItemId,
        userId: user.uid,
        type: 'in',
        quantity: produceQty,
        unitPrice: 0,
        date: serverTimestamp(),
        staffName: user.displayName || user.email || 'Unknown',
        memo: '製造（レシピ連動）'
      });

      // 2. 材料の在庫を減らす処理
      for (const ingredient of selectedRecipe.ingredients) {
        const totalRequiredAmount = ingredient.amount * produceQty;
        // 在庫アイテムから名前で材料を探す（※本来はIDマッピングが必要ですが今回は名前でマッチング）
        const matchedItem = inventoryItems.find(item => item.name === ingredient.name);
        
        if (matchedItem) {
          // 単位の変換
          const conversion = getConvertedAmountAndUnit(ingredient.amount, ingredient.unit, matchedItem.unit);
          const totalRequiredInStockUnit = conversion.amount * produceQty;

          const itemRef = doc(db, 'items', matchedItem.id);
          await updateDoc(itemRef, {
            currentStock: increment(-totalRequiredInStockUnit),
            lastUpdated: serverTimestamp(),
            updatedBy: user.displayName || user.email || 'Unknown'
          });

          // 出庫トランザクション
          await addDoc(collection(db, 'transactions'), {
            itemId: matchedItem.id,
            userId: user.uid,
            type: 'out',
            quantity: totalRequiredInStockUnit,
            unitPrice: 0,
            date: serverTimestamp(),
            staffName: user.displayName || user.email || 'Unknown',
            memo: `製造使用（${selectedRecipe.name}）：${totalRequiredAmount} ${ingredient.unit} 使用`
          });
        }
      }

      alert('製造処理が完了しました！');
      setSelectedRecipe(null);
      setProduceQty(1);
      
      // 在庫再取得
      const q = query(collection(db, 'items'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      setInventoryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
      
    } catch (error) {
      console.error('Production error:', error);
      alert('製造処理に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || settingsLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <Factory size={28} color="var(--primary-color)" />
        <h1 style={{ margin: 0, color: '#1e293b' }}>製造・仕込 (レシピ連動)</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: '#334155' }}>FoodLabel レシピ選択</h2>
          
          {planRequired ? (
            <p style={{ color: '#64748b' }}>
              FoodLabel Pro連携（製造・仕込の自動在庫減算）はプロプラン限定機能です。<a href="/settings" style={{ color: 'var(--primary-color)' }}>設定ページ</a>からアップグレードしてください。
            </p>
          ) : foodlabelNotConfigured ? (
            <p style={{ color: '#64748b' }}>
              FoodLabel Pro連携が設定されていません。<a href="/settings" style={{ color: 'var(--primary-color)' }}>設定ページ</a>で、FoodLabel Proの設定画面で発行したAPIキーを入力してください。
            </p>
          ) : recipes.length === 0 ? (
            <p style={{ color: '#64748b' }}>レシピが見つかりません。FoodLabel Proでレシピを作成してください。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
              {recipes.map(recipe => (
                <div 
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  style={{ 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    border: selectedRecipe?.id === recipe.id ? '2px solid var(--primary-color)' : '1px solid #e2e8f0',
                    background: selectedRecipe?.id === recipe.id ? '#f0f9ff' : 'white'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{recipe.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>構成材料: {recipe.ingredients.length}件</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {selectedRecipe ? (
            <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#334155' }}>製造実行</h2>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>製造数 (単位: {selectedRecipe.unitCount}個相当)</label>
                <input 
                  type="number" 
                  min="1"
                  value={produceQty} 
                  onChange={e => setProduceQty(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.25rem' }} 
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#334155', marginBottom: '0.5rem' }}>必要材料 (引き落とし予定)</h3>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                  {selectedRecipe.ingredients.map((ing: any) => {
                    const requiredAmountInRecipeUnit = ing.amount * produceQty;
                    const inventoryItem = inventoryItems.find(item => item.name === ing.name);
                    
                    let requiredAmountInStockUnit = requiredAmountInRecipeUnit;
                    let displayRequiredText = `${requiredAmountInRecipeUnit.toLocaleString()} ${ing.unit}`;
                    
                    if (inventoryItem) {
                      const conversion = getConvertedAmountAndUnit(ing.amount, ing.unit, inventoryItem.unit);
                      requiredAmountInStockUnit = conversion.amount * produceQty;
                      
                      if (ing.unit.toLowerCase().trim() !== inventoryItem.unit.toLowerCase().trim()) {
                        displayRequiredText = `${requiredAmountInRecipeUnit.toLocaleString()} ${ing.unit} (在庫換算: ${requiredAmountInStockUnit.toLocaleString()} ${inventoryItem.unit})`;
                      }
                    }

                    const stock = inventoryItem?.currentStock || 0;
                    const isShort = stock < requiredAmountInStockUnit;

                    return (
                      <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isShort ? <AlertCircle size={16} color="#ef4444" /> : <CheckCircle size={16} color="#10b981" />}
                          <span style={{ color: '#1e293b' }}>{ing.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 'bold' }}>{displayRequiredText}</span>
                          <div style={{ fontSize: '0.75rem', color: isShort ? '#ef4444' : '#64748b' }}>
                            現在庫: {stock} {inventoryItem?.unit || ing.unit} (不足: {isShort ? (requiredAmountInStockUnit - stock).toLocaleString() : 0})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleProduce}
                disabled={isSubmitting}
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', display: 'flex', justifyContent: 'center' }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : (
                  <>
                    <Factory size={20} />
                    この内容で製造を記録する
                  </>
                )}
              </button>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem', textAlign: 'center' }}>
                ※材料の在庫が自動的に減少し、完成品の在庫が増加します。
              </p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <ArrowRight size={48} style={{ margin: '0 auto 1rem' }} />
              <p>左側のリストからレシピを選択してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
