variable "project_prefix" {
  description = "教材専用のリソース名の接頭辞。通常は変更不要"
  type        = string
  default     = "terraform-playground-d01"
}

variable "web_port" {
  description = "PC側に公開するポート。通常は教材一覧の値を使用"
  type        = number
  default     = 8101
}

variable "welcome" {
  description = "静的サイトの見出し。ここを変えて差分を試します"
  type        = string
  default     = "Terraformから、"
}
