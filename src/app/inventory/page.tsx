'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Plus, Search, MapPin, Tag, AlertCircle, Package } from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { useSubscription } from '@/hooks/useSubscription';
import './inventory.css';

export default function InventoryListPage() {
  const { isPremium, loading: subLoading } = useSubscription();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setItems(itemsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode.includes(searchTerm) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="inventoryHeader">
        <h1>在庫一覧</h1>
        <div className="searchBar">
          <div className="input-with-icon" style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="商品名、バーコード、カテゴリで検索..." 
              className="input" 
              style={{ paddingLeft: '2.5rem', width: '100%' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link href="/inventory/new" className="btn btn-primary">
            <Plus size={18} />
            新規登録
          </Link>
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
