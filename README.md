# Runner

Runner is a focused running log for planning workouts, recording execution, and
reviewing weekly mileage. It has web and native iOS clients backed by the same
API and user-owned data. The production web application is available at
[chosenrunning.com](https://chosenrunning.com).

## V1.1

Runner V1.1 provides:

- React web and native SwiftUI clients using one production backend
- Clerk sign-in and private, per-user workout data
- Monday-through-Sunday navigation across past, current, and future weeks
- a seven-day overview with full selected-day workout details
- workout creation, direct inline editing, and confirmed deletion
- derived pace and completion based on entered distance or duration
- an actual-mileage-only 12-week trend with independent navigation,
  week-over-week comparison, and accessible point details

See the [V1.1 release record](docs/releases/V1.1.md) for the current shipped
behavior and the [V1 release record](docs/releases/V1.md) for the original web
release.

## Architecture

```mermaid
flowchart TD
    Browser[Runner Web] -->|sign in| Clerk[Clerk]
    iOS[Runner iOS] -->|sign in| Clerk
    Browser --> CloudFront
    iOS -->|HTTPS API| CloudFront
    CloudFront -->|/*| S3[Private S3 frontend]
    CloudFront -->|/api/*| APIGateway[API Gateway]
    APIGateway --> Lambda
    Lambda --> Mangum
    Mangum --> FastAPI
    FastAPI --> DynamoDB
    FastAPI -->|verify JWT with JWKS| Clerk
```

CloudFront is the public entry point for both the React application and the
relative `/api` path. ACM provides TLS for `chosenrunning.com` and
`www.chosenrunning.com`.

## Technology

| Area | Technology |
| --- | --- |
| Web | React, TypeScript, Vite, Clerk React |
| Mobile | Swift, SwiftUI, Swift Charts, ClerkKit |
| API | FastAPI, Python, Pydantic, Mangum |
| Database | Amazon DynamoDB |
| Authentication | Clerk JWTs; Google is the initial sign-in provider |
| Infrastructure | Terraform, AWS CloudFront, S3, API Gateway, Lambda, ECR, ACM |
| CI/CD | GitHub Actions with AWS OIDC |

## Repository Layout

```text
apps/web/          React application and frontend tests
apps/api/          FastAPI service, domain/repository code, and API tests
apps/ios/          Native SwiftUI application and tests
infra/terraform/   Runner application infrastructure
infra/bootstrap/   Terraform state and GitHub Actions OIDC bootstrap
scripts/           Local development and validation commands
docs/              Release records, backlog, and design references
.github/workflows/ CI and deployment workflows
```

## Local Development

Install Node.js/npm, Python 3.12+, and
[uv](https://docs.astral.sh/uv/). Then install dependencies and create local
configuration from the tracked examples:

```sh
cd apps/web
npm ci
cp .env.example .env

cd ../api
uv sync --dev
cp .env.example .env

cd ../..
git dev
```

Set the Clerk values in both `.env` files. The API example uses the in-memory
repository; set `WORKOUT_DEMO_USER_ID` to the signed-in Clerk user ID so that
the local demo workouts belong to that user. `git dev` serves the web app at
`http://localhost:5173` and the API at `http://127.0.0.1:8000`.

## Testing and Quality

Run the checks relevant to the area changed:

```sh
git fix-web
git check-web

git fix-api
git check-api

git fix-terraform
git check-terraform
```

The web check runs linting, TypeScript checks, Vitest, and a production build.
The API check runs Ruff, formatting verification, Pyright, and Pytest. The
Terraform check formats and validates both Terraform roots and plans against
their configured state, so it requires appropriate AWS access and Clerk input
variables. The iOS GitHub Actions workflow resolves Swift packages, builds for
testing, and runs the permanent Runner test plan on an iPhone simulator.

## Authentication and Persistence

The web and iOS clients obtain Clerk session tokens and send them as bearer
tokens on API requests. FastAPI verifies each token and uses its `sub` claim as
the storage user ID; clients cannot choose workout ownership. Production
workouts are stored in DynamoDB, while local development and tests can use the
in-memory repository.

## Deployment

Terraform manages the AWS resources. Path-scoped GitHub Actions workflows test
the web, API, containers, and Terraform. Merges to `main` build and deploy the
web bundle to the private S3 origin and deploy the API as a Lambda container
image through ECR. A manually dispatched Terraform workflow applies application
infrastructure changes. CloudFront serves the application and API under the
custom domain. The iOS client has build-and-test CI; App Store distribution is
not automated in V1.1.

## Documentation

- [Runner V1.1 release record](docs/releases/V1.1.md)
- [Runner V1 release record](docs/releases/V1.md)
- [Release documentation policy](docs/releases/README.md)
- [Engineering backlog](docs/ENGINEERING_BACKLOG.md)
- [API development and data seeding](apps/api/README.md)
- [Contribution guide](CONTRIBUTING.md)
