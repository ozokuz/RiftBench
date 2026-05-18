# Production Deployment

## Requirements

- A Linux host with Docker and Docker Compose
- Ports `80` and `443` open to the internet
- DNS records pointing at the host for:
  - `WEB_HOST`
  - `API_HOST`
  - `TRAEFIK_HOST`
- OAuth app credentials for GitHub and Discord configured to use the production callback URLs

## Configure `.env`

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set at least:

- `WEB_HOST`
- `API_HOST`
- `TRAEFIK_HOST`
- `TRAEFIK_ACME_EMAIL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `Authentication__Discord__ClientId`
- `Authentication__Discord__ClientSecret`
- `Authentication__GitHub__ClientId`
- `Authentication__GitHub__ClientSecret`
- `OpenIddict__Client__EncryptionCertificatePassword`
- `OpenIddict__Client__SigningCertificatePassword`
- `VITE_API_BASE`
- `WEB_BASE`

Use the externally reachable URLs for:

- `VITE_API_BASE`, for example `https://api.riftbench.example.com`
- `WEB_BASE`, for example `https://riftbench.example.com`

OAuth callback URLs should match the API host:

- `https://api.riftbench.example.com/auth/callback/github`
- `https://api.riftbench.example.com/auth/callback/discord`

## Generate OpenIddict Certificates

Generate the OpenIddict client certificates before the first deploy:

```bash
just prod-certs
```

This writes two PFX files to `.secrets/openiddict/`:

- `openiddict-client-encryption.pfx`
- `openiddict-client-signing.pfx`

They are mounted automatically into the production API container by `compose.yml`.

## First Deployment

Build and start the production stack:

```bash
just deploy
```

That does the following:

1. Generates the OpenIddict certificates if they do not already exist.
2. Builds the `api`, `web`, `migrate`, and `ingest` images.
3. Starts PostgreSQL and Traefik.
4. Runs database migrations.
5. Runs the ingest job.
6. Starts the API and web containers.

## Operations

View container status:

```bash
just ps
```

View logs:

```bash
just prod-logs
just prod-logs api
just prod-logs web
```

Restart the long-running services:

```bash
just restart
```

Run migrations again:

```bash
just migrate
```

Run the ingest job again:

```bash
just ingest
```

Stop the stack:

```bash
just prod-down
```

Stop the stack and delete volumes:

```bash
just prod-clean
```

## Updating Deployment

On a new revision:

```bash
git pull
just deploy
```

The OpenIddict certificates are reused from `.secrets/openiddict/`. Do not delete that directory unless you intend to rotate the client certificates and update the corresponding passwords in `.env`.
