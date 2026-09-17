output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.web.domain_name
}

output "api_ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}