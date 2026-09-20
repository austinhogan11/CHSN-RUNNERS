# CHSN-RUNNERS Engineering Backlog

This document tracks engineering hardening, correctness, security, CI/CD,
and technical-debt work that should progress alongside Runner product development.

The objective is not to stop product work until every engineering item is complete.

Instead, work proceeds in parallel:

Product development
+
targeted engineering hardening

The project should continue to follow:

- Product before platform.
- Simple before distributed.
- Cost is a requirement.
- Fix real correctness/security issues promptly.
- Defer speculative infrastructure.
- Increase rigor as product/data risk increases.

---

## Status at a Glance

The detailed sections below remain the source of scope and acceptance criteria.

| ID | Priority | Item | Status |
| --- | --- | --- | --- |
| ENG-001 | P0 | Support Empty Training Weeks | ✅ Done |
| ENG-002 | P0 | Use Runner Local Calendar Date | ✅ Done |
| ENG-003 | P1 | Define Workout Domain Invariants | ✅ Done |
| ENG-004 | P1 | Add Authentication and Workout Ownership | ✅ Done |
| ENG-005 | P1 | Separate PR Planning Authority From Production AWS Mutation | ⏳ Pending |
| ENG-006 | P1 | Make Infrastructure Bootstrap/Recreation Reproducible | ⏳ Pending |
| ENG-007 | P2 | Preserve `/api` Routing Context in Generated URLs | ⏳ Pending |
| ENG-008 | P2 | Preserve Request Correlation on Errors | ⏳ Pending |
| ENG-009 | P2 | Namespace Application Environment Variables | ⏳ Pending |
| ENG-010 | P2 | Validate the Production Lambda Artifact in CI | ⏳ Pending |
| ENG-011 | P2 | Verify the Deployed Revision | ⏳ Pending |
| ENG-012 | P2 | Add Workout Production Smoke Check | ⏳ Pending |
| ENG-013 | P2 | Align CI and Deployment Runtime Versions | ⏳ Pending |
| ENG-014 | P2 | Validate Both Terraform Roots | ⏳ Pending |
| ENG-015 | P2 | Make Web Asset Deployment Non-Destructive | ⏳ Pending |
| ENG-016 | P2 | Coordinate Production Workflow Concurrency | ⏳ Pending |
| ENG-017 | P2 | Strengthen Lambda Artifact Immutability / Rollback | ⏳ Pending |
| ENG-018 | P2 | Consolidate Weekly Aggregation Logic | ⏳ Pending |
| ENG-019 | P2 | Centralize Frontend API Error Handling | ⏳ Pending |
| ENG-020 | P3 | Guard Extreme Date Arithmetic | ⏳ Pending |
| ENG-021 | P3 | Repair Repository Documentation | ⏳ Pending |
| ENG-022 | P3 | Ignore Terraform Local Variable and Plan Artifacts | ⏳ Pending |
| ENG-023 | P3 | Improve Local Development Process Supervision | ⏳ Pending |
| ENG-024 | P3 | Remove Template / Scaffold Residue | ⏳ Pending |
| ENG-025 | P3 | Add Basic AWS Cost Notification | ⏳ Pending |
| ENG-026 | P3 | Add Browser Security Headers | ⏳ Pending |
| ENG-027 | P3 | Add SPA Routing Support When Routes Exist | ⏳ Pending |

---

# Priority Definitions

## P0 — Fix Now

Current correctness issue that directly affects Runner V1 behavior or development.

These should normally be addressed before continuing deep feature work.

## P1 — High Priority

Important security, reliability, deployment, or data-integrity work.

These should be completed before the associated risk becomes real.

Some are specifically required before persistence/private user data.

## P2 — Hardening

Real engineering improvements that increase reliability or maintainability,
but do not currently block product development.

Work these alongside feature development in focused PRs.

## P3 — Later / Opportunistic

Low-risk technical debt and quality improvements.

Address when nearby code is already being changed or when the associated feature arrives.

---

# P0 — Fix Now

## ENG-001 — Support Empty Training Weeks

**Status:** ✅ Done — completed on `feat/workout-dashboard` in `057a5af`.
Empty weeks return HTTP 200 with derived zero totals; the dashboard preserves
the mileage trend and shows an intentional empty state, with regression tests.

