import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// HACCPアプリ（https://haccp.lucke.jp/）で「納品を記録」した際に、サーバー間で
// 呼び出される連携用API。ユーザー本人のFirebase Authトークンは使わず、両アプリの
// Vercel環境変数に同じ値を設定した INVENTORY_SYNC_SECRET をヘッダーで照合する。
//
// 一致する商品が見つからない場合はHTTPエラーにはせず matched:false を返す。
// HACCP側はこれを「未マッチ」として扱い、HACCP側の納品記録自体は失わない設計になっている
// （haccp-app側の models/inventorySync.js 参照）。
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-sync-secret');
  if (!process.env.INVENTORY_SYNC_SECRET || secret !== process.env.INVENTORY_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!adminDb) {
    console.error('Firebase Admin DB is not initialized.');
    return NextResponse.json({ error: 'Firebase Admin DB is not initialized.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { userId, itemName, quantity, unit, supplierName, lotNo, bestBefore, staffName } = body || {};

    if (!userId || !itemName) {
      return NextResponse.json({ error: 'userId と itemName は必須です' }, { status: 400 });
    }
    const qty = parseFloat(quantity);
    if (!qty || Number.isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'quantity は正の数値である必要があります' }, { status: 400 });
    }

    // userIdの商品だけをFirestoreから取得し、商品名の一致（前後空白を除去し、大文字小文字を
    // 無視）はアプリ側(JS)で判定する。Firestoreは大文字小文字を無視した検索ができないため。
    const snap = await adminDb.collection('items').where('userId', '==', userId).get();
    const normalizedTarget = String(itemName).trim().toLowerCase();
    const targetDoc = snap.docs.find(
      (d) => String(d.data().name || '').trim().toLowerCase() === normalizedTarget
    );

    if (!targetDoc) {
      return NextResponse.json(
        { matched: false, message: `商品「${itemName}」が見つかりませんでした` },
        { status: 200 }
      );
    }

    await targetDoc.ref.update({
      currentStock: admin.firestore.FieldValue.increment(qty),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: staffName || 'HACCP連携',
    });

    await adminDb.collection('transactions').add({
      itemId: targetDoc.id,
      userId,
      type: 'in',
      quantity: qty,
      unitPrice: 0,
      date: admin.firestore.FieldValue.serverTimestamp(),
      staffName: staffName || 'HACCP連携',
      memo: `(HACCP連携${supplierName ? ' / 仕入先: ' + supplierName : ''}) 納品検品記録より自動登録`,
      lotNo: lotNo || '',
      bestBefore: bestBefore || '',
      imageUrl: '',
    });

    return NextResponse.json({ matched: true, itemId: targetDoc.id }, { status: 200 });
  } catch (error: any) {
    console.error('Error in /api/items/receive:', error);
    return NextResponse.json(
      { error: 'Failed to process receive', details: error.message },
      { status: 500 }
    );
  }
}
