set dotenv-load := true

dev-compose := "docker compose -f compose.dev.yml"
prod-compose := "docker compose --env-file .env -f compose.yml"

vite_api_base := env_var_or_default("VITE_API_BASE", "http://localhost:5036")
web_base := env_var_or_default("WEB_BASE", "http://localhost:3000")
prod_openiddict_cert_dir := ".secrets/openiddict"
prod_openiddict_encryption_cert_path := prod_openiddict_cert_dir + "/openiddict-client-encryption.pfx"
prod_openiddict_signing_cert_path := prod_openiddict_cert_dir + "/openiddict-client-signing.pfx"

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
    ASPNETCORE_ENVIRONMENT="Development" dotnet ef database update --project RiftBench.Data/RiftBench.Data.csproj --startup-project RiftBench.API/RiftBench.API.csproj --context AppDbContext

dev-ingest:
    cd RiftBench.Ingest && DOTNET_ENVIRONMENT="Development" dotnet run

api-dev:
    ASPNETCORE_ENVIRONMENT="Development" WebBase='{{web_base}}' dotnet watch --project RiftBench.API/RiftBench.API.csproj

web-dev: openapi
    cd web && VITE_API_BASE='{{vite_api_base}}' pnpm dev

dev-bootstrap: dev-db dev-migrate dev-ingest

# Add an EF Core migration:
#   just migration-add CreateInitialSchema
migration-add name:
    ASPNETCORE_ENVIRONMENT="Development" dotnet ef migrations add {{name}} --project RiftBench.Data/RiftBench.Data.csproj --startup-project RiftBench.API/RiftBench.API.csproj --context AppDbContext

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

prod-certs:
    #!/usr/bin/env bash
    set -euo pipefail
    cert_dir="{{prod_openiddict_cert_dir}}"
    encryption_pfx="{{prod_openiddict_encryption_cert_path}}"
    signing_pfx="{{prod_openiddict_signing_cert_path}}"
    encryption_password="${OpenIddict__Client__EncryptionCertificatePassword:-change-me-encryption}"
    signing_password="${OpenIddict__Client__SigningCertificatePassword:-change-me-signing}"

    mkdir -p "$cert_dir"

    if [ -f "$encryption_pfx" ] && [ -f "$signing_pfx" ]; then
        echo "OpenIddict production certificates already exist in $cert_dir"
        exit 0
    fi

    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT

    if [ ! -f "$encryption_pfx" ]; then
        openssl req -x509 -newkey rsa:4096 -sha256 -days 730 -nodes \
            -keyout "$tmp_dir/openiddict-client-encryption.key" \
            -out "$tmp_dir/openiddict-client-encryption.crt" \
            -subj "/CN=RiftBench OpenIddict Client Encryption"
        openssl pkcs12 -export \
            -out "$encryption_pfx" \
            -inkey "$tmp_dir/openiddict-client-encryption.key" \
            -in "$tmp_dir/openiddict-client-encryption.crt" \
            -passout "pass:$encryption_password"
    fi

    if [ ! -f "$signing_pfx" ]; then
        openssl req -x509 -newkey rsa:4096 -sha256 -days 730 -nodes \
            -keyout "$tmp_dir/openiddict-client-signing.key" \
            -out "$tmp_dir/openiddict-client-signing.crt" \
            -subj "/CN=RiftBench OpenIddict Client Signing"
        openssl pkcs12 -export \
            -out "$signing_pfx" \
            -inkey "$tmp_dir/openiddict-client-signing.key" \
            -in "$tmp_dir/openiddict-client-signing.crt" \
            -passout "pass:$signing_password"
    fi

    chmod 600 "$encryption_pfx" "$signing_pfx"
    echo "OpenIddict production certificates ready in $cert_dir"

prod-build:
    just prod-certs
    {{prod-compose}} build
    {{prod-compose}} build migrate
    {{prod-compose}} build ingest

prod-up:
    just prod-certs
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
    {{prod-compose}} build migrate
    {{prod-compose}} --profile jobs run --rm migrate

ingest:
    {{prod-compose}} up -d db
    {{prod-compose}} build ingest
    {{prod-compose}} --profile jobs run --rm ingest

deploy:
    just prod-build
    just prod-up

restart:
    {{prod-compose}} restart api web

ps:
    {{prod-compose}} ps
