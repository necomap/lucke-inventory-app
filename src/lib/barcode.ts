// lib/barcode.ts
// ============================================================
// 2026-09新設: バーコード棚卸機能のための、バーコード自動発行・表示補助ユーティリティ。
//
// 仕入れた商品にメーカーのバーコードが無い場合（量り売りの食材、手作り品、小分け商品など）に、
// このアプリが「社内独自のバーコード」を自動発行できるようにする。実在するJANコードと
// 衝突しないよう、GS1が「試験・社内用途に予約している」とされるプレフィックス帯 20〜29
// （インストアマーキング用途）を使い、EAN-13として正しいチェックデジットを計算して払い出す。
// これにより、印刷したラベルを一般的なバーコードスキャナ・カメラスキャン双方で問題なく
// 読み取ることができる。

/**
 * EAN-13のチェックデジット（13桁目）を計算する。
 * @param twelveDigits 先頭12桁の数字文字列
 */
export function calculateEAN13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error('EAN-13のチェックデジット計算には12桁の数字が必要です');
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    // 奇数桁(1,3,5...)は×1、偶数桁(2,4,6...)は×3 (0-indexedでは逆になる点に注意)
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * 社内独自の一意なEAN-13形式バーコード（社内使用可能なプレフィックス帯 20〜29 を使用）を1件生成する。
 * 呼び出し側で、同じユーザー内の既存バーコードと重複していないか確認し、
 * 重複していれば再度呼び出して作り直すこと（本関数自体はDBを見ないため）。
 */
export function generateInternalBarcode(): string {
  const prefix = '20'; // 社内・店舗内利用向けプレフィックス帯(20-29)の先頭を使用
  let body = '';
  for (let i = 0; i < 10; i++) {
    body += Math.floor(Math.random() * 10).toString();
  }
  const twelveDigits = prefix + body;
  const checkDigit = calculateEAN13CheckDigit(twelveDigits);
  return twelveDigits + checkDigit.toString();
}

/**
 * 既存のバーコード一覧と重複しない、社内独自バーコードを生成する。
 * @param existingBarcodes 既に使用中のバーコード群（このユーザーの全商品分）
 * @param maxAttempts 衝突時の最大リトライ回数
 */
export function generateUniqueInternalBarcode(
  existingBarcodes: Iterable<string>,
  maxAttempts: number = 10
): string {
  const existing = new Set(Array.from(existingBarcodes, (b) => String(b || '').trim()));
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateInternalBarcode();
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  // 極めて稀なケース: 衝突が続いた場合は末尾にタイムスタンプ由来の値を足して確実にユニーク化
  return generateInternalBarcode() + Date.now().toString().slice(-3);
}

export type BarcodeSymbology = 'EAN13' | 'UPC' | 'EAN8' | 'CODE128';

/**
 * バーコードの値の形（桁数・数字のみかどうか）から、印刷・表示に使う最適なバーコード規格を推定する。
 * 数字13桁なら本格的なEAN-13として、それ以外は汎用的なCODE128として描画する。
 */
export function pickBarcodeSymbology(value: string): BarcodeSymbology {
  const v = String(value || '').trim();
  if (/^\d{13}$/.test(v)) return 'EAN13';
  if (/^\d{12}$/.test(v)) return 'UPC';
  if (/^\d{8}$/.test(v)) return 'EAN8';
  return 'CODE128';
}

/**
 * このアプリが発行したバーコードかどうか（社内プレフィックス帯 20〜29 のEAN-13かどうか）を判定する。
 * UI上で「自社発行バーコード」であることを示すバッジ表示などに使う。
 */
export function isInternalBarcode(value: string): boolean {
  const v = String(value || '').trim();
  if (!/^\d{13}$/.test(v)) return false;
  const prefix = Number(v.slice(0, 2));
  return prefix >= 20 && prefix <= 29;
}
