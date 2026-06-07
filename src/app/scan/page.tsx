'use client';

import React, { useState, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { InventoryItem } from '@/types/inventory';
import { useAuth } from '@/context/AuthContext';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { Package, Plus, ScanLine, X, Check, Loader2, ArrowUpCircle, ArrowDownCircle, FileText, Upload, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useSubscription } from '@/hooks/useSubscription';
import './scan.css';

export default function ScanPage() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { playSuccessSound, triggerVibration } = useInventorySettings();
  const [result, setResult] = useState<string | null>(null);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'ocr' | 'stocktake'>('barcode');
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [actualCount, setActualCount] = useState<number | string>('');

  const { ref } = useZxing({
    onResult(res) {
      const text = res.getText();
      if (text !== result) {
        setResult(text);
        handleFoundBarcode(text);
      }
    },
  });

  const handleFoundBarcode = async (barcode: string) => {
    setLoading(true);
    playSuccessSound();
    triggerVibration();
    
    try {
      const q = query(
        collection(db, 'items'), 
        where('barcode', '==', barcode)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // userIdが一致するものだけをフィルタ
        const itemDoc = querySnapshot.docs.find(doc => doc.data().userId === user.uid);
        if (itemDoc) {
          const item = { id: itemDoc.id, ...itemDoc.data() } as InventoryItem;
          setFoundItem(item);
          if (scanMode === 'stocktake') {
            setActualCount(item.currentStock);
          }
        } else {
          setFoundItem(null);
        }
      } else {
        setFoundItem(null);
      }
    } catch (error) {
      console.error('Error searching barcode:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdjust = async (type: 'in' | 'out') => {
    if (!foundItem || !user) return;
    setIsAdjusting(true);
    try {
      const itemRef = doc(db, 'items', foundItem.id);
      await updateDoc(itemRef, {
        currentStock: increment(type === 'in' ? 1 : -1),
        lastUpdated: serverTimestamp(),
        updatedBy: user.displayName || user.email || 'Unknown'
      });

      await addDoc(collection(db, 'transactions'), {
        itemId: foundItem.id,
        userId: user.uid,
        type: type,
        quantity: 1,
        unitPrice: 0,
        date: serverTimestamp(),
        staffName: user.displayName || user.email || 'Unknown',
        memo: `クイックスキャン${type === 'in' ? '入庫' : '出庫'}`
      });

      setFoundItem(prev => prev ? { ...prev, currentStock: prev.currentStock + (type === 'in' ? 1 : -1) } : null);
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleStocktakeSubmit = async () => {
    if (!foundItem || !user || actualCount === '') return;
    const actual = Number(actualCount);
    if (isNaN(actual)) return;
    
    const diff = actual - foundItem.currentStock;
    if (diff === 0) {
      alert('在庫数に変更はありません。');
      setResult(null);
      setFoundItem(null);
      return;
    }

    setIsAdjusting(true);
    try {
      const type = diff > 0 ? 'in' : 'out';
      const absDiff = Math.abs(diff);

      const itemRef = doc(db, 'items', foundItem.id);
      await updateDoc(itemRef, {
        currentStock: actual,
        lastUpdated: serverTimestamp(),
        updatedBy: user.displayName || user.email || 'Unknown'
      });

      await addDoc(collection(db, 'transactions'), {
        itemId: foundItem.id,
        userId: user.uid,
        type: type,
        quantity: absDiff,
        unitPrice: 0,
        date: serverTimestamp(),
        staffName: user.displayName || user.email || 'Unknown',
        memo: `棚卸調整 (理論値 ${foundItem.currentStock} → 実測値 ${actual})`
      });

      alert(`棚卸が完了しました。在庫を ${actual} に更新しました。`);
      setResult(null);
      setFoundItem(null);
      setActualCount('');
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleOcrMockScan = () => {
    setLoading(true);
    // モックの遅延をシミュレート
    setTimeout(() => {
      setOcrResult({
        supplier: 'モック卸売株式会社',
        items: [
          { name: 'プレミアムコーヒー豆', quantity: 10, unitPrice: 1200 },
          { name: '専用フィルター', quantity: 5, unitPrice: 300 }
        ],
        date: new Date().toISOString().split('T')[0]
      });
      setLoading(false);
      playSuccessSound();
    }, 2000);
  };

  const submitOcrResult = async () => {
    setLoading(true);
    try {
      // 実際には各アイテムのIDを検索し、存在しなければ新規登録画面へ誘導するなどの処理が必要
      // ここではモックとしてトランザクションを生成するだけとします
      alert(`AI解析結果(${ocrResult.items.length}件)を一括入庫しました！`);
      setOcrResult(null);
    } catch (e) {
      alert('エラー');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanContainer">
      <div className="formHeader" style={{ textAlign: 'center' }}>
        <h1>スキャン</h1>
        
        {isPremium && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button 
              className={`btn ${scanMode === 'barcode' ? 'btn-primary' : 'btnSecondary'}`}
              onClick={() => setScanMode('barcode')}
            >
              <ScanLine size={18} /> 入出庫
            </button>
            <button 
              className={`btn ${scanMode === 'stocktake' ? 'btn-primary' : 'btnSecondary'}`}
              onClick={() => setScanMode('stocktake')}
            >
              <ClipboardList size={18} /> 棚卸
            </button>
            <button 
              className={`btn ${scanMode === 'ocr' ? 'btn-primary' : 'btnSecondary'}`}
              onClick={() => setScanMode('ocr')}
            >
              <FileText size={18} /> 納品書
            </button>
          </div>
        )}

        <p className="label" style={{ marginTop: '1rem' }}>
          {scanMode === 'ocr' ? '納品書やレシートを撮影してください' : '枠の中にバーコードを合わせてください'}
        </p>
      </div>

      {(scanMode === 'barcode' || scanMode === 'stocktake') ? (
        <div className="videoWrapper">
          <video ref={ref} className="scannerVideo" />
          <div className="scanOverlay">
            <div className="scanTarget" />
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', margin: '2rem 0' }}>
          <Upload size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>納品書の写真をアップロードするか<br/>カメラで撮影してください</p>
          <button className="btn btn-primary" onClick={handleOcrMockScan} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ScanLine size={18} />}
            AIで読み取る（モック）
          </button>
        </div>
      )}

      {loading && (scanMode === 'barcode' || scanMode === 'stocktake') && <div className="glass-panel" style={{ padding: '1.5rem' }}><Loader2 className="animate-spin" /></div>}

      {result && !loading && (scanMode === 'barcode' || scanMode === 'stocktake') && (
        <div className="scanResultCard glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="label">スキャン結果: {result}</span>
            <button onClick={() => { setResult(null); setFoundItem(null); }} className="logout-btn"><X size={18} /></button>
          </div>

          {foundItem ? (
            <>
              <div className="resultInfo">
                {foundItem.imageUrl ? (
                  <img src={foundItem.imageUrl} alt="" className="resultImg" />
                ) : (
                  <div className="resultImg" style={{ background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={24} color="#cbd5e1" />
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>{foundItem.name}</div>
                  <div className="label">現在の在庫: {foundItem.currentStock}</div>
                </div>
              </div>

              {scanMode === 'barcode' && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                  <button 
                    onClick={() => handleQuickAdjust('in')} 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    disabled={isAdjusting}
                  >
                    <ArrowUpCircle size={18} /> +1 入庫
                  </button>
                  <button 
                    onClick={() => handleQuickAdjust('out')} 
                    className="btn btnSecondary" 
                    style={{ flex: 1, color: '#ef4444' }}
                    disabled={isAdjusting}
                  >
                    <ArrowDownCircle size={18} /> -1 出庫
                  </button>
                </div>
              )}

              {scanMode === 'stocktake' && (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>実際に数えた数（実数）を入力</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      className="input" 
                      style={{ flex: 1, fontSize: '1.25rem', textAlign: 'center' }} 
                      value={actualCount} 
                      onChange={e => setActualCount(e.target.value)} 
                    />
                    <button 
                      onClick={handleStocktakeSubmit} 
                      className="btn btn-primary" 
                      disabled={isAdjusting || actualCount === ''}
                    >
                      <Check size={18} /> 確定
                    </button>
                  </div>
                </div>
              )}

              <Link href={`/inventory/${foundItem.id}`} className="btn btnSecondary" style={{ width: '100%' }}>
                詳細を見る
              </Link>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p style={{ marginBottom: '1rem' }}>この商品は登録されていません</p>
              <Link href={`/inventory/new?barcode=${result}`} className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={18} /> 新規登録する
              </Link>
            </div>
          )}
        </div>
      )}

      {ocrResult && scanMode === 'ocr' && !loading && (
        <div className="scanResultCard glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#334155' }}>AI読取結果</h3>
            <button onClick={() => setOcrResult(null)} className="logout-btn"><X size={18} /></button>
          </div>
          
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>仕入先: {ocrResult.supplier}</p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>日付: {ocrResult.date}</p>
          </div>

          <table style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.875rem', color: '#64748b' }}>
                <th style={{ padding: '0.5rem 0' }}>商品名</th>
                <th style={{ padding: '0.5rem 0' }}>数量</th>
                <th style={{ padding: '0.5rem 0' }}>単価</th>
              </tr>
            </thead>
            <tbody>
              {ocrResult.items.map((item: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '0.75rem 0' }}>{item.quantity}</td>
                  <td style={{ padding: '0.75rem 0' }}>¥{item.unitPrice.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={submitOcrResult} className="btn btn-primary" style={{ width: '100%' }}>
            <Check size={18} /> この内容で入庫登録する
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <Link href="/inventory" className="btn btnSecondary">
          一覧へ戻る
        </Link>
      </div>
    </div>
  );
}
