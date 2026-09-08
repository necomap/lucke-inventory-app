import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT is not set. Firebase Admin SDK will not be initialized.');
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// adminDbを使用する際は、初期化されているか確認が必要
export const adminDb = admin.apps.length > 0 ? admin.firestore() : null;

// 2026-09追加: クライアントから送られてきたFirebase IDトークンをサーバー側で検証するために使う
// （/api/checkout・/api/portal など、ログインユーザー本人からの呼び出しであることを
// 確認する必要があるAPIのため）。こちらもadminDbと同様、初期化されているか確認が必要。
export const adminAuth = admin.apps.length > 0 ? admin.auth() : null;
