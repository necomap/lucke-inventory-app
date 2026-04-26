export interface InventoryItem {
  id: string;
  name: string;
  barcode: string;
  category: string;
  unit: string; // 単位 (kg, 個, mlなど)
  status: string; // '新品', '中古', '要修理' など
  location: string;
  memo: string;
  imageUrl?: string;
  currentStock: number;
  minStock: number;
  lastUpdated: any; // Firestore Timestamp
  createdAt: any;
  updatedBy: string; // スタッフ名
}

export interface StockTransaction {
  id: string;
  itemId: string;
  type: 'in' | 'out'; // 入庫・出庫
  quantity: number;
  unitPrice: number; // 入庫時の単価
  date: any;
  staffName: string;
  memo: string;
  // HACCP連携用
  supplierName?: string;
  lotNo?: string;
  bestBefore?: string; // 賞味期限
}

export type ValuationMethod = 'FIFO' | 'MOVING_AVERAGE';

export interface UserSettings {
  valuationMethod: ValuationMethod;
  enableSound: boolean;
  enableVibration: boolean;
  enableAlerts: boolean;
  enableHaccpFields: boolean; // 仕入先、ロット、賞味期限の表示
}
