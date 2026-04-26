import React from 'react';

export const metadata = {
  title: 'お問い合わせ | Lucke Inventory',
  description: 'Lucke Inventoryへのお問い合わせ',
};

export default function ContactPage() {
  return (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        お問い合わせ
      </h1>

      <div style={{ lineHeight: '1.8', color: 'var(--text-color)' }}>
        <p style={{ marginBottom: '2rem' }}>
          Lucke Inventory に関するご質問、ご意見、不具合のご報告などは、以下の連絡先までお願いいたします。
        </p>

        <div style={{ 
          padding: '2rem', 
          backgroundColor: 'rgba(0,0,0,0.02)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>メールでのお問い合わせ</h2>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
            [メールアドレスをご入力ください]
          </p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            ※ お問い合わせへのご返信には、数日お時間をいただく場合がございます。あらかじめご了承ください。
          </p>
        </div>

        {/* 
          // もしGoogleフォーム等の外部リンクを使用する場合は以下を有効にしてください。
          <div style={{ marginTop: '3rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>お問い合わせフォーム</h2>
            <a 
              href="https://forms.gle/XXXXX" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ display: 'inline-block', padding: '0.75rem 2rem' }}
            >
              お問い合わせフォームを開く
            </a>
          </div>
        */}
      </div>
    </div>
  );
}
