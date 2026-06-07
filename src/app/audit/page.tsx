'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AuditLog } from '../../types/inventory';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import './audit.css';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        if (!user) return;
        const q = query(
          collection(db, 'auditLogs'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        let logsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AuditLog[];

        // JS側でソートと制限
        logsData.sort((a, b) => {
          const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return bTime - aTime;
        });
        logsData = logsData.slice(0, 100);

        setLogs(logsData);
      } catch (error) {
        console.error('Failed to fetch audit logs', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [user]);

  return (
    <div className="audit-container">
      <header className="audit-header">
        <h1>変更履歴（監査ログ）</h1>
        <Link href="/settings" className="btn-secondary">設定に戻る</Link>
      </header>

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <div className="table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>操作ユーザー</th>
                <th>アクション</th>
                <th>対象</th>
                <th>詳細</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-data">変更履歴はありません</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A'}
                    </td>
                    <td>{log.userName}</td>
                    <td>
                      <span className={`badge badge-${log.action.toLowerCase()}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.targetType} ({log.targetId})</td>
                    <td className="log-details">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
