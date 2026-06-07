'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { Download, UploadCloud, Loader2 } from 'lucide-react';

export default function BackupPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleDownloadBackup = async () => {
    setLoading(true);
    setMessage('バックアップを作成中...');
    try {
      const itemsSnap = await getDocs(collection(db, 'items'));
      const transSnap = await getDocs(collection(db, 'transactions'));

      const data = {
        items: itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        transactions: transSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage('バックアップのダウンロードが完了しました。');
    } catch (err: any) {
      console.error(err);
      setMessage(`エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateData = async () => {
    if (!user) {
      setMessage('ログインしていません。');
      return;
    }
    
    if (!confirm('userIdが未設定のすべての商品と履歴を、現在ログイン中のアカウントに紐付けますか？')) return;

    setLoading(true);
    setMessage('データの引き継ぎを実行中...');
    try {
      let updatedItems = 0;
      let updatedTrans = 0;

      const itemsSnap = await getDocs(collection(db, 'items'));
      for (const d of itemsSnap.docs) {
        const data = d.data();
        if (!data.userId) {
          await updateDoc(doc(db, 'items', d.id), { userId: user.uid });
          updatedItems++;
        }
      }

      const transSnap = await getDocs(collection(db, 'transactions'));
      for (const d of transSnap.docs) {
        const data = d.data();
        if (!data.userId) {
          await updateDoc(doc(db, 'transactions', d.id), { userId: user.uid });
          updatedTrans++;
        }
      }

      setMessage(`引き継ぎ完了！ ${updatedItems}件の商品と ${updatedTrans}件の履歴をアカウントに紐付けました。`);
    } catch (err: any) {
      console.error(err);
      setMessage(`エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div style={{ padding: '2rem' }}>ログインしてください</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>データ移行＆バックアップツール</h1>
      
      <p style={{ marginBottom: '2rem', color: '#64748b', lineHeight: '1.6' }}>
        マルチテナント化（ユーザーごとのデータ分離）を行う前に、これまで登録したすべてのテストデータをバックアップしたり、現在のアカウントに紐付ける（引き継ぐ）ことができます。
      </p>

      {message && (
        <div style={{ padding: '1rem', background: '#f0fdf4', color: '#166534', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button 
          onClick={handleDownloadBackup} 
          disabled={loading}
          style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Download />}
          データをJSONファイルでダウンロード (バックアップ)
        </button>

        <button 
          onClick={handleMigrateData} 
          disabled={loading}
          style={{ padding: '1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
          既存データを現在のアカウントに引き継ぐ
        </button>
      </div>
    </div>
  );
}
