'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Settings, Bell, Volume2, Smartphone, Calculator, Save, Loader2, CreditCard, Sparkles, CheckCircle, Plus, Trash2, Edit3, MapPin, Factory, Store, User, Package, AlertCircle } from 'lucide-react';
import { UserSettings, CustomFieldDefinition, WarehouseLocation } from '@/types/inventory';
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
    customFields: [],
    locations: [],
    businessTypes: {
      manufacturing: false,
      retail: true
    },
    role: 'admin',
    haccpCategories: ''
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
          customFields: data.customFields ?? [],
          locations: data.locations ?? [],
          businessTypes: data.businessTypes ?? { manufacturing: false, retail: true },
          role: data.role ?? 'admin',
          haccpCategories: data.haccpCategories ?? '',
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (settings.role === 'staff') {
      alert('一般スタッフは設定を保存できません。');
      return;
    }
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

  const handleAddCustomField = () => {
    const newField: CustomFieldDefinition = {
      id: `cf_${Date.now()}`,
      name: '新規項目',
      type: 'text',
      required: false,
    };
    setSettings(prev => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField],
    }));
  };

  const handleUpdateCustomField = (id: string, updates: Partial<CustomFieldDefinition>) => {
    setSettings(prev => ({
      ...prev,
      customFields: prev.customFields?.map(f => f.id === id ? { ...f, ...updates } : f) || [],
    }));
  };

  const handleRemoveCustomField = (id: string) => {
    setSettings(prev => ({
      ...prev,
      customFields: prev.customFields?.filter(f => f.id !== id) || [],
    }));
  };

  const handleAddLocation = () => {
    const newLocation: WarehouseLocation = {
      id: `loc_${Date.now()}`,
      name: '新規拠点',
    };
    setSettings(prev => ({
      ...prev,
      locations: [...(prev.locations || []), newLocation],
    }));
  };

  const handleUpdateLocation = (id: string, updates: Partial<WarehouseLocation>) => {
    setSettings(prev => ({
      ...prev,
      locations: prev.locations?.map(l => l.id === id ? { ...l, ...updates } : l) || [],
    }));
  };

  const handleRemoveLocation = (id: string) => {
    setSettings(prev => ({
      ...prev,
      locations: prev.locations?.filter(l => l.id !== id) || [],
    }));
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
      <div className="formHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>システム設定</h1>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving || settings.role === 'staff'}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          設定を保存
        </button>
      </div>

      {settings.role === 'staff' && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem' }}>
          <strong>権限エラー:</strong> 現在「一般スタッフ」権限のため、設定の変更はできません。
        </div>
      )}

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
          <h2 className="settingsTitle"><Settings size={20} /> ご利用業態</h2>
          <div className="toggleGroup">
            <label className="toggleLabel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Factory size={18} />
                <div>
                  <span style={{ display: 'block' }}>製造業向け機能 (BOM・レシピ連動)</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>レシピに基づき材料在庫を自動引き落とし</span>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={settings.businessTypes?.manufacturing ?? false} 
                onChange={(e) => setSettings({...settings, businessTypes: { ...settings.businessTypes, manufacturing: e.target.checked, retail: settings.businessTypes?.retail ?? true }})} 
              />
            </label>
            <label className="toggleLabel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Store size={18} />
                <div>
                  <span style={{ display: 'block' }}>仕入販売業向け機能</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>通常の商品入出庫・販売管理</span>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={settings.businessTypes?.retail ?? true} 
                onChange={(e) => setSettings({...settings, businessTypes: { ...settings.businessTypes, retail: e.target.checked, manufacturing: settings.businessTypes?.manufacturing ?? false }})} 
              />
            </label>
          </div>
          <p className="helpText" style={{ marginTop: '0.5rem' }}>選択した業態に合わせてアプリのメニューや機能が最適化されます。（両方ONも可能）</p>
        </section>

        <section className="settingsSection">
          <h2 className="settingsTitle"><User size={20} /> ユーザー権限管理</h2>
          <div className="radioGroup">
            <label className="radioLabel">
              <input 
                type="radio" 
                name="role" 
                value="admin"
                checked={settings.role === 'admin' || !settings.role} 
                onChange={(e) => setSettings({...settings, role: 'admin'})} 
              />
              <div>
                <span style={{ display: 'block' }}>管理者 (Admin)</span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>すべての機能・設定にアクセス可能</span>
              </div>
            </label>
            <label className="radioLabel">
              <input 
                type="radio" 
                name="role" 
                value="staff"
                checked={settings.role === 'staff'} 
                onChange={(e) => setSettings({...settings, role: 'staff'})} 
              />
              <div>
                <span style={{ display: 'block' }}>一般スタッフ (Staff)</span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>設定変更やマスタ削除などを制限</span>
              </div>
            </label>
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
            {settings.enableHaccpFields && (
              <>
                <div style={{ margin: '1rem 0 1rem 2.5rem' }}>
                  <label className="label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>HACCP連携する商品カテゴリ (カンマ区切り)</label>
                  <input 
                    type="text" 
                    value={settings.haccpCategories || ''} 
                    onChange={(e) => setSettings({...settings, haccpCategories: e.target.value})} 
                    placeholder="例: 原材料, 仕込み品 (空欄なら全商品)" 
                    className="input" 
                    style={{ marginTop: '0.25rem' }}
                  />
                  <p className="helpText" style={{ marginTop: '0.25rem' }}>指定されたカテゴリの商品のみがHACCPアプリ側に連携されます。</p>
                </div>
                <div style={{ margin: '1rem 0 1rem 2.5rem' }}>
                  <label className="label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>HACCP連携用 ユーザーID</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input 
                      type="text" 
                      value={user?.uid || ''} 
                      readOnly 
                      className="input" 
                      style={{ flex: 1, fontFamily: 'monospace', background: 'rgba(0,0,0,0.03)' }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (user?.uid) {
                          navigator.clipboard.writeText(user.uid);
                          alert('ユーザーIDをコピーしました。HACCPアプリの設定画面に貼り付けてください。');
                        }
                      }} 
                      className="btn btnSecondary" 
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      コピー
                    </button>
                  </div>
                  <p className="helpText" style={{ marginTop: '0.25rem' }}>このユーザーIDをコピーして、HACCPアプリの設定画面に貼り付けてください。</p>
                </div>
                <div style={{ margin: '1rem 0 0 2.5rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderLeft: '4px solid #0284c7', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <AlertCircle size={18} color="#0284c7" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#0369a1', display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>HACCPアプリと自動連動中！</strong>
                    <span style={{ fontSize: '0.8rem', color: '#0f172a', display: 'block', lineHeight: '1.5' }}>
                      HACCPアプリで納品記録を付けると、こちらの在庫数が自動で加算され、入庫履歴も自動記録されます。
                    </span>
                    <a href="https://haccp.lucke.jp/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#0284c7', textDecoration: 'none' }}>
                      HACCPアプリを開く <Package size={12} />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {isPremium && (
          <section className="settingsSection">
            <h2 className="settingsTitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={20} /> カスタム項目（独自項目）
              </div>
              <button onClick={handleAddCustomField} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                <Plus size={20} /> 追加
              </button>
            </h2>
            <p className="helpText" style={{ marginBottom: '1rem' }}>在庫データに企業独自の項目を追加できます。</p>
            
            {(!settings.customFields || settings.customFields.length === 0) ? (
              <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', color: '#6b7280' }}>
                カスタム項目はまだありません
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {settings.customFields.map((field) => (
                  <div key={field.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px' }}>
                    <input 
                      type="text" 
                      value={field.name} 
                      onChange={(e) => handleUpdateCustomField(field.id, { name: e.target.value })}
                      placeholder="項目名"
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                    <select 
                      value={field.type} 
                      onChange={(e) => handleUpdateCustomField(field.id, { type: e.target.value as any })}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                      <option value="text">テキスト</option>
                      <option value="number">数値</option>
                      <option value="date">日付</option>
                      <option value="boolean">チェックボックス</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        onChange={(e) => handleUpdateCustomField(field.id, { required: e.target.checked })}
                      /> 必須
                    </label>
                    <button onClick={() => handleRemoveCustomField(field.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isPremium && (
          <section className="settingsSection">
            <h2 className="settingsTitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={20} /> 拠点管理（複数倉庫）
              </div>
              <button onClick={handleAddLocation} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                <Plus size={20} /> 追加
              </button>
            </h2>
            <p className="helpText" style={{ marginBottom: '1rem' }}>在庫を保管する複数の拠点や倉庫を管理できます。</p>
            
            {(!settings.locations || settings.locations.length === 0) ? (
              <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', color: '#6b7280' }}>
                拠点はまだ登録されていません
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {settings.locations.map((loc) => (
                  <div key={loc.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px' }}>
                    <input 
                      type="text" 
                      value={loc.name} 
                      onChange={(e) => handleUpdateLocation(loc.id, { name: e.target.value })}
                      placeholder="拠点名 (例: 東京倉庫)"
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                    <input 
                      type="text" 
                      value={loc.address || ''} 
                      onChange={(e) => handleUpdateLocation(loc.id, { address: e.target.value })}
                      placeholder="住所 (任意)"
                      style={{ flex: 2, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                    <button onClick={() => handleRemoveLocation(loc.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