**Category:** Product correctness  
**Timing:** Now  
**Source finding:** H2

### Problem

`GET /weeks/{date}` currently returns `404` when no workouts exist.

The frontend loads the week and mileage trend together using `Promise.all`, so an
empty current week causes the entire dashboard to fail even though an empty week
is valid training data.

### Desired behavior

An existing calendar week with no workouts should return:

```json
{
  "week_start": "YYYY-MM-DD",
  "planned_distance": 0,
  "actual_distance": 0,
  "workouts": []
}
```

### Acceptance criteria

- `/weeks/{date}` returns `200` for an empty week.
- Planned mileage is `0`.
- Actual mileage is `0`.
- Workouts is an empty array.
- Dashboard renders an intentional empty state.
- Mileage trend remains visible.
- Backend regression test covers an empty week.
- Frontend regression test covers an empty week.

### Suggested issue title

`fix(workouts): support empty training weeks`

---

## ENG-002 — Use Runner Local Calendar Date

**Status:** ✅ Done — completed on `feat/workout-dashboard` in `6f1858c`.
Dashboard requests use a dependency-free local calendar date helper, with
formatting and timezone-boundary regression tests.

**Category:** Product correctness  
**Timing:** Now  
**Source finding:** M1

### Problem

The frontend currently derives today using:

```ts
new Date().toISOString().slice(0, 10)
```

`toISOString()` uses UTC.

A runner late Sunday evening in a U.S. timezone can therefore be placed into
Monday's training week too early.

### Desired behavior

Determine the current date using the user's local calendar date.

### Acceptance criteria

- Introduce a small reusable local-date helper.
- App uses the helper instead of UTC ISO date extraction.
- Test Sunday/Monday boundary behavior.
- No timezone library is introduced unless a real requirement appears.

### Suggested issue title

`fix(web): use local date for training week`

---

# P1 — Before Persistence / Private Data

## ENG-003 — Define Workout Domain Invariants

**Status:** ✅ Done — completed on `feat/workout-domain-rules`.

The workout model represents a training session, and multiple sessions may share
a date. Sessions have an explicit run, rest, strength, cross-training, or other
type; a missing session is not stored as rest. Only `id` and `date` are required.
Title, description, planned distance, start time, duration, and actual distance
are optional, while status and type default to planned and run.

Distances use miles, durations use seconds, and null means unknown or not
applicable while zero remains an explicit value. Average pace is rounded seconds
per mile derived from duration and positive distance rather than stored. Optional
distance values must be finite and nonnegative, and duration must be
nonnegative. Start time remains a local wall-clock value until user timezone
semantics are introduced with persistence.

Planned, completed, and skipped describe scheduling/execution state without
requiring or forbidding metrics. Strict completeness rules and transition
enforcement are deferred until mutation and persistence workflows exist. Create
and update request models are likewise deferred until there are write endpoints.

**Category:** Data integrity  
**Timing:** Before persistence  
**Source finding:** M9

### Problem

The current model permits combinations that may become contradictory once data
is persisted.

Examples:

- completed workout without execution data
- skipped workout with actual mileage
- stored pace inconsistent with distance/duration
- infinity or other invalid numeric values
- unclear null vs zero semantics
- unclear time/timezone semantics

### Decisions required

Define:

- allowed status transitions
- meaning of `planned`
- meaning of `completed`
- meaning of `skipped`
- whether partial completion exists
- null vs zero distance
- whether average pace is stored or derived
- canonical distance unit
- canonical duration unit
- start-time/timezone representation

### Acceptance criteria

- Domain rules documented.
- Pydantic validation enforces decided invariants.
- Invalid combinations receive tests.
- Frontend types remain compatible.
- Database schema is not designed until these semantics are settled.

### Suggested issue title

`feat(workouts): define workout execution invariants`

---

## ENG-004 — Add Authentication and Workout Ownership

**Status:** ✅ Done — completed on `feat/clerk-auth`.

The React app uses Clerk with Google as the initial sign-in provider. Signed-out
visitors see the Runner sign-in flow, while signed-in sessions attach a Clerk
session token to API requests. Apple sign-in remains a future provider option.

