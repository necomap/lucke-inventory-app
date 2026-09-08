'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Camera, Barcode, Save, X, Loader2, Lock, Truck, Trash2,
  Package, Wand2, Tag, Boxes, MapPin, StickyNote, Wallet, Printer,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateUniqueInternalBarcode } from '@/lib/barcode';
import BarcodeSVG from '@/components/BarcodeSVG';
import '../../new/inventory-form.css';

export default function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { settings } = useInventorySettings();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: '',
    unit: '',
    status: '新品',
    location: '',
    memo: '',
    minStock: 0,
    unitPrice: 0,
    supplierName: '',
  });

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const itemRef = doc(db, 'items', id);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const data = itemSnap.data();
          setFormData({
            name: data.name || '',
            barcode: data.barcode || '',
            category: data.category || '',
            unit: data.unit || '',
            status: data.status || '新品',
            location: data.location || '',
            memo: data.memo || '',
            minStock: data.minStock || 0,
            unitPrice: data.unitPrice || 0,
            supplierName: data.supplierName || '',
          });
          if (data.imageUrl) {
            setImagePreview(data.imageUrl);
          }
        } else {
          router.push('/inventory');
        }
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setFetching(false);
      }
    };

    fetchItem();
  }, [id, router]);

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

  // 2026-09新設: バーコードが無い商品のためのバーコード自動発行（新規登録フォームと同じ仕組み）。
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      let imageUrl = imagePreview; // 既存の画像URLを保持
      if (imageFile) {
        const imageRef = ref(storage, `items/${uuidv4()}`);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      const itemRef = doc(db, 'items', id);
      const updateData = {
        ...formData,
        location: isPremium ? formData.location : '',
        imageUrl: imageUrl || '',
        lastUpdated: serverTimestamp(),
        updatedBy: user.displayName || user.email || 'Unknown',
        minStock: Number(formData.minStock),
        unitPrice: Number(formData.unitPrice),
      };

      await updateDoc(itemRef, updateData);
      router.push(`/inventory/${id}`);
    } catch (error) {
      console.error('Error updating document: ', error);
      alert('エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || settings.role !== 'admin') return;
    if (!confirm(`本当にこの商品「${formData.name}」を削除しますか？\n削除すると元に戻せません。`)) return;

    setLoading(true);
    try {
      // 1. 商品の削除
      const itemRef = doc(db, 'items', id);
      await deleteDoc(itemRef);

      // 2. 監査ログの追加
      await addDoc(collection(db, 'auditLogs'), {
        timestamp: serverTimestamp(),
        userName: user.displayName || user.email || 'Unknown',
        action: 'DELETE',
        targetType: 'item',
        targetId: id,
        details: `商品「${formData.name}」を削除しました。`,
        userId: user.uid
      });

      alert('商品を削除しました。');
      router.push('/inventory');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('削除中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /> 読み込み中...</div>;

  return (
    <div className="formContainer">
      <div className="formHeader">
        <h1><Package size={24} /> 商品情報の編集</h1>
        <button onClick={() => router.back()} className="btn btnSecondary">
          <X size={18} />
          キャンセル
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

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
            バーコードが無い商品は「自動発行」でこの場で新しいバーコードを発行できます。発行・変更後は
            <Link href={`/inventory/labels?item=${id}`} className="inlineLink"> ラベル印刷ページ</Link>から印刷してください。
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
              {formData.barcode && (
                <Link href={`/inventory/labels?item=${id}`} className="btn btnSecondary" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                  <Printer size={16} /> ラベルを印刷する
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* 在庫・価格カード */}
        <section className="glass-panel formSection">
          <h2 className="sectionTitle"><Boxes size={18} /> 在庫・価格</h2>
          <div className="formGrid">
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
              <label className="label"><Wallet size={14} /> 商品価格 / 販売単価 (円)</label>
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
              <label className="label">保管場所 {!isPremium && <span style={{ color: 'var(--secondary-color)', fontSize: '0.7rem' }}>(スタンダード限定)</span>}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="input"
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
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                  />
                  <Truck size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
            )}
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

        <div className="formActions" style={{ flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            変更を保存する
          </button>
          {settings.role === 'admin' && (
            <button
              type="button"
              onClick={handleDelete}
              className="btn"
              style={{ background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', flex: 1 }}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
              この商品を削除する
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
