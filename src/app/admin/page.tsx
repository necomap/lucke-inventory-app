'use client';

import { useState } from 'react';
import { ShieldAlert, Users, Package, Repeat, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAdminEmail } from '@/lib/admin-access';
import './admin.css';

// 2026-09新設: オーナー専用の管理画面。全ユーザーを横断した集計データ
// （ユーザー数・プラン別内訳・商品数・取引件数・登録推移・休眠ユーザー一覧）を表示する。
// アクセス制御はこのページの表示だけでなく、必ずAPI側（/api/admin/stats）でも
// IDトークン＋メールアドレスで検証している（このページのガードだけでは、
// 開発者ツールでコードを書き換えられれば突破できてしまうため、見た目の制御にすぎない）。

type AdminStats = {
  totals: {
    userCount: number;
    byPlan: { free: number; premium: number; pro: number };
    totalItems: number;
    totalTransactions: number;
  };
  signupTrend: { month: string; count: number }[];
  planChangeTrend: { month: string; count: number }[];
  staleUsers: {
    uid: string;
    email: string;
    plan: string;
    createdAt: string;
    lastSignInAt: string | null;
    hasItems: boolean;
  }[];
};

function TrendChart({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="trendChart">
      {data.map((d) => (
        <div className="trendBarWrap" key={d.month}>
          <span className="trendBarCount">{d.count > 0 ? d.count : ''}</span>
          <div className="trendBar" style={{ height: `${Math.max(2, (d.count / max) * 90)}px` }} />
          <span className="trendBarLabel">{d.month.slice(2)}</span>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '記録なし';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '記録なし';
  return d.toLocaleDateString('ja-JP');
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = isAdminEmail(user?.email);

  const loadStats = async () => {
    if (!user) return;
    setFetching(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `エラー (${res.status})`);
      }
      const data = await res.json();
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'データの取得に失敗しました');
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}>読み込み中...</div>;
  }

  if (!user || !isAdmin) {
    return (
      <div className="adminContainer">
        <div className="glass-panel adminDenied">
          <ShieldAlert size={32} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <p>このページを表示する権限がありません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="adminContainer">
      <div className="formHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>管理画面</h1>
        <button className="btn btn-primary" onClick={loadStats} disabled={fetching}>
          {fetching ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
          データを取得
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!stats && !fetching && !error && (
        <div className="glass-panel adminSection" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          「データを取得」を押すと、全ユーザーの集計データを読み込みます。
        </div>
      )}

      {stats && (
        <>
          <div className="statGrid">
            <div className="glass-panel statCard">
              <Users size={20} color="var(--primary-color)" />
              <div className="statValue">{stats.totals.userCount}</div>
              <div className="statLabel">登録ユーザー数</div>
              <div className="planBreakdown">
                <span>free {stats.totals.byPlan.free}</span>
                <span>premium {stats.totals.byPlan.premium}</span>
                <span>pro {stats.totals.byPlan.pro}</span>
              </div>
            </div>
            <div className="glass-panel statCard">
              <Package size={20} color="var(--primary-color)" />
              <div className="statValue">{stats.totals.totalItems}</div>
              <div className="statLabel">総商品登録数（全ユーザー合計）</div>
            </div>
            <div className="glass-panel statCard">
              <Repeat size={20} color="var(--primary-color)" />
              <div className="statValue">{stats.totals.totalTransactions}</div>
              <div className="statLabel">総入出庫件数（全ユーザー合計）</div>
            </div>
          </div>

          <div className="glass-panel adminSection">
            <div className="adminSectionTitle">登録推移（直近12か月・月別）</div>
            <TrendChart data={stats.signupTrend} />
          </div>

          <div className="glass-panel adminSection">
            <div className="adminSectionTitle">プラン変更推移（直近12か月・月別、目安）</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              「現在premium/proのユーザーの、最後にプランが変わった月」の集計です。解約時にも更新される値のため、正確な新規アップグレード数ではなく目安としてご覧ください。
            </p>
            <TrendChart data={stats.planChangeTrend} />
          </div>

          <div className="glass-panel adminSection">
            <div className="adminSectionTitle">休眠・未使用ユーザー（商品未登録、または30日以上未ログイン・最大50件）</div>
            <div className="staleTableWrap">
              <table className="staleTable">
                <thead>
                  <tr>
                    <th>メールアドレス</th>
                    <th>プラン</th>
                    <th>登録日</th>
                    <th>最終ログイン</th>
                    <th>商品登録</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.staleUsers.map((u) => (
                    <tr key={u.uid}>
                      <td>{u.email}</td>
                      <td>
                        <span className={`planTag ${u.plan === 'pro' ? 'planTagPro' : u.plan === 'premium' ? 'planTagPremium' : ''}`}>
                          {u.plan}
                        </span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>{formatDate(u.lastSignInAt)}</td>
                      <td>{u.hasItems ? 'あり' : 'なし'}</td>
                    </tr>
                  ))}
                  {stats.staleUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>該当なし</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
