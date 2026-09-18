#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "==> Checking Terraform formatting"
terraform fmt -check -recursive infra

echo "==> Checking bootstrap Terraform"
cd "$ROOT/infra/bootstrap"
terraform init -backend-config=backend.hcl -input=false >/dev/null
terraform validate
terraform plan -no-color

echo "==> Checking application Terraform"
cd "$ROOT/infra/terraform"
terraform init -backend-config=backend.hcl -input=false >/dev/null
terraform validate
terraform plan -no-color