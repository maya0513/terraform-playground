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
