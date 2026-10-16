# Terraform Playground

## まずここから

1. [準備する](docs/guides/setup.md)：mise、Docker、コマンドの読み方。
2. [基礎の5実習](lessons/01-basics/README.md)：作成・変更・S3・変数・削除。
3. [Dockerで3システム](lessons/02-docker-systems/README.md)：Web → DB → キューとワーカー。
4. [AWSのAPIで3システム](lessons/03-aws-systems/README.md)：S3 → DynamoDB → SQS。Motoでローカル実行。

番号は学ぶ順番です。各フォルダの **README.md** が入口です。
初めは一つずつ起動し、触り終えたらその教材を片付けてから次へ進んでください。
コマンドはすべて、このREADMEのあるフォルダで実行します。

## 今どこまで進めるか

| 段階 | 作るもの | 主な学び |
| --- | --- | --- |
| 基礎 | ローカルファイル・MotoのS3 | Terraformの差分、変数、state |
| Docker 1 | 静的サイト | Webサーバー、ポート |
| Docker 2 | メモ管理＋PostgreSQL | DB、内部ネットワーク、ボリューム |
| Docker 3 | メモ管理＋Redis＋ワーカー | 受付と実行の分離、CSV出力 |
| AWS 1 | ファイル管理＋S3 | オブジェクトストレージ |
| AWS 2 | ファイル管理＋DynamoDB＋S3 | メタデータと本体の分離 |
| AWS 3 | SQS＋ワーカー＋DynamoDB＋S3 | 非同期処理、再配信への備え |

## 終わるときは

全教材の実習データ・コンテナ・専用ネットワーク・専用ボリュームを削除します。確認入力はありません。

```sh
mise run cleanup
```

編集した設定、入力値、ツールとイメージは残します。
一つだけ片付ける方法やイメージの削除は、[片付ける・再開する](docs/guides/cleanup.md)を参照してください。

## 必要なときに読む

- [困ったとき](docs/guides/troubleshooting.md)
- [用語・ファイルの役割・コマンド一覧](docs/reference/README.md)
- [内部の仕組みと検証](support/README.md)

アプリとワーカー、タスク・検証スクリプトはTypeScriptです。Node.jsとpnpmはmiseで固定します。
アプリコードの編集は実習の前提ではありません。LinuxとローカルのDocker Engineを想定します。
初回はツール・依存関係・イメージのダウンロードが必要です。
認証、外部公開、実AWSへのデプロイ、本番運用は今回の対象に含めません。
