output "web_url" {
  description = "ブラウザーで開くURL"
  value       = "http://127.0.0.1:${var.web_port}"
}
output "web_container" {
  value = docker_container.web.name
}
output "worker_container" {
  value = docker_container.worker.name
}
