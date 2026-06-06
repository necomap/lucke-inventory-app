'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, MapPin, Tag, AlertCircle, Package, Download, Upload } from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/context/AuthContext';
import Papa from 'papaparse';
import './inventory.css';

export default function InventoryListPage() {
  const { isPremium, loading: subLoading } = useSubscription();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    
    try {
      const q = query(collection(db, 'items'), orderBy('lastUpdated', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as InventoryItem[];
        setItems(itemsData);
        setLoading(false);
      }, (error) => {
        console.error("Firestore loading error:", error);
        setLoading(false);
        alert("データの読み込みに失敗しました: " + error.message);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Query setup error:", err);
      setLoading(false);
    }
  }, [user]);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode?.includes(searchTerm) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const csvData = items.map(item => ({
      ID: item.id,
      商品名: item.name,
      バーコード: item.barcode || '',
      カテゴリ: item.category || '',
      保管場所: item.location || '',
      現在庫: item.currentStock,
      単位: item.unit || '',
      発注点: item.minStock,
      状態: item.status,
      備考: item.memo || ''
    }));
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.data && results.data.length > 0) {
          try {
            for (const row of results.data as any[]) {
              // 簡易的に新規追加のみ実装
              const newItemData = {
                name: row['商品名'] || '名称未設定',
                barcode: row['バーコード'] || '',
                category: row['カテゴリ'] || '',
                location: row['保管場所'] || '',
                currentStock: Number(row['現在庫']) || 0,
                unit: row['単位'] || '個',
                minStock: Number(row['発注点']) || 0,
                status: row['状態'] || 'available',
                memo: row['備考'] || '',
                userId: user.uid,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
                updatedBy: user.displayName || user.email || 'Unknown'
              };
              await addDoc(collection(db, 'items'), newItemData);
            }
            alert(`${results.data.length}件のアイテムをインポートしました！`);
          } catch (error) {
            alert('インポート中にエラーが発生しました');
          }
        }
      }
    });
    e.target.value = '';
  };

  return (
    <div>
      <div className="inventoryHeader">
        <h1>在庫一覧</h1>
        <div className="searchBar" style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>
          <div className="input-with-icon" style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="商品名、バーコード、カテゴリで検索..." 
              style={{ 
                padding: '0 1rem 0 44px', 
                width: '100%', 
                height: '44px', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1', 
                boxSizing: 'border-box',
                outline: 'none',
                fontSize: '1rem'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={handleExportCSV} className="btn btnSecondary" title="CSVエクスポート">
              <Download size={18} />
            </button>
            <label className="btn btnSecondary" title="CSVインポート" style={{ cursor: 'pointer', margin: 0 }}>
              <Upload size={18} />
              <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            </label>
            <Link href="/inventory/new" className="btn btn-primary">
              <Plus size={18} />
              新規登録
            </Link>
          </div>
        </div>
      </div>

      <div style={{ margin: '0 0 1.5rem 0', padding: '1rem', background: 'var(--primary-light, #e0e7ff)', border: '1px solid #c7d2fe', borderLeft: '4px solid var(--primary-color, #4f46e5)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <AlertCircle size={20} color="var(--primary-color, #4f46e5)" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--primary-dark, #3730a3)', display: 'block', marginBottom: '0.25rem' }}>HACCPアプリと自動連動中！</strong>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-color, #334155)', display: 'block' }}>HACCPアプリで納品記録を付けると、こちらの在庫数が自動で加算され、入庫履歴も自動記録されます。納品時の入力はHACCPアプリから行うと便利です。</span>
          <a href="https://haccp-app-five.vercel.app/login" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-color, #4f46e5)', textDecoration: 'none' }}>
            HACCPアプリを開く <Package size={14} />
          </a>
        </div>
      </div>

      {isPremium && items.some(item => item.currentStock <= item.minStock) && (
        <div style={{ margin: '0 0 2rem 0', padding: '1rem 1.5rem', background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <AlertCircle size={24} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ color: '#991b1b', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>在庫不足アラート</h3>
            <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.875rem' }}>
              以下のアイテムの在庫が発注点（最小在庫数）を下回っています。
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {items.filter(item => item.currentStock <= item.minStock).map(item => (
                <Link key={item.id} href={`/inventory/${item.id}`} style={{ background: '#fee2e2', color: '#991b1b', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 500 }}>
                  {item.name} (残り {item.currentStock}{item.unit})
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
          <Package size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
          <p>商品が見つかりません</p>
          <Link href="/inventory/new" className="btn btnSecondary" style={{ marginTop: '1rem' }}>
            最初の商品を登録する
          </Link>
        </div>
      ) : (
        <div className="inventoryGrid">
          {filteredItems.map(item => (
            <Link href={`/inventory/${item.id}`} key={item.id} className="itemCard glass-panel">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="itemImage" />
              ) : (
                <div className="itemImage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                  <Package size={48} style={{ margin: 'auto' }} />
                </div>
              )}
              <div className="itemInfo">
                <div className="itemName">{item.name}</div>
                <div className="itemTags">
                  {item.category && (
                    <span className="tag"><Tag size={12} /> {item.category}</span>
                  )}
                  {item.location && (
                    <span className="tag"><MapPin size={12} /> {item.location}</span>
                  )}
                </div>
                
                <div className="stockInfo">
                  <div>
                    <span className="stockLabel">在庫数</span>
                    <div className={`stockCount ${item.currentStock <= item.minStock ? 'lowStock' : ''}`}>
                      {item.currentStock}
                    </div>
                  </div>
                  {item.currentStock <= item.minStock && (
                    <span className="lowStockBadge">
                      <AlertCircle size={12} /> 在庫少
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 広告プレースホルダー（無料プランのみ） */}
      {!isPremium && !subLoading && (
        <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'rgba(0,0,0,0.02)', border: '1px dashed #cbd5e1', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>スポンサーリンク</p>
          <div style={{ width: '100%', maxWidth: '728px', height: '90px', margin: '0 auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
            <span style={{ color: '#94a3b8' }}>ここにGoogle AdSense広告が表示されます</span>
          </div>
        </div>
      )}
    </div>
  );
}
