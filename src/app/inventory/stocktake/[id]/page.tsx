'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZxing } from 'react-zxing';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { getPlanLimits } from '@/lib/plan-limits';
import { db } from '@/lib/firebase';
import {
  doc, onSnapshot, collection, query, where, getDocs, updateDoc, increment,
  serverTimestamp, writeBatch, deleteDoc,
} from 'firebase/firestore';
import { logAction } from '@/lib/audit';
import { StocktakeSession, StocktakeEntry } from '@/types/inventory';
import {
  ArrowLeft, Loader2, ScanLine, Search, Check, X, AlertTriangle, CheckCircle2,
  Download, Ban, ClipboardCheck, Rocket, Plus, PackageSearch,
} from 'lucide-react';
import Papa from 'papaparse';
import '../../new/inventory-form.css';
import '../stocktake.css';

export default function StocktakeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { plan, loading: subLoading } = useSubscription();
  const { playSuccessSound, triggerVibration } = useInventorySettings();
  const router = useRouter();

  const [session, setSession] = useState<StocktakeSession | null>(null);
  const [entries, setEntries] = useState<StocktakeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEntry, setActiveEntry] = useState<StocktakeEntry | null>(null);
  const [countValue, setCountValue] = useState<number | string>('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'uncounted' | 'counted'>('uncounted');
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const canUse = getPlanLimits(plan).canUseStocktakeSessions;
  const staffName = user?.displayName || user?.email || 'Unknown';

  useEffect(() => {
    if (!user || !canUse) {
      return;
    }
    const sessionRef = doc(db, 'stocktakeSessions', id);
    const unsubSession = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        setSession({ id: snap.id, ...snap.data() } as StocktakeSession);
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    const entriesQuery = query(collection(db, 'stocktakeEntries'), where('sessionId', '==', id));
    const unsubEntries = onSnapshot(entriesQuery, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as StocktakeEntry));
      data.sort((a, b) => a.itemName.localeCompare(b.itemName, 'ja'));
      setEntries(data);
    });

    return () => {
      unsubSession();
      unsubEntries();
    };
  }, [id, user, canUse]);

  const { ref: scannerRef } = useZxing({
    paused: !session || session.status !== 'in_progress' || !!activeEntry,
    onResult(res) {
      const text = res.getText();
      if (text === lastScanned) return;
      setLastScanned(text);
      handleScan(text);
    },
  });

  const handleScan = async (barcode: string) => {
    playSuccessSound();
    triggerVibration();
    setNotFoundBarcode(null);

    const entry = entries.find(e => e.barcode && e.barcode === barcode);
    if (entry) {
      openCountCard(entry);
      return;
    }

    // このセッションの対象には含まれていないが、商品自体は登録されているかもしれない
    // （拠点の絞り込みで除外された、または棚卸開始後に登録された商品など）
    if (user) {
      try {
        const q = query(collection(db, 'items'), where('userId', '==', user.uid), where('barcode', '==', barcode));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setNotFoundBarcode(barcode);
          return;
        }
      } catch (error) {
        console.error('Barcode lookup error:', error);
      }
    }
    setNotFoundBarcode(barcode);
  };

  const openCountCard = (entry: StocktakeEntry) => {
    setActiveEntry(entry);
    setCountValue(entry.countedStock ?? entry.expectedStock);
    setNotFoundBarcode(null);
  };

  const handleAddItemToSession = async (barcode: string) => {
    if (!user || !session) return;
    try {
      const q = query(collection(db, 'items'), where('userId', '==', user.uid), where('barcode', '==', barcode));
      const snap = await getDocs(q);
      if (snap.empty) return;
      const itemDoc = snap.docs[0];
      const item = itemDoc.data();

      const entryRef = doc(collection(db, 'stocktakeEntries'));
      const batch = writeBatch(db);
      batch.set(entryRef, {
        sessionId: session.id,
        userId: user.uid,
        itemId: itemDoc.id,
        itemName: item.name || '',
        barcode: item.barcode || '',
        unit: item.unit || '',
        category: item.category || '',
        location: item.location || '',
        unitPrice: item.unitPrice || 0,
        expectedStock: item.currentStock || 0,
        countedStock: null,
        diff: null,
      });
      batch.update(doc(db, 'stocktakeSessions', session.id), { totalItems: increment(1) });
      await batch.commit();
      setNotFoundBarcode(null);
    } catch (error) {
      console.error('Error adding item to session:', error);
      alert('商品の追加に失敗しました。');
    }
  };

  const handleRecordCount = async () => {
    if (!activeEntry || countValue === '' || !session) return;
    const counted = Number(countValue);
    if (isNaN(counted) || counted < 0) return;

    setSubmitting(true);
    try {
      const diff = counted - activeEntry.expectedStock;
      const wasCounted = activeEntry.countedStock !== null;
      const wasDiscrepancy = wasCounted && activeEntry.diff !== 0;
      const isDiscrepancyNow = diff !== 0;

      await updateDoc(doc(db, 'stocktakeEntries', activeEntry.id), {
        countedStock: counted,
        diff,
        countedAt: serverTimestamp(),
        countedBy: staffName,
      });

      await updateDoc(doc(db, 'stocktakeSessions', session.id), {
        countedItems: increment(wasCounted ? 0 : 1),
        discrepancyItems: increment((isDiscrepancyNow ? 1 : 0) - (wasDiscrepancy ? 1 : 0)),
      });

      setActiveEntry(null);
      setCountValue('');
      setLastScanned(null);
    } catch (error) {
      console.error('Error recording count:', error);
      alert('記録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (!session || !user) return;
    const uncountedCount = entries.filter(e => e.countedStock === null).length;
    const discrepantEntries = entries.filter(e => e.countedStock !== null && e.diff !== 0);

    const confirmMsg = uncountedCount > 0
      ? `未カウントの商品が${uncountedCount}件あります。未カウントの商品は在庫を変更せずに棚卸を確定しますが、よろしいですか？`
      : 'この内容で棚卸を確定します。差異のある商品の在庫が調整されます。よろしいですか？';
    if (!confirm(confirmMsg)) return;

    setFinalizing(true);
    try {
      const chunkSize = 200; // 差異1件につき2回の書き込み(在庫更新+履歴追加)なので余裕を持って分割
      for (let i = 0; i < discrepantEntries.length; i += chunkSize) {
        const chunk = discrepantEntries.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const entry of chunk) {
          const diff = entry.diff || 0;
          batch.update(doc(db, 'items', entry.itemId), {
            currentStock: increment(diff),
            lastUpdated: serverTimestamp(),
            updatedBy: staffName,
          });
          const txRef = doc(collection(db, 'transactions'));
          batch.set(txRef, {
            itemId: entry.itemId,
            userId: user.uid,
            type: diff > 0 ? 'in' : 'out',
            quantity: Math.abs(diff),
            unitPrice: 0,
            date: serverTimestamp(),
            staffName,
            memo: `棚卸調整（${session.name}／理論値 ${entry.expectedStock}${entry.unit} → 実測値 ${entry.countedStock}${entry.unit}）`,
          });
        }
        await batch.commit();
      }

      const totalDiffValue = discrepantEntries.reduce(
        (sum, e) => sum + (e.diff || 0) * (e.unitPrice || 0), 0
      );

      await updateDoc(doc(db, 'stocktakeSessions', session.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: staffName,
        discrepancyItems: discrepantEntries.length,
        totalDiffValue,
      });

      await logAction(
        'UPDATE',
        'STOCKTAKE',
        session.id,
        user.uid,
        staffName,
        `棚卸「${session.name}」を確定しました（カウント済み ${entries.filter(e => e.countedStock !== null).length}/${entries.length}件、差異 ${discrepantEntries.length}件）`
      );
    } catch (error) {
      console.error('Error finalizing stocktake:', error);
      alert('棚卸の確定に失敗しました。');
    } finally {
      setFinalizing(false);
    }
  };

  const handleCancelSession = async () => {
    if (!session) return;
    if (!confirm('この棚卸を破棄します。カウントした内容はすべて失われ、在庫には一切反映されません。よろしいですか？')) return;
    setCancelling(true);
    try {
      const chunkSize = 400;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(e => batch.delete(doc(db, 'stocktakeEntries', e.id)));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'stocktakeSessions', session.id));
      router.push('/inventory/stocktake');
    } catch (error) {
      console.error('Error cancelling stocktake:', error);
      alert('破棄に失敗しました。');
      setCancelling(false);
    }
  };

  const handleExportCSV = () => {
    if (!session) return;
    const csvData = entries.map(e => ({
      商品名: e.itemName,
      バーコード: e.barcode || '',
      カテゴリ: e.category || '',
      拠点: e.location || '',
      単位: e.unit || '',
      理論値: e.expectedStock,
      実測値: e.countedStock ?? '未カウント',
      差異: e.diff ?? '',
      差異金額: e.diff !== null ? (e.diff * (e.unitPrice || 0)) : '',
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${session.name}_棚卸結果.csv`;
    link.click();
  };

  const filteredSearchResults = useMemo(() => {
    if (!searchTerm) return [];
    return entries.filter(e => e.itemName.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 20);
  }, [entries, searchTerm]);

  const uncountedEntries = useMemo(() => entries.filter(e => e.countedStock === null), [entries]);
  const countedEntries = useMemo(() => entries.filter(e => e.countedStock !== null), [entries]);

  const reportSortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aDiscrepant = a.diff !== null && a.diff !== 0;
      const bDiscrepant = b.diff !== null && b.diff !== 0;
      if (aDiscrepant !== bDiscrepant) return aDiscrepant ? -1 : 1;
      return a.itemName.localeCompare(b.itemName, 'ja');
    });
  }, [entries]);

  if (subLoading) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>;
  }

  if (!canUse) {
    return (
      <div className="stocktakeContainer">
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <AlertTriangle size={22} color="#ea580c" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#9a3412', display: 'block', marginBottom: '0.5rem' }}>本格棚卸セッションはプロプラン限定機能です</strong>
            <Link href="/upgrade" className="btn btn-primary" style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
              <Rocket size={18} /> プロプランを見る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>;
  }

  if (!session) {
    return (
      <div className="stocktakeContainer">
        <p>この棚卸セッションは見つかりませんでした。</p>
        <Link href="/inventory/stocktake" className="btn btnSecondary"><ArrowLeft size={18} /> 棚卸一覧へ戻る</Link>
      </div>
    );
  }

  // ============================================================
  // 完了済みセッション: 読み取り専用のレポート表示
  // ============================================================
  if (session.status === 'completed') {
    return (
      <div className="stocktakeContainer">
        <div className="formHeader">
          <h1><ClipboardCheck size={24} /> {session.name}</h1>
          <Link href="/inventory/stocktake" className="btn btnSecondary"><ArrowLeft size={18} /> 一覧へ戻る</Link>
        </div>

        <div className="stocktakeStatGrid">
          <div className="glass-panel stocktakeStatCard">
            <div className="stocktakeStatValue">{session.countedItems} / {session.totalItems}</div>
            <div className="label">カウント済み</div>
          </div>
          <div className="glass-panel stocktakeStatCard">
            <div className="stocktakeStatValue" style={{ color: session.discrepancyItems > 0 ? '#ef4444' : '#10b981' }}>
              {session.discrepancyItems}件
            </div>
            <div className="label">差異あり商品</div>
          </div>
          <div className="glass-panel stocktakeStatCard">
            <div className="stocktakeStatValue" style={{ color: (session.totalDiffValue || 0) < 0 ? '#ef4444' : (session.totalDiffValue || 0) > 0 ? '#10b981' : undefined }}>
              ¥{Math.round(session.totalDiffValue || 0).toLocaleString()}
            </div>
            <div className="label">差異金額（マイナス=棚卸ロス）</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '1rem 0' }}>
          <button onClick={handleExportCSV} className="btn btnSecondary">
            <Download size={18} /> CSVエクスポート
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', overflowX: 'auto' }}>
          <table className="stocktakeTable">
            <thead>
              <tr>
                <th>商品名</th>
                <th>カテゴリ/拠点</th>
                <th>理論値</th>
                <th>実測値</th>
                <th>差異</th>
              </tr>
            </thead>
            <tbody>
              {reportSortedEntries.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.itemName}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{[e.category, e.location].filter(Boolean).join(' / ') || '-'}</td>
                  <td>{e.expectedStock} {e.unit}</td>
                  <td>{e.countedStock === null ? <span style={{ color: 'var(--text-muted)' }}>未カウント</span> : `${e.countedStock} ${e.unit}`}</td>
                  <td>
                    {e.diff === null ? '-' : e.diff === 0 ? (
                      <span style={{ color: '#10b981', fontWeight: 700 }}>±0</span>
                    ) : (
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>{e.diff > 0 ? `+${e.diff}` : e.diff}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ============================================================
  // 進行中セッション: カウント作業画面
  // ============================================================
  return (
    <div className="stocktakeContainer">
      <div className="formHeader">
        <h1><ScanLine size={24} /> {session.name}</h1>
        <Link href="/inventory/stocktake" className="btn btnSecondary"><ArrowLeft size={18} /> 一覧へ</Link>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span className="label">進捗</span>
          <span style={{ fontWeight: 700 }}>{session.countedItems} / {session.totalItems} 件</span>
        </div>
        <div className="stocktakeProgressBar">
          <div
            className="stocktakeProgressFill"
            style={{ width: `${session.totalItems ? Math.min(100, (session.countedItems / session.totalItems) * 100) : 0}%` }}
          />
        </div>
      </div>

      {activeEntry ? (
        <div className="glass-panel stocktakeCountCard">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{activeEntry.itemName}</div>
              <div className="label">帳簿在庫（理論値）: {activeEntry.expectedStock} {activeEntry.unit}</div>
            </div>
            <button onClick={() => { setActiveEntry(null); setLastScanned(null); }} className="logout-btn"><X size={18} /></button>
          </div>
          <label className="label" style={{ marginTop: '1rem' }}>実際に数えた数（実数）を入力</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="number"
              className="input"
              style={{ flex: 1, fontSize: '1.25rem', textAlign: 'center' }}
              value={countValue}
              onChange={e => setCountValue(e.target.value)}
              autoFocus
            />
            <button onClick={handleRecordCount} className="btn btn-primary" disabled={submitting || countValue === ''}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              記録する
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="videoWrapper" style={{ maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            <video ref={scannerRef} className="scannerVideo" />
            <div className="scanOverlay"><div className="scanTarget" /></div>
          </div>

          {notFoundBarcode && (
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', border: '1px solid #fed7aa', background: '#fff7ed' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#7c2d12' }}>
                バーコード「{notFoundBarcode}」はこの棚卸の対象に含まれていません。
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => handleAddItemToSession(notFoundBarcode)} className="btn btn-primary">
                  <Plus size={16} /> この棚卸に追加してカウントする
                </button>
                <Link href={`/inventory/new?barcode=${notFoundBarcode}`} className="btn btnSecondary">
                  新規商品として登録する
                </Link>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Search size={14} /> バーコードが無い商品は、名前で検索してカウントできます
            </label>
            <input
              type="text"
              className="input"
              placeholder="商品名で検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {filteredSearchResults.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {filteredSearchResults.map(e => (
                  <div key={e.id} className="stocktakeSearchResultRow" onClick={() => { openCountCard(e); setSearchTerm(''); }}>
                    <span>{e.itemName}</span>
                    {e.countedStock !== null ? <CheckCircle2 size={16} color="#10b981" /> : <span className="label" style={{ fontSize: '0.75rem' }}>未カウント</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="stocktakeTabBar">
            <button className={`btn ${tab === 'uncounted' ? 'btn-primary' : 'btnSecondary'}`} onClick={() => setTab('uncounted')}>
              未カウント ({uncountedEntries.length})
            </button>
            <button className={`btn ${tab === 'counted' ? 'btn-primary' : 'btnSecondary'}`} onClick={() => setTab('counted')}>
              カウント済み ({countedEntries.length})
            </button>
          </div>

          <div className="glass-panel stocktakeListPanel">
            {(tab === 'uncounted' ? uncountedEntries : countedEntries).length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                {tab === 'uncounted' ? <><PackageSearch size={28} style={{ marginBottom: '0.5rem' }} /><br />すべての商品をカウントしました</> : '該当する商品がありません'}
              </p>
            ) : (
              (tab === 'uncounted' ? uncountedEntries : countedEntries).map(e => (
                <div key={e.id} className="stocktakeListRow" onClick={() => openCountCard(e)}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{e.itemName}</div>
                    <div className="label" style={{ fontSize: '0.75rem' }}>
                      {e.barcode ? `バーコード: ${e.barcode}` : 'バーコード未登録'} ・ 理論値 {e.expectedStock} {e.unit}
                    </div>
                  </div>
                  {e.countedStock !== null && (
                    e.diff === 0 ? (
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>実測 {e.countedStock} (±0)</span>
                    ) : (
                      <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>実測 {e.countedStock} ({e.diff! > 0 ? `+${e.diff}` : e.diff})</span>
                    )
                  )}
                </div>
              ))
            )}
          </div>

          <div className="stocktakeFooterActions">
            <button onClick={handleCancelSession} className="btn" style={{ background: 'transparent', color: '#ef4444' }} disabled={cancelling || finalizing}>
              {cancelling ? <Loader2 className="animate-spin" size={18} /> : <Ban size={18} />}
              破棄する
            </button>
            <button onClick={handleFinalize} className="btn btn-primary" disabled={finalizing || cancelling} style={{ flex: 1 }}>
              {finalizing ? <Loader2 className="animate-spin" size={18} /> : <ClipboardCheck size={18} />}
              棚卸を確定する
            </button>
          </div>
        </>
      )}
    </div>
  );
}
