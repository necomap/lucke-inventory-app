import Link from 'next/link';
import { ScanLine, Package, BarChart3, Database } from 'lucide-react';
import './page.css';

export default function Home() {
  return (
    <div>
      <section className="heroSection">
        <h1 className="title">スマートな在庫管理を、<br/>もっと身近に。</h1>
        <p className="subtitle">
          Lucke Inventoryは、スマホのカメラでサクサク棚卸しができる在庫管理アプリです。
          複数人での同期や、HACCPアプリとの連携機能も備えています。
        </p>
        <div className="actionButtons">
          <Link href="/scan" className="btn btn-primary">
            <ScanLine size={20} />
            今すぐ棚卸しを始める
          </Link>
          <Link href="/inventory" className="btn btnSecondary">
            <Package size={20} />
            在庫を確認する
          </Link>
        </div>
      </section>

      <section className="featuresGrid">
        <div className="featureCard glass-panel">
          <div className="featureIcon">
            <ScanLine size={32} />
          </div>
          <div>
            <h3 className="featureTitle">爆速スキャンモード</h3>
            <p className="featureDesc">
              スマホのカメラを使って、バーコードを瞬時に読み取り。音とバイブレーションのフィードバックで、確実かつスピーディな棚卸しを実現します。
            </p>
          </div>
        </div>

        <div className="featureCard glass-panel">
          <div className="featureIcon">
            <Package size={32} />
          </div>
          <div>
            <h3 className="featureTitle">詳細なアイテム管理</h3>
            <p className="featureDesc">
              画像、カテゴリ、保管場所（ロケーション）、状態など、様々な属性を設定可能。入庫時の金額登録で、先入先出や移動平均の計算もサポートします。
            </p>
          </div>
        </div>

        <div className="featureCard glass-panel">
          <div className="featureIcon">
            <BarChart3 size={32} />
          </div>
          <div>
            <h3 className="featureTitle">在庫アラートと発注支援</h3>
            <p className="featureDesc">
              在庫が少なくなったらアラートでお知らせ。確定申告に向けた在庫金額の計算もワンクリックで完了します。
            </p>
          </div>
        </div>

        <div className="featureCard glass-panel">
          <div className="featureIcon">
            <Database size={32} />
          </div>
          <div>
            <h3 className="featureTitle">HACCPデータ連携</h3>
            <p className="featureDesc">
              既存のHACCPアプリと在庫受け入れデータを同期可能。シームレスなデータ連携で、入力の二度手間を防ぎます。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
