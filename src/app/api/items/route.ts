import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// 2026-09修正: 以前はクライアント用のFirebase SDK（db）をサーバー側から直接使っており、
// Firestoreセキュリティルールを「ログインユーザー本人のみ許可」に厳格化すると、
// サーバー側にはログインセッション（request.auth）が存在しないため permission-denied に
// なってしまう構造だった。HACCP連携など他アプリから呼ばれるサーバー間APIなので、
// ルールを経由しないAdmin SDK（adminDb）を使うように統一する。
//
// 2026-09修正（重大なセキュリティ修正）: このAPIには認証チェックが一切無く、
// userIdさえ分かれば誰でもその人の在庫データ一覧を取得できてしまっていた。
// 同じ外部連携用の /api/items/receive・/api/items/consume と同じく、
// 呼び出し元（HACCP等）と共有しているシークレット（INVENTORY_SYNC_SECRET）を
// ヘッダーで照合する方式に統一する。
// ★このAPIを呼んでいる側（HACCPアプリなど）も、リクエストヘッダーに
// `x-sync-secret: <INVENTORY_SYNC_SECRETの値>` を付けるよう、あわせて対応が必要。
// 対応が完了するまでは、このAPIの呼び出しはすべて401エラーになる点に注意。
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-sync-secret');
  if (!process.env.INVENTORY_SYNC_SECRET || secret !== process.env.INVENTORY_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const queryCategory = searchParams.get('category');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }
  if (!adminDb) {
    console.error('Firebase Admin DB is not initialized.');
    return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
  }

  try {
    // 1. ユーザー設定の取得 (連携カテゴリ制限があるかチェック)
    let allowedCategories: string[] = [];
    const settingsSnap = await adminDb.collection('settings').doc(userId).get();
    if (settingsSnap.exists) {
      const settingsData = settingsSnap.data() as Record<string, unknown>;
      const haccpCategories = (settingsData?.haccpCategories as string) || '';
      if (haccpCategories.trim()) {
        allowedCategories = haccpCategories.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    // 2. 商品一覧の取得
    const querySnapshot = await adminDb.collection('items').where('userId', '==', userId).get();

    let items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 3. 連携カテゴリ制限フィルタの適用
    if (allowedCategories.length > 0) {
      items = items.filter((item: any) => 
        item.category && allowedCategories.some(cat => item.category.toLowerCase() === cat.toLowerCase())
      );
    }

    // 4. クエリパラメータ指定カテゴリフィルタの適用
    if (queryCategory) {
      items = items.filter((item: any) => 
        item.category && item.category.toLowerCase() === queryCategory.toLowerCase()
      );
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching items API:', error);
    return NextResponse.json({ error: 'Failed to fetch items', details: error.message }, { status: 500 });
  }
}
