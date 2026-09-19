# Runner API

Local development uses the in-memory demo workout repository, so `git dev` does
not require AWS credentials or a local DynamoDB service.

Production selects the DynamoDB repository with these Lambda environment
variables, which Terraform manages:

- `WORKOUT_REPOSITORY=dynamodb`
- `WORKOUT_TABLE_NAME=chsn-runners-workouts`
- `WORKOUT_DEFAULT_USER_ID=runner-v1-default-user`

`WORKOUT_DEFAULT_USER_ID` is temporary single-user scaffolding. Authentication
will replace it with the authenticated user's identity in a later product slice.

## Seed demo workouts

After the table has been created, an operator with `dynamodb:PutItem` permission
can explicitly seed the existing demo sessions from `apps/api`:

```sh
uv run python scripts/seed_workouts.py \
  --table-name chsn-runners-workouts \
  --user-id runner-v1-default-user \
  --region us-east-1
```

The script uses stable workout IDs and timestamps, so rerunning it safely
replaces the same four items. Deployment does not run this command automatically.
