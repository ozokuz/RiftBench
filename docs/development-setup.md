# Development Setup

## Requirements

- `mise`
- Docker with Compose

Your interactive shell should already be configured to activate `mise` so the pinned tools are available directly on `PATH`.

Tools are pinned in [mise.toml](/home/ozoku/src/github.com/ozokuz/RiftBench/mise.toml):

- `.NET SDK 10`
- `Node 24`
- `pnpm 10.20.0`
- `just 1.51.0`

## Initial Setup

1. Install the pinned tools:

```bash
mise install
```

2. Restore the local .NET tools:

```bash
dotnet tool restore
```

3. Create a local env file from the example and fill in the auth credentials:

```bash
cp .env.example .env
```

Required auth variables:

- `Authentication__Discord__ClientId`
- `Authentication__Discord__ClientSecret`
- `Authentication__GitHub__ClientId`
- `Authentication__GitHub__ClientSecret`

## Start Development

Install dependencies:

```bash
just dependencies
```

Setup development database (through Docker) with migrations & card data:

```bash
just dev-bootstrap
```

Run the API and web app together:

```bash
just dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:5036`

## Quality Checks

Run all local checks:

```bash
just check
```
