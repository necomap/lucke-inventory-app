import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import { isPaidPlan } from '@/lib/stripe-plans';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // イベントに応じた処理
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (userId) {
      if (!adminDb) {
        console.error('Firebase Admin DB is not initialized.');
        return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
      }

      // stripeCustomerId・stripeSubscriptionIdは、解約時（customer.subscription.deleted）に
      // どのユーザーを降格させればよいか特定するために保存する（2026-09追加。
      // 以前は保存しておらず、解約しても永久にプレミアムのままになる不具合があった）。
      // planはcheckout作成時にmetadataへ入れた値（premium/pro）をそのまま使う。
      // 未知の値・欠落時は後方互換のためpremium扱いにする。
      const purchasedPlan = isPaidPlan(session.metadata?.plan) ? session.metadata!.plan : 'premium';
      await adminDb.collection('users').doc(userId).set({
        plan: purchasedPlan,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        updatedAt: new Date(),
      }, { merge: true });

      console.log(`User ${userId} upgraded to ${purchasedPlan}.`);
    }
  }

  // 2026-09新設: 解約（サブスクリプション終了）時に自動でフリープランへ降格させる。
  // 「今すぐ解約」「期間終了時に解約」いずれも、実際に契約が終了した時点で
  // customer.subscription.deletedが発生するため、これだけ処理すれば十分
  // （期間終了待ちの間に飛ぶcustomer.subscription.updatedの間はまだ有効な契約なので
  // プレミアムのままでよい）。
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;

    if (!adminDb) {
      console.error('Firebase Admin DB is not initialized.');
      return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
    }

    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (customerId) {
      const snapshot = await adminDb.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        await userDoc.ref.set({ plan: 'free', updatedAt: new Date() }, { merge: true });
        console.log(`User ${userDoc.id} downgraded to free (subscription ended).`);
      } else {
        console.warn(`customer.subscription.deleted received but no matching user found (customer=${customerId}).`);
      }
    }
  }

  return NextResponse.json({ received: true });
}
