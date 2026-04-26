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