FastAPI verifies Clerk-issued RS256 tokens through the configured issuer and
JWKS, including expiry, not-before, and authorized-party checks. Protected read
routes receive a provider-neutral `CurrentUser` and use the verified `sub` claim
as the DynamoDB `user_id`; ownership does not depend on whether the user signed
in with Google or another social provider.

The former `runner-v1-default-user` production fallback has been removed. Demo
records can be explicitly and repeatably reassigned to a real Clerk user ID with
the existing seed command. Write APIs and their ownership checks remain deferred.

**Category:** Security / product architecture  
**Timing:** Before storing meaningful private workout data

### Problem

The API is currently public and unauthenticated.

That is acceptable for fixture/demo data, but not for persisted private training records.

### Desired behavior

Before private data becomes meaningful:

- authenticate requests
- associate workouts with a user
- authorize access based on ownership
- prevent arbitrary users from reading/modifying another user's records

### Acceptance criteria

To be defined when authentication design begins.

Do not select an authentication system prematurely.

### Suggested issue title

`feat(auth): protect persisted workout data`

---

# P1 — Security / Infrastructure

## ENG-005 — Separate PR Planning Authority From Production AWS Mutation

**Category:** Security / IAM  
**Timing:** High priority infrastructure PR  
**Source finding:** H1

### Problem

GitHub workflow contexts can assume an AWS role with broad production mutation
capabilities.

Terraform PR planning currently shares authority with deployment/apply workflows.

### Desired architecture

Separate:

```text
PR planning role
→ read / refresh / plan requirements

production deployment/apply role
→ mutation permissions
→ protected production trust boundary
```

### Acceptance criteria

- PR workflows cannot mutate production infrastructure.
- Production role trust is restricted to the intended branch/environment.
- IAM resources are narrowed where AWS APIs allow it.
- Wildcard permissions required by AWS are documented.
- Terraform CI remains functional.

### Suggested issue title

`security(infra): separate Terraform plan and production roles`

---

## ENG-006 — Make Infrastructure Bootstrap/Recreation Reproducible

**Category:** Disaster recovery / infrastructure  
**Timing:** High priority but separate from product UI  
**Source finding:** H3

### Problem

Current infrastructure appears to depend on historical/manual bootstrap actions,
including Lambda's initial ECR image and some IAM/ECR behavior.

A healthy Terraform plan against existing resources does not prove the system
can be recreated.

### Required investigation

Document:

- how the ECR repository is initially created
- how the first `bootstrap` image is produced
- how Lambda gains image pull access
- which IAM permissions Terraform requires for first creation
- which actions remain intentionally manual

### Acceptance criteria

- A documented clean-bootstrap process exists.
- Required infrastructure permissions match Terraform ownership.
- Initial Lambda image creation is reproducible.
- Normal application deployment remains owned by CI/CD.
- Terraform does not begin owning normal release image selection.

### Suggested issue title

`fix(infra): make API bootstrap reproducible`

---

# P2 — API / Observability Hardening

## ENG-007 — Preserve `/api` Routing Context in Generated URLs

**Category:** API correctness  
**Source finding:** M2

### Problem

Mangum strips `/api` before FastAPI handles requests.

FastAPI-generated URLs currently do not necessarily understand the public external prefix.

Observed implications include:

- `/api/docs` referencing `/openapi.json`
- redirects potentially pointing directly at API Gateway

### Acceptance criteria

- Public `/api/docs` works if docs remain enabled.
- Generated redirects preserve the intended public entry path.
- Internal API Gateway hostname is not unintentionally exposed through redirects.
- Realistic Mangum routing tests cover the behavior.

### Suggested issue title

`fix(api): preserve external API routing context`

---

## ENG-008 — Preserve Request Correlation on Errors

**Category:** Observability  
**Source finding:** M3

### Problem

Successful requests receive `x-request-id`, but unhandled exception responses can
lose the correlation ID.

Frontend errors also discard available request identifiers.

### Acceptance criteria

- Application-generated `500` responses expose the request correlation ID.
- Exception logs include canonical request ID.
- Local application logs are actually emitted.
- Frontend API errors retain response request ID when available.
- Tests cover failure correlation.

### Suggested issue title

