resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    actions = [
      "sts:AssumeRoleWithWebIdentity",
    ]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.github.arn,
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"

      values = [
        "sts.amazonaws.com",
      ]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"

      values = [
        "repo:austinhogan11@60478173/CHSN-RUNNERS@1367812655:*",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name = "chsn-runners-github-actions"

  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

data "aws_iam_policy_document" "github_actions_permissions" {
  statement {
    sid = "TerraformStateBucketList"

    actions = [
      "s3:ListBucket",
    ]

    resources = [
      aws_s3_bucket.terraform_state.arn,
    ]
  }

  statement {
    sid = "TerraformStateObjects"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = [
      "${aws_s3_bucket.terraform_state.arn}/runner/*",
    ]
  }

  statement {
    sid = "RunnerWebBucket"

    actions = [
      # Terraform refresh/read access for this project's web bucket.
      "s3:Get*",
      "s3:ListBucket",

      # Current Terraform-managed writes.
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutBucketTagging",
    ]

    resources = [
      "arn:aws:s3:::chsn-runners-web-*",
    ]
  }

  statement {
    sid = "RunnerWebBucketPolicy"

    actions = [
      "s3:GetBucketPolicy",
      "s3:PutBucketPolicy",
      "s3:DeleteBucketPolicy",
    ]

    resources = [
      "arn:aws:s3:::chsn-runners-web-*",
    ]
  }

  statement {
    sid = "RunnerCloudFront"

    actions = [
      # Read/refresh operations.
      "cloudfront:Get*",
      "cloudfront:List*",

      # Distribution lifecycle.
      "cloudfront:CreateDistribution",
      "cloudfront:UpdateDistribution",
      "cloudfront:DeleteDistribution",

      # Origin Access Control lifecycle.
      "cloudfront:CreateOriginAccessControl",
      "cloudfront:UpdateOriginAccessControl",
      "cloudfront:DeleteOriginAccessControl",

      # Terraform/AWS tagging.
      "cloudfront:TagResource",
      "cloudfront:UntagResource",

      "cloudfront:CreateInvalidation",
    ]

    resources = [
      "*",
    ]
  }

  statement {
    sid = "RunnerWebObjects"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = [
      "arn:aws:s3:::chsn-runners-web-*/*",
    ]
  }

  statement {
    sid = "RunnerApiEcr"

    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
      "ecr:ListImages",
      "ecr:ListTagsForResource",
      "ecr:GetLifecyclePolicy",
      "ecr:PutLifecyclePolicy",
      "ecr:DeleteLifecyclePolicy",
    ]

    resources = [
      "*",
    ]
  }

  statement {
    sid = "RunnerApiLogs"

    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:ListTagsForResource",
      "logs:PutRetentionPolicy",
      "logs:TagResource",
      "logs:UntagResource",
    ]

    resources = [
      "arn:aws:logs:us-east-1:537690166345:log-group:/aws/apigateway/chsn-runners-api",
      "arn:aws:logs:us-east-1:537690166345:log-group:/aws/apigateway/chsn-runners-api:*",
      "arn:aws:logs:us-east-1:537690166345:log-group:/aws/lambda/chsn-runners-api",
      "arn:aws:logs:us-east-1:537690166345:log-group:/aws/lambda/chsn-runners-api:*",
    ]
  }

  statement {
    sid = "RunnerApiLogDelivery"

    actions = [
      "logs:CreateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:DescribeLogGroups",
      "logs:DescribeResourcePolicies",
      "logs:GetLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:UpdateLogDelivery",
    ]

    resources = [
      "*",
    ]
  }

  statement {
    sid = "RunnerApiGateway"

    actions = [
      "apigateway:*",
    ]

    resources = [
      "*",
    ]
  }

  statement {
    sid = "RunnerApiLambda"

    actions = [
      "lambda:Get*",
      "lambda:List*",
      "lambda:CreateFunction",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:DeleteFunction",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:TagResource",
      "lambda:UntagResource",
    ]

    resources = [
      "arn:aws:lambda:us-east-1:537690166345:function:chsn-runners-api",
    ]
  }

  statement {
    sid = "RunnerApiLambdaRoleRead"

    actions = [
      "iam:GetRole",
      "iam:ListAttachedRolePolicies",
      "iam:ListRolePolicies",
    ]

    resources = [
      "arn:aws:iam::537690166345:role/chsn-runners-api-lambda",
    ]
  }
}

resource "aws_iam_policy" "github_actions" {
  name   = "chsn-runners-github-actions"
  policy = data.aws_iam_policy_document.github_actions_permissions.json
}

resource "aws_iam_role_policy_attachment" "github_actions" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions.arn
}