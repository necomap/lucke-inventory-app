# 引き継ぎ文書（v2）：Googleログイン不具合＋ファイルが勝手に元に戻る問題（2026-09-12）

このドキュメントは、新しいチャットにそのまま貼り付けて続きを依頼するための資料です。
前回作成した引き継ぎ文書（v1）よりも状況が進んでいるので、こちらを使ってください。

---

## 1. 結論から：今どうなっているか

- **Googleログインの根本原因は特定・修正済みで、一度は本番で成功も確認できている。**
  - 原因は2つあった。
    1. Firebase Hostingが一度も有効化されておらず、ログインの中継ページが参照する`/__/firebase/init.json`が404になっていた（→Firebase Hostingを最小構成で有効化して解決）。
    2. `signInWithPopup`使用時、ブラウザのCross-Origin-Opener-Policy（COOP）によってポップアップの完了検知がブロックされ、ログインが完了しないことがあった（→`next.config.ts`に`Cross-Origin-Opener-Policy: same-origin-allow-popups`を設定して解決）。
  - この2つの修正＋`signInWithRedirect`から`signInWithPopup`への変更（ポップアップブロック時のみredirectにフォールバック）で、**一度ログイン成功・バックアップメールも受信確認済み**。
- **しかし、その後に追加した「毎回Googleアカウント選択画面を出す」機能（`provider.setCustomParameters({ prompt: 'select_account' })`）が、何度Claude側から書き込んでも、ユーザーのパソコン上で元のバージョン（この変更をする前の、デバッグログ入りバージョン）に戻ってしまう、原因不明の現象が発生している。**
  - これはGitHubやVercelの問題以前に、**Claudeがリモートデバイスブリッジ経由でユーザーのPC上のファイルに直接書き込んだ直後の状態を、あとで確認すると書き込み前の内容に戻っている**、という不可解な現象。
  - 同様の現象が、`docs/CHANGELOG.md`と`src/app/login/page.tsx`の一部の変更でも過去に一度発生している（Claudeが書き込み→成功応答→しばらくして確認すると内容が古いものに戻っている）。

## 2. 「ファイルが元に戻る」現象の詳細（最重要・未解決）

### 発生した具体例
1. `docs/CHANGELOG.md`に新しいセクションを追記→書き込み成功の応答→数ターン後に確認すると、追記前の内容（11287バイト）に戻っていた。再度書き込んで解決（今のところ再発なし）。
2. `src/app/login/page.tsx`のGoogleログインボタンに、デバッグログ＋`.catch()`のラッパーを追加→書き込み成功→数ターン後に確認すると、一番最初の状態（`onClick={signInWithGoogle}`のみ、ラッパー無し）に戻っていた。再度書き込んで解決。
3. **（今回・直近）** `src/context/AuthContext.tsx`から調査用の`console.log`を削除し、`provider.setCustomParameters({ prompt: 'select_account' })`を追加して書き込み成功→ユーザーが「ログアウトしてログインしてもアカウント選択画面が出ない」と報告→コンソールログを見ると**削除したはずの`console.log('[auth] ...')`が普通に出力されていた**→Claudeがパソコン上のファイルを直接再確認したところ、`select_account`が無く、`console.log`が残ったままの、1つ前の状態に戻っていることを確認した（現在の最新状態）。

### 疑われる原因（未検証）
- **OneDriveの同期が原因の可能性が高い。** ユーザーの作業フォルダは`C:\Users\emma\Documents\inventory-app`で、Windowsの「Documentsフォルダのバックアップ」機能により`Documents`フォルダ自体がOneDriveと同期されていることが非常によくある。もしそうなっている場合、Claudeがリモートデバイスブリッジ経由でファイルに直接書き込んでも、その直後にOneDriveが「クラウド側の古いバージョン」で上書き（同期）してしまい、結果的に変更が消えたように見える、という可能性がある。
  - 確認方法: エクスプローラーで`C:\Users\emma\Documents`を開き、フォルダ名の右に雲のアイコン（同期中/同期済み）が付いていないか確認する。または、タスクバーのOneDriveアイコンを右クリックして「設定」→同期しているフォルダに`Documents`が含まれていないか確認する。
  - もしOneDrive同期が原因なら、対処法はいくつか考えられる（未検証・要相談）:
    - このプロジェクトフォルダをOneDriveの同期対象外の場所（例: `C:\dev\inventory-app`など）に移動する
    - 作業中だけ一時的にOneDriveの同期を一時停止する
    - OneDriveの「ファイルの競合」履歴（同じファイル名で「(競合しているコピー)」のようなファイルが同じフォルダに増えていないか）を確認する
- その他の可能性として、GitHub Desktopの操作（過去に「secret detected」の対応でコミットを複数回Undoした際、意図した範囲より巻き戻ってしまった）も一因として疑ったが、今回の`AuthContext.tsx`の巻き戻りは、Push・デプロイの話をする**前の時点、Claudeが書き込んだ直後**に既に起きている可能性があり、Git操作だけでは説明がつかない。**OneDrive等のファイル同期系の問題を最優先で疑うべき。**

## 3. アプリの前提情報