`fix(api): preserve request correlation on failures`

---

## ENG-009 — Namespace Application Environment Variables

**Category:** Configuration reliability  
**Source finding:** M8

### Problem

Generic variables such as `DEBUG` can collide with unrelated shell/tool environment values.

### Desired direction

Prefer application-specific names, for example:

```text
RUNNER_ENVIRONMENT
RUNNER_DEBUG
```

or another consistent prefix.

### Acceptance criteria

- Generic environment names no longer unexpectedly control application startup.
- Deployment configuration is updated.
- Example/local environment configuration is updated.
- Controlled configuration tests exist.

### Suggested issue title

`fix(api): namespace application settings`

---

# P2 — CI/CD Hardening

## ENG-010 — Validate the Production Lambda Artifact in CI

**Category:** CI / release confidence  
**Source finding:** M5

### Problem

PR container CI primarily exercises the Uvicorn API container rather than the
actual Lambda artifact defined by `Dockerfile.lambda`.

Production is the first place the Lambda image receives full validation.

### Desired behavior

Build and exercise the deployable Lambda artifact before production deployment.

### Acceptance criteria

- PR CI builds `Dockerfile.lambda`.
- Lambda/Mangum behavior receives a smoke test.
- Workout endpoint is exercised.
- Existing local API container coverage remains useful where appropriate.

### Suggested issue title

`ci(api): validate Lambda deployment artifact`

---

## ENG-011 — Verify the Deployed Revision

**Category:** Deployment correctness  
**Source finding:** M5

### Problem

Production smoke tests prove that a healthy application is running, but not
necessarily that the intended commit was deployed.

### Desired behavior

Expose or otherwise record a deployment revision.

Potential representation:

```text
version
environment
commit_sha
```

### Acceptance criteria

- Deployment injects an immutable revision identifier.
- `/version` or equivalent exposes it.
- Post-deployment smoke test confirms the expected revision.

### Suggested issue title

`ci(api): verify deployed revision`

---

## ENG-012 — Add Workout Production Smoke Check

**Category:** Deployment confidence  
**Source finding:** M5

### Problem

Production API smoke testing currently focuses primarily on system endpoints.

### Acceptance criteria

- Production smoke test exercises at least one Runner application contract.
- Keep smoke test lightweight.
- Do not make it dependent on mutable user records.

### Suggested issue title

`ci(api): smoke test Runner API contract`

---

## ENG-013 — Align CI and Deployment Runtime Versions

**Category:** CI consistency  
**Source finding:** M5

### Problem

Different workflows currently use different Node/runtime versions and dependency
locking behavior.

### Acceptance criteria

- Web CI and deployment use the same supported Node major version.
- API dependency locking expectations are consistent.
- Runtime versions are intentional and documented.

### Suggested issue title

`chore(ci): align build runtime versions`

---

## ENG-014 — Validate Both Terraform Roots

**Category:** Infrastructure CI  
**Source finding:** M5

### Problem

Application Terraform receives stronger validation than bootstrap Terraform.

### Acceptance criteria

CI validates:

```text
infra/bootstrap
infra/terraform
```

at the appropriate level without granting PRs production mutation capability.

### Suggested issue title

`ci(infra): validate bootstrap Terraform`

---

# P2 — Release Safety

## ENG-015 — Make Web Asset Deployment Non-Destructive

**Category:** Frontend deployment  
**Source finding:** M4

### Problem

Deployment can delete previous hashed assets before all users have transitioned
to the newly published HTML.

A client with cached HTML may reference a deleted JavaScript asset.

### Desired deployment order

Conceptually:

```text
upload new hashed assets
→ publish new HTML
→ invalidate mutable entry files
→ retain old hashed assets temporarily
```

### Acceptance criteria

- Existing hashed assets are not immediately deleted during deployment.
- New HTML is published after assets exist.
- CloudFront invalidation targets mutable entry content where practical.
- Old assets have a defined cleanup strategy.

### Suggested issue title

`fix(web): make static deployments rollback-safe`

---

## ENG-016 — Coordinate Production Workflow Concurrency

**Category:** Release safety  
**Source finding:** M6

### Problem

Terraform, API deployment, and web deployment use independent concurrency controls
while some operations can touch the same resources.

