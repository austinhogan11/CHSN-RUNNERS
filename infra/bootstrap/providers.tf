provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "CHSN"
      ManagedBy = "Terraform"
      Purpose   = "TerraformBootstrap"
    }
  }
}