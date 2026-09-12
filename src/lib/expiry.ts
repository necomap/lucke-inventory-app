// lib/expiry.ts
// ============================================================
// 2026-09新設: 賞味期限アラート機能。
//
// このアプリは「現時点でどのロットが何個残っているか」を個別に記録しておらず、
// 商品ごとの合計在庫数（InventoryItem.currentStock）と、入出庫の履歴
// （StockTransaction。入庫時のみ lotNo / bestBefore を記録）だけを持っている。
//
// そのため「賞味期限が近い在庫が、今どれだけ残っているか」は正確には分からないが、
// lib/valuation.ts の calculateFIFO と同じ考え方（先入先出＝古い入庫から先に
// 出ていくという前提）を使えば、「現在庫として残っていると推定されるロット」を
// 入庫の新しい順に近似計算できる。この推定ロットの中から、賞味期限が近いものを
// 拾い上げるのが本ファイルの役割。
//
// 注意: あくまで推定であり、実際の出庫が先入先出の通りに行われていなかった場合
// （新しいロットから先に使ってしまった等）は、この推定とズレることがある。
// 「安全側」に倒すため、推定に幅を持たせず単純にFIFO順で計算している。
import { StockTransaction } from '@/types/inventory';

export interface EstimatedLot {
  quantity: number;
  unitPrice: number;
  bestBefore: string; // YYYY-MM-DD 形式
  lotNo?: string;
  supplierName?: string;
  receivedDate: any; // 入庫日（Firestore Timestamp等）
}

/**
 * FIFO前提で「現在庫として残っていると推定されるロット」の一覧を計算する。
 * calculateFIFO（lib/valuation.ts）と同じロジック（入庫を新しい順に見て、
 * 現在庫数に達するまで積み上げる＝古いロットから先に消費された前提）を使うが、
 * 金額の合計ではなく、ロットごとの内訳（数量・賞味期限など）を返す点が異なる。
 */
export function estimateRemainingLots(
  transactions: StockTransaction[],
  currentStock: number
): EstimatedLot[] {
  if (currentStock <= 0) return [];

  const inTransactions = [...transactions]
    .filter((t) => t.type === 'in' && t.quantity > 0)
    .sort((a, b) => {
      const getMs = (d: any) => {
        if (!d) return 0;
        if (typeof d.toMillis === 'function') return d.toMillis();
        if (typeof d.toDate === 'function') return d.toDate().getTime();
        if (d instanceof Date) return d.getTime();
        const parsed = Date.parse(d);
        return isNaN(parsed) ? 0 : parsed;
      };
      return getMs(b.date) - getMs(a.date); // 新しい順
    });

  const lots: EstimatedLot[] = [];
  let remaining = currentStock;

  for (const t of inTransactions) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, t.quantity);
    if (t.bestBefore) {
      lots.push({
        quantity: taken,
        unitPrice: t.unitPrice || 0,
        bestBefore: t.bestBefore,
        lotNo: t.lotNo,
        supplierName: t.supplierName,
        receivedDate: t.date,
      });
    }
    remaining -= taken;
  }

  return lots;
}

export interface ExpiringLotEntry {
  itemId: string;
  itemName: string;
  category?: string;
  location?: string;
  unit: string;
  quantity: number;
  bestBefore: string;
  lotNo?: string;
  daysUntilExpiry: number; // マイナス＝すでに期限切れ
}

function daysBetween(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 複数商品分の推定ロットから、指定日数以内（すでに期限切れも含む）に
 * 賞味期限を迎えるものだけを抽出し、期限が近い順に並べて返す。
 */
export function getUpcomingExpiries(
  items: {
    itemId: string;
    itemName: string;
    category?: string;
    location?: string;
    unit: string;
    currentStock: number;
    transactions: StockTransaction[];
  }[],
  thresholdDays: number
): ExpiringLotEntry[] {
  const result: ExpiringLotEntry[] = [];

  for (const item of items) {
    const lots = estimateRemainingLots(item.transactions, item.currentStock);
    for (const lot of lots) {
      const daysUntilExpiry = daysBetween(lot.bestBefore);
      if (daysUntilExpiry <= thresholdDays) {
        result.push({
          itemId: item.itemId,
          itemName: item.itemName,
          category: item.category,
          location: item.location,
          unit: item.unit,
          quantity: lot.quantity,
          bestBefore: lot.bestBefore,
          lotNo: lot.lotNo,
          daysUntilExpiry,
        });
      }
    }
  }

  result.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return result;
}
