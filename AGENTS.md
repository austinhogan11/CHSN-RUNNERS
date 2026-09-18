# CHSN-RUNNERS Agent Instructions

## Engineering Philosophy

- Product before platform.
- Simple before distributed.
- Cost is a requirement.
- Avoid speculative abstractions.
- Prefer small vertical slices.
- Do not add infrastructure without a concrete product requirement.

## Git Workflow

- Inspect the current branch and working tree before making changes.
- Stay on the current feature branch when the task belongs there.
- Create a new branch only when the task clearly requires a separate PR.
- Never discard user changes.
- Make small coherent commits as meaningful tasks are completed.
- Use Conventional Commits.
- Validate before committing.
- Do not push unless explicitly requested.
- Do not merge.
- Do not rewrite history unless explicitly requested.
- Do not modify PR state unless explicitly requested.

Normal lifecycle:

main
→ feature branch
→ small commits
→ push
→ PR
→ CI/review
→ squash merge

## Validation

Backend:
- git fix-api
- git check-api

Frontend:
- git fix-web
- git check-web

Terraform:
- git fix-terraform
- git check-terraform

Run validation relevant to every area changed.

## Implementation Rules

- Inspect existing patterns before introducing new ones.
- Prefer extending existing architecture over introducing new frameworks.
- Do not add abstractions for hypothetical future requirements.
- Keep API contracts explicit.
- Add or update tests when behavior changes.
- Do not weaken linting, typing, CI, or tests to make code pass.
- Report uncertainties instead of silently guessing.

## Completion Report

At the end of a task, report:

1. What was changed
2. Files changed
3. Important design decisions
4. Tests added or updated
5. Validation commands run and results
6. Commits created
7. Any risks, follow-up work, or unresolved questions