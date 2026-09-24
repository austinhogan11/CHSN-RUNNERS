output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.web.domain_name
}

output "custom_domain_url" {
  description = "Custom production URL for the Runner application."
  value       = "https://chosenrunning.com"
}

output "www_custom_domain_url" {
  description = "WWW custom production URL for the Runner application."
  value       = "https://www.chosenrunning.com"
}

output "api_ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "api_lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "api_lambda_function_arn" {
  value = aws_lambda_function.api.arn
}

output "api_gateway_endpoint" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "api_gateway_id" {
  value = aws_apigatewayv2_api.api.id
}

output "workout_table_name" {
  description = "Name of the DynamoDB table containing workout sessions."
  value       = aws_dynamodb_table.workouts.name
}

output "custom_domain_certificate_arn" {
  description = "ARN of the ACM certificate requested for the Runner custom domains."
  value       = aws_acm_certificate.runner_custom_domain.arn
}

output "custom_domain_certificate_validation_records" {
  description = "CNAME records to add manually in Squarespace DNS for ACM validation."
  value = {
    for option in aws_acm_certificate.runner_custom_domain.domain_validation_options :
    option.domain_name => {
      domain_name  = option.domain_name
      record_name  = option.resource_record_name
      record_type  = option.resource_record_type
      record_value = option.resource_record_value
    }
  }
}
