# 変更履歴 (CHANGELOG)

このファイルは、Lucke Inventory（在庫アプリ）に対して行った変更を日付ごとに記録していくものです。
Webアプリのため「インストールマニュアル」を機能追加のたびに新しく作る・書き換えるのはやめて、
このファイル1本に新しいセクションを追記していく方式にします。**過去のセクションは書き換えず、
新しい変更は必ず一番上に新しいセクションとして追加します。**

新しいセクションを書くときの型（すべての項目が必要なわけではなく、該当するものだけ書く）:

```
## YYYY-MM-DD - 概要タイトル

### 追加・変更
- ...

### セキュリティ
- ...

### デプロイ時の注意
- ...

### 動作確認チェックリスト
- [ ] ...
```

---

## 2026-09-12 - Googleログイン不具合の修正 ＆ Admin SDK未初期化の発覚

### 追加・変更
- Googleログイン（`signInWithPopup`）が、ブラウザのCross-Origin-Opener-Policy（COOP）によって永久に完了しない不具合を修正。`next.config.ts`に`Cross-Origin-Opener-Policy: same-origin-allow-popups`ヘッダーを明示的に設定し、自分が開いたポップアップの状態を確認できるようにした。
- `signInWithGoogle`（`src/context/AuthContext.tsx`）を、まず`signInWithPopup`を試し、ポップアップがブロックされた場合のみ`signInWithRedirect`にフォールバックする方式に変更。失敗時はログイン画面にエラー内容を表示するようにした（以前はエラーが握りつぶされ、原因究明ができなかった）。
- Firebase Hostingが一度も有効化されておらず、Googleログインの中継ページが参照する`/__/firebase/init.json`が404になっていた問題を修正（Firebase Hostingを最小構成で有効化。実際のアプリ配信は引き続きVercelで行う）。
- 調査目的の一時的なconsole.logが`AuthContext.tsx`・`login/page.tsx`に残っている。原因確定後に削除予定。

### セキュリティ・重大な発覚事項
**[要対応・ユーザー側の作業]** Vercelの環境変数`FIREBASE_SERVICE_ACCOUNT`（Firebase Admin SDKの認証情報）が**そもそも設定されていなかった**ことが判明した。これにより、Admin SDKに依存する以下のAPIが、これまで本番環境で正しく動作していなかった可能性が高い。
- `/api/checkout`・`/api/portal`（課金・お支払いポータル）
- `/api/items`（HACCP連携用の商品一覧取得API）
- `/api/foodlabel/recipes`
- `/api/admin/stats`（オーナー専用管理画面の集計）
- `/api/cron/backup`（自動バックアップメール）

対応: Firebaseコンソール →プロジェクトの設定→「サービス アカウント」タブから秘密鍵（JSON）を新規生成し、Vercelの環境変数`FIREBASE_SERVICE_ACCOUNT`にJSONの中身をそのまま設定→再デプロイ。ダウンロードしたJSONファイルはローカルにも残さないこと（Firebaseプロジェクトへの管理者権限を持つ機密情報のため）。

### デプロイ時の注意
1. Vercelに`FIREBASE_SERVICE_ACCOUNT`を設定後、必ず再デプロイする（環境変数の追加だけでは既存のデプロイには反映されない）。
2. 再デプロイ後、Cron Jobsから`/api/cron/backup`を手動実行し、エラーが出ずメールが届くことを確認する。
3. あわせて、課金画面（アップグレード・お支払い方法の変更）とHACCP連携（`/api/items`）が正常に動作することも確認する。

### 動作確認チェックリスト
- [ ] `https://inventory.lucke.jp/login` でGoogleログインすると、ポップアップが開いてアカウント選択でき、ログインが完了する
- [ ] `FIREBASE_SERVICE_ACCOUNT`設定・再デプロイ後、Cron Jobsから`/api/cron/backup`を手動実行してバックアップメールが届く
- [ ] 設定画面・アップグレード画面から正常にStripeのポータル・チェックアウトに遷移できる
- [ ] HACCP側から`/api/items`が正常にデータを取得できる

---

## 2026-09-08 - 自動バックアップメール機能の追加

姉妹アプリ（FoodLabel Pro）と同じ方式で実装。DB（Firestore）側に独自の自動バックアップが
無い前提で、アプリ側からも「入力し直しが効かないデータ」を毎日1回メールで送っておく保険。

