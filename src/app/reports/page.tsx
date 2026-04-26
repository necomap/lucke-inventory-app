'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { InventoryItem, StockTransaction, ValuationMethod } from '@/types/inventory';
import { useAuth } from '@/context/AuthContext';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { calculateFIFO, calculateMovingAverage } from '@/lib/valuation';
import { BarChart3, Download, Calculator, TrendingUp, Package } from 'lucide-react';
import dayjs from 'dayjs';

export default function ReportsPage() {
  const { user } = useAuth();
  const { settings } = useInventorySettings();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 全商品と全履歴を取得
    const fetchAllData = async () => {
      const itemsSnap = await getDocs(collection(db, 'items'));
      const itemsData = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(itemsData);

      const transSnap = await getDocs(query(collection(db, 'transactions'), orderBy('date', 'asc')));
      const transData = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockTransaction));
      setTransactions(transData);
      
      setLoading(false);
    };

    fetchAllData();
  }, []);

  const calculateTotalValuation = () => {
    let total = 0;
    const itemized: { name: string, value: number, stock: number }[] = [];

    items.forEach(item => {
      const itemTrans = transactions.filter(t => t.itemId === item.id);
      const value = settings.valuationMethod === 'FIFO' 
        ? calculateFIFO(itemTrans, item.currentStock)
        : calculateMovingAverage(itemTrans);
      
      total += value;
      itemized.push({ name: item.name, value, stock: item.currentStock });
    });

    return { total, itemized };
  };

  const { total, itemized } = calculateTotalValuation();

  const exportCSV = () => {
    const headers = ['商品名', '在庫数', `評価額(${settings.valuationMethod})`];
    const rows = itemized.map(i => [i.name, i.stock, Math.round(i.value)]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_report_${dayjs().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}>レポートを生成中...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="inventoryHeader">
        <h1>在庫レポート (確定申告用)</h1>
        <button onClick={exportCSV} className="btn btnSecondary">
          <Download size={18} /> CSV出力
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Package className="featureIcon" style={{ margin: '0 auto 1rem' }} />
          <div className="label">総在庫品目数</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{items.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Calculator className="featureIcon" style={{ margin: '0 auto 1rem', color: 'var(--secondary-color)', background: 'rgba(236, 72, 153, 0.1)' }} />
          <div className="label">総在庫評価額 ({settings.valuationMethod})</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>
            ¥{Math.round(total).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 className="settingsTitle" style={{ marginBottom: '1rem' }}><TrendingUp size={20} /> 商品別評価額一覧</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="historyTable">
            <thead>
              <tr>
                <th>商品名</th>
                <th>在庫数</th>
                <th>評価額</th>
              </tr>
            </thead>
            <tbody>
              {itemized.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>{item.stock}</td>
                  <td>¥{Math.round(item.value).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="helpText" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        評価方法は設定画面から変更可能です。このデータは確定申告の際の棚卸資産の計上にご利用いただけます。
      </p>
    </div>
  );
}
