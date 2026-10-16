# 用語・構成・コマンドのリファレンス

[全体の入口](../../README.md)

最初から全部読む必要はありません。実習中に意味を確かめたいときの資料です。

## 役割の分担

| 部品 | 役割 |
| --- | --- |
| Terraform | インフラの設計図からリソースを作成・変更・削除 |
| localプロバイダー | PC上のファイルを操作 |
| Dockerプロバイダー | コンテナ、ネットワーク、ボリュームを操作 |
| AWSプロバイダー | MotoのS3・DynamoDB・SQSを操作 |
| Compose | Motoという補助環境を起動・停止 |
| デモアプリ・ワーカー | アプリのデータとCSV処理。TypeScriptで実装 |
| mise | バージョン固定とタスクの入口 |

## 用語

| 用語 | 意味 |
| --- | --- |
| リソース | Terraformが管理するもの。ファイル、コンテナ、バケットなど |
| プロバイダー | Terraformと管理対象をつなぐ部品 |
| state | Terraformが管理している対象の台帳。実物そのものではない |
| バケット / オブジェクト | ファイルを入れる箱 / 中に保存したファイル。Cloudflare R2と同じ考え方 |
| API / エンドポイント | ツールからサービスを操作する窓口 / その接続先URL |
| コンテナ / イメージ | 動いている実行環境 / それを起動するための材料 |
| ポート | サービスの入口の番号。PC側とコンテナ側で別に指定できる |
| ネットワーク | コンテナ同士を内部の名前でつなぐ範囲 |
| ボリューム | コンテナを作り直してもデータを残す保存領域 |
| メタデータ | ファイルの表示名、サイズなど、本体に付く情報 |
| キュー / ワーカー | 処理待ちの置き場 / そこから取り出して実行する役割 |
| 冪等性 | 同じ処理を繰り返しても結果を壊さない性質 |
| variable / for_each / output | 入力値 / 組み合わせごとの作成 / 結果の表示 |

## ファイルの読み方

教材のREADME → main.tf → variables.tf → outputs.tf の順に読みます。
providers.tfはバージョンと接続設定を集め、最初の学習では触らずに済むようにしています。
基礎では短い設定を追いやすくするため、変数と出力もmain.tfにまとめています。

| ファイル・フォルダ | 役割 |
| --- | --- |
| lessons/01-basics | 基礎の5実習。2つの独立したTerraform設定 |
| lessons/02-docker-systems | Dockerの3システム |
| lessons/03-aws-systems | AWSのAPIを使う3システム |
| lessons/catalog.json | 教材ID、ポート、名前、イメージの一覧。タスクの共通の情報源 |
| mise.toml | 固定ツール、ダミー環境変数、タスク |
| support/apps | 用意済みのデモ。アプリを読まずにインフラを学べる |
| support/moto/compose.yaml | Moto用の補助環境 |
| scripts/course.ts | 初期化、ビルド、片付けの内部処理 |
| .terraform.lock.hcl | プロバイダーの版とチェックサム。Gitに残す |
| pnpm-lock.yaml | アプリと開発ツールの依存関係。Gitに残す |
| .terraform/ | プロバイダーなどの作業データ。Gitには残さない |
| terraform.tfstate | 教材ごとの管理台帳。手動編集しない。Gitには残さない |
| *.auto.tfvars | 自分で変更した入力値。Gitには残さない |

stateには保存内容が記録される場合があります。削除の代わりにstateを消してはいけません。

## Terraformコマンド

基礎では `mise exec -- terraform -chdir=教材フォルダ` の後ろへ指定します。

| 操作 | 目的 | 実物の変更 |
| --- | --- | --- |
| init | プロバイダーなどの初期化 | リソースは作らない |
| plan | 設計図と実物を比較して予定を表示 | リソースは変更しない |
| apply | 作成・変更・削除を適用 | 変更する。yesによる確認あり |
| output | 結果を表示 | 変更しない |
| state list / state show | 台帳にある対象 / 記録を表示 | 変更しない |
| plan -destroy | 全管理対象の削除予定を表示 | リソースは変更しない |
| destroy | 全管理対象を削除 | 変更する。yesによる確認あり |

