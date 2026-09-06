// lib/plan-limits.ts
// ============================================================
// 2026-09新設: foodlabel-pro（lib/plan-limits.ts）と同じ考え方で、プランごとの
// 機能フラグ・上限を1ファイルに集約する。
//
// 価格（premium ¥980 / pro ¥2,980）は2026-09に確定済み（lib/stripe-plans.ts参照）。
// 一方、具体的な上限値（maxItems/maxLocations等）はまだ暫定値のまま。
// 決定済みなのは「foodlabel-pro連携（製造・仕込でのレシピ自動取得）はproプラン限定」
// という部分のみ。それ以外のitems/locations上限は現状どのプランでも実質無制限の
// ままにしてある（今のアプリに数量上限を強制する仕組みがまだ無いため、ここで
// 急に制限を課さないようにするため）。将来、具体的な上限値が決まったら
// このファイルの値だけを変更すればよい。
export const PLAN_LIMITS = {
  free: {
    maxLocations: 1,
    canUseCustomFields: false,
    // 2026-09新設: foodlabel-pro（レシピ管理アプリ）と連携し、「製造・仕込」ページで
    // レシピに応じた自動在庫減算ができる機能。以前は無料でも使えてしまっていたが、
    // proプラン限定機能として新設したため、既存利用者も含めfalseにする。
    canUseFoodlabelSync: false,
    canUseAdvancedExport: false,
    hasAds: true,
  },
  premium: {
    maxLocations: 3,
    canUseCustomFields: true,
    // 2026-09: 新設のproプラン限定機能にしたため、premiumでも不可（要相談・変更の余地あり）
    canUseFoodlabelSync: false,
    canUseAdvancedExport: false,
    hasAds: false,
  },
  pro: {
    maxLocations: 10,
    canUseCustomFields: true,
    canUseFoodlabelSync: true,
    canUseAdvancedExport: true,
    hasAds: false,
  },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string | undefined | null) {
  return PLAN_LIMITS[(plan as PlanKey)] ?? PLAN_LIMITS.free;
}

export function isPremiumOrAbove(plan: string | undefined | null) {
  return plan === 'premium' || plan === 'pro';
}

export function isProPlan(plan: string | undefined | null) {
  return plan === 'pro';
}
