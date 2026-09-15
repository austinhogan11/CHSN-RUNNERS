resource "aws_s3_bucket" "web" {
  bucket_prefix = "chsn-runners-web-"

  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

output "web_bucket_name" {
  description = "Name of the private S3 bucket used for frontend assets."
  value       = aws_s3_bucket.web.bucket
}