import React from 'react';

export const metadata = {
  title: 'プライバシーポリシー | Lucke Inventory',
  description: 'Lucke Inventoryのプライバシーポリシーについて',
};

export default function PrivacyPage() {
  return (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        プライバシーポリシー
      </h1>

      <div style={{ lineHeight: '1.8', color: 'var(--text-color)' }}>
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>第1条（はじめに）</h2>
          <p>
            当サイト（Lucke Inventory）は、ユーザーの個人情報について以下のとおりプライバシーポリシー（以下、「本ポリシー」という。）を定めます。
            本ポリシーは、当サイトがどのような個人情報を取得し、どのように利用・共有するか、ユーザーがどのようにご自身の個人情報を管理できるかをご説明するものです。
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>第2条（広告の配信について）</h2>
          <p>
            当サイトは、第三者配信の広告サービス（Google AdSense 等）を利用する場合があります。<br />
            広告配信事業者は、ユーザーの興味に応じた広告を表示するためにCookie（クッキー）を使用することがあります。<br />
            Cookieを無効にする設定およびGoogleアドセンスに関する詳細は「<a href="https://policies.google.com/technologies/ads?hl=ja" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>広告 – ポリシーと規約 – Google</a>」をご覧ください。
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>第3条（アクセス解析ツールについて）</h2>
          <p>
            当サイトでは、Googleによるアクセス解析ツール「Google Analytics」を利用しています。<br />
            このGoogle Analyticsはトラフィックデータの収集のためにCookieを使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。<br />
            この機能は、Cookieを無効にすることで収集を拒否することが出来ますので、お使いのブラウザの設定をご確認ください。
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>第4条（免責事項）</h2>
          <p>
            当サイトのコンテンツ・情報について、できる限り正確な情報を掲載するよう努めておりますが、正確性や安全性を保証するものではありません。
            当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>第5条（著作権・肖像権）</h2>
          <p>
            当サイトで掲載している文章や画像などにつきましては、無断転載することを禁止します。
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>第6条（プライバシーポリシーの変更）</h2>
          <p>
            本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。
            変更後のプライバシーポリシーは、当サイトに掲載したときから効力を生じるものとします。
          </p>
        </section>

        <div style={{ marginTop: '3rem', textAlign: 'right', color: 'var(--text-muted)' }}>
          <p>制定日：202X年X月X日</p>
          <p>改定日：202X年X月X日</p>
        </div>
      </div>
    </div>
  );
}
