# 準備する

[全体の入口](../../README.md) · 次：[基礎の5実習](../../lessons/01-basics/README.md)

この教材はLinuxとDocker Engineを使います。この作業環境ではmiseとDockerは導入済みです。
アプリを自分で書く必要はありません。AWSのアカウントや認証キーも用意しません。

## 1. 作業フォルダを開く

```sh
cd /home/maya0513/workspace/terraform-playground
```

別の場所にコピーした場合は、そのフォルダに移動してください。
以降のコマンドはすべて、このREADMEがあるプロジェクトのルートで実行します。

## 2. Dockerを確認する

```sh
docker info
docker compose version
```

サーバー情報とComposeのバージョンが出れば成功です。
接続エラーは[トラブル対処](troubleshooting.md#dockerに接続できない)を先に確認します。

## 3. miseでツールをそろえる

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- terraform version
mise exec -- node --version
mise run lesson:list
```

`mise trust` はプロジェクトのタスクと設定を信頼する操作、`mise install` は固定バージョンの導入です。
Terraform・AWS CLI・Node.js・pnpmをmiseで管理し、グローバル設定は変更しません。
pnpmはTypeScriptの型検査用ツールとアプリの依存関係をロックファイルどおりに導入します。
Node.jsは24.22.0、対応範囲は `>=24.22.0 <25`、TypeScriptのtargetとlibは `ESNext` です。
PythonをPCへ導入する必要はありません。Moto内部の実装言語は、教材の実行言語とは別です。

## コマンドの読み方

基礎ではTerraformの操作をそのまま体験します。

```sh
mise exec -- terraform -chdir=lessons/01-basics/01-local-files plan
```

| 部分 | 意味 |
| --- | --- |
| mise exec -- | 固定したツールと練習用の環境変数を使う |
| terraform | Terraformを起動 |
| -chdir=... | この教材フォルダの設定を使う |
| plan | 作成・変更・削除の予定を見る |

システム編では長い準備を共通タスクへまとめています。

```sh
mise run lesson:prepare -- 02-docker-systems/01-static-site
mise run lesson:plan -- 02-docker-systems/01-static-site
```

`--` の後ろが教材IDです。フォルダの `lessons/` より後ろと同じ名前です。
`prepare` は準備、`plan` は予定確認、`apply` は適用です。
共通タスクは内部で通常のTerraformコマンドを実行し、stateもその教材フォルダに保存します。

## 以前の配置からの変更

| 旧配置 | 新配置 |
| --- | --- |
| examples/local | lessons/01-basics/01-local-files |
| examples/s3 | lessons/01-basics/02-s3-storage |
| docs/tutorial.md | lessons/01-basics/README.md |
| docs/setup.md・cleanup.md・troubleshooting.md | docs/guides/ |
| docs/reference.md | docs/reference/README.md |
| compose.yaml | support/moto/compose.yaml |

既存のstate・入力値・生成物は教材フォルダと一緒に移します。
stateを消して移行する必要はありません。古いexamplesへのコマンドは新しい配置へ読み替えてください。

[基礎の5実習へ進む](../../lessons/01-basics/README.md)
