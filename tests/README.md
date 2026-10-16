# 教材の動作確認

[全体の入口](../README.md) · [補助コード](../support/README.md)

```sh
mise run check
mise run test:lessons
```

test:lessonsは.mise内の一時コピーに専用namespace・ポート・stateを用意します。
既存の学習データをコピーせず、テスト用リソースだけを作成・削除します。
専用ログは.mise/test-course-*/logsに残します。

対象を絞って再検証する場合は教材IDを指定します。

```sh
mise run test:lessons -- 02-docker-systems/02-web-database
```

基礎の移動・state引き継ぎ、HTTP保存・取得・削除、DB再起動、ジョブ待機・再開、SQS重複配信、Moto停止と復元、個別・全体・繰り返し・途中失敗の片付けを検証します。
テスト用のイメージタグだけを削除し、通常の教材用キャッシュと他のコンテナを残すことも確認します。
