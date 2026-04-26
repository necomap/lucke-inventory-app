'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Settings, Bell, Volume2, Smartphone, Calculator, Save, Loader2, CreditCard, Sparkles, CheckCircle } from 'lucide-react';
import { UserSettings } from '@/types/inventory';
import './settings.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { plan, isPremium, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    valuationMethod: 'FIFO',
    enableSound: true,
    enableVibration: true,
    enableAlerts: true,
    enableHaccpFields: false,
  });

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
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
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', user.uid), settings);
      alert('設定を保存しました。');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('エラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('エラーが発生しました。');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading || subLoading) return <div style={{ textAlign: 'center', padding: '4rem' }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="formHeader">
        <h1>設定</h1>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <section className="settingsSection">
          <h2 className="settingsTitle"><CreditCard size={20} /> 現在のプラン</h2>
          <div className="planCard" style={{ 
            padding: '1.5rem', 
            borderRadius: '12px', 
            background: isPremium ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'rgba(0,0,0,0.05)',
            color: isPremium ? 'white' : 'inherit',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isPremium ? <><Sparkles size={20} /> プレミアムプラン</> : '無料プラン'}
              </div>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.8 }}>
                {isPremium ? '全ての機能が無制限に利用可能です。' : '100件まで登録可能です。'}
              </p>
            </div>
            {!isPremium ? (
              <button onClick={handleUpgrade} className="btn btn-primary" disabled={checkoutLoading}>
                {checkoutLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                アップグレード
              </button>
            ) : (
              <CheckCircle size={32} />
            )}
          </div>
        </section>

        <section className="settingsSection">
          <h2 className="settingsTitle"><Calculator size={20} /> 在庫評価方法</h2>
          <div className="radioGroup">
            <label className="radioLabel">
              <input 
                type="radio" 
                checked={settings.valuationMethod === 'FIFO'} 
                onChange={() => setSettings({...settings, valuationMethod: 'FIFO'})} 
              />
              <span>先入先出法 (FIFO)</span>
            </label>
            <label className="radioLabel">
              <input 
                type="radio" 
                checked={settings.valuationMethod === 'MOVING_AVERAGE'} 
                onChange={() => setSettings({...settings, valuationMethod: 'MOVING_AVERAGE'})} 
              />
              <span>移動平均法</span>
            </label>
          </div>
          <p className="helpText">確定申告時の在庫評価額計算に使用します。</p>
        </section>

        <section className="settingsSection">
          <h2 className="settingsTitle"><Bell size={20} /> 通知とフィードバック</h2>
          <div className="toggleGroup">
            <label className="toggleLabel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Volume2 size={18} />
                <span>スキャン時のサウンド</span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.enableSound} 
                onChange={(e) => setSettings({...settings, enableSound: e.target.checked})} 
              />
            </label>
            <label className="toggleLabel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Smartphone size={18} />
                <span>スキャン時のバイブレーション</span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.enableVibration} 
                onChange={(e) => setSettings({...settings, enableVibration: e.target.checked})} 
              />
            </label>
            <label className="toggleLabel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Bell size={18} />
                <span>在庫不足アラート通知</span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.enableAlerts} 
                onChange={(e) => setSettings({...settings, enableAlerts: e.target.checked})} 
              />
            </label>
            <label className="toggleLabel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle size={18} />
                <span>HACCP連携項目を表示 (飲食向け)</span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.enableHaccpFields} 
                onChange={(e) => setSettings({...settings, enableHaccpFields: e.target.checked})} 
              />
            </label>
          </div>
        </section>

        <div className="formActions">
          <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            設定を保存する
          </button>
        </div>
      </div>
    </div>
  );
}
