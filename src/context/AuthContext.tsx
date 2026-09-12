'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // signInWithRedirect でGoogleから戻ってきた直後、その結果(成功/失敗)を拾う。
    // これが無いと、リダイレクト認証が失敗してもどこにもエラーが出ず、
    // ただログイン画面に戻るだけになってしまい原因が分からなくなるため追加。
    getRedirectResult(auth).catch((error) => {
      console.error('Google redirect sign-in error:', error?.code, error?.message, error);
      setAuthError(`Googleログインに失敗しました (${error?.code || 'unknown'}): ${error?.message || error}`);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      // authDomain(lucke-inventory-app.firebaseapp.com)がアプリ本体のドメイン
      // (inventory.lucke.jp)と別ドメインのため、signInWithRedirectだと
      // ブラウザのサードパーティストレージ制限で認証結果を引き継げず、
      // エラーも出ないままログイン画面に戻ってしまう不具合が確認された。
      // まずポップアップ方式を試し、ポップアップがブロックされた場合や
      // (主にスマホのアプリ内ブラウザ等で)ポップアップ自体が使えない場合のみ
      // 従来のリダイレクト方式にフォールバックする。
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          console.error('Error signing in with Google (redirect fallback):', redirectError);
          const rCode = (redirectError as { code?: string; message?: string })?.code;
          const rMessage = (redirectError as { code?: string; message?: string })?.message;
          setAuthError(`Googleログインに失敗しました (${rCode || 'unknown'}): ${rMessage || redirectError}`);
          throw redirectError;
        }
      }
      // ユーザーが単にポップアップを閉じただけの場合はエラー表示しない
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error('Error signing in with Google:', error);
      const message = (error as { message?: string })?.message;
      setAuthError(`Googleログインに失敗しました (${code || 'unknown'}): ${message || error}`);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in with Email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing up with Email:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
