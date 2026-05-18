# Tech Stack

## Backend

- .NET 10
- ASP.NET Core
  - minimal API endpoints for auth and identity
  - MVC controllers for cards and decks
  - OpenAPI generation via `Microsoft.AspNetCore.OpenApi` & `Microsoft.Extensions.ApiDescription.Server`
- ASP.NET Core Identity
  - application users
  - bearer token authentication
- OpenIddict
  - external OAuth client integration
  - GitHub and Discord login flows
- Entity Framework Core
- Npgsql Entity Framework Core provider for PostgreSQL
- Scalar.AspNetCore
  - local API reference UI in development

## Frontend

- React 19
- TypeScript
- TanStack Start
  - SSR application host
- TanStack Router
- TanStack Query
- TanStack Form
- Tailwind CSS
- shadcn/ui
  - app UI component layer
- `@base-ui/react`
  - lower-level UI primitives used by the component layer
- Lucide React
  - icon set
- DnD Kit
  - drag and drop in the deck editor
- Recharts
  - deck statistics charts
- Zod
  - route and form validation
- `@fontsource-variable/geist`
  - application font assets

## Tooling and Deployment

- `mise`
  - toolchain management, pinned versions
- `pnpm`
  - frontend package management
- `just`
  - development and deployment task runner
- Docker and Docker Compose
  - local database and production container orchestration
- Traefik
  - public ingress and automatic Let's Encrypt TLS
- OpenSSL
  - OpenIddict production certificate generation

## Generated and Integration Pieces

- OpenAPI document generated from the API project
- `@hey-api/openapi-ts`
  - generated TypeScript client under `web/src/client/`
- `@hey-api/vite-plugin`
  - client generation integrated into the web dev and build flow
- GitHub OAuth
- Discord OAuth
- RiftCodex API
  - external source for card and set ingestion
- `RiftBench.Ingest`
  - one-shot ingestion worker
