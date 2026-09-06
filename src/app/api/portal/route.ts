// app/api/portal/route.ts - Stripeカスタマーポータル（お支払い方法の変更・解約）
// ============================================================
// 2026-09新設: これまでアプリ内から自分で解約する手段が一切無かった
// （＝解約時に自動でフリーへ戻すWebhookの修正をしても、そもそも解約する方法が
// 無ければ意味がないため、あわせて追加した）。
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userIdが必要です' }, { status: 400 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
    }

    const userSnap = await adminDb.collection('users').doc(userId).get();
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
