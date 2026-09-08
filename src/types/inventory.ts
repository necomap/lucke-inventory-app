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
  // 2026-09新設: FoodLabel Pro（レシピ管理アプリ）連携用APIキー。FoodLabel Pro側の
  // 設定画面で発行したキーをここに貼り付けると、「製造・仕込」ページでレシピが
  // 取得できるようになる（app/api/foodlabel/recipes/route.ts参照）。
  foodlabelApiKey?: string;
}

export interface AuditLog {
  id: string;
  userId?: string; // マルチテナント対応
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  targetType: 'INVENTORY' | 'TRANSACTION' | 'SETTINGS' | 'STOCKTAKE';
  targetId: string;
  userName: string;
  timestamp: any;
  details: string; // JSON文字列または詳細な説明
}

// ============================================================
// 2026-09新設: バーコード棚卸（本格棚卸セッション）機能用の型定義
// ============================================================

export type StocktakeStatus = 'in_progress' | 'completed';

export interface StocktakeSession {
  id: string;
  userId: string;
  name: string; // 例: "棚卸 2026/09/08"
  status: StocktakeStatus;
  locationFilter?: string; // 指定拠点のみ対象にした場合の拠点名（未指定なら全商品対象）
  startedAt: any; // Firestore Timestamp
  startedBy: string; // スタッフ名
  completedAt?: any;
  completedBy?: string;
  totalItems: number; // このセッションの対象商品数
  countedItems: number; // カウント済み商品数
  discrepancyItems: number; // 理論値とズレがあった商品数（確定後に確定値）
  totalDiffValue?: number; // 差異の金額換算合計（確定後。商品単価×差分数量の合計。マイナス=棚卸ロス）
}

export interface StocktakeEntry {
  id: string;
  sessionId: string;
  userId: string;
  itemId: string;
  itemName: string; // 商品名のスナップショット（後から商品名が変わっても棚卸時点の名前で表示するため）
  barcode?: string;
  unit: string;
  category?: string;
  location?: string;
  unitPrice?: number;
  expectedStock: number; // 棚卸開始時点の帳簿在庫（理論値）のスナップショット
  countedStock: number | null; // 実際に数えた数（未カウントならnull）
  diff: number | null; // countedStock - expectedStock（未カウントならnull）
  countedAt?: any;
  countedBy?: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  required: boolean;
}
