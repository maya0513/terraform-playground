terraform {
  required_version = "~> 1.16.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "4.6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "6.69.0"
    }
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}

# 詳細は docs/reference/README.md。実AWSへの接続には使いません。
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
    s3       = "http://localhost:${var.moto_port}"
    sts      = "http://localhost:${var.moto_port}"
    dynamodb = "http://localhost:${var.moto_port}"
    sqs      = "http://localhost:${var.moto_port}"
  }
}
