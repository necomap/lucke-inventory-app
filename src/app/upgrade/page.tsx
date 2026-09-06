'use client';

import { useState } from 'react';
import { Crown, Check, X, Loader2, Star, Rocket, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import './upgrade.css';

// 2026-09新設: 設定画面のプランボタンが、内容を比較する間もなく即座に
// Stripeの決済ページへ遷移してしまい分かりにくいという指摘を受けて新設した
// プラン比較ページ。他の2アプリ（HACCP・foodlabel-pro）に既にある同種のページに
// ならい、「一覧で比較→納得してから申し込む」という導線にする。
// 金額・機能はlib/plan-limits.ts・lib/stripe-plans.tsの内容と必ず一致させること。

type PaidPlan = 'premium' | 'pro';

type Feature = { label: string; free: boolean; premium: boolean; pro: boolean };

const FEATURES: Feature[] = [
  { label: '拠点1件まで（プレミアム以上は3件・プロは10件）', free: true, premium: true, pro: true },
  { label: 'カスタム項目', free: false, premium: true, pro: true },
  { label: '広告なし', free: false, premium: true, pro: true },
  { label: 'FoodLabel Pro連携（製造・仕込の自動在庫減算）', free: false, premium: false, pro: true },
  { label: '高度なエクスポート・分析機能', free: false, premium: false, pro: true },
];

export default function UpgradePage() {
  const { user } = useAuth();
  const { plan, isPremium, isPro, loading: subLoading } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async (targetPlan: PaidPlan) => {
    if (!user) return;
    setLoadingPlan(targetPlan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email, plan: targetPlan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'エラーが発生しました。');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('エラーが発生しました。');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    if (!user) return;
    setPortalLoading(true);
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'エラーが発生しました。');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('エラーが発生しました。');
    } finally {
      setPortalLoading(false);
    }
  };

  if (subLoading) return <div style={{ textAlign: 'center', padding: '4rem' }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="upgradeHeader">
        <h1><Crown size={26} color="#f59e0b" />プランを選択</h1>
        <p>機能を比較して、ぴったりのプランをお選びください</p>
      </div>

      <div className="planGrid">
        {/* フリープラン */}
        <div className={`glass-panel planColumn ${plan === 'free' ? 'current' : ''}`}>
          <div className="planName">
            <h2>フリープラン</h2>
            {plan === 'free' && <span className="currentBadge">現在のプラン</span>}
          </div>
          <div className="planPrice">¥0<span>/月</span></div>
          <ul className="featureList">
            {FEATURES.map(f => (
              <li key={f.label} className={f.free ? '' : 'disabled'}>
                {f.free ? <Check size={18} color="#22c55e" style={{ flexShrink: 0 }} /> : <X size={18} style={{ flexShrink: 0 }} />}
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        {/* スタンダード（premium） */}
        <div
          className={`glass-panel planColumn ${isPremium && !isPro ? 'current' : ''}`}
          style={{ borderColor: isPremium && !isPro ? '#6366f1' : undefined }}
        >
          <div className="planName">
            <h2><Star size={18} color="#6366f1" />スタンダード</h2>
            {isPremium && !isPro && <span className="currentBadge" style={{ background: '#6366f1' }}>現在のプラン</span>}
          </div>
          <div className="planPrice">¥980<span>/月</span></div>
          <p className="planNote">税込・いつでも解約可能</p>
          <ul className="featureList">
            {FEATURES.map(f => (
              <li key={f.label} className={f.premium ? '' : 'disabled'}>
                {f.premium ? <Check size={18} color="#22c55e" style={{ flexShrink: 0 }} /> : <X size={18} style={{ flexShrink: 0 }} />}
                {f.label}
              </li>
            ))}
          </ul>
          {isPremium && !isPro ? (
            <button onClick={handlePortal} className="btn btnSecondary" disabled={portalLoading}>
              {portalLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
              お支払い管理・解約
            </button>
          ) : isPro ? (
            <button disabled className="btn" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }}>
              プロプランをご利用中です
            </button>
          ) : (
            <button
              onClick={() => handleUpgrade('premium')}
              className="btn btn-primary"
              disabled={loadingPlan !== null}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}
            >
              {loadingPlan === 'premium' ? <Loader2 className="animate-spin" size={18} /> : <Star size={18} />}
              スタンダードにアップグレード
            </button>
          )}
        </div>

        {/* プロ */}
        <div
          className={`glass-panel planColumn ${isPro ? 'current' : ''}`}
          style={{ borderColor: '#f59e0b' }}
        >
          <div className="planBadgeTop" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>おすすめ</div>
          <div className="planName">
            <h2><Rocket size={18} color="#ef4444" />プロ</h2>
            {isPro && <span className="currentBadge" style={{ background: '#ef4444' }}>現在のプラン</span>}
          </div>
          <div className="planPrice">¥2,980<span>/月</span></div>
          <p className="planNote">税込・いつでも解約可能</p>
          <ul className="featureList">
            {FEATURES.map(f => (
              <li key={f.label} className={f.pro ? '' : 'disabled'}>
                {f.pro ? <Check size={18} color="#22c55e" style={{ flexShrink: 0 }} /> : <X size={18} style={{ flexShrink: 0 }} />}
                {f.label}
              </li>
            ))}
          </ul>
          {isPro ? (
            <button onClick={handlePortal} className="btn btnSecondary" disabled={portalLoading}>
              {portalLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
              お支払い管理・解約
            </button>
          ) : (
            <button
              onClick={() => handleUpgrade('pro')}
              className="btn btn-primary"
              disabled={loadingPlan !== null}
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}
            >
              {loadingPlan === 'pro' ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />}
              プロにアップグレード
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel upgradeFootNote">
        <p>・ クレジットカード決済（Stripe）</p>
        <p>・ 毎月自動更新・いつでも解約可能</p>
        <p>・ 解約後は当月末までご利用いただけます</p>
        <p>・ スタンダードからプロへのアップグレードは「お支払い管理・解約」から行えます</p>
      </div>
    </div>
  );
}
