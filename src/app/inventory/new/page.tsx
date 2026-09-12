'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, limit, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Camera, Barcode, Save, X, Loader2, Lock, Sparkles, Truck,
  Package, Wand2, Tag, Boxes, MapPin, StickyNote, Wallet,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateUniqueInternalBarcode } from '@/lib/barcode';
import BarcodeSVG from '@/components/BarcodeSVG';
import './inventory-form.css';

function NewItemPageInner() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { settings } = useInventorySettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);

  // スキャン画面(/scan)で未登録バーコードを検出したときの「新規登録する」導線から
  // ?barcode=... 付きで遷移してきた場合、バーコード欄にあらかじめ入力しておく
  // （初期値として読み込むだけなので、useEffectでのsetStateは不要）。
  const [formData, setFormData] = useState(() => ({
    name: '',
    barcode: searchParams.get('barcode') || '',
    category: '',
    unit: '',
    status: '新品',
    location: '',
    memo: '',
    minStock: 0,
    currentStock: 0,
    initialCost: 0,
    unitPrice: 0,
    supplierName: '',
  }));

  useEffect(() => {
    const fetchCount = async () => {
      const q = query(collection(db, 'items'), limit(101));
      const snap = await getDocs(q);
      setItemCount(snap.size);
    };
    fetchCount();
  }, []);

  // 2026-09新設: 仕入先マスタ（/suppliers）に登録済みの名前を入力候補として出す。
  // 発注書作成（/suppliers/[id]/order）はここの表記と完全一致で突き合わせるため、
  // 候補から選んでもらうことで表記ゆれを防ぐ（自由入力自体はこれまで通り可能）。
  useEffect(() => {
    if (!user) return;
    const fetchSuppliers = async () => {
      const q = query(collection(db, 'suppliers'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setSupplierNames(snap.docs.map((d) => (d.data().name as string) || '').filter(Boolean));
    };
    fetchSuppliers();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // 2026-09新設: バーコードが無い商品（量り売りの食材、手作り品など）のためのバーコード自動発行。
  // 社内利用可能なプレフィックス帯を使ったEAN-13を、既存の全商品と重複しないよう発行する。
  const handleGenerateBarcode = async () => {
    if (!user) return;
    setGeneratingBarcode(true);
    try {
      const q = query(collection(db, 'items'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const existing = snap.docs.map(d => String(d.data().barcode || ''));
      const code = generateUniqueInternalBarcode(existing);
      setFormData(prev => ({ ...prev, barcode: code }));
    } catch (error) {
      console.error('Barcode generation error:', error);
      alert('バーコードの発行に失敗しました。');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const isLimitReached = !isPremium && itemCount >= 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isLimitReached) return;
    setLoading(true);

    try {
      let imageUrl = '';
      if (imageFile) {
        const imageRef = ref(storage, `items/${uuidv4()}`);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      const itemData = {
        ...formData,
        location: isPremium ? formData.location : '', // 無料プランは場所を保存しない
        imageUrl,
        userId: user.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        updatedBy: user.displayName || user.email || 'Unknown',
        currentStock: Number(formData.currentStock),
        minStock: Number(formData.minStock),
        unitPrice: Number(formData.unitPrice),
      };

      const docRef = await addDoc(collection(db, 'items'), itemData);

      // 初回入庫履歴の作成
      if (Number(formData.currentStock) > 0) {
        await addDoc(collection(db, 'transactions'), {
          itemId: docRef.id,
          userId: user.uid,
          type: 'in',
          quantity: Number(formData.currentStock),
          unitPrice: Number(formData.initialCost),
          date: serverTimestamp(),
          staffName: user.displayName || user.email || 'Unknown',
          memo: '初期在庫登録',
        });
      }

      router.push('/inventory');
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="formContainer">
      <div className="formHeader">
        <h1><Package size={24} /> 新規商品登録</h1>
        <button onClick={() => router.back()} className="btn btnSecondary">
          <X size={18} />
          キャンセル
        </button>
      </div>

      {isLimitReached && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={18} /> 登録上限に達しました
          </h3>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            無料プランでは100件までしか登録できません。スタンダードプランへアップグレードすると無制限に登録可能になります。
          </p>
          <button onClick={() => router.push('/settings')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            <Sparkles size={18} /> アップグレードする
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ opacity: isLimitReached ? 0.5 : 1, pointerEvents: isLimitReached ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* 基本情報カード */}
        <section className="glass-panel formSection">
          <h2 className="sectionTitle"><Package size={18} /> 基本情報</h2>
          <div className="formGrid">
            <div className="formGroup fullWidth">
              <label className="label">商品画像</label>
              <div className="imageUpload" onClick={() => document.getElementById('imageInput')?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="previewImage" />
                ) : (
                  <>
                    <Camera size={32} color="var(--text-muted)" />
                    <span className="label">クリックして画像をアップロード</span>
                  </>
                )}
                <input
                  id="imageInput"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div className="formGroup fullWidth">
              <label className="label">商品名 *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="input"
                required
                placeholder="例: マウス、備品Aなど"
              />
            </div>

            <div className="formGroup">
              <label className="label"><Tag size={14} /> カテゴリ</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="input"
                placeholder="例: 事務用品、原材料"
              />
            </div>

            <div className="formGroup">
              <label className="label">単位</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                className="input"
                placeholder="例: kg, 個, 本"
              />
            </div>

            <div className="formGroup">
              <label className="label">状態</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="select">
                <option value="新品">新品</option>
                <option value="中古">中古</option>
                <option value="要修理">要修理</option>
              </select>
            </div>
          </div>
        </section>

        {/* バーコードカード */}
        <section className="glass-panel formSection">
          <h2 className="sectionTitle"><Barcode size={18} /> バーコード</h2>
          <p className="sectionHint">
            メーカーのバーコードが無い商品（量り売りの食材、手作り品など）は「自動発行」でこの場で新しいバーコードを発行できます。
            発行後は<Link href="/inventory/labels" className="inlineLink"> ラベル印刷ページ</Link>で印刷し、商品に貼り付けてください。
          </p>
          <div className="formGrid">
            <div className="formGroup fullWidth">
              <label className="label">バーコード / JANコード</label>
              <div className="barcodeWrapper">
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="スキャンまたは入力"
                />
                <button
                  type="button"
                  className="barcodeBtn"
                  onClick={handleGenerateBarcode}
                  disabled={generatingBarcode}
                  title="この商品専用のバーコードを自動発行する"
                >
                  {generatingBarcode ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                  自動発行
                </button>
              </div>
              {formData.barcode && (
                <div className="barcodePreview">
                  <BarcodeSVG value={formData.barcode} height={50} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 在庫・価格カード */}
        <section className="glass-panel formSection">
          <h2 className="sectionTitle"><Boxes size={18} /> 在庫・価格</h2>
          <div className="formGrid">
            <div className="formGroup">
              <label className="label">初期在庫数</label>
              <input
                type="number"
                name="currentStock"
                value={formData.currentStock}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="formGroup">
              <label className="label">最低在庫数 (アラート用)</label>
              <input
                type="number"
                name="minStock"
                value={formData.minStock}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="formGroup">
              <label className="label"><Wallet size={14} /> 初期仕入単価 (円)</label>
              <input
                type="number"
                name="initialCost"
                value={formData.initialCost}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="formGroup">
              <label className="label">商品価格 / 販売単価 (円)</label>
              <input
                type="number"
                name="unitPrice"
                value={formData.unitPrice}
                onChange={handleInputChange}
                className="input"
              />
            </div>
          </div>
        </section>

        {/* 保管・仕入先カード */}
        <section className="glass-panel formSection">
          <h2 className="sectionTitle"><MapPin size={18} /> 保管・仕入先</h2>
          <div className="formGrid">
            <div className="formGroup" style={{ position: 'relative' }}>
              <label className="label">保管場所 {!isPremium && <span style={{ color: 'var(--secondary-color)', fontSize: '0.7rem' }}>(プレミアム限定)</span>}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="input"
                  placeholder={isPremium ? "例: 倉庫A-棚1" : "アップグレードで利用可能"}
                  disabled={!isPremium}
                  style={{ width: '100%', paddingRight: !isPremium ? '2.5rem' : '0.75rem' }}
                />
                {!isPremium && <Lock size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {settings.enableHaccpFields && (
              <div className="formGroup">
                <label className="label">主な仕入先</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="supplierName"
                    value={formData.supplierName}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="例: ○○商事"
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                    list="supplierNameList"
                  />
                  <datalist id="supplierNameList">
                    {supplierNames.map((n) => <option key={n} value={n} />)}
                  </datalist>
                  <Truck size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
                <p className="helpText" style={{ marginTop: '0.25rem' }}>
                  <Link href="/suppliers" style={{ color: 'var(--primary-color)' }}>仕入先管理</Link>で登録した名前を選ぶと、発注書作成時にまとめて扱えます。
                </p>
              </div>
            )}

            <div className="formGroup">
              <label className="label">登録スタッフ</label>
              <input
                type="text"
                value={user?.displayName || user?.email || ''}
                readOnly
                className="input"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              />
            </div>
          </div>
        </section>

        {/* 備考カード */}
        <section className="glass-panel formSection">
          <h2 className="sectionTitle"><StickyNote size={18} /> 備考</h2>
          <div className="formGrid">
            <div className="formGroup fullWidth">
              <textarea
                name="memo"
                value={formData.memo}
                onChange={handleInputChange}
                className="textarea"
                rows={3}
              />
            </div>
          </div>
        </section>

        <div className="formActions">
          <button type="submit" className="btn btn-primary" disabled={loading || isLimitReached}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            商品を登録する
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>}>
      <NewItemPageInner />
    </Suspense>
  );
}