### 追加・変更
- `GET /api/cron/backup` を新設。Vercel Cron Jobsから毎日1回（`vercel.json`に`0 15 * * *` = 日本時間0:00で設定）呼び出され、対象データをJSON化してResend経由でメール送信する。
- バックアップ対象: `items`（在庫商品マスタ）、`transactions`（入出庫履歴）、`stocktakeSessions`・`stocktakeEntries`（棚卸記録）、`settings`（ユーザー設定。ただし`foodlabelApiKey`は機密情報のため除外）。
- 対象外（意図的に除外）: `users`（プラン・Stripe顧客IDなど決済関連情報は含めない方針）、`auditLogs`（際限なく増えるため。必要になれば直近N日分に絞って追加を検討）、Firebase Authのアカウント情報（そもそもFirestoreに保存していない）。

### セキュリティ
- `/api/cron/backup` は `Authorization: Bearer <CRON_SECRET>` が一致しないと401を返す（Vercel Cronが自動付与するヘッダーと照合）。この保護が無いと、全データを誰でもメールで抜き出せてしまうため必須。

### デプロイ時の注意
1. Vercelの環境変数に以下を設定してからデプロイすること（無いとバックアップメールが送信されない）。
   - `RESEND_API_KEY`（Resendの実際のAPIキー。FoodLabel Proで使っているものと同じでよい）
   - `EMAIL_FROM`（送信元アドレス。Resendで送信ドメイン認証済みのもの）
   - `BACKUP_EMAIL`（送り先。未設定時は`ADMIN_EMAIL`を使う）
   - `CRON_SECRET`（任意の推測されにくい文字列。Vercelに設定するだけでよく、Cron Jobs側の追加設定は不要）
2. デプロイ後、Vercelダッシュボードの「Cron Jobs」から手動実行し、`BACKUP_EMAIL`宛にメールが届くか確認する。

### 動作確認チェックリスト
- [ ] Vercelダッシュボードから `/api/cron/backup` を手動実行し、バックアップメールが届く
- [ ] メール本文の件数サマリーと、添付JSONの中身（items・transactions等）が実際のデータと一致している
- [ ] `CRON_SECRET` を付けずに `/api/cron/backup` を呼び出すと401になる

---

## 2026-09-08 - オーナー専用管理画面の追加

### 追加・変更
- `/admin` にオーナー専用の管理画面を新設。全ユーザー横断で、登録ユーザー数・プラン別内訳（free/premium/pro）・総商品数・総取引件数・登録推移（直近12か月）・プラン変更推移（目安）・休眠/未使用ユーザー一覧（商品未登録 or 30日以上未ログイン、最大50件）を表示。
- ナビゲーションにも「管理画面」リンクを追加（オーナー本人がログインしているときだけ表示）。

### セキュリティ
- 管理画面へのアクセスは、`settings.role`（ユーザーが自分の設定画面から自由に書き換えられる値）とは完全に切り離し、`src/lib/admin-access.ts` に直書きしたオーナー本人のメールアドレス（`putin3martin3@gmail.com`）とIDトークンの一致でのみ許可。画面側の表示制御に加え、集計API（`/api/admin/stats`）側でも同じ検証を行っているため、画面のガードを迂回されても他人のデータは取得できない。
- 管理者を増やす場合は `src/lib/admin-access.ts` の `ADMIN_EMAILS` にメールアドレスを追加するだけでよい。

### 動作確認チェックリスト
- [ ] `putin3martin3@gmail.com` でログインし、ナビゲーションに「管理画面」が表示され、`/admin`で集計データが正しく取得できる
- [ ] 別のアカウントでログインした状態で `/admin` にアクセスすると、アクセス権がない旨が表示される

---

## 2026-09-08 - バーコード棚卸機能・ラベルプリンター対応・セキュリティ強化

### 追加・変更
- 商品にバーコードが無い場合の自動発行機能（EAN-13、社内用プレフィックス`20`を使用、市販のスキャナーで読み取り可能）。バーコード画像の表示・印刷にも対応。
- バーコードラベルの印刷方式に、A4シート印刷に加えて**ラベルプリンター向け**のレイアウト（実寸mm・1商品1ページ）を追加。よく使われるサイズのプリセット（ブラザーQL-62×29mm など）と、mm単位の手入力の両方に対応。
- **本格棚卸セッション機能（プロプラン限定）** を新設。未カウント商品の一覧、差異（理論値と実測値のズレ）レポート、CSVエクスポート、過去セッションの履歴管理ができる。複数端末での同時カウントにも対応（Firestoreのリアルタイム同期・`increment()`による安全な加算処理）。
- 商品の新規登録・編集フォームのUIを、他のページと統一感のあるセクション区切りのカードデザインに刷新。
- `/scan`（クイックスキャン）ページの「納品書（OCR）」ボタンが、取扱マニュアルの記載（プロプラン限定機能）と食い違ってプレミアムプランでも使えてしまっていた不具合を修正。プレミアム以下では「納品書」ボタンがアップグレード案内リンクに変わる。

