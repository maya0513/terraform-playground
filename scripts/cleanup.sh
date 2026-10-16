#!/usr/bin/env bash
# mise run cleanup から実行する、この教材専用の後片付けです。
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

trap 'printf "\n片付けが途中で止まりました。エラーを解消して mise run cleanup を再実行してください。stateは手動で削除しないでください。\n" >&2' ERR

state_resources() {
  local example="$1"
  if [[ -f "examples/$example/terraform.tfstate" ]]; then
    terraform -chdir="examples/$example" state list
  fi
}

destroy_example() {
  local example="$1"
  printf '\n%s の管理対象を削除します。\n' "$example"
  terraform -chdir="examples/$example" init -input=false -lockfile=readonly
  terraform -chdir="examples/$example" destroy -input=false -auto-approve

  local remaining
  remaining="$(terraform -chdir="examples/$example" state list)"
  if [[ -n "$remaining" ]]; then
    printf '%s のstateに管理対象が残っています。\n' "$example" >&2
    return 1
  fi
}

# stateの読み取りに失敗した場合は、コンテナを消す前に停止します。
s3_resources="$(state_resources s3)"
local_resources="$(state_resources local)"

if [[ -n "$s3_resources" ]]; then
  printf 'S3の片付けに必要なMotoを起動します。\n'
  docker compose up -d --wait
  destroy_example s3
else
  printf 'S3: 管理対象はありません。\n'
fi

if [[ -n "$local_resources" ]]; then
  destroy_example local
else
  printf 'local: 管理対象はありません。\n'
fi

printf '\nこの教材のコンテナとネットワークを削除します。\n'
docker compose down
printf '\n片付け完了。設定ファイル・入力値・ツール・イメージは残してあります。\n'
