'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, Barcode, Save, X, Loader2, Lock, Truck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
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

  if (fetching) return <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /> 読み込み中...</div>;

  return (
    <div className="formContainer">
      <div className="formHeader">
        <h1>商品情報の編集</h1>
        <button onClick={() => router.back()} className="btn btnSecondary">
          <X size={18} />
          キャンセル
        </button>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2rem' }}>
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
            <label className="label">バーコード / QRコード</label>
            <div className="barcodeWrapper">
              <input 
                type="text" 
                name="barcode" 
                value={formData.barcode} 
                onChange={handleInputChange} 
                className="input" 
                style={{ flex: 1 }}
              />
              <button type="button" className="barcodeBtn">
                <Barcode size={18} />
              </button>
            </div>
          </div>

          <div className="formGroup">
            <label className="label">カテゴリ</label>
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

          <div className="formGroup">
            <label className="label">状態</label>
            <select name="status" value={formData.status} onChange={handleInputChange} className="select">
              <option value="新品">新品</option>
              <option value="中古">中古</option>
              <option value="要修理">要修理</option>
            </select>
          </div>

          <div className="formGroup" style={{ position: 'relative' }}>
            <label className="label">保管場所 {!isPremium && <span style={{ color: 'var(--secondary-color)', fontSize: '0.7rem' }}>(プレミアム限定)</span>}</label>
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
            <label className="label">商品価格 / 販売単価 (円)</label>
            <input 
              type="number" 
              name="unitPrice" 
              value={formData.unitPrice} 
              onChange={handleInputChange} 
              className="input" 
            />
          </div>

          <div className="formGroup fullWidth">
            <label className="label">備考</label>
            <textarea 
              name="memo" 
              value={formData.memo} 
              onChange={handleInputChange} 
              className="textarea" 
              rows={3}
            />
          </div>
        </div>

        <div className="formActions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            変更を保存する
          </button>
        </div>
      </form>
    </div>
  );
}
