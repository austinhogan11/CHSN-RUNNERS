provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "CHSN-RUNNERS"
      ManagedBy = "Terraform"
    }
  }
}