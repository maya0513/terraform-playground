# 5つの実習

[入口に戻る](../README.md) · 前：[準備する](setup.md) · 次：[片付ける・再開する](cleanup.md)

Terraformは「こうなってほしい」という設定を書き、実際の状態との差を見て、必要な操作を行う道具です。
普通のファイルから始め、同じ考え方でローカルのS3を操作します。
すべてのコマンドはREADMEがあるフォルダで実行してください。

| 順番 | 体験すること | 学ぶこと |
| --- | --- | --- |
| [実習1](#実習1ファイルを作る) | ファイルを作る | 初期化・予定の確認・適用 |
| [実習2](#実習2変更とstateを見る) | 内容を変更する | 差分・state・変更がない状態 |
| [実習3](#実習3ローカルのs3にファイルを保存する) | S3に保存する | バケット・オブジェクト・参照 |
| [実習4](#実習4変数から複数のファイルを作る) | 複数のファイルを作る | 変数・for_each・output |
| [実習5](#実習5削除してもう一度作る) | 削除・再作成する | destroy・同じ設定からの復元 |

途中で終える場合も `mise run cleanup` で片付けられます。

## 実習1：ファイルを作る

使う設定は `examples/local/main.tf` です。

```hcl
resource "local_file" "hello" {
  filename        = "${path.module}/generated/hello.txt"
  content         = "Hello, Terraform!\n"
  file_permission = "0644"
}
```

- `resource`：Terraformが管理するものの定義。
- `local_file`：普通のファイルを管理する種類。
- `hello`：設定の中で使う名前。実際のファイル名は `filename` で決まります。
- `${path.module}`：この設定ファイルがあるフォルダ。

まず初期化します。

```sh
mise exec -- terraform -chdir=examples/local init
```

`init` は必要なプロバイダーをダウンロードする準備です。まだファイルは作りません。
`-chdir=examples/local` は「このフォルダの設定を使う」という指定です。

次に、何が起こる予定なのかを確認します。

```sh
mise exec -- terraform -chdir=examples/local plan
```

最初は `Plan: 1 to add, 0 to change, 0 to destroy.` と表示されます。
`plan` は予定の確認で、ファイルの作成はまだ行いません。

```sh
mise exec -- terraform -chdir=examples/local apply
```

表示された予定を確認し、`Enter a value:` に `yes` と入力します。
`apply` が実際の作成・変更を行います。

```sh
cat examples/local/generated/hello.txt
mise exec -- terraform -chdir=examples/local output
```

`Hello, Terraform!` と出れば成功です。`output` は設定で指定した結果を取り出す機能です。

## 実習2：変更とstateを見る

`examples/local/main.tf` の `content` を次のように編集して保存します。

```hcl
content = "こんにちは、Terraform!\n"
```

```sh
mise exec -- terraform -chdir=examples/local plan
mise exec -- terraform -chdir=examples/local apply
cat examples/local/generated/hello.txt
```

`apply` の確認では `yes` と入力します。日本語の内容になれば成功です。
このファイルのプロバイダーは内容の変更を「古いファイルを削除して作り直す」と扱うため、
予定には `-/+`（置き換え）と表示されます。

もう一度、同じ設定で予定を確認します。

```sh
mise exec -- terraform -chdir=examples/local plan
mise exec -- terraform -chdir=examples/local state list
mise exec -- terraform -chdir=examples/local state show local_file.hello
```

`No changes.` が出れば、設定と実物がそろっています。
`state list` には `local_file.hello`、`state show` にはファイルの情報が表示されます。

**state** はTerraformが「自分が何を管理しているか」を覚えておく管理情報です。
この実習では `examples/local/terraform.tfstate` に保存されます。
設定ファイル `.tf` は設計図、`state` は管理台帳、`generated/hello.txt` は実物です。
stateを手作業で書き換えたり、削除して後片付けの代わりにしたりしないでください。
stateには保存内容が入ることもあるため、Gitには登録しません。

## 実習3：ローカルのS3にファイルを保存する

S3はAWSのファイル置き場です。ここでは本物のAWSではなく、Docker上のMotoを使います。

| Cloudflareでのイメージ | 今回の名前 |
| --- | --- |
| R2のバケット（ファイルを入れる箱） | S3のバケット |
| R2のオブジェクト（保存したファイル） | S3のオブジェクト |
| R2のAPIにアクセスするURL | Motoの `http://localhost:5000` |

まずMotoを起動します。

```sh
mise run moto:up
docker compose ps
```

Motoが `healthy` になれば準備完了です。コンテナ内のポート5000を、
PCの `127.0.0.1:5000` だけに公開します。データを保存するボリュームは作りません。

```sh
mise exec -- terraform -chdir=examples/s3 init
mise exec -- terraform -chdir=examples/s3 plan
mise exec -- terraform -chdir=examples/s3 apply
```

初回はバケットと `hello.txt` の **2つ** を作る予定です。確認で `yes` と入力します。
設定は `examples/s3/main.tf` にあります。

```hcl
resource "aws_s3_bucket" "practice" {
  bucket = "terraform-playground-practice"
}

resource "aws_s3_object" "hello" {
  bucket       = aws_s3_bucket.practice.id
  key          = "hello.txt"
  content      = "Hello from local S3!\n"
  content_type = "text/plain; charset=utf-8"
}
```

`aws_s3_bucket.practice.id` という参照で、「この箱に入れる」と指定しています。
Terraformはこの参照から、箱を先に作る必要があることも判断します。

AWS CLIで中身を確認します。**接続先を必ずローカルに指定したコマンド**にしています。

```sh
mise exec -- aws --endpoint-url=http://localhost:5000 s3 ls
mise exec -- aws --endpoint-url=http://localhost:5000 s3 ls s3://terraform-playground-practice/
mise exec -- aws --endpoint-url=http://localhost:5000 s3 cp s3://terraform-playground-practice/hello.txt -
mise exec -- terraform -chdir=examples/s3 output
mise exec -- terraform -chdir=examples/s3 plan
```

`hello.txt` とその内容が確認でき、最後に `No changes.` が出れば成功です。
`s3 cp ... -` の `-` は、ダウンロード先をファイルではなく画面にする指定です。

認証情報は `test` というダミー値です。Terraformの接続先もMotoに固定しています。
実際のAWSキーを入力したり、`aws configure` を実行したりする必要はありません。
`mise.toml` はこのフォルダ内で既存のAWS設定を読み込まないようにしています。

## 実習4：変数から複数のファイルを作る

入力値のサンプルをコピーします。

```sh
cp examples/s3/lesson4.tfvars.example examples/s3/lesson4.auto.tfvars
```

`.auto.tfvars` で終わるファイルはTerraformが自動で読み込む入力値です。
コピーしたファイルには次の内容が入っています。

```hcl
extra_files = {
  "notes.txt" = "Terraformの変数から作りました。\n"
  "links.txt" = "https://www.terraform.io/\n"
}
```

`variable` は外から渡す入力値の定義です。今回は `map(string)`、つまり
「名前と文字列の組み合わせ」を受け取ります。何も渡さなければ空の `{}` です。

`main.tf` の追加ファイル用の定義は次の部分です。

```hcl
resource "aws_s3_object" "extra" {
  for_each = var.extra_files

  bucket       = aws_s3_bucket.practice.id
  key          = each.key
  content      = each.value
  content_type = "text/plain; charset=utf-8"
  # 完全な設定には、hello.txtとの名前の重複を防ぐ処理もあります。
}
```

`for_each` は組み合わせの数だけ作成する指定です。
`each.key` がファイル名、`each.value` が内容になります。
`hello.txt` は実習3で管理しているため、追加ファイルには別の名前を使ってください。

```sh
mise exec -- terraform -chdir=examples/s3 plan
mise exec -- terraform -chdir=examples/s3 apply
mise exec -- aws --endpoint-url=http://localhost:5000 s3 ls s3://terraform-playground-practice/
mise exec -- aws --endpoint-url=http://localhost:5000 s3 cp s3://terraform-playground-practice/notes.txt -
mise exec -- terraform -chdir=examples/s3 output
mise exec -- terraform -chdir=examples/s3 plan
```

追加する予定は **2つ**。適用後は `hello.txt`、`notes.txt`、`links.txt` の3つが見えます。
`output` に3つの名前が表示され、最後に `No changes.` が出れば成功です。

余裕があれば入力値に1行追加して、予定がどう変わるか試してください。
既存の内容を書き換えれば変更、1行削除すればそのファイルだけの削除になります。
Terraformで管理中のファイルは、AWS CLIでは読み取りだけに使うと混乱しにくくなります。

## 実習5：削除して、もう一度作る

まず削除予定を確認します。**Motoを動かしたまま**実行してください。

```sh
mise exec -- terraform -chdir=examples/s3 plan -destroy
mise exec -- terraform -chdir=examples/s3 destroy
mise exec -- terraform -chdir=examples/local plan -destroy
mise exec -- terraform -chdir=examples/local destroy
```

それぞれ確認に `yes` と入力します。実習4まで進めたS3では
バケット1つとファイル3つの合計4つ、localではファイル1つを削除します。

```sh
mise exec -- terraform -chdir=examples/s3 state list
mise exec -- terraform -chdir=examples/local state list
mise exec -- aws --endpoint-url=http://localhost:5000 s3 ls
test ! -f examples/local/generated/hello.txt && echo "ローカルのファイルも削除できました"
```

stateの一覧とS3の一覧が空になれば成功です。
`destroy` は実物を削除しますが、設計図である `.tf` は残します。

同じ設計図から作り直せます。

```sh
mise exec -- terraform -chdir=examples/local apply
mise exec -- terraform -chdir=examples/s3 apply
mise exec -- terraform -chdir=examples/local plan
mise exec -- terraform -chdir=examples/s3 plan
```

再び確認に `yes` と入力します。両方 `No changes.` になれば、作り直しも成功です。
`lesson4.auto.tfvars` が残っているので、S3の追加ファイルも復元します。

練習を終えたら、便利な片付けタスクで管理対象とMotoを削除します。確認入力はありません。

```sh
mise run cleanup
```

stateファイル自体は空の管理台帳として残ることがあります。正常です。
コンテナイメージとダウンロードしたツールは、次の練習のためPC上に残ります。

片付け後の確認方法や再開手順は、[片付ける・再開する](cleanup.md)を参照してください。
