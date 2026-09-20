# Runner API

Local development uses the in-memory demo workout repository, so `git dev` does
not require AWS credentials or a local DynamoDB service.

Production selects the DynamoDB repository with these Lambda environment
variables, which Terraform manages:

- `WORKOUT_REPOSITORY=dynamodb`
- `WORKOUT_TABLE_NAME=chsn-runners-workouts`
- `CLERK_ISSUER=https://your-instance.clerk.accounts.dev`
- `CLERK_AUTHORIZED_PARTIES=https://your-frontend.example`

Routes verify Clerk session tokens and use the verified `sub` claim as the
repository user ID. Local in-memory demo data can be assigned to a Clerk user by
setting `WORKOUT_DEMO_USER_ID` to that user's `user_...` ID.

## Seed demo workouts

After signing in once, copy the new `user_...` ID from the Clerk Dashboard. An
operator with `dynamodb:PutItem` permission can then explicitly reassign the
existing demo sessions from `runner-v1-default-user` by running this from
`apps/api`:

```sh
uv run python scripts/seed_workouts.py \
  --table-name chsn-runners-workouts \
  --user-id user_replace_with_clerk_user_id \
  --region us-east-1
```

The script uses the existing stable workout IDs, so each `PutItem` replaces that
item's old ownership and GSI key instead of creating duplicates. Rerunning it is
safe. Deployment does not run this command automatically.

## Workout mutations

Authenticated clients can create, partially update, and delete sessions through
`POST /workouts`, `PATCH /workouts/{id}`, and `DELETE /workouts/{id}`. The API
derives ownership only from the verified `CurrentUser`; mutation payloads cannot
set IDs, ownership, timestamps, or derived pace.

PATCH leaves omitted fields unchanged and clears nullable fields that are
explicitly sent as `null`. DynamoDB removes cleared optional attributes instead
of storing `NULL` values. Missing IDs and IDs owned by another user both return
`404` so the API does not reveal another user's workout IDs.
