'use client';

// app/suppliers/page.tsx
// ============================================================
// 2026-09新設: 仕入先マスタ管理ページ。
//
// ここで登録した仕入先名（Supplier.name）と、商品登録フォームの「主な仕入先」
// （InventoryItem.supplierName、自由入力）を完全一致で突き合わせて、
// 発注点を下回った商品をまとめた発注書を作成できるようにする（/suppliers/[id]/order）。
// 商品側の入力を厳密なリスト選択に変えると既存データとの互換が崩れるため、
// あえて自由入力のままにし、こちらのページで一覧管理する形にしている。

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Truck, Plus, Trash2, Edit3, Save, X, Mail, Phone, MapPin, FileText, ClipboardList } from 'lucide-react';
import { Supplier } from '@/types/inventory';
import { useAuth } from '@/context/AuthContext';

const emptyForm = { name: '', email: '', phone: '', address: '', memo: '' };

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'suppliers'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Supplier[];
      data.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setSuppliers(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({ name: s.name, email: s.email || '', phone: s.phone || '', address: s.address || '', memo: s.memo || '' });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) {
      alert('仕入先名を入力してください。');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'suppliers', editingId), {
          name,
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          memo: form.memo.trim(),
        });
      } else {
        await addDoc(collection(db, 'suppliers'), {
          userId: user.uid,
          name,
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          memo: form.memo.trim(),
          createdAt: serverTimestamp(),
        });
      }
      cancelForm();
    } catch (error) {
      console.error('Supplier save error:', error);
      alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この仕入先を削除しますか？（商品側の「主な仕入先」入力はそのまま残ります）')) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
    } catch (error) {
      console.error('Supplier delete error:', error);
      alert('削除に失敗しました。');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="formHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Truck size={24} /> 仕入先管理
        </h1>
        {!showForm && (
          <button onClick={startAdd} className="btn btn-primary">
            <Plus size={18} /> 仕入先を追加
          </button>
        )}
      </div>

      <p className="helpText" style={{ marginBottom: '1.5rem' }}>
        ここで登録した名前を、商品登録フォームの「主な仕入先」欄に同じ表記で入力しておくと、発注点を下回った商品をまとめて発注書として出力・メール送信できるようになります。
      </p>

      {showForm && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className="settingsTitle" style={{ fontSize: '1rem' }}>{editingId ? '仕入先を編集' : '仕入先を追加'}</h2>
          <div>
            <label className="label">仕入先名（必須）</label>
            <input className="input" style={{ width: '100%', marginTop: '0.25rem' }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例: ○○商事" />
          </div>
          <div>
            <label className="label">メールアドレス（発注書の送信先）</label>
            <input className="input" style={{ width: '100%', marginTop: '0.25rem' }} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="order@example.com" />
          </div>
          <div>
            <label className="label">電話番号</label>
            <input className="input" style={{ width: '100%', marginTop: '0.25rem' }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">住所</label>
            <input className="input" style={{ width: '100%', marginTop: '0.25rem' }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">メモ</label>
            <textarea className="input" style={{ width: '100%', marginTop: '0.25rem', minHeight: '60px' }} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={cancelForm} className="btn btnSecondary" disabled={saving}><X size={16} /> キャンセル</button>
            <button onClick={handleSave} className="btn btn-primary" disabled={saving}><Save size={16} /> 保存</button>
          </div>
        </div>
      )}

      {suppliers.length === 0 && !showForm ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Truck size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <p>仕入先がまだ登録されていません。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {suppliers.map((s) => (
            <div key={s.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {s.email && <span><Mail size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />{s.email}</span>}
                  {s.phone && <span><Phone size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />{s.phone}</span>}
                  {s.address && <span><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />{s.address}</span>}
                </div>
                {s.memo && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{s.memo}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <Link href={`/suppliers/${s.id}/order`} className="btn btnSecondary" style={{ fontSize: '0.8rem' }}>
                  <ClipboardList size={16} /> 発注書
                </Link>
                <button onClick={() => startEdit(s)} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }} title="編集">
                  <Edit3 size={18} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="削除">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
