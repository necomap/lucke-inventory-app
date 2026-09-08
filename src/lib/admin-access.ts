// 2026-09追加: アプリ全体の管理者（オーナー本人）だけが使える画面・APIのための判定。
//
// 注意: settings.role（'admin' | 'staff'）とは完全に別物。settings.roleは各ユーザーが
// 自分の設定画面から自由に書き換えられる値（共有端末でスタッフに操作させないための
// 表示切り替え用）なので、これを管理者判定に使うと、どのユーザーも自分でroleを
// 'admin'に書き換えるだけで他人のデータが見える管理画面に入れてしまう。
// そのため、ここではコードに直接書いたメールアドレスの一致だけで判定する。
export const ADMIN_EMAILS = ['putin3martin3@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized);
}