`+` は作成、`~` は変更、`-` は削除、`-/+` は置き換え、`No changes.` は差分なしです。
実習2のlocal_fileは、内容の変更を置き換えとして扱います。

## 共通タスク

`lesson:*` の対象IDは `lessons/` の後ろのフォルダ名です。

| コマンド | 役割 |
| --- | --- |
| mise run lesson:list | 学ぶ順番に一覧を表示 |
| mise run lesson:prepare -- ID | 初期化、必要なMotoの起動、必要なアプリのビルド |
| mise run lesson:plan -- ID | Terraformの予定確認。コンテナの起動・ビルドはしない |
| mise run lesson:apply -- ID | Terraformの確認付き適用 |
| mise run lesson:status -- ID | 台帳とコンテナの状態を確認 |
| mise run lesson:cleanup -- ID | この教材を確認入力なしで片付ける |
| mise run cleanup | 全教材を確認入力なしで片付ける |
| mise run cleanup:images | 全教材を片付け、教材用イメージも削除 |
| mise run moto:up / moto:logs / moto:down | 基礎専用のMotoを操作。システム編のMotoとは別 |
| mise run check | 設定・型・文書を確認。リソースは作らない |
| mise run test:lessons | 隔離した環境で実際の構築・HTTP操作・削除を検証 |

project_prefix・web_port・app_image・moto_portは、タスクが教材一覧から渡す実行設定です。
普通の実習で変更する入力値はwelcomeやapp_titleです。
初期化・ビルド・片付けの複雑さは内部スクリプトへ隔離し、Terraformのリソース定義は各教材に直接置いています。
AWS教材のplan/applyはMotoへの接続確認も行い、停止中に消失と誤解した予定を出さないようにしています。

## バージョンと実行言語

| 部品 | 固定バージョン |
| --- | --- |
| Terraform / AWS CLI | 1.16.6 / 2.38.1 |
| Node.js / pnpm | 24.22.0 / 12.11.2 |
| local / aws / Dockerプロバイダー | 2.9.1 / 6.69.0 / 4.6.0 |
| Moto | 5.2.4 |

アプリ、ワーカー、管理・検証スクリプトはTypeScript。Node.jsの直接実行を使います。
ルートとアプリのengines.nodeは `>=24.22.0 <25`、target/libはESNext、moduleはNodeNextです。
TypeScriptなどの正確な依存版はpackage.jsonとpnpm-lock.yaml、イメージ名はcatalog.jsonに記録します。
Dockerfile・Terraform内のサービス画像も固定バージョンです。ブラウザーへ配信する静的ファイルはHTML/CSS/JavaScriptです。

## Motoと実AWSの違い

接続先はPC内のMotoに固定し、認証情報はtestというダミー値です。
実AWSの認証ファイル、プロファイル、マシンのメタデータから認証情報を探す処理は使用しません。
`aws configure` は不要です。通常のAWS作業はこの教材とは別のフォルダで行ってください。

Motoは停止でデータが消えます。実AWSの永続性、権限、可用性、ネットワーク構成や性能は再現しません。
DynamoDBのPAY_PER_REQUESTなどはAWSの設定名ですが、この教材はローカルのAPI再現なのでクラウド利用料は発生しません。
ワーカーのコードは実際にDockerで実行し、Moto自体がアプリを実行するわけではありません。

## 公式資料

- [Terraform CLI](https://developer.hashicorp.com/terraform/cli)
- [Dockerプロバイダー](https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs)
- [Moto](https://docs.getmoto.org/en/stable/docs/server_mode.html)
- [Node.jsのTypeScript実行](https://nodejs.org/api/typescript.html)
- [mise](https://mise.jdx.dev/)
- [Docker Compose](https://docs.docker.com/compose/)