- アプリ名: Lucke Inventory（在庫管理SaaS。課金制・ユーザーごとに使う想定）
- スタック: Next.js 16.2.4 / Turbopack、Firebase Auth + Firestore、Stripe（課金）
- デプロイ: ローカルで編集 → GitHub Desktopでコミット・push → Vercelが自動デプロイ
- 本番URL: `https://inventory.lucke.jp`（Vercelのカスタムドメイン）
- Firebaseプロジェクト: `lucke-inventory-app`（authDomain: `lucke-inventory-app.firebaseapp.com`）
- ローカル作業フォルダ: `C:\Users\emma\Documents\inventory-app`
- Claude側の制約: このユーザーのPCには「シェルを直接実行するツール」が無く、ファイルの個別ステージ（アップロード）／コミット（ダウンロード）でのみ操作している（`mcp__remote-devices__device_stage_files` / `device_commit_files` / `device_list_dir`）。Vercel MCP連携はあるが、`inventory-app`プロジェクトは見えず（別チーム/別アカウントの可能性）、`haccp-app`のみ見える状態。
- ドキュメント運用ルール: 機能追加のたびにインストールマニュアルを新規作成せず、`docs/CHANGELOG.md`に日付ごとのセクションを追記する方式（過去のセクションは書き換えない、常に一番上に追記）。**このアプリは課金制・ユーザーごとのデータを扱うため、セキュリティチェックを最優先・厳重に行う方針。**
- CHANGELOGの実ファイルパスは`docs/CHANGELOG.md`（プロジェクト直下ではなく`docs`フォルダの中）。同様に`README.md`・`AGENTS.md`・`CLAUDE.md`・`usage_manual.md`・`firestore.rules_案.txt`・過去のインストールマニュアルもすべて`docs`フォルダの中にある。

## 4. 現在のファイルの実際の状態（2026-09-12・最終確認時点）

### `src/context/AuthContext.tsx`（パソコン上の現状 ＝ 期待する最新状態ではない）
現状（巻き戻ってしまっている内容）:
- `signInWithGoogle`内に調査用の`console.log('[auth] signInWithGoogle 開始')`などが**残っている**
- `provider.setCustomParameters({ prompt: 'select_account' })`は**含まれていない**
- ポップアップ→（ブロック時のみ）リダイレクトのフォールバックロジック自体は入っている（これが無いとログインの根本修正が消えてしまうので最優先で確認すること）

Claudeが書き込もうとして、パソコン上には反映されなかった「あるべき最新の内容」の要点:
```ts
const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  // 共有端末で複数のスタッフが同じブラウザを使う可能性があるため、ブラウザに
  // 既存のGoogleセッションがあっても毎回アカウント選択画面を出すようにする。
  provider.setCustomParameters({ prompt: 'select_account' });
  setAuthError(null);
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    // ...(popup-blocked等ならsignInWithRedirectにフォールバック。詳細は本文参照)
  }
};
```
（console.logは全部削除した状態が最終形。詳しいエラーハンドリングの全文は、このチャットの過去のやり取り、または一つ前の引き継ぎ文書v1を参照）

### `docs/CHANGELOG.md` / `src/app/login/page.tsx`
- 一度巻き戻りが発生したが、Claudeが再度書き込みして、その後は（今のところ）反映が確認できている。ただし今回`AuthContext.tsx`でまた同じ現象が起きたため、**この2ファイルも本当に最新のままか、次のチャットで念のため再確認したほうがよい**。

### `next.config.ts`
- COOPヘッダーの追加は本番で効果が確認できている（ログイン自体は成功したため）。ただし同じ巻き戻り現象が起きていないか、次のチャットで一度中身を確認したほうがよい。

## 5. 次のチャットでやるべきこと（優先順位順）

1. **OneDrive同期の有無を確認する。** ユーザーに「エクスプローラーで`C:\Users\emma\Documents`フォルダを開いて、フォルダに雲のマークが付いていないか」「タスクバーのOneDriveアイコンの設定で、同期対象フォルダに`Documents`が入っていないか」を確認してもらう。
2. もしOneDrive同期が原因と分かれば、対処法（プロジェクトを同期対象外のフォルダに移動する等）をユーザーと相談して決める。
3. 原因が何であれ、`src/context/AuthContext.tsx`に`provider.setCustomParameters({ prompt: 'select_account' })`を追加し、調査用の`console.log`を削除した状態を、**今度こそ確実にパソコン上に定着させる**（書き込み直後だけでなく、少し時間を置いてからもう一度`device_stage_files`等で内容を再確認し、本当に定着しているか確かめること）。
4. 定着を確認できたら、GitHub Desktopでコミット・push→Vercelデプロイ→本番でアカウント選択画面が出るか確認。
5. ついでに、`docs/CHANGELOG.md`・`src/app/login/page.tsx`・`next.config.ts`も同様に、最新の意図した内容のままになっているか再確認する。

## 6. 参考：この一連の作業ですでに解決済みの別件

- Firestoreセキュリティルールを全開放から、ユーザーごとにデータを制限するルールに変更・適用済み。
- `/api/checkout`・`/api/portal`にFirebase IDトークン検証を追加済み。
- `/api/items`（HACCP連携用API）に共有シークレット認証を追加済み（HACCP側対応も完了報告あり）。
- オーナー専用の管理画面（`/admin`）を新設済み。
- 毎日1回の自動バックアップメール機能（`/api/cron/backup`）を実装済み。**Vercelの環境変数`FIREBASE_SERVICE_ACCOUNT`が未設定だったため、Admin SDKを使う上記API群が軒並み動いていなかったことが判明し、設定・再デプロイして解決済み（バックアップメール受信も確認済み）。**

## 7. 新しいチャットへの依頼の仕方（例）

このドキュメントをそのまま貼り付けたあと、たとえば以下のように伝えるとスムーズです。

> このドキュメントは前のチャットからの引き継ぎです。Googleログインの根本修正はできていますが、「毎回アカウント選択画面を出す」設定を追加しても、なぜかパソコン上のファイルが元に戻ってしまう問題が未解決です。上記「5. 次のチャットでやるべきこと」の1番（OneDriveの確認）から一緒に進めてください。
