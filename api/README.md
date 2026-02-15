# Kkalla API

Backend for the [Kkalla](https://github.com/eunsoogi/kkalla) AI investment assistant. NestJS REST API with TypeORM, MariaDB, Redis, Swagger, and integrations for OpenAI, Upbit, AWS SQS, and Slack.

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeORM-0.3-FE291A" alt="TypeORM" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm" alt="pnpm" />
</p>

---

## Features

- **Auth** — Google OAuth, JWT bearer, roles & permissions
- **Users & roles** — CRUD, role-based access
- **Market research** — OpenAI-powered analysis and recommendations
- **Rebalance** — Portfolio rebalance suggestions (AI)
- **Upbit / trade** — Market data, trades, profit
- **News** — News aggregation and management
- **Notify** — Notifications (e.g. Slack), schedules
- **Blacklist** — Symbol blacklisting
- **Health** — Liveness/readiness for Kubernetes
- **i18n** — Korean locale support

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| **Framework** | NestJS 11, Express |
| **ORM** | TypeORM, MariaDB (mysql2), Redis (ioredis, redlock) |
| **Auth** | Passport (Google, JWT bearer), class-validator |
| **API docs** | Swagger (`/docs`) |
| **External** | OpenAI, Upbit (ccxt), AWS SQS, Slack |

---

## Project structure

```
api/
├── src/
│   ├── modules/           # Feature modules
│   │   ├── auth/          # Google OAuth, JWT, guards
│   │   ├── user/          # Users CRUD
│   │   ├── role/          # Roles & permissions
│   │   ├── market-research/
│   │   ├── rebalance/
│   │   ├── upbit/         # Upbit/market data
│   │   ├── trade/         # Trades, profit
│   │   ├── news/
│   │   ├── notify/        # Notifications, Slack
│   │   ├── schedule/
│   │   ├── blacklist/
│   │   ├── category/
│   │   ├── item/
│   │   ├── feargreed/
│   │   ├── health/
│   │   ├── cache/
│   │   ├── translate/
│   │   └── ...
│   ├── databases/         # TypeORM migrations, seeds
│   ├── i18n/
│   ├── utils/
│   ├── transforms/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── helm/                  # API Helm subchart
├── Dockerfile
└── package.json
```

---

## Requirements

- **Node.js** ≥ 22, **pnpm** 10
- **MariaDB** and **Redis** (or use the root [kkalla](https://github.com/eunsoogi/kkalla) Helm chart for local k3d)

---

## Setup

```bash
pnpm install
```

Configure environment (or use repo root `secrets.yaml` when running via Helm). The API expects DB, Redis, and external API keys as in the [root README](https://github.com/eunsoogi/kkalla#-configuration).

---

## Scripts

| Command | Description |
|---------|--------------|
| `pnpm start` | Start (single run) |
| `pnpm start:dev` | Start in watch mode |
| `pnpm start:prod` | Run production build (`node dist/main`) |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | E2E tests |
| `pnpm test:cov` | Unit tests with coverage |
| `pnpm migration:generate -- ...` | Generate migration |
| `pnpm migration:run` | Run migrations |
| `pnpm migration:revert` | Revert last migration |

---

## Run locally

```bash
pnpm start:dev
```

- API: `http://localhost:3000` (or `PORT` if set)
- Swagger UI: `http://localhost:3000/docs`

When running in the full stack, the root Makefile and Helm chart expose the API (e.g. port 3001) and wire DB/Redis/secrets.

---

## Deployment

This service is deployed as part of the parent [kkalla](https://github.com/eunsoogi/kkalla) repo:

- **Images**: Built with Docker Buildx (see root `docker-bake.hcl`); default registry `ghcr.io/eunsoogi/kkalla-api`
- **Orchestration**: Root Helm chart (`helm/`) includes this API as a subchart (`api/helm/`)

See the [root README](https://github.com/eunsoogi/kkalla#-getting-started) for development (k3d) and production (Kubernetes) instructions.
