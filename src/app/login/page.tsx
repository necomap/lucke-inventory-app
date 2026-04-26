'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import './login.css';

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <div className="loginContainer">
      <div className="loginCard glass-panel">
        <div className="loginHeader">
          <h1>Lucke Inventory</h1>
          <p>在庫管理をスマートに始めましょう</p>
        </div>
        
        <button onClick={signInWithGoogle} className="googleBtn">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="googleIcon" />
          Googleでログイン
        </button>
        
        <p className="loginHeader" style={{ fontSize: '0.8rem' }}>
          ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}