### Acceptance criteria

- Workflows that mutate the same production resource cannot race.
- Terraform state locking is not treated as protection for direct AWS CLI updates.
- Deployment identifiers have a maintained source of truth.

### Suggested issue title

`fix(ci): coordinate production deployment concurrency`

---

## ENG-017 — Strengthen Lambda Artifact Immutability / Rollback

**Category:** Release recovery  
**Source finding:** M7

### Problem

`deploy-<SHA>` tags can still be mutable at the ECR level.

Lifecycle cleanup may eventually remove artifacts needed for rollback.

### Desired direction

Prefer immutable image digests as deployment identity.

### Acceptance criteria

- Release artifact can be uniquely identified by digest.
- Redeploying a commit cannot silently replace its artifact identity.
- Current and reasonable rollback images are protected from cleanup.
- Retention stays cost-conscious.

### Suggested issue title

`fix(api): strengthen Lambda release immutability`

---

# P2 — Shared Domain Logic

## ENG-018 — Consolidate Weekly Aggregation Logic

**Category:** Maintainability  
**Source finding:** Product/code architecture review

### Problem

Week-start calculation, workout filtering, and weekly totals are duplicated between routes.

### Desired behavior

Introduce a small pure domain/helper function.

Do not create a large service/repository hierarchy.

### Acceptance criteria

- Week boundary logic has one implementation.
- Planned/actual aggregation semantics have one implementation.
- Unit tests cover the pure function.
- Both API routes use it.

### Suggested issue title

`refactor(api): share weekly workout aggregation`

---

## ENG-019 — Centralize Frontend API Error Handling

**Category:** Frontend maintainability  
**Source finding:** Product/code architecture review

### Problem

As API calls grow, status handling and request-correlation handling will otherwise
be duplicated.

### Desired direction

Introduce only a thin fetch helper.

Do not introduce a networking/state framework.

### Acceptance criteria

- HTTP status is retained.
- request ID can be retained.
- existing typed endpoint functions remain simple.
- current behavior remains tested.

### Suggested issue title

`refactor(web): centralize API error handling`

---

# P3 — Low-Priority Correctness

## ENG-020 — Guard Extreme Date Arithmetic

**Category:** API validation  
**Source finding:** L1

### Problem

Dates near Python calendar limits can overflow weekly arithmetic and cause `500`.

### Acceptance criteria

- Supported calendar range is explicit.
- Invalid extreme dates return a validation response instead of `500`.

### Suggested issue title

`fix(api): validate workout calendar range`

---

# P3 — Repository / Developer Experience

## ENG-021 — Repair Repository Documentation

**Category:** Developer experience  
**Source finding:** L2

### Work includes

- fix malformed root README
- remove duplicated/malformed contributing content
- document `git dev`
- document validation aliases
- document fixture limitations
- replace default web README
- document API basics

### Suggested issue title

`docs: refresh repository developer guide`

---

## ENG-022 — Ignore Terraform Local Variable and Plan Artifacts

**Category:** Security hygiene  
**Source finding:** L3

### Acceptance criteria

Ignore appropriate local artifacts such as:

```text
*.tfvars
*.tfplan
tfplan
```

while retaining explicitly tracked examples.

Review exact patterns before committing so legitimate checked-in configuration is not hidden.

### Suggested issue title

`chore(infra): ignore local Terraform artifacts`

---

## ENG-023 — Improve Local Development Process Supervision

**Category:** Developer experience  
**Source finding:** L4

### Problem

If one local server exits, the other may remain running.

Compose startup also does not fully use the existing API health check.

### Acceptance criteria

- `git dev` stops both children when either fails.
- Ctrl+C reliably cleans up both processes.
- Compose can wait for API health where appropriate.

### Suggested issue title

`chore(dev): improve local process supervision`

---

## ENG-024 — Remove Template / Scaffold Residue

**Category:** Cleanup  
**Source finding:** L5

### Work includes

- update page title
- remove unused Vite scaffold code/styles/assets
- fix misplaced GitHub templates
- clean obsolete product scaffolding

Do this during nearby frontend/repository work rather than as a major project.

### Suggested issue title

`chore: remove starter template residue`

---

