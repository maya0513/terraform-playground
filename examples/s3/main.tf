terraform {
  required_version = "~> 1.16.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.69.0"
    }
  }
}

# 実AWSの認証情報・設定は使用しません。
# このダミー認証情報と接続先は実習専用です。
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  token                       = "test"
  shared_config_files         = ["/dev/null"]
  shared_credentials_files    = ["/dev/null"]
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true
  max_retries                 = 0

  endpoints {
    s3  = "http://localhost:5000"
    sts = "http://localhost:5000"
  }
}

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
