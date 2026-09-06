import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getPlanLimits } from '@/lib/plan-limits';

// app/api/items/consume/route.ts - foodlabel-pro連携による自動在庫「差し引き」API
// ============================================================
// 2026-09新設: foodlabel-pro（レシピ＋ラベル印刷アプリ）で印刷したとき、あるいは
// HACCPアプリ経由で、材料の在庫をまとめて減算するためのAPI。
// POST /api/items/receive（HACCPの「納品を記録」＝入庫・加算）とは逆方向の処理のため
// 別エンドポイントにしている。認証は在庫アプリ↔HACCP間で既に使っているものと同じ
// INVENTORY_SYNC_SECRET をヘッダーで照合する方式（サーバー間通信のため、ユーザー本人の
// Firebase Authトークンは使わない）。
//
// items: [{ itemName, amount, unit }, ...] をまとめて1回のリクエストで処理する
// （材料の数だけ何度も通信しない）。producedItemName/producedQuantityを指定すると、
// 「製造・仕込」ページの手動フローと同じ考え方で、完成品側の在庫も増やす
// （無ければ新規作成する）。
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
    const { userId, items, producedItemName, producedQuantity } = body || {};

    if (!userId || !Array.isArray(items)) {
      return NextResponse.json({ error: 'userId と items（配列）は必須です' }, { status: 400 });
    }

    // 2026-09新設: 自動差し引き（foodlabel-pro連携）はproプラン限定機能。
    // 手動の「製造・仕込」ページ（app/api/foodlabel/recipes/route.ts）と同じ判定を
    // ここでも行う（多層防御。呼び出し元の共有シークレットだけでは、どのプランの
    // アカウントかまでは区別できないため）。
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const plan = userSnap.exists ? ((userSnap.data() as any)?.plan ?? 'free') : 'free';
    if (!getPlanLimits(plan).canUseFoodlabelSync) {
      return NextResponse.json({ results: [], planRequired: true, message: 'proプラン限定機能のため反映しませんでした' }, { status: 200 });
    }

    const snap = await adminDb.collection('items').where('userId', '==', userId).get();
    const findByName = (name: string) =>
      snap.docs.find((d) => String(d.data().name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());

    const results: Array<{ name: string; matched: boolean; unitMismatch?: boolean; expectedUnit?: string; message?: string }> = [];

    for (const raw of items) {
      const itemName = String((raw && raw.name) || '').trim();
      const amt = parseFloat(raw && raw.amount);
      if (!itemName || !amt || Number.isNaN(amt) || amt <= 0) {
        results.push({ name: itemName, matched: false, message: '数量が不正です' });
        continue;
      }
      const targetDoc = findByName(itemName);
      if (!targetDoc) {
        results.push({ name: itemName, matched: false, message: `商品「${itemName}」が見つかりませんでした` });
        continue;
      }

      // 単位チェック: /api/items/receive と同じ考え方。双方に単位が設定されていて
      // 食い違っている場合は、意味のない数量を減算してしまわないよう反映しない。
      const targetData = targetDoc.data();
      const targetUnit = String(targetData.unit || '').trim().toLowerCase();
      const requestUnit = String((raw && raw.unit) || '').trim().toLowerCase();
      if (targetUnit && requestUnit && targetUnit !== requestUnit) {
        results.push({
          name: itemName, matched: false, unitMismatch: true, expectedUnit: targetData.unit,
          message: `単位が一致しないため反映しませんでした（在庫アプリ側の単位: ${targetData.unit} / 送られてきた単位: ${raw.unit}）`,
        });
        continue;
      }

      await targetDoc.ref.update({
        currentStock: admin.firestore.FieldValue.increment(-amt),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'FoodLabel連携',
      });
      await adminDb.collection('transactions').add({
        itemId: targetDoc.id,
        userId,
        type: 'out',
        quantity: amt,
        unitPrice: 0,
        date: admin.firestore.FieldValue.serverTimestamp(),
        staffName: 'FoodLabel連携',
        memo: '(FoodLabel Pro連携) 印刷による自動製造記録より自動差し引き',
      });
      results.push({ name: itemName, matched: true });
    }

    // 完成品側の在庫も増やす（在庫アプリの「製造・仕込」ページの手動フローと同じ考え方）。
    // producedItemName/producedQuantityが渡された場合のみ。
    let producedItemId: string | null = null;
    const pQty = parseFloat(producedQuantity);
    if (producedItemName && pQty > 0) {
      const existing = findByName(String(producedItemName));
      if (existing) {
        await existing.ref.update({
          currentStock: admin.firestore.FieldValue.increment(pQty),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'FoodLabel連携',
        });
        producedItemId = existing.id;
      } else {
        const newRef = await adminDb.collection('items').add({
          name: producedItemName,
          category: '完成品',
          currentStock: pQty,
          unit: '個',
          minStock: 0,
          status: 'available',
          userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'FoodLabel連携',
        });
        producedItemId = newRef.id;
      }
      await adminDb.collection('transactions').add({
        itemId: producedItemId,
        userId,
        type: 'in',
        quantity: pQty,
        unitPrice: 0,
        date: admin.firestore.FieldValue.serverTimestamp(),
        staffName: 'FoodLabel連携',
        memo: '(FoodLabel Pro連携) 印刷による自動製造記録',
      });
    }

    return NextResponse.json({ ok: true, results, producedItemId }, { status: 200 });
  } catch (error: any) {
    console.error('Error in /api/items/consume:', error);
    return NextResponse.json({ error: 'Failed to process consume', details: error.message }, { status: 500 });
  }
}
