# AWSのAPIで3つのシステムを作る

[全体の入口](../../README.md) · 前：[Docker編](../02-docker-systems/README.md)

Docker編で学んだWeb・保存先・ワーカーを、AWSのAPIに置き換えて考えます。S3、DynamoDB、SQSはMoto上で再現し、Webアプリとワーカーは実際のコンテナで動かします。

| 順番 | 教材 | ブラウザーのURL |
| --- | --- | --- |
| 01 | [AWS 1：ファイル置き場](01-object-storage/README.md) | http://127.0.0.1:8201 |
| 02 | [AWS 2：ファイルとメタデータ](02-database-storage/README.md) | http://127.0.0.1:8202 |
| 03 | [AWS 3：キューとワーカー](03-queue-worker/README.md) | http://127.0.0.1:8203 |

各教材は独立したstateとデータを持ちます。前の教材のデータをコピーする必要はありません。
普段は一つずつ進めます。編集するのはTerraformの設定と入力値で、アプリは用意済みです。

Motoを停止すると、API側のデータは消えます。実AWSのストレージやDBが停止のたびに消えるという意味ではありません。各教材でこの違いも説明します。

[片付け方](../../docs/guides/cleanup.md) · [コマンド一覧](../../docs/reference/README.md)
