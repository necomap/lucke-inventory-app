'use client';

// app/suppliers/[id]/order/page.tsx
// ============================================================
// 2026-09新設: 仕入先ごとの発注書作成ページ。
// その仕入先を「主な仕入先」に指定している商品を一覧表示し、発注点（minStock）を
// 下回っている商品をあらかじめチェック・推奨数量で表示する。数量は自由に編集可能。
// 「印刷/PDF保存」はブラウザの印刷機能を使う（他ページのラベル印刷と同じ方式で、
// 新しいライブラリを追加せずに済むようにしている）。「メールで送信」は
// /api/purchase-order/send を呼び、仕入先のメールアドレス宛に内容を送信する。

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Printer, Mail, Loader2, Package } from 'lucide-react';
import { InventoryItem, Supplier } from '@/types/inventory';
import { useAuth } from '@/context/AuthContext';

interface OrderLine {
  item: InventoryItem;
  selected: boolean;
  quantity: number;
}

export default function SupplierOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchSupplier = async () => {
      const snap = await getDoc(doc(db, 'suppliers', id));
      if (!snap.exists()) {
        alert('仕入先が見つかりませんでした。');
        router.push('/suppliers');
        return;
      }
      setSupplier({ id: snap.id, ...snap.data() } as Supplier);
    };
    fetchSupplier();

    const q = query(collection(db, 'items'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
      setLines((prev) => {
        // 既にチェック状態・数量を編集済みの行はそのまま維持しつつ、商品一覧の更新を反映する
        const prevMap = new Map(prev.map((l) => [l.item.id, l]));
        return items.map((item) => {
          const existing = prevMap.get(item.id);
          if (existing) return { ...existing, item };
          const lowStock = item.currentStock <= item.minStock;
          const suggested = Math.max(1, item.minStock - item.currentStock) || 1;
          return { item, selected: lowStock, quantity: suggested };
        });
      });
      setLoading(false);
    });

    return () => unsub();
  }, [user, id, router]);

  // supplierが取れてから、名前が一致する商品だけに絞り込む（前後空白は無視）
  const supplierLines = supplier
    ? lines.filter((l) => (l.item.supplierName || '').trim() === supplier.name.trim())
    : [];

  const toggleSelected = (itemId: string) => {
    setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, selected: !l.selected } : l)));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, quantity } : l)));
  };

  const selectedLines = supplierLines.filter((l) => l.selected && l.quantity > 0);

  const handleSendEmail = async () => {
    if (!user || !supplier) return;
    if (!supplier.email) {
      alert('この仕入先にはメールアドレスが登録されていません。仕入先管理画面から追加してください。');
      return;
    }
    if (selectedLines.length === 0) {
      alert('発注する商品を1つ以上選択してください。');
      return;
    }
    setSending(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/purchase-order/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          supplierId: supplier.id,
          memo,
          items: selectedLines.map((l) => ({ name: l.item.name, quantity: l.quantity, unit: l.item.unit })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('発注書を仕入先にメール送信しました。');
      } else {
        alert(data.error || '送信に失敗しました。');
      }
    } catch (error) {
      console.error('Purchase order send error:', error);
      alert('送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  if (loading || !supplier) return <div style={{ textAlign: 'center', padding: '4rem' }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="formHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href="/suppliers" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <ArrowLeft size={14} /> 仕入先一覧に戻る
          </Link>
          <h1>発注書作成: {supplier.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.print()} className="btn btnSecondary">
            <Printer size={18} /> 印刷 / PDF保存
          </button>
          <button onClick={handleSendEmail} className="btn btn-primary" disabled={sending}>
            {sending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
            仕入先にメール送信
          </button>
        </div>
      </div>

      {!supplier.email && (
        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa' }}>
          この仕入先にはメールアドレスが未登録です。メール送信するには<Link href="/suppliers" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>仕入先管理画面</Link>で追加してください（印刷/PDF保存は今のままでも使えます）。
        </div>
      )}

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          発注日: {new Date().toLocaleDateString('ja-JP')} ／ 発注元: {user?.displayName || user?.email}
        </p>

        {supplierLines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Package size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p>「主な仕入先」に「{supplier.name}」と入力されている商品がありません。</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>商品登録・編集画面の「主な仕入先」欄に、この仕入先名と完全に同じ表記で入力すると、ここに表示されます。</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}></th>
                <th style={{ padding: '0.5rem' }}>商品名</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>現在庫</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>発注点</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>発注数量</th>
              </tr>
            </thead>
            <tbody>
              {supplierLines.map((l) => (
                <tr key={l.item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="checkbox" checked={l.selected} onChange={() => toggleSelected(l.item.id)} />
                  </td>
                  <td style={{ padding: '0.5rem', fontWeight: l.item.currentStock <= l.item.minStock ? 700 : 400 }}>
                    {l.item.name}
                    {l.item.currentStock <= l.item.minStock && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#ef4444' }}>発注点以下</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{l.item.currentStock} {l.item.unit}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{l.item.minStock} {l.item.unit}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                    <input
                      type="number"
                      min={0}
                      value={l.quantity}
                      onChange={(e) => updateQuantity(l.item.id, Number(e.target.value))}
                      style={{ width: '70px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', textAlign: 'right' }}
                      disabled={!l.selected}
                    />
                    <span style={{ marginLeft: '0.25rem', fontSize: '0.85rem' }}>{l.item.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '1.5rem' }}>
          <label className="label">備考（納期のご希望など、仕入先への伝言）</label>
          <textarea
            className="input"
            style={{ width: '100%', marginTop: '0.25rem', minHeight: '80px' }}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
