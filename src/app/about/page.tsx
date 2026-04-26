import React from 'react';

export const metadata = {
  title: '運営者情報 | Lucke Inventory',
  description: 'Lucke Inventoryの運営者情報について',
};

export default function AboutPage() {
  return (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        運営者情報
      </h1>

      <div style={{ lineHeight: '1.8', color: 'var(--text-color)' }}>
        <p style={{ marginBottom: '2rem' }}>
          当サイト（Lucke Inventory）の運営者に関する情報です。
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', width: '30%', backgroundColor: 'rgba(0,0,0,0.02)' }}>サービス名</th>
              <td style={{ padding: '1rem' }}>Lucke Inventory</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.02)' }}>運営会社・組織名</th>
              <td style={{ padding: '1rem' }}>[会社名または個人名をご入力ください]</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.02)' }}>代表者</th>
              <td style={{ padding: '1rem' }}>[代表者名をご入力ください]</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.02)' }}>所在地</th>
              <td style={{ padding: '1rem' }}>[所在地をご入力ください]</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.02)' }}>連絡先</th>
              <td style={{ padding: '1rem' }}>[電話番号、またはメールアドレスをご入力ください]</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.02)' }}>URL</th>
              <td style={{ padding: '1rem' }}>https://lucke.jp/ (予定)</td>
            </tr>
          </tbody>
        </table>

        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>免責事項</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            本サービスをご利用いただいたことによって生じたトラブルや損害につきましては、一切責任を負いかねますのでご了承ください。
            また、本サービスの内容は予告なく変更、一時停止、または終了することがあります。
          </p>
        </div>
      </div>
    </div>
  );
}
