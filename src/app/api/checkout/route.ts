import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { isPaidPlan, PLAN_PRICING, type PaidPlan } from '@/lib/stripe-plans';

export async function POST(req: Request) {
  try {
    const { userId, email, plan } = await req.json();

    // 2026-09修正: 新設のproプランにも対応できるよう、金額・商品名を
    // lib/stripe-plans.tsの対応表から引くようにした（以前はpremiumのみ決め打ち）。
    // planが未指定の場合は従来通りpremiumとして扱う（後方互換）。
    const targetPlan: PaidPlan = isPaidPlan(plan) ? plan : 'premium';
    const pricing = PLAN_PRICING[targetPlan];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: pricing.name,
              description: pricing.description,
            },
            unit_amount: pricing.unitAmount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/settings?success=true`,
      cancel_url: `${req.headers.get('origin')}/settings?canceled=true`,
      customer_email: email,
      metadata: {
        userId: userId,
        plan: targetPlan,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
