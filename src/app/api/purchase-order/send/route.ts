// app/api/purchase-order/send/route.ts - 発注書メール送信
// ============================================================
// 2026-09新設: 仕入先ごとの発注書作成ページ（/suppliers/[id]/order）から呼ばれる。
// 他の外部送信API（/api/portal・/api/checkout）と同じく、リクエストボディの値を
// そのまま信用せず、IDトークンで検証した本人のuidと、supplierドキュメントの
// userIdが一致することをサーバー側で確認してから送信する
// （他人のsupplierIdを指定して、その人の仕入先に勝手にメールを送れてしまうことを防ぐ）。
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/verify-auth';

interface OrderItem {
  name: string;
  quantity: number;
  unit: string;
}

export async function POST(req: Request) {
  try {
    const verifiedUid = await verifyRequestUser(req);
    if (!verifiedUid) {
      return NextResponse.json({ error: 'ログイン情報を確認できませんでした。再度ログインしてからお試しください。' }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
    }

    const body = await req.json();
    const supplierId: string = body.supplierId;
    const items: OrderItem[] = Array.isArray(body.items) ? body.items : [];
    const memo: string = typeof body.memo === 'string' ? body.memo : '';

    if (!supplierId || items.length === 0) {
      return NextResponse.json({ error: '仕入先と商品を指定してください。' }, { status: 400 });
    }

    const supplierSnap = await adminDb.collection('suppliers').doc(supplierId).get();
    if (!supplierSnap.exists) {
      return NextResponse.json({ error: '仕入先が見つかりませんでした。' }, { status: 404 });
    }
    const supplier = supplierSnap.data() as { userId?: string; name: string; email?: string };
    if (supplier.userId !== verifiedUid) {
      return NextResponse.json({ error: 'この仕入先を操作する権限がありません。' }, { status: 403 });
    }
    if (!supplier.email) {
      return NextResponse.json({ error: 'この仕入先にはメールアドレスが登録されていません。' }, { status: 400 });
    }

    // 発注元（本人）のメールアドレスを、返信先として使う
    let fromUserEmail = '';
    try {
      if (adminAuth) {
        const userRecord = await adminAuth.getUser(verifiedUid);
        fromUserEmail = userRecord.email || '';
      }
    } catch (e) {
      // 取得できなくても送信自体は継続する
      console.error('Failed to resolve sender email:', e);
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_FROM;
    if (!resendApiKey || !fromAddress) {
      return NextResponse.json({ error: 'メール送信が設定されていません（管理者にご連絡ください）。' }, { status: 500 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const itemLines = items
      .map((it) => `・${it.name}　${it.quantity} ${it.unit}`)
      .join('\n');

    const textBody = [
      `${supplier.name} 御中`,
      '',
      'いつもお世話になっております。下記の通り発注いたします。',
      '',
      `発注日: ${today}`,
      '',
      '【発注内容】',
      itemLines,
      '',
      memo ? `【備考】\n${memo}` : '',
      '',
      'Lucke Inventory（在庫管理システム）より自動送信されました。',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: supplier.email,
        ...(fromUserEmail ? { reply_to: fromUserEmail } : {}),
        subject: `【発注書】${today}`,
        text: textBody,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('Resend API error (purchase order):', res.status, errBody);
      return NextResponse.json({ error: 'メール送信に失敗しました。' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Purchase order send error:', error);
    return NextResponse.json({ error: error.message || '送信に失敗しました。' }, { status: 500 });
  }
}
