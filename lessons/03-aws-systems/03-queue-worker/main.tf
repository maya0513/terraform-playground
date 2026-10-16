# アプリが保存したオブジェクトも、教材の片付けで削除します。
resource "aws_s3_bucket" "files" {
  bucket        = "${var.project_prefix}-files"
  force_destroy = true
}

resource "aws_dynamodb_table" "files" {
  name         = "${var.project_prefix}-files"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "jobs" {
  name         = "${var.project_prefix}-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_sqs_queue" "jobs" {
  name                       = "${var.project_prefix}-exports"
  visibility_timeout_seconds = 30
}

resource "docker_image" "app" {
  name         = var.app_image
  keep_locally = true
}

locals {
  app_env = [
    "APP_MODE=files-jobs",
    "APP_TITLE=${var.app_title}",
    "AWS_ENDPOINT_URL=http://moto:5000",
    "BUCKET_NAME=${aws_s3_bucket.files.id}",
    "FILES_TABLE=${aws_dynamodb_table.files.name}",
    "JOBS_TABLE=${aws_dynamodb_table.jobs.name}",
    "QUEUE_NAME=${aws_sqs_queue.jobs.name}",
  ]
}

# ブラウザーから操作する入口です。
resource "docker_container" "web" {
  name  = "${var.project_prefix}-web"
  image = docker_image.app.image_id
  env   = local.app_env
  ports {
    internal = 8000
    external = var.web_port
    ip       = "127.0.0.1"
  }
  networks_advanced {
    name    = "${var.project_prefix}-moto_default"
    aliases = ["web"]
  }
  labels {
    label = "terraform-playground.project"
    value = var.project_prefix
  }
  healthcheck {
    test         = ["CMD", "node", "--input-type=module", "-e", "const r = await fetch('http://127.0.0.1:8000/health'); if (!r.ok) process.exit(1)"]
    interval     = "3s"
    timeout      = "5s"
    retries      = 30
    start_period = "5s"
  }
  wait         = true
  wait_timeout = 120
}

# Webとは別のプロセスで、キューに届いた処理を実行します。
resource "docker_container" "worker" {
  name    = "${var.project_prefix}-worker"
  image   = docker_image.app.image_id
  command = ["node", "worker.ts"]
  env     = local.app_env
  networks_advanced {
    name    = "${var.project_prefix}-moto_default"
    aliases = ["worker"]
  }
  labels {
    label = "terraform-playground.project"
    value = var.project_prefix
  }
}
