export interface InventoryItem {
  id: string;
  userId?: string; // マルチテナント対応
  name: string;
  barcode: string;
  category: string;
  unit: string; // 単位 (kg, 個, mlなど)
  unitPrice?: number; // 商品価格（単価）
  status: string; // '新品', '中古', '要修理' など
  location: string;
  memo: string;
  imageUrl?: string;
  currentStock: number;
  minStock: number;
  lastUpdated: any; // Firestore Timestamp
  createdAt: any;
  updatedBy: string; // スタッフ名
  customFields?: Record<string, any>; // 独自項目用
}

export interface WarehouseLocation {
  id: string;
  name: string;
  address?: string;
  description?: string;
}

export interface StockTransaction {
  id: string;
  userId?: string; // マルチテナント対応
  itemId: string;
  type: 'in' | 'out'; // 入庫・出庫
  status?: 'pending' | 'approved' | 'rejected'; // 出庫承認ワークフロー用
  quantity: number;
  unitPrice: number; // 入庫時の単価
  date: any;
  staffName: string;
  memo: string;
  // HACCP連携用
  supplierName?: string;
  lotNo?: string;
  bestBefore?: string; // 賞味期限
  imageUrl?: string; // 証拠写真
}

export type ValuationMethod = 'FIFO' | 'MOVING_AVERAGE';

export interface UserSettings {
  valuationMethod: ValuationMethod;
  enableSound: boolean;
  enableVibration: boolean;
  enableAlerts: boolean;
  enableHaccpFields: boolean; // 仕入先、ロット、賞味期限の表示
  customFields?: CustomFieldDefinition[]; // カスタム項目の定義
  locations?: WarehouseLocation[]; // 拠点管理用
  businessTypes?: {
    manufacturing: boolean; // 製造業モード
    retail: boolean; // 仕入販売業モード
  };
  role?: 'admin' | 'staff'; // ユーザー権限
  haccpCategories?: string; // HACCP連携カテゴリ
}

export interface AuditLog {
  id: string;
  userId?: string; // マルチテナント対応
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  targetType: 'INVENTORY' | 'TRANSACTION' | 'SETTINGS';
  targetId: string;
  userName: string;
  timestamp: any;
  details: string; // JSON文字列または詳細な説明
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  required: boolean;
}
