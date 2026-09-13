# Contributing

## Workflow

All changes should follow the standard development flow:

1. Start from an existing GitHub issue.
2. Create a branch from `main`.
3. Make the smallest reasonable change for that issue.
4. Run applicable local checks.
5. Open a pull request into `main`.
6. Ensure required CI checks pass.
7. Merge only after the change is reviewed and verified.

## Branch Naming

Use descriptive branch names that reference the issue when possible.

Examples:

```text
feat/12-training-week-model
fix/31-weekly-mileage-calculation
chore/4-add-gitignore
docs/7-update-architecture-doc
```

## Pull Requests

Pull requests should:

- have a clear title
- reference the related issue
- describe what changed and why
- identify relevant testing
- call out architecture, dependency, or security impacts
- remain reasonably small and reviewable

Use `Closes #<issue>` when the PR should automatically close an issue after merge.

## Main Branch

`main` represents the current stable integration branch.

Direct development on `main` should be avoided. Changes should normally enter through pull requests.

## Testing

Changes should include appropriate tests when behavior is added or modified.

Do not remove, skip, or weaken tests solely to make a change pass CI.

## Dependencies

New dependencies should be added intentionally.

A pull request introducing a dependency should explain:

- why it is needed
- why existing dependencies are insufficient
- any meaningful security or maintenance considerations

## Secrets and Configuration

Never commit:

- passwords
- API keys
- access tokens
- private certificates
- production credentials
- populated `.env` files# Contributing

## Workflow

All changes should follow the standard development flow:

1. Start from an existing GitHub issue.
2. Create a branch from `main`.
3. Make the smallest reasonable change for that issue.
4. Run applicable local checks.
5. Open a pull request into `main`.
6. Ensure required CI checks pass.
7. Merge only after the change is reviewed and verified.

## Branch Naming

Use descriptive branch names that reference the issue when possible.

Examples:

```text
feat/12-training-week-model
fix/31-weekly-mileage-calculation
chore/4-add-gitignore
docs/7-update-architecture-doc

Use environment variables or the approved secrets-management mechanism.

## AI-Assisted Contributions

AI tools may be used to assist development, but generated changes are held to the same standards as human-written changes.

AI-generated changes must be reviewed, understood, tested, and accepted by a human contributor before merge.

Repository-specific AI instructions are defined in `AGENTS.md`.
