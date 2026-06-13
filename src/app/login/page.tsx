'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './login.css';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      if (isReset) {
        if (!email) throw new Error('メールアドレスを入力してください');
        await resetPassword(email);
        setMessage('パスワードリセットのメールを送信しました。メールをご確認ください。');
        setIsReset(false);
      } else if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('メールアドレスまたはパスワードが間違っています。もしくはGoogleでログインしたアカウントの可能性があります。');
      } else {
        setError(err.message || '認証エラーが発生しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="loginContainer">
      <div className="loginCard">
        <div className="loginHeader">
          <h1>Lucke Inventory</h1>
          <p>在庫管理をスマートに始めましょう</p>
        </div>
        
        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
        {message && <div style={{ color: 'green', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{message}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="loginFormInput"
          />
          {!isReset && (
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="パスワード (6文字以上)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="loginFormInput"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
          <button type="submit" disabled={isSubmitting} style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            {isSubmitting ? '処理中...' : (isReset ? 'パスワードをリセット' : (isSignUp ? '新規登録' : 'ログイン'))}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {!isReset && (
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}>
              {isSignUp ? 'すでにアカウントをお持ちの方はこちら' : '初めての方はこちら（新規登録）'}
            </button>
          )}
          <button type="button" onClick={() => { setIsReset(!isReset); setIsSignUp(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
            {isReset ? 'ログイン画面に戻る' : 'パスワードをお忘れの方はこちら'}
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
