import Link from 'next/link';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-links">
          <Link href="/about">運営者情報</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/contact">お問い合わせ</Link>
          <Link href="/faq">よくある質問</Link>
        </div>
        <div className="footer-copyright">
          &copy; {new Date().getFullYear()} Lucke Inventory. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
