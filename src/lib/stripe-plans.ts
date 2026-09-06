// lib/stripe-plans.ts - 課金プラン（premium/pro）の定義
// ============================================================
// 2026-09新設: foodlabel-pro（lib/stripe-plans.ts）と同じ考え方。
// 在庫アプリはStripeダッシュボードで事前に価格（Price）を作らず、checkout.sessions.create時に
// price_dataでその場で価格を組み立てる方式を既存踏襲している（app/api/checkout/route.ts）。
// そのため「価格ID→プラン」の対応表ではなく、「プランキー→表示名・金額」の対応表として持つ。
//
// 2026-09: premium(スタンダード)は月額¥980に決定（まだ実際の課金は始まっていない状態からの
// 初回設定。price_data方式のためStripeダッシュボード側の作業は不要、この数値のみで確定する）。
// proは金額まだ相談中のため暫定値のまま。
export type PaidPlan = 'premium' | 'pro';

export const PAID_PLANS: PaidPlan[] = ['premium', 'pro'];

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'premium' || value === 'pro';
}

export const PLAN_PRICING: Record<PaidPlan, { name: string; description: string; unitAmount: number }> = {
  premium: {
    name: 'Lucke Inventory スタンダードプラン',
    description: 'ロケーション管理、カスタム項目、広告なし',
    unitAmount: 980, // 円/月（2026-09確定）
  },
  pro: {
    // 2026-09新設・暫定価格（要相談）: foodlabel-pro連携（自動在庫減算）・拠点数拡張・
    // 高度なエクスポート/分析機能などを含む上位プラン。
    name: 'Lucke Inventory プロプラン',
    description: 'FoodLabel Pro連携（製造・仕込の自動在庫減算）、拠点数拡張、高度なエクスポート・分析機能',
    unitAmount: 2980, // 円/月（暫定値・要相談）
  },
};
