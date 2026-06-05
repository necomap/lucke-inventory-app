import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { AuditLog } from '../types/inventory';

/**
 * 監査ログをFirestoreに記録するユーティリティ関数
 */
export const logAction = async (
  action: AuditLog['action'],
  targetType: AuditLog['targetType'],
  targetId: string,
  userId: string,
  userName: string,
  details: string | object
) => {
  try {
    const logData = {
      action,
      targetType,
      targetId,
      userId,
      userName,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      timestamp: serverTimestamp(),
    };

    const auditCollection = collection(db, 'auditLogs');
    await addDoc(auditCollection, logData);
  } catch (error) {
    console.error('Failed to write audit log', error);
  }
};
