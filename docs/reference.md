# 仕組みとコマンドのリファレンス

[入口に戻る](../README.md) · [5つの実習](tutorial.md)

実習を進めるために、ここを最初から読む必要はありません。
設定の意味やファイルの役割を詳しく知りたいときに使ってください。

## 全体の構成

```text
あなたのPC
├─ mise：ツールのバージョンと練習用の環境変数を選ぶ
├─ Terraform
│  ├─ localプロバイダー → PC上のテキストファイル
│  └─ awsプロバイダー   → localhost:5000 → Docker内のMoto
└─ AWS CLI             → localhost:5000 → 同じMotoのデータを確認
```

Terraformは設定を書く側、AWS CLIは今回の実習では結果を読む側です。
MotoがAWSのAPIに似た応答を返すので、AWS用のプロバイダーでローカル実習ができます。
実AWSやCloudflare R2にリソースは作りません。

## 用語

| 用語 | この教材での意味 |
| --- | --- |
| リソース | Terraformで管理するもの。ファイル、バケット、オブジェクトなど |
| プロバイダー | Terraformが管理対象を操作するための部品。今回はlocalとaws |
| state | 自分の管理対象を覚えておく台帳。実物そのものではない |
| バケット | ファイルを入れる箱。Cloudflare R2のバケットと同じ考え方 |
| オブジェクト | バケットの中に保存するファイル |
| API | ツールからサービスを操作する窓口 |
| エンドポイント | APIへの接続先URL。今回は `http://localhost:5000` |
| コンテナ | Dockerで動いている実行環境。今回はMotoのサーバー |
| イメージ | コンテナを起動するために保存してある材料。動いているサーバーではない |
| 変数 / `variable` | 設定の外から渡す入力値 |
| `for_each` | 名前と値の組み合わせごとにリソースを作る指定 |
| `output` | Terraformの結果から取り出して表示する値 |

## ファイルの役割

| ファイル・フォルダ | 役割・編集する場面 |
| --- | --- |
| `mise.toml` | ツール、環境変数、便利なタスク。実習では編集不要 |
| `compose.yaml` | Motoの起動方法、イメージ、ポート。実習では編集不要 |
| `examples/local/main.tf` | 実習1・2の設計図。実習2で内容を変更する |
| `examples/s3/main.tf` | 実習3・4の設計図。バケットとファイルを定義する |
| `examples/s3/lesson4.tfvars.example` | 実習4でコピーする入力値の見本 |
| `lesson4.auto.tfvars` | 自分の入力値。実習4で編集する |
| 各実習の `.terraform.lock.hcl` | プロバイダーのバージョンとチェックサム。Gitに残す |
| 各実習の `.terraform/` | ダウンロードしたプロバイダーなど。Gitには残さない |
| 各実習の `terraform.tfstate` | 管理台帳。手動編集しない。Gitには残さない |
| `examples/local/generated/` | 作ったファイルの保存先。Gitには残さない |
| `scripts/cleanup.sh` | 片付けの順序や途中終了を扱う内部処理。実習では編集不要 |

localとS3は別々のstateを持ちます。一方の `apply` や `destroy` は、もう一方の実習を操作しません。

## コマンド一覧

以下のTerraform操作は、`mise exec -- terraform -chdir=examples/local` または
`mise exec -- terraform -chdir=examples/s3` に続けます。

| 操作 | 目的 | 実物を変更するか |
| --- | --- | --- |
| `init` | プロバイダーなどの初期化 | リソースは変更しない。作業用ファイルを作る |
| `plan` | 設定と実物を比較して予定を表示 | リソースは変更しない |
| `apply` | 作成・変更の予定を適用 | 変更する。確認に `yes` が必要 |
| `output` | 指定した結果を表示 | 変更しない |
| `state list` | 管理しているリソース名を一覧表示 | 変更しない |
| `state show 名前` | 管理台帳に記録した情報を表示 | 変更しない |
| `plan -destroy` | 全管理対象の削除予定を表示 | リソースは変更しない |
| `destroy` | 全管理対象を削除 | 変更する。確認に `yes` が必要 |

`plan` は実物を読み取り、stateの情報を使って比較します。
表の「変更しない」はリソースに対する説明で、初期化や管理情報の処理は別です。

### miseタスク

| コマンド | 用途 |
| --- | --- |
| `mise run moto:up` | Motoを起動し、利用可能になるまで待つ |
| `mise run moto:logs` | Motoの直近のログを表示 |
| `mise run cleanup` | 通常の片付け。管理対象を削除し、Motoを停止・削除 |
| `mise run cleanup:images` | 通常の片付けに加え、Motoイメージも削除 |
| `mise run moto:down` | Motoだけ停止・削除。Terraformの台帳やPC上のファイルは片付けない |
| `mise run check` | Compose設定、Terraformの書式・構文を確認。リソースは作らない |
| `mise tasks ls` | 利用できるタスクを一覧表示 |

片付けタスクの確認入力や削除範囲は、[片付けの説明](cleanup.md)にまとめています。

## 差分の読み方

| 表示 | 意味 |
| --- | --- |
| `+` | 新しく作る |
| `~` | 既存のものを変更する |
| `-` | 削除する |
| `-/+` | 削除して作り直す |
| `No changes.` | 設定と実物に差がない |

内容の変更がその場の更新になるか、置き換えになるかはリソースの種類によります。
実習2の `local_file` は内容を変えると置き換えになります。

## バージョンと設定

| 部品 | 固定バージョン | 定義場所 |
| --- | --- | --- |
| Terraform | 1.16.6 | `mise.toml` |
| AWS CLI | 2.38.1 | `mise.toml` |
| Moto | 5.2.4 | `compose.yaml` |
| localプロバイダー | 2.9.1 | localの `main.tf` とロックファイル |
| awsプロバイダー | 6.69.0 | S3の `main.tf` とロックファイル |

AWS用の接続先はS3・STSとも `http://localhost:5000` に固定しています。
認証情報は `test` というダミー値です。認証設定ファイルの読み込みや
実AWSの認証確認、マシンのメタデータから認証情報を探す処理も避けています。
AWS CLIはmise経由で同じダミー設定を使い、実習のコマンドには接続先を明記しています。

MotoのポートはPCの `127.0.0.1:5000` だけに公開し、保存用のボリュームは使いません。
Motoの停止でデータは消え、TerraformのstateはPC上に残ります。
この違いが、[再起動後の復元](troubleshooting.md#motoを再起動してデータが消えた)を理解するポイントです。

`mise.toml` の環境変数は、このフォルダ内でmise経由で実行するコマンドに適用されます。
通常のAWS作業は別のフォルダで行ってください。この教材では `aws configure` は不要です。

## 公式ドキュメント

- [Terraform CLI](https://developer.hashicorp.com/terraform/cli)
- [Motoのサーバーモード](https://docs.getmoto.org/en/latest/docs/server_mode.html)
- [mise](https://mise.jdx.dev/)
- [Docker Compose](https://docs.docker.com/compose/)
- [AWS CLIの接続先指定](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-endpoints.html)
