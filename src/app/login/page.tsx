'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import './login.css';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || '認証エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="loginContainer">
      <div className="loginCard glass-panel">
        <div className="loginHeader">
          <h1>Lucke Inventory</h1>
          <p>在庫管理をスマートに始めましょう</p>
        </div>
        
        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <input
            type="password"
            placeholder="パスワード (6文字以上)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <button type="submit" disabled={isSubmitting} style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            {isSubmitting ? '処理中...' : (isSignUp ? '新規登録' : 'ログイン')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}>
            {isSignUp ? 'すでにアカウントをお持ちの方はこちら' : '初めての方はこちら（新規登録）'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#94a3b8' }}>
          <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }}></div>
          <span style={{ padding: '0 1rem', fontSize: '0.85rem' }}>または</span>
          <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }}></div>
        </div>

        <button onClick={signInWithGoogle} className="googleBtn">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="googleIcon" />
          Googleでログイン
        </button>
        
        <p className="loginHeader" style={{ fontSize: '0.8rem', marginTop: '1.5rem' }}>
          ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}
