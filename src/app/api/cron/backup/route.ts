// app/api/cron/backup/route.ts - 毎日1回のデータバックアップ・メール送信（保険用）
// ============================================================
// 2026-09新設: 姉妹アプリ（FoodLabel Pro）と同じ方式。DB（Firestore）側に独自の
// 自動バックアップが無い環境のため、アプリ側からも「入力し直しが効かないデータ」を
// 中心に毎日1回JSONでメール送信しておく保険。Vercel Cron Jobsから叩かれる。
//
// バックアップ対象（このアプリのデータモデルを踏まえて選定。要相談・調整可）:
//   - items（在庫商品マスタ）
//   - transactions（入出庫トランザクション履歴）
//   - stocktakeSessions / stocktakeEntries（棚卸セッション・記録）
//   - settings（ユーザー設定。ただしfoodlabelApiKey等の外部サービスの秘密鍵は
//     機密情報のため除外してから含める）
//
// 意図的に対象外にしているもの:
//   - users（plan・stripeCustomerId等の決済関連情報。FoodLabel Proの方針と同じく、
//     決済関連情報は絶対に含めない。planはStripe側が正の情報源のため、万一の際も
//     そちらから復元できる）
//   - auditLogs（操作ログ。件数が際限なく増えていくため、まずは対象外とした。
//     必要になれば、直近N日分だけに絞って追加することを検討する）
//   - Firebase Authのアカウント情報（メールアドレス・パスワード等はFirebase Auth側で
//     管理されており、そもそもFirestoreには保存していない）
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const maxDuration = 60;

const BACKUP_COLLECTIONS = ['items', 'transactions', 'stocktakeSessions', 'stocktakeEntries', 'suppliers'] as const;

// BigIntが混ざっていてもJSON.stringifyが落ちないようにするreplacer。
// このアプリでBigIntを使っている箇所は無いはずだが、FoodLabel Proの実装を踏襲し、
// 将来的な事故を防ぐための保険として残している。
function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

async function collectBackupData() {
  if (!adminDb) {
    throw new Error('Firebase Admin DB is not initialized.');
  }

  const data: Record<string, unknown[]> = {};

  for (const name of BACKUP_COLLECTIONS) {
    const snap = await adminDb.collection(name).get();
    data[name] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  // settingsは外部API鍵（foodlabelApiKeyなどの機密情報）を取り除いてから含める
  const settingsSnap = await adminDb.collection('settings').get();
  data.settings = settingsSnap.docs.map((doc) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- foodlabelApiKeyを結果から除外するための分割代入
    const { foodlabelApiKey, ...rest } = doc.data() as Record<string, unknown>;
    return { id: doc.id, ...rest };
  });

  return data;
}

export async function GET(request: Request) {
  // Vercel Cronからの呼び出しは、CRON_SECRETをBearerトークンとして自動付与する。
  // これが一致しない場合は誰でも叩けてしまう（全データをメールで抜き出せてしまう）
  // ことになるため、必ず一致確認する。
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await collectBackupData();

    const summary = Object.entries(data)
      .map(([name, rows]) => `${name}: ${rows.length}件`)
      .join(' / ');

    const json = JSON.stringify(data, jsonReplacer, 2);
    const attachmentBase64 = Buffer.from(json, 'utf-8').toString('base64');
    const today = new Date().toISOString().slice(0, 10);

    const fromAddress = process.env.EMAIL_FROM;
    const toAddress = process.env.BACKUP_EMAIL || process.env.ADMIN_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey || !fromAddress || !toAddress) {
      console.error(
        'Backup email is not configured (RESEND_API_KEY / EMAIL_FROM / BACKUP_EMAIL(or ADMIN_EMAIL) is missing).'
      );
      return NextResponse.json({ error: 'Email is not configured.' }, { status: 500 });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: toAddress,
        subject: `[Lucke Inventory] 自動バックアップ ${today}`,
        text: `Lucke Inventoryの自動バックアップです。\n\n件数: ${summary}\n\n添付のJSONファイルをご確認ください。`,
        attachments: [
          {
            filename: `lucke-inventory-backup-${today}.json`,
            content: attachmentBase64,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('Resend API error:', res.status, errBody);
      return NextResponse.json({ error: 'Failed to send backup email', details: errBody }, { status: 502 });
    }

    console.log(`Backup email sent. ${summary}`);
    return NextResponse.json({ ok: true, summary });
  } catch (error: any) {
    console.error('Backup cron error:', error);
    return NextResponse.json({ error: 'Backup failed', details: error.message }, { status: 500 });
  }
}
