# 片付ける・再開する

[入口に戻る](../README.md) · [5つの実習](tutorial.md)

## 普段の片付けは1コマンド

READMEがあるフォルダで実行します。実習の途中でも使えます。

```sh
mise run cleanup
```

**確認入力なしで、この教材のTerraform管理対象を削除します。**
削除予定を自分で確かめながら練習したい場合は、[実習5](tutorial.md#実習5削除してもう一度作る)の手動操作を使ってください。

タスクは次の順で処理します。

1. S3とローカルファイルのstateを読み、管理対象があるか調べる。
2. S3の管理対象があればMotoを起動し、Terraformで削除する。
3. ローカルファイルの管理対象があればTerraformで削除する。
4. この教材のMotoコンテナとComposeネットワークを停止・削除する。

実習3に進んでいなければ、片付けのためにMotoを新しく起動することはありません。
すでにMotoを停止していても、必要なら起動してstateを整理します。
管理対象がない状態でも実行でき、何度繰り返しても構いません。

`片付け完了。` が表示されれば終了です。途中で失敗した場合は、
エラーを解消して同じコマンドを再実行します。失敗を無視してstateを削除する処理はありません。
Dockerに接続できることが必要です。プロバイダーを削除していた場合は再取得のため通信も必要です。

## なぜDockerの停止だけでは足りないのか

**停止するのはコンテナです。イメージはコンテナを起動するために保存しておく材料です。**
イメージを残しておいても、それ自体が動き続けることはありません。

この教材では、片付けるものが2か所にあります。

| 場所 | 作ったもの | 片付け方 |
| --- | --- | --- |
| PC上 | `generated/hello.txt` とTerraformの管理情報 | Terraformの `destroy` |
| Docker内 | Moto、S3のバケットとファイル | 先に `destroy`、最後にComposeの `down` |

Motoはメモリ内だけにデータを持つため、停止するとS3のデータは消えます。
一方、PC上のファイルとstateはDockerの停止では消えません。
`cleanup` はTerraformの管理台帳も整理してから、コンテナを片付けます。
対象はこの教材です。他のプロジェクトのコンテナをまとめて停止する必要はありません。

## 何が消えて、何が残るか

| 対象 | `mise run cleanup` の結果 |
| --- | --- |
| Terraformが管理するローカルファイル | 削除する（空のフォルダは残る場合がある） |
| Terraformが管理するS3バケット・オブジェクト | 削除する |
| この教材のMotoコンテナ・ネットワーク | 停止・削除する |
| Motoのイメージ | 次の起動用に残す |
| `.tf`、README、ロックファイル | 残す |
| 実習4の `.auto.tfvars`、自分で編集した設定 | 残す |
| stateファイルとバックアップ | 残る場合がある。現在の管理対象の一覧は空になる |
| `.terraform/` とmiseで導入したツール | 次の実行用に残す |

stateのバックアップに以前の記録が残っていても、リソースが動き続けているという意味ではありません。
stateファイルの有無ではなく、管理対象の一覧で確認します。

```sh
docker compose ps -a
```

コンテナの一覧が空なら、Motoは片付いています。stateファイルがある場合は、次も空になります。

```sh
mise exec -- terraform -chdir=examples/local state list
mise exec -- terraform -chdir=examples/s3 state list
```

一度も実行していない実習では `No state file was found` と表示されることがあります。削除する管理対象がない状態です。
片付けの確認のために `plan` を使うと、残っている設計図から「もう一度作る予定」が表示されます。これは正常です。

## ディスク容量も空けたいとき

通常の片付けに加えて、この教材で使うMotoのイメージも削除します。

```sh
mise run cleanup:images
```

先に `cleanup` を実行し、その後Composeの `down --rmi all` で
**このCompose設定が使うイメージ**を削除します。PC全体のDockerイメージを削除する操作ではありません。
他のコンテナが同じイメージを使っていてDockerが削除を拒否した場合は、強制削除せずエラーで止まります。
次の `mise run moto:up` ではイメージを再ダウンロードします。
Terraformのプロバイダーやmiseのツールは残ります。

## 続きから再開する

現在の設定や入力値から作り直せます。

```sh
mise exec -- terraform -chdir=examples/local init
mise exec -- terraform -chdir=examples/local apply
mise run moto:up
mise exec -- terraform -chdir=examples/s3 init
mise exec -- terraform -chdir=examples/s3 apply
```

確認にはそれぞれ `yes` と入力します。実習4の入力値が残っていれば、追加ファイルも復元します。
ローカルだけ再開する場合は、最初の2行だけで構いません。

## 実習1からやり直す

まず `mise run cleanup` を実行します。
次に `examples/local/main.tf` の `content` を最初の値に戻します。

```hcl
content = "Hello, Terraform!\n"
```

実習4の入力値を削除します。

```sh
rm -f examples/s3/lesson4.auto.tfvars
```

[実習1](tutorial.md#実習1ファイルを作る)から同じ手順で進められます。
片付けタスクは、学習中の編集内容を勝手に元に戻しません。

## 公式仕様

- [Terraformのdestroy](https://developer.hashicorp.com/terraform/cli/commands/destroy)
- [Docker Composeのdownとイメージ削除](https://docs.docker.com/reference/cli/docker/compose/down/)
- [イメージとは](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
