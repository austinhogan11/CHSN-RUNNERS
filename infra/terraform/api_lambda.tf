resource "aws_ecr_repository" "api" {
  name                 = "chsn-runners-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type = "Service"

      identifiers = [
        "lambda.amazonaws.com",
      ]
    }
  }
}

resource "aws_iam_role" "api_lambda" {
  name = "chsn-runners-api-lambda"

  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "api_lambda_basic_execution" {
  role       = aws_iam_role.api_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "api" {
  function_name = "chsn-runners-api"
  role          = aws_iam_role.api_lambda.arn

  package_type = "Image"
  image_uri    = "${aws_ecr_repository.api.repository_url}:bootstrap"

  architectures = [
    "arm64",
  ]

  memory_size = 512
  timeout     = 10

  environment {
    variables = {
      ENVIRONMENT = "production"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.api_lambda_basic_execution,
    aws_cloudwatch_log_group.api_lambda,
  ]

  lifecycle {
    ignore_changes = [
      image_uri,
    ]
  }


}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the 30 most recent API deployment images"

        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["deploy-"]
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }

        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Remove untagged API images after 7 days"

        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }

        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "api_lambda" {
  name              = "/aws/lambda/chsn-runners-api"
  retention_in_days = 7
}