'use client';

import Link from 'next/link';
import { Package, ScanLine, Settings, User, LogOut, BarChart3, Factory, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const { settings } = useInventorySettings();

  return (
    <nav className="navbar glass-panel">
      <div className="navbar-container">
        <Link href="/" className="navbar-logo">
          <Package className="logo-icon" />
          <span>Lucke Inventory</span>
        </Link>
        
        <div className="navbar-links">
          {user ? (
            <>
              <Link href="/inventory" className="nav-link">
                <Package size={18} />
                <span>在庫一覧</span>
              </Link>
              {settings?.businessTypes?.manufacturing && (
                <Link href="/production" className="nav-link">
                  <Factory size={18} />
                  <span>製造・仕込</span>
                </Link>
              )}
              <Link href="/reports" className="nav-link">
                <BarChart3 size={18} />
                <span>レポート</span>
              </Link>
              <Link href="/scan" className="nav-link scan-btn">
                <ScanLine size={18} />
                <span>棚卸し</span>
              </Link>
              <Link href="/settings" className="nav-link">
                <Settings size={18} />
                <span>設定</span>
              </Link>
              <Link href="/faq" className="nav-link">
                <HelpCircle size={18} />
                <span>よくある質問</span>
              </Link>
              <div className="user-section">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="profile" className="user-avatar" />
                ) : (
                  <div className="profile-btn"><User size={18} /></div>
                )}
                <button onClick={logout} className="logout-btn" title="ログアウト">
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            !loading && (
              <Link href="/login" className="nav-link login-link">
                ログイン
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
