import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserSettings } from '@/types/inventory';

export function useInventorySettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({
    valuationMethod: 'FIFO',
    enableSound: true,
    enableVibration: true,
    enableAlerts: true,
    enableHaccpFields: false,
    businessTypes: {
      manufacturing: false,
      retail: true
    },
    customFields: [],
    locations: [],
    role: 'admin',
    haccpCategories: ''
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            valuationMethod: data.valuationMethod || 'FIFO',
            enableSound: data.enableSound ?? true,
            enableVibration: data.enableVibration ?? true,
            enableAlerts: data.enableAlerts ?? true,
            enableHaccpFields: data.enableHaccpFields ?? false,
            businessTypes: data.businessTypes ?? { manufacturing: false, retail: true },
            customFields: data.customFields ?? [],
            locations: data.locations ?? [],
            role: data.role ?? 'admin',
            haccpCategories: data.haccpCategories ?? '',
          });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const playSuccessSound = () => {
    if (settings.enableSound) {
      const audio = new Audio('/success.mp3');
      audio.play().catch(() => {});
    }
  };

  const triggerVibration = () => {
    if (settings.enableVibration && typeof window !== 'undefined' && window.navigator.vibrate) {
      window.navigator.vibrate(200);
    }
  };

  return { settings, loading, playSuccessSound, triggerVibration };
}
