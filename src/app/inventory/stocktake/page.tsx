'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { getPlanLimits } from '@/lib/plan-limits';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, writeBatch, doc, serverTimestamp,
} from 'firebase/firestore';
import { InventoryItem, StocktakeSession } from '@/types/inventory';
import {
  ClipboardList, PlayCircle, History, Loader2, AlertTriangle, Rocket,
  CheckCircle2, ArrowRight, MapPin,
} from 'lucide-react';
import dayjs from 'dayjs';
import '../new/inventory-form.css';
import './stocktake.css';

export default function StocktakeLandingPage() {
  const { user } = useAuth();
  const { plan, loading: subLoading } = useSubscription();
  const { settings } = useInventorySettings();
  const router = useRouter();

  const [sessions, setSessions] = useState<StocktakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sessionName, setSessionName] = useState(`棚卸 ${dayjs().format('YYYY/MM/DD')}`);
  const [locationFilter, setLocationFilter] = useState('');

  const canUse = getPlanLimits(plan).canUseStocktakeSessions;

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user || !canUse) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, 'stocktakeSessions'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as StocktakeSession));
        setSessions(data);
      } catch (error) {
        console.error('Error fetching stocktake sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [user, canUse]);

  const getMs = (d: any) => {
    if (!d) return 0;
    if (typeof d.toMillis === 'function') return d.toMillis();
    if (typeof d.toDate === 'function') return d.toDate().getTime();
    if (d instanceof Date) return d.getTime();
    const parsed = Date.parse(d);
    return isNaN(parsed) ? 0 : parsed;
  };

  const activeSession = useMemo(
    () => sessions.find(s => s.status === 'in_progress'),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions
      .filter(s => s.status === 'completed')
      .sort((a, b) => getMs(b.completedAt) - getMs(a.completedAt)),
    [sessions]
  );

  const handleStart = async () => {
    if (!user || activeSession) return;
    setCreating(true);
    try {
      const itemsQuery = query(collection(db, 'items'), where('userId', '==', user.uid));
      const itemsSnap = await getDocs(itemsQuery);
      let targetItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      if (locationFilter) {
        targetItems = targetItems.filter(i => i.location === locationFilter);
      }

      if (targetItems.length === 0) {
        alert('対象になる商品がありません。拠点の絞り込みを見直すか、先に商品を登録してください。');
        setCreating(false);
        return;
      }

      const staffName = user.displayName || user.email || 'Unknown';
      const sessionRef = await addDoc(collection(db, 'stocktakeSessions'), {
        userId: user.uid,
        name: sessionName || `棚卸 ${dayjs().format('YYYY/MM/DD')}`,
        status: 'in_progress',
        locationFilter: locationFilter || '',
        startedAt: serverTimestamp(),
        startedBy: staffName,
        totalItems: targetItems.length,
        countedItems: 0,
        discrepancyItems: 0,
      });

      // Firestoreのバッチ書き込みは1回あたり最大500件のため、余裕を持って400件ずつに分割する
      const chunkSize = 400;
      for (let i = 0; i < targetItems.length; i += chunkSize) {
        const chunk = targetItems.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const entryRef = doc(collection(db, 'stocktakeEntries'));
          batch.set(entryRef, {
            sessionId: sessionRef.id,
            userId: user.uid,
            itemId: item.id,
            itemName: item.name,
            barcode: item.barcode || '',
            unit: item.unit || '',
            category: item.category || '',
            location: item.location || '',
            unitPrice: item.unitPrice || 0,
            expectedStock: item.currentStock || 0,
            countedStock: null,
            diff: null,
          });
        }
        await batch.commit();
      }

      router.push(`/inventory/stocktake/${sessionRef.id}`);
    } catch (error) {
      console.error('Error starting stocktake session:', error);
      alert('棚卸の開始に失敗しました。');
      setCreating(false);
    }
  };

  if (subLoading || loading) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>;
  }

  if (!canUse) {
    return (
      <div className="stocktakeContainer">
        <div className="formHeader">
          <h1><ClipboardList size={24} /> 棚卸セッション</h1>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <AlertTriangle size={22} color="#ea580c" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <strong style={{ color: '#9a3412', display: 'block', marginBottom: '0.5rem', fontSize: '1.05rem' }}>本格棚卸セッションはプロプラン限定機能です</strong>
            <p style={{ color: '#7c2d12', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
              未カウント商品の一覧表示、差異レポート、棚卸履歴の保存など、複数人での本格的な棚卸作業に対応した機能です。
              スキャン画面の簡易「棚卸」モードは引き続きスタンダードプラン以上でご利用いただけます。
            </p>
            <Link href="/upgrade" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
              <Rocket size={18} /> プロプランを見る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stocktakeContainer">
      <div className="formHeader">
        <h1><ClipboardList size={24} /> 棚卸セッション</h1>
        <Link href="/scan" className="btn btnSecondary">スキャン画面へ</Link>
      </div>

      {activeSession ? (
        <div className="glass-panel stocktakeActiveCard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PlayCircle size={28} color="var(--primary-color)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{activeSession.name}</div>
              <div className="label">進行中の棚卸があります（{activeSession.countedItems} / {activeSession.totalItems} 件カウント済み）</div>
            </div>
          </div>
          <div className="stocktakeProgressBar">
            <div
              className="stocktakeProgressFill"
              style={{ width: `${activeSession.totalItems ? Math.min(100, (activeSession.countedItems / activeSession.totalItems) * 100) : 0}%` }}
            />
          </div>
          <Link href={`/inventory/stocktake/${activeSession.id}`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            再開する <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <div className="glass-panel stocktakeStartCard">
          <h2 className="sectionTitle"><PlayCircle size={18} /> 新しい棚卸を開始する</h2>
          <div className="formGrid">
            <div className="formGroup fullWidth">
              <label className="label">棚卸の名前</label>
              <input type="text" className="input" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </div>
            {settings.locations && settings.locations.length > 0 && (
              <div className="formGroup fullWidth">
                <label className="label"><MapPin size={14} /> 対象拠点（未選択の場合は全商品が対象）</label>
                <select className="select" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                  <option value="">全拠点・全商品</option>
                  {settings.locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="sectionHint">
            開始すると、その時点の対象商品すべての帳簿在庫（理論値）を記録します。以降はバーコードをスキャンするか、
            一覧から選んで実際に数えた数を入力していき、最後に「棚卸を確定する」と差分だけ在庫が調整されます。
          </p>
          <button className="btn btn-primary" onClick={handleStart} disabled={creating} style={{ alignSelf: 'flex-start' }}>
            {creating ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
            棚卸を開始する
          </button>
        </div>
      )}

      <section style={{ marginTop: '2.5rem' }}>
        <h2 className="sectionTitle" style={{ marginBottom: '1rem' }}><History size={18} /> 棚卸履歴</h2>
        {completedSessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>まだ完了した棚卸はありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {completedSessions.map(session => (
              <Link href={`/inventory/stocktake/${session.id}`} key={session.id} className="glass-panel stocktakeHistoryRow">
                <div>
                  <div style={{ fontWeight: 700 }}>{session.name}</div>
                  <div className="label" style={{ fontSize: '0.8rem' }}>
                    {session.completedAt?.toDate ? dayjs(session.completedAt.toDate()).format('YYYY/MM/DD HH:mm') : ''} 完了
                    {session.locationFilter ? ` ・ ${session.locationFilter}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800 }}>{session.countedItems} / {session.totalItems}</div>
                    <div className="label" style={{ fontSize: '0.75rem' }}>カウント済み</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {session.discrepancyItems > 0 ? (
                      <div style={{ fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <AlertTriangle size={14} /> {session.discrepancyItems}
                      </div>
                    ) : (
                      <div style={{ fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <CheckCircle2 size={14} /> 0
                      </div>
                    )}
                    <div className="label" style={{ fontSize: '0.75rem' }}>差異</div>
                  </div>
                  <ArrowRight size={18} color="var(--text-muted)" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
