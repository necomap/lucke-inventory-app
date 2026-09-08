// app/api/portal/route.ts - Stripeカスタマーポータル（お支払い方法の変更・解約）
// ============================================================
// 2026-09新設: これまでアプリ内から自分で解約する手段が一切無かった
// （＝解約時に自動でフリーへ戻すWebhookの修正をしても、そもそも解約する方法が
// 無ければ意味がないため、あわせて追加した）。
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/verify-auth';

export async function POST(req: Request) {
  try {
    // 2026-09修正（重大なセキュリティ修正）: 以前はリクエストボディのuserIdをそのまま
    // 信用しており、他人のuserIdを指定するだけで他人のStripeお客様ポータル
    // （支払い方法の変更・解約ができる画面）のURLを取得できてしまっていた。
    // ログイン中の本人からのリクエストであることをIDトークンで検証してから処理する。
    const verifiedUid = await verifyRequestUser(req);
    if (!verifiedUid) {
      return NextResponse.json({ error: 'ログイン情報を確認できませんでした。再度ログインしてからお試しください。' }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
    }

    const userSnap = await adminDb.collection('users').doc(verifiedUid).get();
    const stripeCustomerId = userSnap.exists ? (userSnap.data() as any)?.stripeCustomerId : null;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'お支払い情報が見つかりませんでした。時間をおいて再度お試しください。' }, { status: 400 });
    }

    const origin = req.headers.get('origin');
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Portal session error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
