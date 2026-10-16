# 困ったとき

[全体の入口](../../README.md) · [片付ける](cleanup.md)

近い症状の項目を確認してください。エラーはstateを消して解決する必要はありません。

## Dockerに接続できない

`permission denied ... /var/run/docker.sock` は接続権限のエラーです。
UbuntuのDocker Engineでは、自分の開発用PCの管理者権限で実行します。

```sh
sudo usermod -aG docker "$USER"
```

ログインし直し、ターミナルと作業を実行するアプリも開き直してください。
既に起動したプロセスには新しいグループ権限が反映されません。Dockerグループは管理者相当の操作ができます。

`Cannot connect to the Docker daemon` なら、Docker本体が起動しているか確認します。

```sh
sudo systemctl start docker
docker info
```

別のPCでDocker Desktopを使う場合は、そのアプリを起動します。

## Node.jsのバージョンが違う・.tsを実行できない

```sh
mise install
mise exec -- node --version
mise exec -- pnpm install --frozen-lockfile
```

24.22.0になっていることを確認し、プロジェクトのルートからmiseタスクを実行します。
この教材はNode.jsのTypeScript直接実行を使います。設定はtarget/libがESNext、モジュールがNodeNextです。

## ポートが使用中

教材のURLはDocker編が8101〜8103、AWS編が8201〜8203、Motoが5000・5101〜5103です。
`docker ps` と `lesson:status` で使っている環境を確認してください。
他のアプリなら、その用途を確認してからポートを空けます。PC全体のコンテナを一括停止しないでください。

## applyでデモイメージを取得できない

先に同じ教材の `lesson:prepare` を実行します。ビルドはprepare、リソースの作成はapplyです。
補助アプリや依存関係を変更したときも、prepareで新しいイメージを作ってからplan/applyと進みます。

## Webが開けない・healthyにならない

例としてDocker 2を確認します。

```sh
mise run lesson:status -- 02-docker-systems/02-web-database
docker logs terraform-playground-d02-web
docker logs terraform-playground-d02-db
```

prepareとapplyが最後まで成功していることを確認します。
DB・Motoが止まっているとWebのヘルスチェックも失敗します。必要な環境を復旧してから再実行します。
初回のダウンロードは通信や空き容量も確認してください。

## ジョブが受付済みのまま

ワーカーを停止した実習の後なら、ワーカーを起動します。

```sh
docker start terraform-playground-a03-worker
docker logs terraform-playground-a03-worker
```

Docker編の場合は `terraform-playground-d03-worker` です。
SQS編ではワーカーの処理中断後、メッセージが再び見えるまで最大30秒程度待つ場合があります。
Redis編の単純なリストでは、取り出した後の強制終了時の再配信は保証しません。失敗状態なら、原因を直して新しくCSV出力を依頼します。

## Motoを再起動してデータが消えた

Motoのデータはメモリ内だけなので、停止・再起動で消えます。
PCのstateには管理対象が残りますが、Terraformが消失を検知して作り直せます。

```sh
mise run lesson:prepare -- 03-aws-systems/01-object-storage
mise run lesson:plan -- 03-aws-systems/01-object-storage
mise run lesson:apply -- 03-aws-systems/01-object-storage
```

バケットなどの構成は戻りますが、アプリで保存したデータは戻りません。
共通タスクのplan/applyは先にMotoへの接続を確認し、停止中はエラーで止まります。実AWSには切り替わりません。
直接Terraformを実行すると、S3だけの構成では停止を「バケットの消失」と扱う場合があるため、システム編では共通タスクを使ってください。
片付けたい場合はprepare/applyで作り直さず、`lesson:cleanup` または `cleanup` を使います。

## 基礎のバケットが空ではない

AWS CLIなどでTerraform管理外のファイルを追加すると、基礎のバケットは削除に失敗します。
追加したファイルを確認して削除し、再度cleanupします。システム編はアプリのファイルも片付ける設定です。

## cleanupが途中で止まる

Docker接続、ポート、Terraformの構文、state、通信のエラーを確認します。
途中まで削除できていても、原因を解消して同じcleanupを再実行できます。
全体cleanupは全stateを読み取ってから削除を始め、失敗を無視してstateを消す処理はしません。

## cleanup:imagesでイメージを削除できない

別のコンテナが同じイメージを使っている可能性があります。
普通の片付けが終わっていれば、イメージを残したままでも構いません。強制削除は不要です。

## 設定と手順をチェックしたい

```sh
mise run check
```

Terraformの書式・構文、Compose、TypeScriptの型、文書リンクを確認します。
専用のテスト環境で実際の構築まで試す場合は `mise run test:lessons` を使います。
テストは順番に実行して片付け、ログを `.mise/test-course-*/logs/` に保存します。
