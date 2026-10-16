# アプリが保存したオブジェクトも、教材の片付けで削除します。
resource "aws_s3_bucket" "files" {
  bucket        = "${var.project_prefix}-files"
  force_destroy = true
}

resource "docker_image" "app" {
  name         = var.app_image
  keep_locally = true
}

locals {
  app_env = [
    "APP_MODE=files",
    "APP_TITLE=${var.app_title}",
    "AWS_ENDPOINT_URL=http://moto:5000",
    "BUCKET_NAME=${aws_s3_bucket.files.id}",


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
