# GitHub登録メモ

- リポジトリ名の例: `ses-match-prototype`
- 公開範囲: Private
- リポジトリのルート: このディレクトリ
- 登録対象: アプリソース、SQL migration、README、`.env.example`
- 登録禁止: `.env.local`、APIキー、スキルシート、案件資料、Supabaseから出力した実データ

## 初回登録

GitHubで空のPrivate repositoryを作成します（READMEやLicenseの自動追加はオフにします）。Node.js/npmとGitが使える端末でこのディレクトリに移動し、READMEの「GitHubへ登録するとき」に記載したコマンドを実行します。

コミット前に `git status --short` を確認し、秘密情報やユーザーデータが出ていないことを確認してください。誤って秘密情報をpushした場合、ファイル削除だけでは履歴から消えないため、キーを失効・再発行します。

## 次の接続先

- GitHub: ソースコードとマイグレーション
- Supabase: Auth、PostgreSQL、Private Storage
- Vercel: Webアプリのビルドと公開

Supabase URL、anon key、Anthropic API keyはGitHubへ登録せず、ローカルは `.env.local`、本番はVercelのEnvironment Variablesで管理します。