# P3 — Optional Operational Improvements

## ENG-025 — Add Basic AWS Cost Notification

**Category:** Cost visibility  
**Timing:** Optional

### Goal

Add a small budget/cost notification so accidental usage increases are visible.

This should remain lightweight and inexpensive.

### Suggested issue title

`feat(infra): add AWS cost alert`

---

## ENG-026 — Add Browser Security Headers

**Category:** Web security  
**Timing:** Optional hardening

Potential headers should be tested before rollout.

Avoid blindly applying restrictive CSP rules that break Vite-generated production assets.

### Suggested issue title

`security(web): add CloudFront response headers`

---

## ENG-027 — Add SPA Routing Support When Routes Exist

**Category:** Frontend architecture  
**Timing:** When client-side routing is introduced

### Rule

Do not implement yet.

The application currently has no real client-side navigation requirement.

When routes arrive, CloudFront should support SPA fallbacks without converting API
errors into frontend HTML.

### Suggested issue title

`feat(web): support client-side application routes`

---

# Product Development Track

Engineering hardening should not replace feature development.

The current Runner product sequence remains:

## Product 1 — Read-Only Dashboard

- weekly mileage visualization
- 12-week default window
- current-week summary
- workout list
- usable empty state
- local calendar correctness
- basic dashboard styling

## Product 2 — Persistent Workout Reads

**Status:** ✅ Done — completed on `feat/workout-persistence`.

Workout sessions are stored in an on-demand DynamoDB table with direct ID lookup
and a user/date index that preserves multiple sessions per date. Production read
routes use the DynamoDB repository; local development and tests use the same
domain behavior through an in-memory repository. Demo data is populated only by
an explicit, repeatable seed command.

Records are partitioned by the verified session token subject. Existing demo
records require the explicit reseed command after the first Clerk sign-in.
Authenticated ownership for future write APIs remains part of the next product
work.

## Product 3 — Create / Edit / Log Workouts

Support the primary workflow:

```text
planned workout
→ perform run
→ enter execution data
→ mark completed
→ weekly actual mileage updates
→ trend updates automatically
```

## Product 4 — Training Structure

Only after the workout workflow is useful:

- training blocks
- phases
- race context

Keep the representation minimal.

## Product 5 — Integrations / Enrichment

Later possibilities:

- weather
- Garmin
- Strava
- heart rate
- elevation
- shoes
- richer analytics

Do not build these ahead of the core workout workflow.

---

# Recommended Parallel Work Strategy

Use two active lanes.

## Product Lane

Primary development effort.

Examples:

```text
dashboard
persistence
workout editing
training workflow
```

## Engineering Lane

Take one contained hardening item at a time.

Suggested initial order:

```text
ENG-001 empty week
ENG-002 local calendar date

then continue dashboard

ENG-005 OIDC / role separation
ENG-007 external API routing
ENG-008 error correlation
ENG-010 Lambda artifact CI

before persistence:
ENG-003 workout invariants
ENG-004 authentication / ownership
ENG-006 reproducible bootstrap
```

Do not start several infrastructure refactors simultaneously.

---

# Current Recommended Order

## Immediate

1. ENG-001 — Empty week behavior
2. ENG-002 — Local calendar date
3. Finish read-only Runner dashboard

## Next hardening cycle

4. ENG-005 — AWS OIDC / production-role separation
5. ENG-007 — Public `/api` routing correctness
6. ENG-008 — Error request correlation
7. ENG-010 — Lambda artifact CI validation

## Before persistence

8. ENG-003 — Workout invariants
9. ENG-004 — Authentication / ownership
10. ENG-006 — Reproducible infrastructure bootstrap
11. ENG-018 — Shared weekly calculations

## Ongoing hardening

12. ENG-011 through ENG-017
13. ENG-019 through ENG-024

## Optional / future

14. ENG-025 through ENG-027

---

# Backlog Rule

This document is not a mandate to implement everything immediately.

When considering any item, ask:

1. Does this solve a current correctness, security, or reliability problem?
2. Is the associated risk active yet?
3. Does the change belong in the current PR?
4. Is there a simpler solution?
5. Will this improve the product or our ability to operate it?

If the answer does not justify the work yet, leave the item in the backlog.