### セキュリティ

**[重大・修正済み]** `/api/checkout`・`/api/portal` が、リクエストボディに書かれた `userId` を無条件に信用していた。第三者が他人の `userId` を指定してリクエストを送るだけで、他人のStripeお客様ポータル（お支払い方法の変更・解約ができる画面）のURLを取得できてしまう状態だった。Firebaseの IDトークンをサーバー側（Admin SDK）で検証し、リクエストが本当にその本人のログインセッションから来ているかを確認する方式に変更。クライアント側（`upgrade`・`settings`画面）もあわせて、IDトークンを送るように修正済み。

**[修正済み]** `src/app/api/items/route.ts`・`src/app/api/foodlabel/recipes/route.ts` が、サーバー側の処理であるにもかかわらず、ログインユーザー用のFirebase SDK（`db`）で直接Firestoreを読んでいた。ルールが `if true`（全開放）の間はたまたま動いていたが、下記のFirestoreルール厳格化を行うと `permission-denied` で壊れる作りだったため、ルールの影響を受けないAdmin SDK（`adminDb`）に統一した。

**[要対応・ユーザー側の作業]** Firestoreのセキュリティルールが `allow read, write: if true;`（ログイン有無に関わらず誰でも全データを読み書き可能）のままになっていることを確認した。実際のコレクション構成（`items` / `transactions` / `auditLogs` / `stocktakeSessions` / `stocktakeEntries` / `settings` / `users`）に合わせたルール案を `firestore.rules_案.txt` として用意済み。適用は下記「デプロイ時の注意」を参照（自分のデータのみ読み書きできるよう制限する内容）。

**[修正済み・要HACCP側対応]** `src/app/api/items/route.ts`（HACCPなど外部から呼ばれる商品一覧取得API）に認証チェックが無く、`userId` さえ分かれば誰でもその人の在庫データ一覧を取得できる状態だった。他の外部連携API（`items/receive`・`items/consume`）と同じ共有シークレット方式（`INVENTORY_SYNC_SECRET`をヘッダー`x-sync-secret`で照合）で保護する修正を実施。**この変更をデプロイすると、HACCP側もリクエストヘッダーに`x-sync-secret`を付けるよう対応しないと、このAPIの呼び出しがすべて401エラーになる。** デプロイ前にHACCP側の対応状況を確認すること。

### デプロイ時の注意
1. **HACCP側が `x-sync-secret` ヘッダーを送るよう対応済みであることを先に確認する。** 未対応のままこのアプリをデプロイすると、HACCPからの商品一覧取得（`/api/items`）がすべて401エラーになり連携が止まる。
2. 今回のコード修正一式（`src/app/scan/page.tsx`、`src/app/inventory/labels/`、`src/app/api/items/route.ts`、`src/app/api/foodlabel/recipes/route.ts`、`src/app/api/checkout/route.ts`、`src/app/api/portal/route.ts`、`src/lib/firebase-admin.ts`、`src/lib/verify-auth.ts`、`src/app/upgrade/page.tsx`、`src/app/settings/page.tsx` ほか）をGitHub Desktopでコミット・push・デプロイし、正常に動作することを確認する。
3. 動作確認後、Firebaseコンソール →「Firestore Database」→「ルール」タブで `firestore.rules_案.txt` の内容を貼り付けて公開する。
4. アプリを一通り操作し、`permission-denied` が出ないか確認する（万一出た場合はルール履歴からすぐ元の内容に戻せる）。

### 動作確認チェックリスト
- [ ] 商品登録画面でバーコードの「自動発行」ができ、画像が表示される
- [ ] バーコードラベルの印刷（A4シート／ラベルプリンターの両方）ができる
- [ ] プロプランのアカウントで本格棚卸セッションを開始・カウント・確定でき、在庫が正しく調整される
- [ ] プレミアム以下のプランで「納品書」ボタンがアップグレード案内になっている
- [ ] 設定画面・アップグレード画面の「お支払い方法の変更・解約」ボタンから、正常にStripeのポータルへ遷移できる（ログインしているアカウント自身の情報が表示される）
- [ ] Firestoreルール適用後も、ログイン・商品登録・入出庫・棚卸・HACCP連携（納品記録）のいずれでもエラーが出ない
- [ ] HACCP側から `/api/items`（商品一覧取得）を呼び出して、401にならず正常にデータが返る
