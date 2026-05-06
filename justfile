set dotenv-load := true

dev-compose := "docker compose -f compose.dev.yml"
prod-compose := "docker compose --env-file .env -f compose.yml"

vite_api_base := env_var_or_default("VITE_API_BASE", "http://localhost:5036")
web_base := env_var_or_default("WEB_BASE", "http://localhost:3000")
dev_connection_string := env_var_or_default("DEV_CONNECTION_STRING", "Host=localhost;Port=5432;Database=riftbench;Username=riftbench;Password=riftbench")

default:
    @just --list

# ---------- Dependencies ----------

[parallel]
dependencies: dotnet-restore web-install

dotnet-restore:
    dotnet restore RiftBench.API/RiftBench.API.csproj
    dotnet restore RiftBench.Ingest/RiftBench.Ingest.csproj

web-install:
    cd web && pnpm install

# ---------- Development ----------
# Development uses Docker only for PostgreSQL.
# Run API and TanStack Start on your host machine.

dev: dev-db
    just dev-services

[parallel]
dev-services: api-dev web-dev

dev-db:
    {{dev-compose}} up -d db

dev-db-logs:
    {{dev-compose}} logs -f db

dev-db-down:
    {{dev-compose}} down

dev-db-clean:
    {{dev-compose}} down -v --remove-orphans

# Regenerates RiftBench.API/RiftBench.API.json for the frontend client generation.
openapi:
    ASPNETCORE_ENVIRONMENT="Development" dotnet build RiftBench.API/RiftBench.API.csproj

dev-migrate:
    ASPNETCORE_ENVIRONMENT="Development" ConnectionStrings__DefaultConnection='{{dev_connection_string}}' dotnet ef database update --project RiftBench.Data/RiftBench.Data.csproj --startup-project RiftBench.API/RiftBench.API.csproj --context AppDbContext

dev-ingest:
    ASPNETCORE_ENVIRONMENT="Development" ConnectionStrings__DefaultConnection='{{dev_connection_string}}' dotnet run --project RiftBench.Ingest/RiftBench.Ingest.csproj

api-dev:
    ASPNETCORE_ENVIRONMENT="Development" WebBase='{{web_base}}' ConnectionStrings__DefaultConnection='{{dev_connection_string}}' dotnet watch --project RiftBench.API/RiftBench.API.csproj

web-dev: openapi
    cd web && VITE_API_BASE='{{vite_api_base}}' pnpm dev

dev-bootstrap: dev-db dev-migrate dev-ingest

# Add an EF Core migration:
#   just migration-add CreateInitialSchema
migration-add name:
    ASPNETCORE_ENVIRONMENT="Development" ConnectionStrings__DefaultConnection='{{dev_connection_string}}' dotnet ef migrations add {{name}} --project RiftBench.Data/RiftBench.Data.csproj --startup-project RiftBench.API/RiftBench.API.csproj --context AppDbContext

# ---------- Local quality gates ----------

[parallel]
check: check-api check-web

check-api:
    dotnet build RiftBench.API/RiftBench.API.csproj
    dotnet build RiftBench.Ingest/RiftBench.Ingest.csproj

check-web:
    cd web && pnpm build

[parallel]
format: format-dotnet format-web

format-dotnet:
    dotnet format

format-web:
    cd web && pnpm format

# ---------- Generic parallel task groups ----------
# Just 1.42+ runs dependencies of recipes marked with [parallel] concurrently.
# Add/remove dependencies here to customize your own grouped tasks.

[parallel]
parallel-build: build-api build-ingest build-web

build-api:
    docker build --build-arg DOTNET_VERSION=${DOTNET_VERSION:-10.0} -f Dockerfile.api --target api -t riftbench-api:local .

build-ingest:
    docker build --build-arg DOTNET_VERSION=${DOTNET_VERSION:-10.0} -f Dockerfile.ingest --target ingest -t riftbench-ingest:local .

build-web:
    docker build \
      --build-arg NODE_VERSION=${NODE_VERSION:-24} \
      --build-arg DOTNET_VERSION=${DOTNET_VERSION:-10.0} \
      --build-arg VITE_API_BASE=${VITE_API_BASE:-http://localhost:5036} \
      -f Dockerfile.web \
      --target web \
      -t riftbench-web:local .

# ---------- Production / Azure VM ----------
# Production is fully containerized behind Traefik.

prod-build:
    {{prod-compose}} build

prod-up:
    {{prod-compose}} up -d db traefik
    {{prod-compose}} --profile jobs run --rm migrate
    {{prod-compose}} --profile jobs run --rm ingest
    {{prod-compose}} up -d api web

prod-down:
    {{prod-compose}} down

prod-clean:
    {{prod-compose}} down -v --remove-orphans

prod-logs service="":
    {{prod-compose}} logs -f {{service}}

migrate:
    {{prod-compose}} up -d db
    {{prod-compose}} --profile jobs run --rm migrate

ingest:
    {{prod-compose}} up -d db
    {{prod-compose}} --profile jobs run --rm ingest

deploy:
    just prod-build
    just prod-up

restart:
    {{prod-compose}} restart api web

ps:
    {{prod-compose}} ps
