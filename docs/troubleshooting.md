# 困ったとき

[入口に戻る](../README.md) · [5つの実習](tutorial.md) · [片付ける](cleanup.md)

エラーに近い項目から確認してください。stateを手動で消して解決しようとする必要はありません。

## Dockerに接続できない

`permission denied ... /var/run/docker.sock` はDockerの接続権限がない状態です。
通常のDocker Engineを使うUbuntuであれば、管理者権限のある端末で実行します。

```sh
sudo usermod -aG docker "$USER"
```

その後ログインし直し、ターミナルやこの作業を実行するアプリも開き直してください。
既に起動しているプロセスには新しいグループ権限が反映されません。
Dockerグループは管理者相当の操作ができるため、自分の開発用PCを想定しています。
`docker info` が成功してから `mise run moto:up` を実行します。

`Cannot connect to the Docker daemon` は、Docker本体が起動していない場合にも出ます。
UbuntuのDocker Engineを使っているこの環境では、次を確認します。

```sh
sudo systemctl start docker
docker info
```

Docker Desktopを使う別のPCでは、Docker Desktopを起動してから確認してください。

## ポート5000が使用中

`docker compose ps` でこのプロジェクトのMotoが起動済みか確認してください。
別のアプリが使っている場合は、そのアプリを確認して停止するか、空けてから起動します。
この教材はComposeとTerraform、AWS CLIのすべてでポート5000を使います。

## Motoが起動しない／接続できない

```sh
docker compose ps
mise run moto:logs
mise run moto:up
```

Motoが停止しているとS3の `plan` や `apply` は接続エラーになります。
実AWSに自動で切り替わることはありません。localの実習はMotoなしでも動きます。

## Motoを再起動してデータが消えた

Motoのデータはメモリ内だけにあり、コンテナの再起動・停止で消えます。
TerraformのstateはPC上に残るので、一時的に「台帳にはあるが実物はない」状態になります。

```sh
mise run moto:up
mise exec -- terraform -chdir=examples/s3 plan
mise exec -- terraform -chdir=examples/s3 apply
```

Terraformが実物の消失を検知し、設定から再作成します。stateを手動削除する必要はありません。
通常の片付けは `mise run cleanup` でまとめて実行できます。

## 「バケットが空ではない」と出る

AWS CLIなどでTerraform管理外のファイルを追加すると、バケットの削除が失敗します。
追加したものを確認して削除してから、もう一度 `destroy` してください。
教材では管理外のファイルまで自動削除する設定は使っていません。

## cleanupが途中で止まる

`cleanup` はエラーを無視せず、その場で止まります。途中まで削除できていても、
原因を解消して `mise run cleanup` を再実行できます。

| エラー | 確認すること |
| --- | --- |
| Dockerの接続権限・サーバー接続 | このページの「Dockerに接続できない」を確認 |
| ポート5000が使用中 | 使っているアプリを確認して、ポートを空ける |
| stateを読み取れない | stateを消さず、エラーメッセージを確認する |
| Terraform設定の構文エラー | 編集した `.tf` や `.auto.tfvars` の書式を直す |
| プロバイダーを取得できない | インターネット接続を確認する |
| バケットが空ではない | Terraform管理外に追加したファイルを確認する |

S3の削除が失敗した場合、調査できるようMotoは動いた状態で残ります。
`mise run moto:logs` でログを確認できます。

## cleanup:imagesでイメージを削除できない

同じMotoイメージを別のコンテナが使っている可能性があります。
通常の片付けは先に終わっているので、容量の解放だけができていない状態です。
イメージを残したままでも構いません。強制削除やPC全体のDockerの掃除は不要です。

## チェックだけ実行したい

```sh
mise run check
```

Composeの設定、Terraformの書式・構文を確認します。
プロバイダーの取得は行いますが、リソースの作成・変更・削除は行いません。
