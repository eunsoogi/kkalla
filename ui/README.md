# Kkalla UI

Frontend for the [Kkalla](https://github.com/eunsoogi/kkalla) AI investment assistant. Next.js 16 app with NextAuth (Google), dashboard, and integrations with the Kkalla API.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm" alt="pnpm" />
</p>

---

## Features

- **Auth** — Google OAuth via NextAuth, protected routes
- **Dashboard** — Overview, news, notifications, market/rebalance recommendations
- **Users & roles** — User list/detail, role CRUD
- **News** — News list and detail
- **Trades & profits** — Trade and profit views
- **Schedules** — Schedule management
- **Blacklists** — Symbol blacklist CRUD
- **i18n** — Korean (and locale support via next-intl)
- **UI** — Tailwind CSS, Flowbite, responsive layout

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Auth** | NextAuth (Google OAuth) |
| **Data** | TanStack Query, Axios |
| **UI** | Tailwind CSS 4, Flowbite, Tabler icons, ApexCharts |
| **i18n** | next-intl |

---

## Project structure

```
ui/
├── src/
│   ├── app/
│   │   ├── (auth)/        # Sign-in, etc.
│   │   ├── (dashboard)/   # Dashboard routes
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── news/
│   │   │   ├── trades/
│   │   │   ├── profits/
│   │   │   ├── schedules/
│   │   │   ├── blacklists/
│   │   │   ├── market-recommendations/
│   │   │   ├── balance-recommendations/
│   │   │   ├── notify/
│   │   │   └── ...
│   │   ├── api/           # Next.js API routes (e.g. auth)
│   │   ├── health/
│   │   └── layout, global styles
│   ├── components/        # Shared & feature components
│   │   ├── dashboard/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── news/
│   │   ├── trade/
│   │   ├── profit/
│   │   ├── common/
│   │   └── ...
│   ├── layouts/
│   ├── i18n/
│   ├── hooks/
│   ├── utils/
│   ├── interfaces/
│   └── enums/
├── public/
├── helm/                  # UI Helm subchart
├── Dockerfile
└── package.json
```

---

## Requirements

- **Node.js** ≥ 22, **pnpm** 10
- **Kkalla API** running (for full functionality; or use root Helm for API + UI together)

---

## Setup

```bash
pnpm install
```

Configure NextAuth and API base URL via environment (or use repo root `secrets.yaml` when running via Helm). See [root README – Configuration](https://github.com/eunsoogi/kkalla#-configuration).

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm start:dev` | Dev server with hot reload |
| `pnpm start:prod` | Serve production build |
| `pnpm build` | Production build (standalone output for Docker) |
| `pnpm lint` | Run ESLint |
| `pnpm prettier` | Format with Prettier |

---

## Run locally

```bash
pnpm start:dev
```

Open [http://localhost:3000](http://localhost:3000). Ensure the API is reachable (e.g. `http://localhost:3001` when using the root k3d setup).

---

## Deployment

This app is deployed as part of the parent [kkalla](https://github.com/eunsoogi/kkalla) repo:

- **Images**: Built with Docker Buildx (see root `docker-bake.hcl`); default registry `ghcr.io/eunsoogi/kkalla-ui`
- **Orchestration**: Root Helm chart (`helm/`) includes this UI as a subchart (`ui/helm/`)

See the [root README](https://github.com/eunsoogi/kkalla#-getting-started) for development (k3d) and production (Kubernetes) instructions.
