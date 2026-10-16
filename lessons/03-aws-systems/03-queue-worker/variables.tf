variable "project_prefix" {
  description = "教材専用のリソース名の接頭辞。通常は変更不要"
  type        = string
  default     = "terraform-playground-a03"
}

variable "web_port" {
  description = "PC側に公開するポート。通常は教材一覧の値を使用"
  type        = number
  default     = 8203
}

variable "app_title" {
  description = "画面のタイトル。一か所変更する実習で使います"
  type        = string
  default     = "AWS 3：キューとワーカー"
}

variable "app_image" {
  description = "lesson:prepareでビルドするデモアプリのイメージ"
  type        = string
}

variable "moto_port" {
  description = "ホスト側のMoto接続ポート。通常は変更不要"
  type        = number
  default     = 5103
}
