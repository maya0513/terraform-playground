resource "docker_network" "app" {
  name = "${var.project_prefix}-net"
  labels {
    label = "terraform-playground.project"
    value = var.project_prefix
  }
}

# コンテナが作り直されても、DBのデータはこのボリュームに残ります。
resource "docker_volume" "database" {
  name = "${var.project_prefix}-database"
  labels {
    label = "terraform-playground.project"
    value = var.project_prefix
  }
}

resource "docker_image" "postgres" {
  name         = "postgres:17.6-alpine"
  keep_locally = true
}

resource "docker_image" "app" {
  name         = var.app_image
  keep_locally = true
}

resource "docker_container" "database" {
  name  = "${var.project_prefix}-db"
  image = docker_image.postgres.image_id
  env   = ["POSTGRES_DB=app", "POSTGRES_USER=demo", "POSTGRES_PASSWORD=local-practice"]
  volumes {
    volume_name    = docker_volume.database.name
    container_path = "/var/lib/postgresql/data"
  }
  networks_advanced {
    name    = docker_network.app.name
    aliases = ["db"]
  }
  labels {
    label = "terraform-playground.project"
    value = var.project_prefix
  }
  healthcheck {
    test         = ["CMD-SHELL", "pg_isready -U demo -d app"]
    interval     = "2s"
    timeout      = "3s"
    retries      = 30
    start_period = "5s"
  }
  wait         = true
  wait_timeout = 120
}

locals {
  app_env = [
    "APP_MODE=notes",
    "APP_TITLE=${var.app_title}",
    "DATABASE_URL=postgresql://demo:local-practice@db:5432/app",

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
    name    = docker_network.app.name
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
  depends_on   = [docker_container.database]
}
