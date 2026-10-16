# 片付ける・再開する

[全体の入口](../../README.md) · [教材一覧](../../lessons/README.md)

## 普段の片付け

プロジェクトのルートで実行します。**確認入力なしで実習データも削除します。**

```sh
mise run cleanup
```

各教材のstateを確認し、管理対象がある教材だけTerraformで削除します。
AWS側の管理対象があれば必要なMotoを起動し、削除が終わった後にMotoを停止・削除します。
途中までしか進めていなくても、すでにMotoを止めていても、何度実行しても構いません。
教材の初期化が必要な場合はプロバイダー取得のため通信が必要です。

一つの教材だけ片付ける場合は、教材IDを指定します。

```sh
mise run lesson:cleanup -- 02-docker-systems/02-web-database
```

## コンテナとイメージの違い

停止するのはコンテナです。イメージは起動用に保存した材料で、それ自体が動いているサーバーではありません。
普通の片付けではイメージを残しておくと、次回のダウンロードを省けます。
Docker全体を停止したり、他のプロジェクトのコンテナをまとめて削除したりする必要はありません。

Dockerの停止だけでは、PCのファイルとTerraformの台帳は整理されません。
この教材では「Terraformで実物と台帳を整理 → エミュレーターを停止」の順にします。

## 消えるものと残るもの

| 対象 | 通常のcleanup |
| --- | --- |
| 基礎のgenerated/hello.txt | 削除（空のフォルダは残る場合がある） |
| 教材用Web・DB・Redis・ワーカー | 削除 |
| 教材専用のネットワーク・DB/Redisのボリューム | 削除 |
| Motoのバケット・テーブル・キュー、アップロードとCSV | 削除 |
| 各教材のMotoコンテナとComposeネットワーク | 削除 |
| 自分で編集した.tf・.auto.tfvars | 残す |
| README、アプリ、ロックファイル | 残す |
| stateとバックアップ | 残る場合がある。現在の管理対象は空になる |
| イメージ、プロバイダー、miseのツール、pnpm依存関係 | 残す |

AWSシステム編のバケットは `force_destroy = true` です。
アプリが保存したデータも、教材終了時に一緒に消すためです。
基礎のバケットではこの設定を使わず、Terraformが管理外のファイルを消さないことも学べます。

## 終わったか確認する

```sh
mise run lesson:status -- 02-docker-systems/02-web-database
```

管理対象とコンテナが空なら片付いています。未実行の教材は最初から空です。
空のstateや過去のバックアップが残っていても、リソースが動いているという意味ではありません。
`plan` は設計図から再作成する予定を出すので、片付けの確認には `status` を使います。

## ディスク容量も空ける

```sh
mise run cleanup:images
```

先に全教材を片付け、その後、教材一覧に固定したサービス用イメージと教材名のデモアプリのイメージを削除します。
PC全体のpruneは使いません。同じサービス用イメージを他のコンテナが使っていてDockerが拒否した場合は、強制せず止まります。
次回は再ダウンロード・再ビルドが必要です。Dockerのビルドキャッシュ、ツール、プロバイダーやpnpm依存関係は削除しません。

## 続きから再開する

```sh
mise run lesson:prepare -- 02-docker-systems/02-web-database
mise run lesson:plan -- 02-docker-systems/02-web-database
mise run lesson:apply -- 02-docker-systems/02-web-database
```

残してある設定と入力値から環境を作り直します。cleanupで消したメモやアップロードは戻りません。
基礎からやり直す場合はlocalのcontentを `Hello, Terraform!\n` に戻し、
実習4で作った `lesson4.auto.tfvars` を削除して [実習1](../../lessons/01-basics/README.md#実習1ファイルを作る) から進みます。
各システムの変更を戻す場合は、その教材で作った `practice.auto.tfvars` を削除します。
タスクは編集内容を勝手に書き戻しません。

## 途中でエラーになったら

エラーを解消して同じコマンドを再実行します。stateは手動で削除しないでください。
全体cleanupは、どれかのstateを読めない場合には削除を始める前に止まります。
削除の途中で失敗した場合は、その場で止まり、調査できるよう必要なMotoを残します。
対処は [困ったとき](troubleshooting.md) にまとめています。

## 公式仕様

- [Terraform destroy](https://developer.hashicorp.com/terraform/cli/commands/destroy)
- [Docker Compose down](https://docs.docker.com/reference/cli/docker/compose/down/)
- [Dockerイメージとは](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
