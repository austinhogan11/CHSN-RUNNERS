# AI / Agent Contribution Guidelines

This repository may use AI-assisted development tools and autonomous coding agents.

AI-generated changes are treated as untrusted until they are reviewed, understood, tested, and accepted by a human contributor.

## Core Principles

- Human contributors own architecture, product decisions, interfaces, data models, and final merge decisions.
- Agents should make the smallest reasonable change needed to satisfy the assigned issue.
- Agents must follow the same contribution, testing, security, and review requirements as human contributors.
- Agents should not introduce unnecessary abstractions, dependencies, infrastructure, or architectural changes.

## Scope of Changes

Agents should:

- work from a clearly defined issue or task
- stay within the requested scope
- preserve existing architecture and conventions unless explicitly asked to change them
- explain meaningful implementation or design decisions
- call out assumptions when requirements are unclear

Agents should not:

- make unrelated refactors
- redesign architecture without explicit approval
- introduce new frameworks or major dependencies without justification
- modify unrelated files solely for cleanup
- silently change public interfaces, API contracts, schemas, or persistence behavior

## Testing and Validation

Agents must:

- add or update tests when behavior changes
- run applicable tests, linting, formatting, and type checks when available
- clearly report checks that were not run
- never remove, skip, disable, or weaken tests solely to make CI pass
- never bypass required quality or security checks

## Security

Agents must never:

- commit secrets, credentials, tokens, private keys, or populated environment files
- print or expose sensitive values in logs or documentation
- weaken authentication, authorization, validation, or security controls to simplify implementation
- disable security scanning or repository protections
- add insecure dependency versions to resolve build issues

Security-sensitive changes should be explicitly identified in the pull request.

## Dependencies

Before adding a dependency, agents should determine whether the requirement can reasonably be satisfied using the standard library or existing project dependencies.

New dependencies must have a clear purpose and should be:

- actively maintained
- appropriately licensed
- compatible with the existing stack
- reviewed for security and maintenance risk

## Repository and CI Guardrails

Agents must not:

- push directly to protected branches
- force-push protected branches
- merge their own changes without the configured review process
- modify branch protection or repository security settings unless explicitly requested
- weaken required CI checks
- change deployment or production infrastructure without explicit scope and review

## Generated Code

Generated code must be understandable and maintainable by human contributors.

Agents should prefer:

- simple implementations
- explicit behavior
- clear naming
- small, reviewable changes

Agents should avoid:

- speculative abstractions
- unnecessary generic frameworks
- large generated files without justification
- duplicating code when an existing project pattern should be followed

## Pull Requests

AI-assisted pull requests should:

- reference the related issue
- summarize what changed and why
- identify tests and validation performed
- identify any new dependencies
- call out architecture, API, schema, security, or infrastructure impacts
- disclose meaningful AI-generated implementation when relevant to review

The human reviewer remains responsible for understanding and accepting the final change.

## When Requirements Are Unclear

Agents should not invent important product or architecture requirements.

If a decision could materially affect architecture, data integrity, security, API compatibility, or operational behavior, the agent should stop and request clarification before proceeding.
