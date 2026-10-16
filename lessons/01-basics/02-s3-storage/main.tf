# バケット = ファイルを入れる箱。Cloudflare R2のバケットと同じ考え方です。
resource "aws_s3_bucket" "practice" {
  bucket = "terraform-playground-practice"
}

# オブジェクト = 箱に保存するファイル。bucket の参照から作成順も決まります。
resource "aws_s3_object" "hello" {
  bucket       = aws_s3_bucket.practice.id
  key          = "hello.txt"
  content      = "Hello from local S3!\n"
  content_type = "text/plain; charset=utf-8"
}

# 実習3では空。実習4で入力値を渡すと複数のファイルを作成します。
variable "extra_files" {
  description = "追加するファイル名と内容の組み合わせ"
  type        = map(string)
  default     = {}
}

resource "aws_s3_object" "extra" {
  for_each = var.extra_files

  bucket       = aws_s3_bucket.practice.id
  key          = each.key
  content      = each.value
  content_type = "text/plain; charset=utf-8"

  lifecycle {
    precondition {
      condition     = each.key != aws_s3_object.hello.key
      error_message = "hello.txt は実習3で使うため、別のファイル名にしてください。"
    }
  }
}

output "bucket_name" {
  description = "作成したバケットの名前"
  value       = aws_s3_bucket.practice.id
}

output "object_keys" {
  description = "作成したファイルの名前"
  value       = concat([aws_s3_object.hello.key], sort(keys(aws_s3_object.extra)))
}
