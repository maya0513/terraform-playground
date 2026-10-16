resource "docker_image" "nginx" {
  name         = "nginx:1.30.0-alpine"
  keep_locally = true
}

resource "docker_container" "web" {
  name  = "${var.project_prefix}-web"
  image = docker_image.nginx.image_id
  ports {
    internal = 80
    external = var.web_port
    ip       = "127.0.0.1"
  }
  upload {
    file    = "/usr/share/nginx/html/index.html"
    content = replace(file("${path.module}/../../../support/apps/static/index.html"), "Terraformから、", var.welcome)
  }
  labels {
    label = "terraform-playground.project"
    value = var.project_prefix
  }
  healthcheck {
    test     = ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]
    interval = "2s"
    timeout  = "3s"
    retries  = 20
  }
  wait         = true
  wait_timeout = 60
}
