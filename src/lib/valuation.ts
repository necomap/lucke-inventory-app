import { StockTransaction } from '@/types/inventory';

/**
 * 先入先出法 (FIFO) による在庫金額の計算
 * @param transactions 入庫・出庫の全履歴（日付順）
 * @param currentStock 現在の在庫数
 * @returns 在庫の総額
 */
export function calculateFIFO(transactions: StockTransaction[], currentStock: number): number {
  const inTransactions = transactions
    .filter(t => t.type === 'in')
    .sort((a, b) => b.date.seconds - a.date.seconds); // 新しい順

  let remaining = currentStock;
  let totalValue = 0;

  for (const t of inTransactions) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, t.quantity);
    totalValue += taken * t.unitPrice;
    remaining -= taken;
  }

  return totalValue;
}

/**
 * 移動平均法による在庫金額の計算
 * @param transactions 入庫・出庫の全履歴（日付順）
 * @returns 最終的な平均単価
 */
export function calculateMovingAverage(transactions: StockTransaction[]): number {
  const sortedTransactions = transactions.sort((a, b) => a.date.seconds - b.date.seconds); // 古い順

  let totalStock = 0;
  let totalValue = 0;
  let averagePrice = 0;

  for (const t of sortedTransactions) {
    if (t.type === 'in') {
      const newValue = t.quantity * t.unitPrice;
      totalValue += newValue;
      totalStock += t.quantity;
      if (totalStock > 0) {
        averagePrice = totalValue / totalStock;
      }
    } else {
      // 出庫時はその時の平均単価で価値を減らす
      totalStock -= t.quantity;
      totalValue = totalStock * averagePrice;
    }
  }

  return totalValue;
}
