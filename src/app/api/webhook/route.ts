import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
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

      await adminDb.collection('users').doc(userId).set({
        plan: 'premium',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        updatedAt: new Date(),
      }, { merge: true });
      
      console.log(`User ${userId} upgraded to premium.`);
    }
  }

  return NextResponse.json({ received: true });
}
