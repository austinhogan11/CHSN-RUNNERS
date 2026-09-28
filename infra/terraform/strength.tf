resource "aws_dynamodb_table" "strength_maxes" {
  name         = "chsn-runners-strength-maxes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "max_key"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "max_key"
    type = "S"
  }
}

resource "aws_dynamodb_table" "strength_exercises" {
  name         = "chsn-runners-strength-exercises"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "strength_sessions" {
  name         = "chsn-runners-strength-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "user_date_key"
    type = "S"
  }

  global_secondary_index {
    name            = "user-date-index"
    projection_type = "ALL"

    key_schema {
      attribute_name = "user_id"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "user_date_key"
      key_type       = "RANGE"
    }
  }
}

resource "aws_dynamodb_table" "strength_templates" {
  name         = "chsn-runners-strength-templates"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "user-id-index"
    projection_type = "ALL"

    key_schema {
      attribute_name = "user_id"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "id"
      key_type       = "RANGE"
    }
  }
}

data "aws_iam_policy_document" "api_strength_reads" {
  statement {
    sid = "ReadStrengthItems"

    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
    ]

    resources = [
      aws_dynamodb_table.strength_maxes.arn,
      aws_dynamodb_table.strength_exercises.arn,
      aws_dynamodb_table.strength_sessions.arn,
      "${aws_dynamodb_table.strength_sessions.arn}/index/user-date-index",
      aws_dynamodb_table.strength_templates.arn,
      "${aws_dynamodb_table.strength_templates.arn}/index/user-id-index",
    ]
  }
}

resource "aws_iam_role_policy" "api_strength_reads" {
  name   = "chsn-runners-api-strength-reads"
  role   = aws_iam_role.api_lambda.id
  policy = data.aws_iam_policy_document.api_strength_reads.json
}

data "aws_iam_policy_document" "api_strength_writes" {
  statement {
    sid = "MutateStrengthItems"

    actions = [
      "dynamodb:DeleteItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ]

    resources = [
      aws_dynamodb_table.strength_maxes.arn,
      aws_dynamodb_table.strength_exercises.arn,
      aws_dynamodb_table.strength_sessions.arn,
      aws_dynamodb_table.strength_templates.arn,
    ]
  }
}

resource "aws_iam_role_policy" "api_strength_writes" {
  name   = "chsn-runners-api-strength-writes"
  role   = aws_iam_role.api_lambda.id
  policy = data.aws_iam_policy_document.api_strength_writes.json
}
