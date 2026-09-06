import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// 2026-09更新: proプラン新設のため型を拡張
export type PlanType = 'free' | 'premium' | 'pro';

export function useSubscription() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanType>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlan('free');
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setPlan(userData.plan || 'free');
      } else {
        setPlan('free');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // isPremium: 「premium以上」（premium・pro両方）を指す。既存の呼び出し元
  // （設定画面のカスタム項目・拠点管理セクションなど）はこれまで通り
  // 「無料プランではない」を意味するものとして使い続けられる。
  const isPremium = plan === 'premium' || plan === 'pro';
  const isPro = plan === 'pro';

  return { plan, isPremium, isPro, loading };
}
