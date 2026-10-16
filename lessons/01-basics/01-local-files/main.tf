# resource は「Terraformで管理するもの」1つの定義です。
# hello はTerraform内で参照するための名前です。
resource "local_file" "hello" {
  filename        = "${path.module}/generated/hello.txt"
  content         = "Hello, Terraform!\n"
  file_permission = "0644"
}

output "file_path" {
  description = "作成したファイルの場所"
  value       = local_file.hello.filename
}
