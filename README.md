# SES Match prototype

スマートフォン対応の案件マッチ度分析プロトタイプ（Next.js App Router / TypeScript）。案件入力、分析結果プレビュー、プロフィール設定、重みの合計100%自動調整、案件一覧を含みます。画面はデザイン確認用サンプルデータです。分析 API、ファイル抽出 API、Supabase 初期スキーマも同梱しています。

## 起動

1. Node.js 20以降を用意し、`npm install`。
2. Supabase プロジェクトを作成し、SQL Editorで `supabase/migrations/001_initial.sql` を実行。
3. `.env.example` を `.env.local` にコピーして Supabase URL / anon key / Anthropic API key / モデル名を設定。
4. `npm run dev` を実行して http://localhost:3000 を開く。

## API

- `POST /api/extract` multipart form: `kind=project|sheet` と `text` または PDF/XLSX の `file`。抽出値は Zod 検証され、不正 JSON は一度だけ再試行。
- `POST /api/analyze` JSON: `{sheet, profile:{weights:{tech,experience,career}, ...}, project}`。点数は0–100に検証し、総合値はコードで計算。重み合計は100必須。
- Anthropic の呼び出しは `lib/ai.ts` に集約し、APIキーはサーバー環境変数のみで扱います。

## 注意 / 残作業

この作業環境に Node.js がなく、依存関係の導入・起動確認ができていません。画面は現在サンプルデータで描画し、フォーム値をAPIへ接続する処理、Supabase Auth のログイン/セッション、アップロード・抽出結果の保存、利用者ごとの保存済みデータ読み込みは次の接続作業として残っています。SQL の RLS と非公開 Storage バケットのポリシーは用意済みです。公開前に Supabase Auth と server-side session をアプリに結線してください。

初回利用時には所属会社の規定・お客様との契約を確認してください。AIへ資料を送る前の固有名詞マスキングは未実装です。資料本文やAI入出力をログに出さない運用にしてください。Supabase無料プランの一時停止・バックアップ手順とVercel Hobby利用条件を確認のうえ利用してください。

## GitHubへ登録するとき

ソースコードのみを登録してください。Supabaseの実データ、スキルシートや案件ファイル、`.env.local` はGitHubに置きません。`.gitignore` で環境変数ファイルなどを除外し、必要な変数名だけを `.env.example` に記載しています。最初のリポジトリは **Private** を推奨します。

このフォルダをGitリポジトリのルートにして登録します。GitHubで空のPrivateリポジトリを作ったあと、このフォルダで次を実行します。

```sh
git init
git add .
git status --short
git commit -m "Initial SES Match prototype"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
git push -u origin main
```

`git status --short` で `.env.local` や利用者データが含まれていないことを確認してからコミットしてください。GitHubにpushした後、VercelにGitHubリポジトリを接続し、SupabaseとAnthropicの値はVercelのEnvironment Variablesに登録します。
