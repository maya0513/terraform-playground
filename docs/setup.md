# 準備する

[入口に戻る](../README.md) · 次：[5つの実習](tutorial.md)

この教材はLinux上のmise、Docker Engine、Docker Composeを使います。
この作業環境では導入済みです。初回のダウンロードにはインターネット接続が必要です。
AWSアカウントやクレジットカードは使いません。

## 1. 作業フォルダを開く

以降のコマンドは、すべてREADMEがあるフォルダで実行します。
別の場所にコピーした場合は、そのフォルダに移動してください。

```sh
cd /home/maya0513/workspace/terraform-playground
```

## 2. Dockerに接続できることを確認する

```sh
docker info
docker compose version
```

サーバー情報とComposeのバージョンが表示されれば成功です。
`permission denied` や接続エラーなら、[Dockerのトラブル対処](troubleshooting.md#dockerに接続できない)を先に確認します。

## 3. miseでツールをそろえる

```sh
mise trust
mise install
mise exec -- terraform version
mise exec -- aws --version
```

`mise trust` はこのプロジェクトの設定とタスクを信頼する操作です。
`mise install` は `mise.toml` に書かれたバージョンを導入します。
グローバルのツール設定は変更しません。

TerraformとAWS CLIのバージョンが表示されれば準備完了です。
検証したバージョンは[構成のリファレンス](reference.md#バージョンと設定)にまとめています。

## コマンドの読み方

```sh
mise exec -- terraform -chdir=examples/local plan
```

| 部分 | 意味 |
| --- | --- |
| `mise exec --` | この教材のツールと環境変数を使って、後ろのコマンドを実行する |
| `terraform` | Terraformを起動する |
| `-chdir=examples/local` | ローカルファイル用の設定フォルダを使う |
| `plan` | 作成・変更・削除の予定を表示する |

この書き方なら、シェルのmise連携を設定していなくても実行できます。
`mise run cleanup` のような書き方は、あらかじめ登録したタスクを実行するものです。

## 次へ

[実習1：ファイルを作る](tutorial.md#実習1ファイルを作る)に進みます。
Motoの起動は実習3で行います。実習1・2はDockerのコンテナを起動せず進められます。
