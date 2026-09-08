'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { InventoryItem } from '@/types/inventory';
import { generateUniqueInternalBarcode } from '@/lib/barcode';
import BarcodeSVG from '@/components/BarcodeSVG';
import { ArrowLeft, Loader2, Wand2, Printer, CheckSquare, Square, Search, AlertTriangle, Package } from 'lucide-react';
import './labels.css';

function LabelsPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [mode, setMode] = useState<'select' | 'print'>('select');

  useEffect(() => {
    const fetchItems = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'items'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
        data.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setItems(data);

        // 商品詳細・編集ページから ?item=... で遷移してきた場合はその商品を選択済みにする
        const presetId = searchParams.get('item');
        if (presetId && data.some(i => i.id === presetId)) {
          setSelected(new Set([presetId]));
          setOnlyMissing(false);
        }
      } catch (error) {
        console.error('Error fetching items for labels:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [user, searchParams]);

  const missingCount = useMemo(() => items.filter(i => !i.barcode).length, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (onlyMissing && item.barcode) return false;
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [items, onlyMissing, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filteredItems.every(i => selected.has(i.id))) {
      setSelected(prev => {
        const next = new Set(prev);
        filteredItems.forEach(i => next.delete(i.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filteredItems.forEach(i => next.add(i.id));
        return next;
      });
    }
  };

  // 選択した商品のうち、バーコード未登録のものにまとめてバーコードを発行する
  const handleIssueBarcodes = async () => {
    if (!user) return;
    const targets = items.filter(i => selected.has(i.id) && !i.barcode);
    if (targets.length === 0) {
      alert('選択した商品の中に、バーコード未登録の商品がありません。');
      return;
    }
    setIssuing(true);
    try {
      const existing = new Set(items.map(i => String(i.barcode || '')).filter(Boolean));
      const batch = writeBatch(db);
      const newCodes: Record<string, string> = {};
      for (const item of targets) {
        const code = generateUniqueInternalBarcode(existing);
        existing.add(code);
        newCodes[item.id] = code;
        batch.update(doc(db, 'items', item.id), {
          barcode: code,
          lastUpdated: serverTimestamp(),
          updatedBy: user.displayName || user.email || 'Unknown',
        });
      }
      await batch.commit();
      setItems(prev => prev.map(i => (newCodes[i.id] ? { ...i, barcode: newCodes[i.id] } : i)));
      alert(`${targets.length}件の商品にバーコードを発行しました。続けて印刷できます。`);
    } catch (error) {
      console.error('Error issuing barcodes:', error);
      alert('バーコードの発行中にエラーが発生しました。');
    } finally {
      setIssuing(false);
    }
  };

  const selectedItems = items.filter(i => selected.has(i.id));
  const printableItems = selectedItems.filter(i => i.barcode);

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /> 読み込み中...</div>;

  if (mode === 'print') {
    return (
      <div className="labelsPrintPage">
        <div className="printToolbar noPrint">
          <button onClick={() => setMode('select')} className="btn btnSecondary">
            <ArrowLeft size={18} /> 選択画面に戻る
          </button>
          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer size={18} /> 印刷する
          </button>
        </div>
        <p className="noPrint" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          A4用紙にラベルを並べて印刷します。プリンターの設定で「余白なし」または「最小」を選ぶと、実寸に近いサイズで印刷できます。
        </p>
        <div className="labelSheet">
          {printableItems.map(item => (
            <div className="labelCard" key={item.id}>
              <div className="labelName">{item.name}</div>
              <BarcodeSVG value={item.barcode} height={45} barWidth={1.6} fontSize={12} />
              {item.category && <div className="labelCategory">{item.category}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="labelsContainer">
      <div className="formHeader">
        <h1><Printer size={24} /> バーコードラベルの発行・印刷</h1>
        <Link href="/inventory" className="btn btnSecondary">
          <ArrowLeft size={18} /> 一覧へ戻る
        </Link>
      </div>

      {missingCount > 0 && (
        <div className="glass-panel labelsBanner">
          <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div>
            <strong>{missingCount}件の商品にバーコードが未登録です。</strong>
            <p>下の一覧から選択して「バーコードを発行する」を押すと、まとめて社内用バーコードを発行できます。仕入れた商品にメーカーのバーコードが無い場合の運用にご利用ください。</p>
          </div>
        </div>
      )}

      <div className="glass-panel labelsToolbar">
        <div className="searchBar" style={{ maxWidth: 'none', flex: 1 }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="商品名で検索"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input"
            style={{ flex: 1, border: 'none', background: 'transparent' }}
          />
        </div>
        <label className="labelsToggle">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
          バーコード未登録のみ表示
        </label>
      </div>

      <div className="glass-panel labelsListPanel">
        <div className="labelsListHeader">
          <button type="button" className="selectAllBtn" onClick={toggleSelectAll}>
            {filteredItems.length > 0 && filteredItems.every(i => selected.has(i.id)) ? <CheckSquare size={18} /> : <Square size={18} />}
            すべて選択 ({filteredItems.length}件)
          </button>
          <span className="label">{selected.size}件選択中</span>
        </div>

        {filteredItems.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>該当する商品がありません。</p>
        ) : (
          <div className="labelsList">
            {filteredItems.map(item => (
              <div key={item.id} className="labelsRow" onClick={() => toggleSelect(item.id)}>
                {selected.has(item.id) ? <CheckSquare size={18} color="var(--primary-color)" /> : <Square size={18} color="var(--text-muted)" />}
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="labelsThumb" />
                ) : (
                  <div className="labelsThumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                    <Package size={16} color="#cbd5e1" />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div className="label" style={{ fontSize: '0.75rem' }}>{item.category || 'カテゴリ未設定'}</div>
                </div>
                {item.barcode ? (
                  <span className="barcodeBadge">{item.barcode}</span>
                ) : (
                  <span className="barcodeBadge barcodeBadgeMissing">未登録</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="labelsActions">
        <button
          className="btn btn-primary"
          onClick={handleIssueBarcodes}
          disabled={issuing || selected.size === 0}
        >
          {issuing ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
          選択した商品にバーコードを発行する
        </button>
        <button
          className="btn btnSecondary"
          onClick={() => setMode('print')}
          disabled={printableItems.length === 0}
        >
          <Printer size={18} /> 選択した商品のラベルを印刷する ({printableItems.length}件)
        </button>
      </div>
    </div>
  );
}

export default function LabelsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>}>
      <LabelsPageInner />
    </Suspense>
  );
}
