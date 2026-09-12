'use client';

// app/expiry/page.tsx
// ============================================================
// 2026-09新設: 賞味期限アラートページ。
//
// StockTransaction.bestBefore（入庫時に記録した賞味期限）と、商品ごとの
// currentStock（現在庫数）から、lib/expiry.ts の getUpcomingExpiries で
// 「今、期限が近いと推定される在庫」を算出して一覧表示する。
//
// 前提: 設定画面の「HACCP連携項目を表示」がONになっていないと、そもそも
// 入庫時にlotNo/bestBeforeを入力する欄が出ないため、このページに表示される
// データも無い（＝食品を扱わない業態では自然と使わない機能になる）。

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CalendarClock, AlertCircle, Package, MapPin, Tag } from 'lucide-react';
import { InventoryItem, StockTransaction } from '@/types/inventory';
import { useAuth } from '@/context/AuthContext';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { getUpcomingExpiries, ExpiringLotEntry } from '@/lib/expiry';

const THRESHOLD_OPTIONS = [3, 7, 14, 30];

function urgencyStyle(days: number): { bg: string; border: string; color: string; label: string } {
  if (days < 0) {
    return { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', label: '期限切れ' };
  }
  if (days <= 3) {
    return { bg: '#fff7ed', border: '#fed7aa', color: '#9a3412', label: 'まもなく期限' };
  }
  if (days <= 7) {
    return { bg: '#fffbeb', border: '#fde68a', color: '#92400e', label: '要注意' };
  }
  return { bg: 'rgba(0,0,0,0.02)', border: '#e2e8f0', color: 'var(--text-muted)', label: '' };
}

export default function ExpiryPage() {
  const { user } = useAuth();
  const { settings } = useInventorySettings();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholdDays, setThresholdDays] = useState(7);

  useEffect(() => {
    if (!user) return;

    const itemsQ = query(collection(db, 'items'), where('userId', '==', user.uid));
    const unsubItems = onSnapshot(itemsQ, (snapshot) => {
      setItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[]);
    });

    const transQ = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubTrans = onSnapshot(transQ, (snapshot) => {
      setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as StockTransaction[]);
      setLoading(false);
    });

    return () => {
      unsubItems();
      unsubTrans();
    };
  }, [user]);

  const expiring: ExpiringLotEntry[] = React.useMemo(() => {
    const transByItem = new Map<string, StockTransaction[]>();
    for (const t of transactions) {
      if (!t.itemId) continue;
      if (!transByItem.has(t.itemId)) transByItem.set(t.itemId, []);
      transByItem.get(t.itemId)!.push(t);
    }

    const itemInputs = items.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      location: item.location,
      unit: item.unit,
      currentStock: item.currentStock,
      transactions: transByItem.get(item.id) || [],
    }));

    return getUpcomingExpiries(itemInputs, thresholdDays);
  }, [items, transactions, thresholdDays]);

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}>読み込み中...</div>;

  return (
    <div>
      <div className="formHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarClock size={24} /> 賞味期限アラート
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="threshold" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>表示期間</label>
          <select
            id="threshold"
            value={thresholdDays}
            onChange={(e) => setThresholdDays(Number(e.target.value))}
            className="input"
            style={{ padding: '0.4rem 0.75rem' }}
          >
            {THRESHOLD_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}日以内</option>
            ))}
          </select>
        </div>
      </div>

      {!settings?.enableHaccpFields && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertCircle size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>賞味期限の入力が無効になっています</strong>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Link href="/settings" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>設定画面</Link>で「HACCP連携項目を表示」をONにすると、入庫時に賞味期限・ロット番号を記録できるようになり、このページに反映されます。
            </span>
          </div>
        </div>
      )}

      <p className="helpText" style={{ marginBottom: '1.5rem' }}>
        入庫時に記録した賞味期限と現在の在庫数から、先入先出（FIFO）の考え方で「今、期限が近いと推定される在庫」を一覧表示しています。実際の出庫順によっては推定とズレる場合があるため、目安としてご活用ください。
      </p>

      {expiring.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CalendarClock size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <p>{thresholdDays}日以内に期限を迎える在庫はありません。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {expiring.map((entry, idx) => {
            const style = urgencyStyle(entry.daysUntilExpiry);
            return (
              <Link
                key={`${entry.itemId}-${entry.bestBefore}-${idx}`}
                href={`/inventory/${entry.itemId}`}
                className="glass-panel"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Package size={16} />
                    {entry.itemName}
                    {style.label && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: style.color, color: 'white' }}>
                        {style.label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {entry.category && <span><Tag size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />{entry.category}</span>}
                    {entry.location && <span><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />{entry.location}</span>}
                    {entry.lotNo && <span>ロット: {entry.lotNo}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: style.color }}>
                    {entry.daysUntilExpiry < 0
                      ? `${Math.abs(entry.daysUntilExpiry)}日前に期限切れ`
                      : entry.daysUntilExpiry === 0
                      ? '本日が期限'
                      : `あと${entry.daysUntilExpiry}日`}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {entry.bestBefore} / 推定 {entry.quantity} {entry.unit}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
