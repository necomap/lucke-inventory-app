// app/api/foodlabel/recipes/route.ts - FoodLabel Proのレシピ取得プロキシ
// ============================================================
// 2026-09修正（重大なセキュリティ修正）: 以前はfoodlabel-proのPostgreSQLに直接
// 接続し、認証もユーザー絞り込みも無いまま「有効な全レシピ」を無条件に返していた。
// つまり「製造業」モードを使っている任意のユーザーが、他の全事業者の秘密のレシピ
// （材料・配合）を閲覧できてしまう状態だった（2026-09発見。本番のFOODLABEL_DB_URL
// は未設定だったため実害は無かったが、設定した瞬間に発生していた）。
//
// 修正後は、設定画面（/settings）で入力されたfoodlabel-pro発行のAPIキーを使い、
// foodlabel-pro側の認証付きAPI（/api/external/recipes）を呼ぶだけのプロキシにする。
// レスポンス形式は変更していないため、呼び出し側（app/production/page.tsx）の
// 表示コードへの影響はない。
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getPlanLimits } from '@/lib/plan-limits';

// 2026-09修正: settingsの読み取りもクライアント用SDK（db）ではなくadminDbに統一。
// 理由は同ディレクトリの ../../items/route.ts のコメントを参照（Firestoreルールを
// 厳格化した際に、サーバー側にはログインセッションが無いため権限エラーになるのを防ぐため）。

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }
  if (!adminDb) {
    console.error('Firebase Admin DB is not initialized.');
    return NextResponse.json({ error: 'Firebase Admin DB is not initialized.', recipes: [] }, { status: 500 });
  }

  try {
    // 2026-09新設: foodlabel-pro連携はproプラン限定機能。クライアント側の表示制御だけでなく
    // サーバー側でも必ず確認する（多層防御）。
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const plan = userSnap.exists ? ((userSnap.data() as any)?.plan ?? 'free') : 'free';
    if (!getPlanLimits(plan).canUseFoodlabelSync) {
      return NextResponse.json({ recipes: [], planRequired: true });
    }

    const settingsSnap = await adminDb.collection('settings').doc(userId).get();
    const apiKey = settingsSnap.exists ? (settingsSnap.data()?.foodlabelApiKey as string | undefined) : undefined;

    if (!apiKey || !apiKey.trim()) {
      // 未設定の場合はエラーではなく「連携未設定」として空リストを返す
      // （フロント側で案内メッセージを出し分けられるようにnotConfiguredを付与）
      return NextResponse.json({ recipes: [], notConfigured: true });
    }

    const baseUrl = (process.env.FOODLABEL_APP_URL || 'https://foodlabel.lucke.jp').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/external/recipes`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({} as any));
      return NextResponse.json(
        { error: errBody.error || 'FoodLabel Pro側でエラーが発生しました', recipes: [] },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ recipes: data.recipes || [] });
  } catch (error: any) {
    console.error('FoodLabel API proxy error:', error);
    return NextResponse.json({ error: error.message, recipes: [] }, { status: 500 });
  }
}
