import { adminAuth } from './firebase-admin';
import { isAdminEmail } from './admin-access';

// 2026-09追加（セキュリティ強化）: これまで /api/checkout・/api/portal は、リクエストの
// JSONボディに書かれた userId をそのまま信用していた。これは「ブラウザから送られてくる値は
// 誰でも自由に書き換えられる」という前提が抜けており、悪意のある第三者が他人のuserIdを
// 指定してリクエストを送ることで、他人のStripeお客様ポータル（支払い方法の変更・解約）を
// 開けてしまう、という重大な問題があった。
//
// 対策として、クライアントには「Authorization: Bearer <FirebaseのIDトークン>」ヘッダーを
// 付けて送ってもらい、サーバー側でFirebase Admin SDKにより本物のログイン中トークンかどうかを
// 検証する。これにより、リクエストが「本当にそのユーザー自身のブラウザから」送られたことを
// 保証できる（IDトークンは本人のログインセッションでしか発行されず、他人が偽造できない）。
//
// 検証に成功した場合はFirebase Authのuidをそのまま返す。呼び出し側は、この関数が返した
// uidだけを「本人のuserId」として使い、リクエストボディに書かれたuserIdは絶対に信用しない こと。
export async function verifyRequestUser(request: Request): Promise<string | null> {
  try {
    if (!adminAuth) {
      console.error('Firebase Admin Auth is not initialized.');
      return null;
    }
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (!idToken) {
      return null;
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch (error) {
    console.error('ID token verification failed:', error);
    return null;
  }
}

// 2026-09追加: 管理画面（全ユーザーのデータを横断的に見られるページ・API）専用の検証。
// 上のverifyRequestUserと同じくIDトークンを検証したうえで、さらにメールアドレスが
// admin-access.tsに書かれた本人のものと一致する場合のみ許可する。
// settings.role（ユーザーが自分で書き換えられる値）は絶対に管理者判定に使わないこと。
export async function verifyRequestAdmin(request: Request): Promise<{ uid: string; email: string } | null> {
  try {
    if (!adminAuth) {
      console.error('Firebase Admin Auth is not initialized.');
      return null;
    }
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (!idToken) {
      return null;
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!isAdminEmail(decoded.email)) {
      return null;
    }
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch (error) {
    console.error('Admin ID token verification failed:', error);
    return null;
  }
}
