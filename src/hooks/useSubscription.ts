import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export type PlanType = 'free' | 'premium';

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

  const isPremium = plan === 'premium';

  return { plan, isPremium, loading };
}
