output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.web.domain_name
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
