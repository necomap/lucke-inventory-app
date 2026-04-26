'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ArrowLeft, 
  Edit, 
  History, 
  Package, 
  MapPin, 
  Tag, 
  Barcode, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Calendar,
  User,
  Calculator,
  Truck,
  Hash
} from 'lucide-react';
import { InventoryItem, StockTransaction } from '@/types/inventory';
import { useAuth } from '@/context/AuthContext';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { calculateFIFO, calculateMovingAverage } from '@/lib/valuation';
import dayjs from 'dayjs';
import './item-detail.css';

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { settings } = useInventorySettings();
  const router = useRouter();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 入出庫操作用
  const [actionType, setActionType] = useState<'in' | 'out' | null>(null);
  const [actionQty, setActionQty] = useState(1);
  const [actionPrice, setActionPrice] = useState(0);
  const [actionMemo, setActionMemo] = useState('');
  const [actionLotNo, setActionLotNo] = useState('');
  const [actionBestBefore, setActionBestBefore] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const itemRef = doc(db, 'items', id);
    const unsubscribeItem = onSnapshot(itemRef, (doc) => {
      if (doc.exists()) {
        setItem({ id: doc.id, ...doc.data() } as InventoryItem);
      } else {
        router.push('/inventory');
      }
      setLoading(false);
    });

    const q = query(
      collection(db, 'transactions'), 
      where('itemId', '==', id),
      orderBy('date', 'desc')
    );
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockTransaction[];
      setTransactions(transData);
    });

    return () => {
      unsubscribeItem();
      unsubscribeTrans();
    };
  }, [id, router]);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !item || !actionType) return;
    setIsSubmitting(true);

    try {
      // 1. 在庫数の更新
      const itemRef = doc(db, 'items', id);
      await updateDoc(itemRef, {
        currentStock: increment(actionType === 'in' ? actionQty : -actionQty),
        lastUpdated: serverTimestamp(),
        updatedBy: user.displayName || user.email || 'Unknown'
      });

      // 2. 履歴の追加
      await addDoc(collection(db, 'transactions'), {
        itemId: id,
        type: actionType,
        quantity: actionQty,
        unitPrice: actionType === 'in' ? actionPrice : 0,
        date: serverTimestamp(),
        staffName: user.displayName || user.email || 'Unknown',
        memo: actionMemo,
        lotNo: actionType === 'in' ? actionLotNo : '',
        bestBefore: actionType === 'in' ? actionBestBefore : '',
      });

      setActionType(null);
      setActionQty(1);
      setActionPrice(0);
      setActionMemo('');
      setActionLotNo('');
      setActionBestBefore('');
    } catch (error) {
      console.error('Transaction error:', error);
      alert('エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}>読み込み中...</div>;
  if (!item) return null;

  const fifoValue = calculateFIFO(transactions, item.currentStock);
  const movingAvgValue = calculateMovingAverage(transactions);

  return (
    <div className="detailContainer">
      <div className="formHeader">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.push('/inventory')} className="btn btnSecondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} />
          </button>
          <h1>商品詳細</h1>
        </div>
        <button onClick={() => alert('編集機能は開発中です')} className="btn btnSecondary">
          <Edit size={18} />
          編集
        </button>
      </div>

      <div className="detailLayout">
        <div className="detailSidebar">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="detailImage" />
          ) : (
            <div className="detailImage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
              <Package size={64} />
            </div>
          )}

          <div className="glass-panel actionPanel" style={{ marginTop: '1.5rem' }}>
            <div className="stockStatus">
              <span className="infoLabel">現在の在庫数</span>
              <span className={`stockCount ${item.currentStock <= item.minStock ? 'lowStock' : ''}`} style={{ fontSize: '2rem' }}>
                {item.currentStock}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setActionType('in')} className="btn btn-primary" style={{ flex: 1 }}>
                <ArrowUpCircle size={18} /> 入庫
              </button>
              <button onClick={() => setActionType('out')} className="btn btnSecondary" style={{ flex: 1, color: '#ef4444' }}>
                <ArrowDownCircle size={18} /> 出庫
              </button>
            </div>
          </div>

          <div className="glass-panel actionPanel" style={{ marginTop: '1rem' }}>
            <h3 className="valLabel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Calculator size={16} /> 在庫評価額
            </h3>
            <div className="valuationBox">
              <span className="valLabel">先入先出 (FIFO)</span>
              <span className="valAmount">¥{fifoValue.toLocaleString()}</span>
            </div>
            <div className="valuationBox" style={{ marginTop: '0.5rem' }}>
              <span className="valLabel">移動平均</span>
              <span className="valAmount">¥{Math.round(movingAvgValue).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="detailContent">
          {actionType && (
            <div className="glass-panel" style={{ padding: '1.5rem', border: `2px solid ${actionType === 'in' ? 'var(--primary-color)' : '#ef4444'}` }}>
              <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {actionType === 'in' ? <ArrowUpCircle color="var(--primary-color)" /> : <ArrowDownCircle color="#ef4444" />}
                {actionType === 'in' ? '商品の入庫' : '商品の出庫'}
              </h2>
              <form onSubmit={handleTransaction} className="formGrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="formGroup">
                  <label className="label">数量</label>
                  <input type="number" min="1" value={actionQty} onChange={e => setActionQty(Number(e.target.value))} className="input" required />
                </div>
                {actionType === 'in' && (
                  <div className="formGroup">
                    <label className="label">仕入単価 (円)</label>
                    <input type="number" min="0" value={actionPrice} onChange={e => setActionPrice(Number(e.target.value))} className="input" required />
                  </div>
                )}
                {actionType === 'in' && settings?.enableHaccpFields && (
                  <>
                    <div className="formGroup">
                      <label className="label">ロット番号</label>
                      <input type="text" value={actionLotNo} onChange={e => setActionLotNo(e.target.value)} className="input" placeholder="例: L-1234" />
                    </div>
                    <div className="formGroup">
                      <label className="label">賞味期限</label>
                      <input type="date" value={actionBestBefore} onChange={e => setActionBestBefore(e.target.value)} className="input" />
                    </div>
                  </>
                )}
                <div className="formGroup" style={{ gridColumn: (actionType === 'in' && settings?.enableHaccpFields) ? 'span 3' : (actionType === 'in' ? 'auto' : 'span 2') }}>
                  <label className="label">備考</label>
                  <input type="text" value={actionMemo} onChange={e => setActionMemo(e.target.value)} className="input" placeholder="理由など" />
                </div>
                <div className="formGroup fullWidth" style={{ display: 'flex', flexDirection: 'row', gap: '1rem', marginTop: '1rem', gridColumn: '1 / -1' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                    確定
                  </button>
                  <button type="button" onClick={() => setActionType(null)} className="btn btnSecondary" style={{ flex: 1 }}>
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="glass-panel infoSection" style={{ padding: '1.5rem' }}>
            <h2><Package size={20} /> 基本情報</h2>
            <div className="infoGrid">
              <div className="infoItem">
                <span className="infoLabel">商品名</span>
                <span className="infoValue">{item.name}</span>
              </div>
              <div className="infoItem">
                <span className="infoLabel">単位</span>
                <span className="infoValue">{item.unit || '-'}</span>
              </div>
              <div className="infoItem">
                <span className="infoLabel">バーコード</span>
                <span className="infoValue">{item.barcode || '未設定'}</span>
              </div>
              <div className="infoItem">
                <span className="infoLabel">カテゴリ</span>
                <span className="infoValue"><Tag size={14} /> {item.category || '未設定'}</span>
              </div>
              <div className="infoItem">
                <span className="infoLabel">保管場所</span>
                <span className="infoValue"><MapPin size={14} /> {item.location || '未設定'}</span>
              </div>
              <div className="infoItem">
                <span className="infoLabel">状態</span>
                <span className="infoValue">{item.status}</span>
              </div>
              <div className="infoItem">
                <span className="infoLabel">最低在庫数</span>
                <span className="infoValue">{item.minStock}</span>
              </div>
              <div className="infoItem fullWidth" style={{ gridColumn: 'span 2' }}>
                <span className="infoLabel">備考</span>
                <span className="infoValue">{item.memo || 'なし'}</span>
              </div>
            </div>
          </div>

          <div className="glass-panel infoSection" style={{ padding: '1.5rem' }}>
            <h2><History size={20} /> 入出庫履歴</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="historyTable">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>種別</th>
                    <th>数量</th>
                    <th>単価/理由</th>
                    {settings?.enableHaccpFields && <th>詳細(ロット/賞味期限)</th>}
                    <th>スタッフ</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>{dayjs(t.date?.toDate()).format('YYYY/MM/DD HH:mm')}</td>
                      <td>
                        <span className={t.type === 'in' ? 'typeIn' : 'typeOut'}>
                          {t.type === 'in' ? '入庫' : '出庫'}
                        </span>
                      </td>
                      <td>{t.quantity} {item.unit}</td>
                      <td>
                        {t.type === 'in' ? `¥${t.unitPrice.toLocaleString()}` : t.memo}
                      </td>
                      {settings?.enableHaccpFields && (
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {t.lotNo ? `Lot: ${t.lotNo}` : ''}
                          {t.lotNo && t.bestBefore ? ' / ' : ''}
                          {t.bestBefore ? `期限: ${t.bestBefore}` : ''}
                        </td>
                      )}
                      <td><User size={12} /> {t.staffName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
