# Dockerで3つのシステムを作る

[全体の入口](../../README.md) · 前：[基礎](../01-basics/README.md)

まずWebサーバーを1つ動かし、次にDB、最後にキューとワーカーを足します。コンテナを起動するだけでなく、ブラウザーから保存や処理を確かめます。

| 順番 | 教材 | ブラウザーのURL |
| --- | --- | --- |
| 01 | [Docker 1：静的サイト](01-static-site/README.md) | http://127.0.0.1:8101 |
| 02 | [Docker 2：Webとデータベース](02-web-database/README.md) | http://127.0.0.1:8102 |
| 03 | [Docker 3：バックグラウンド処理](03-background-jobs/README.md) | http://127.0.0.1:8103 |

各教材は独立したstateとデータを持ちます。前の教材のデータをコピーする必要はありません。
普段は一つずつ進めます。編集するのはTerraformの設定と入力値で、アプリは用意済みです。

次は [AWSのAPI編](../03-aws-systems/README.md) に進みます。

[片付け方](../../docs/guides/cleanup.md) · [コマンド一覧](../../docs/reference/README.md)
