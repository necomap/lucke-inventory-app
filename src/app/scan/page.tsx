'use client';

import React, { useState, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { InventoryItem } from '@/types/inventory';
import { useAuth } from '@/context/AuthContext';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { Package, Plus, ScanLine, X, Check, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import Link from 'next/link';
import './scan.css';

export default function ScanPage() {
  const { user } = useAuth();
  const { playSuccessSound, triggerVibration } = useInventorySettings();
  const [result, setResult] = useState<string | null>(null);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

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
      const q = query(collection(db, 'items'), where('barcode', '==', barcode));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const itemDoc = querySnapshot.docs[0];
        setFoundItem({ id: itemDoc.id, ...itemDoc.data() } as InventoryItem);
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
        type: type,
        quantity: 1,
        unitPrice: 0,
        date: serverTimestamp(),
        staffName: user.displayName || user.email || 'Unknown',
        memo: `クイックスキャン${type === 'in' ? '入庫' : '出庫'}`
      });

      // 状態を更新して完了表示
      setFoundItem(prev => prev ? { ...prev, currentStock: prev.currentStock + (type === 'in' ? 1 : -1) } : null);
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="scanContainer">
      <div className="formHeader" style={{ textAlign: 'center' }}>
        <h1>バーコードスキャン</h1>
        <p className="label">枠の中にバーコードを合わせてください</p>
      </div>

      <div className="videoWrapper">
        <video ref={ref} className="scannerVideo" />
        <div className="scanOverlay">
          <div className="scanTarget" />
        </div>
      </div>

      {loading && <div className="glass-panel" style={{ padding: '1.5rem' }}><Loader2 className="animate-spin" /></div>}

      {result && !loading && (
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

              <div style={{ display: 'flex', gap: '0.75rem' }}>
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

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <Link href="/inventory" className="btn btnSecondary">
          一覧へ戻る
        </Link>
      </div>
    </div>
  );
}
