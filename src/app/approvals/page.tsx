'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { StockTransaction, InventoryItem } from '../../types/inventory';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import './approvals.css';
import { useSubscription } from '@/hooks/useSubscription';

export default function ApprovalsPage() {
  const { isPremium, loading: subLoading } = useSubscription();
  const [pendingTransactions, setPendingTransactions] = useState<(StockTransaction & { itemName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subLoading || !isPremium) {
      setLoading(false);
      return;
    }

    const fetchPending = async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid),
          where('status', '==', 'pending'),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        const transData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockTransaction[];

        // Fetch item names for context
        const enriched = await Promise.all(transData.map(async t => {
          try {
            const itemSnap = await getDocs(query(collection(db, 'items'), where('id', '==', t.itemId)));
            let itemName = 'Unknown Item';
            if (!itemSnap.empty) {
              itemName = (itemSnap.docs[0].data() as InventoryItem).name;
            }
            return { ...t, itemName };
          } catch (e) {
            return { ...t, itemName: 'Unknown Item' };
          }
        }));

        setPendingTransactions(enriched);
      } catch (error) {
        console.error('Failed to fetch pending transactions', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPending();
  }, [subLoading, isPremium]);

  const handleApprove = async (transaction: StockTransaction) => {
    if (!confirm('出庫を承認して在庫を減らしますか？')) return;
    try {
      const transRef = doc(db, 'transactions', transaction.id);
      await updateDoc(transRef, { status: 'approved' });
      
      // Reduce stock
      const itemsQ = query(collection(db, 'items'), where('id', '==', transaction.itemId));
      const itemSnap = await getDocs(itemsQ);
      if (!itemSnap.empty) {
        const itemDoc = itemSnap.docs[0];
        await updateDoc(doc(db, 'items', itemDoc.id), {
          currentStock: increment(-transaction.quantity)
        });
      }
      
      setPendingTransactions(prev => prev.filter(p => p.id !== transaction.id));
      alert('承認しました。在庫が更新されました。');
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました。');
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('出庫を却下しますか？')) return;
    try {
      const transRef = doc(db, 'transactions', id);
      await updateDoc(transRef, { status: 'rejected' });
      setPendingTransactions(prev => prev.filter(p => p.id !== id));
      alert('却下しました。');
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました。');
    }
  };

  if (!isPremium) {
    return (
      <div className="approvals-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>出庫承認ワークフローはプロフェッショナルプラン限定機能です</h2>
        <Link href="/settings" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>プランをアップグレード</Link>
      </div>
    );
  }

  return (
    <div className="approvals-container">
      <header className="approvals-header">
        <h1>出庫承認待ち一覧</h1>
        <Link href="/inventory" className="btn btnSecondary">在庫一覧に戻る</Link>
      </header>

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <div className="table-wrapper">
          <table className="approvals-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>申請者</th>
                <th>アイテム</th>
                <th>数量</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-data">承認待ちの出庫データはありません</td>
                </tr>
              ) : (
                pendingTransactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.date?.toDate ? t.date.toDate().toLocaleString() : 'N/A'}</td>
                    <td>{t.staffName}</td>
                    <td>{t.itemName}</td>
                    <td>{t.quantity}</td>
                    <td className="actions-cell">
                      <button onClick={() => handleApprove(t as StockTransaction)} className="btn-icon btn-approve">
                        <CheckCircle size={18} /> 承認
                      </button>
                      <button onClick={() => handleReject(t.id)} className="btn-icon btn-reject">
                        <XCircle size={18} /> 却下
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
