// app/api/admin/stats/route.ts - 管理画面（オーナー専用）向けの集計API
// ============================================================
// 2026-09新設: 全ユーザーを横断した集計データ（ユーザー数・商品数・登録推移など）を返す。
// 呼び出し元がアプリのオーナー本人であることをverifyRequestAdmin()で確認したうえで、
// Firestoreのルールを経由しないAdmin SDKで全ユーザー分のデータを集計する
// （＝この確認が無いと、全ユーザーのデータが誰でも見えてしまう非常に重大な問題になる）。
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { verifyRequestAdmin } from '@/lib/verify-auth';

type AuthUserInfo = {
  uid: string;
  email: string | undefined;
  createdAt: string;
  lastSignInAt: string | undefined;
};

function buildMonthlyTrend(isoDates: string[], months: number) {
  const now = new Date();
  const buckets: { month: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, count: 0 });
  }
  const monthIndex = new Map(buckets.map((b, i) => [b.month, i]));
  for (const iso of isoDates) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const idx = monthIndex.get(key);
    if (idx !== undefined) buckets[idx].count++;
  }
  return buckets;
}

export async function GET(req: Request) {
  const caller = await verifyRequestAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!adminDb || !adminAuth) {
    return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
  }

  try {
    // 1. Firebase Authに登録されている全ユーザーを取得（1000件ずつページネーション）。
    // ※ users コレクションはStripeで一度でも課金したユーザーのドキュメントしか無いため、
    // 「登録ユーザー総数」はFirestoreではなくFirebase Auth側から数える必要がある。
    const allAuthUsers: AuthUserInfo[] = [];
    let pageToken: string | undefined;
    do {
      const result = await adminAuth.listUsers(1000, pageToken);
      for (const u of result.users) {
        allAuthUsers.push({
          uid: u.uid,
          email: u.email,
          createdAt: u.metadata.creationTime,
          lastSignInAt: u.metadata.lastSignInTime,
        });
      }
      pageToken = result.pageToken;
    } while (pageToken);

    // 2. プラン情報（users コレクション。ドキュメントが無いユーザーはfree扱い）
    const usersSnap = await adminDb.collection('users').get();
    const planByUid = new Map<string, { plan: string; updatedAt: FirebaseFirestore.Timestamp | undefined }>();
    usersSnap.forEach((doc) => {
      const data = doc.data();
      planByUid.set(doc.id, { plan: data.plan || 'free', updatedAt: data.updatedAt });
    });

    let freeCount = 0;
    let premiumCount = 0;
    let proCount = 0;
    for (const u of allAuthUsers) {
      const plan = planByUid.get(u.uid)?.plan || 'free';
      if (plan === 'pro') proCount++;
      else if (plan === 'premium') premiumCount++;
      else freeCount++;
    }

    // 3. 全体件数（集計クエリなので、ドキュメントを全部読まずに軽量に取得できる）
    const [itemsCountSnap, txCountSnap] = await Promise.all([
      adminDb.collection('items').count().get(),
      adminDb.collection('transactions').count().get(),
    ]);

    // 4. 登録推移（直近12か月、月別。Firebase Authのアカウント作成日時から集計）
    const signupTrend = buildMonthlyTrend(
      allAuthUsers.map((u) => u.createdAt).filter(Boolean),
      12
    );

    // 5. アップグレード推移（直近12か月、月別）。
    // 注意: usersドキュメントのupdatedAtは「最後にプランが変わった日時」であり、
    // 解約（プレミアム/プロ→free）でも更新される。そのため、ここでは
    // 「現時点でpremium/proのユーザーの、最後の更新日時」を集計した近似値。
    const planChangeTimestamps: string[] = [];
    usersSnap.forEach((doc) => {
      const data = doc.data();
      if ((data.plan === 'premium' || data.plan === 'pro') && data.updatedAt) {
        const ts: FirebaseFirestore.Timestamp = data.updatedAt;
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts as unknown as string);
        planChangeTimestamps.push(d.toISOString());
      }
    });
    const planChangeTrend = buildMonthlyTrend(planChangeTimestamps, 12);

    // 6. 未使用・休眠ユーザー: 商品を1件も登録していない、または30日以上ログインが無い。
    // ユーザー数が多くなってきたら重くなる（人数分のクエリを並列実行しているため）ので、
    // 将来的にはキャッシュ化・バッチ集計への切り替えを検討すること（現状は暫定実装）。
    const staleCandidates = await Promise.all(
      allAuthUsers.map(async (u) => {
        const itemSnap = await adminDb!.collection('items').where('userId', '==', u.uid).limit(1).get();
        return { u, hasItems: !itemSnap.empty };
      })
    );

    const staleUsers = staleCandidates
      .filter(({ u, hasItems }) => {
        const daysSinceLogin = u.lastSignInAt
          ? (Date.now() - new Date(u.lastSignInAt).getTime()) / 86400000
          : Infinity;
        return !hasItems || daysSinceLogin >= 30;
      })
      .map(({ u, hasItems }) => ({
        uid: u.uid,
        email: u.email || '(不明)',
        plan: planByUid.get(u.uid)?.plan || 'free',
        createdAt: u.createdAt,
        lastSignInAt: u.lastSignInAt || null,
        hasItems,
      }))
      .sort((a, b) => {
        const at = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
        const bt = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
        return at - bt;
      })
      .slice(0, 50);

    return NextResponse.json({
      totals: {
        userCount: allAuthUsers.length,
        byPlan: { free: freeCount, premium: premiumCount, pro: proCount },
        totalItems: itemsCountSnap.data().count,
        totalTransactions: txCountSnap.data().count,
      },
      signupTrend,
      planChangeTrend,
      staleUsers,
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats', details: error.message }, { status: 500 });
  }
}
