resource "aws_dynamodb_table" "workouts" {
  name         = "chsn-runners-workouts"
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

data "aws_iam_policy_document" "api_workout_reads" {
  statement {
    sid = "GetWorkoutById"

    actions = [
      "dynamodb:GetItem",
    ]

    resources = [
      aws_dynamodb_table.workouts.arn,
    ]
  }

  statement {
    sid = "QueryWorkoutsByUserAndDate"

    actions = [
      "dynamodb:Query",
    ]

    resources = [
      "${aws_dynamodb_table.workouts.arn}/index/user-date-index",
    ]
  }
}

resource "aws_iam_role_policy" "api_workout_reads" {
  name   = "chsn-runners-api-workout-reads"
  role   = aws_iam_role.api_lambda.id
  policy = data.aws_iam_policy_document.api_workout_reads.json
}
