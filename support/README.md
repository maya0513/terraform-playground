# 補助コードと検証の入口

[全体の入口](../README.md) · [構成のリファレンス](../docs/reference/README.md)

ここは教材を支える実装です。インフラの学習を進めるために、このコードを先に読む必要はありません。

| 場所 | 役割 |
| --- | --- |
| apps/static | Nginxで配信する小さな静的ページ |
| apps/demo/app.ts | メモ・ファイル・ジョブ用のHTTP API。Expressで実装 |
| apps/demo/storage.ts | PostgreSQL、Redis、S3、DynamoDB、SQSへのアクセス |
| apps/demo/worker.ts | RedisまたはSQSから取り出し、CSVを生成 |
| apps/demo/static | ブラウザー用HTML/CSS/JavaScript |
| moto/compose.yaml | 教材ごとに独立したMotoを起動 |

## 開発時の確認

```sh
mise exec -- pnpm install --frozen-lockfile
mise run check
mise run test:lessons
```

checkはTerraformの検証、Compose、TypeScriptの型、文書リンクを確認します。
test:lessonsは専用namespace・ポート・stateのコピーで順番に構築し、HTTP経由で動作確認して片付けます。
アプリを編集した場合は、lesson:prepareでソースのハッシュを含む新しいタグをビルドします。
その後plan/applyすると必要なコンテナが置き換わります。

## デモの範囲

メモはPostgreSQL、CSVの結果もPostgreSQLに保存します。
AWS編はS3にファイル、DynamoDBにファイル情報とジョブ状態を保存します。
アプリの行やファイル1件ずつはTerraformのstateで管理しません。
Redisの例は単純なリストで、処理中断後の再配信を保証しません。
SQSの例は1ワーカーで動かし、完了済みジョブの再処理を避け、同じジョブの出力先を同じS3キーにします。
認証、複数ワーカーの排他、トランザクションをまたぐ障害回復、本番運用の実装は含めません。
