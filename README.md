<p align="center">
  <img src="https://img.shields.io/badge/Kkalla-AI%20Investment%20Assistant-2563eb?style=for-the-badge&labelColor=1e3a8a" alt="Kkalla" />
</p>

<p align="center">
  <strong>AI-powered investment assistant platform</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-configuration">Configuration</a>
</p>

<p align="center">
  <a href="https://github.com/eunsoogi/kkalla/actions/workflows/lint-and-build.yaml"><img src="https://github.com/eunsoogi/kkalla/actions/workflows/lint-and-build.yaml/badge.svg" alt="Lint and Build" /></a>
  <a href="https://github.com/eunsoogi/kkalla/actions/workflows/bake-release.yaml"><img src="https://github.com/eunsoogi/kkalla/actions/workflows/bake-release.yaml/badge.svg" alt="Bake and Release" /></a>
  <a href="https://github.com/eunsoogi/kkalla/actions/workflows/deploy.yaml"><img src="https://github.com/eunsoogi/kkalla/actions/workflows/deploy.yaml/badge.svg" alt="Deploy" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm" alt="pnpm" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Next.js-16-000?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Docker-ghcr.io%2Feunsoogi%2Fkkalla-2496ED?logo=docker" alt="Docker" />
</p>

---

## ✨ Features

- **AI investment analysis** — OpenAI-powered market and stock analysis and Q&A
- **Market data** — Upbit integration for real-time and historical prices
- **Dashboard** — News, notifications, market reports, user/role/blacklist management
- **Auth** — Google OAuth 2.0, NextAuth
- **Notifications** — Slack channel integration

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|--------------|
| **API** | NestJS, TypeORM, MariaDB, Redis, Swagger |
| **UI** | Next.js 16, React 19, NextAuth, Tailwind CSS, Flowbite |
| **AI & external** | OpenAI, Upbit API, AWS SQS, Slack |
| **Infra** | Docker, Helm, Kubernetes, k3d (local) |

---

## 📁 Project Structure

```text
kkalla/
├── api/                          # NestJS backend API
│   ├── src/
│   │   ├── modules/              # Domain/application modules
│   │   ├── databases/            # TypeORM config, migrations, seeds
│   │   ├── i18n/                 # API i18n resources
│   │   └── utils/
│   ├── docs/architecture/
│   │   └── system-structure.md
│   ├── helm/                     # API Helm subchart
│   ├── test/
│   ├── Dockerfile
│   └── package.json
├── ui/                           # Next.js frontend
│   ├── src/
│   │   ├── app/                  # App Router routes and route-local modules
│   │   ├── layouts/              # Layout-specific components
│   │   ├── shared/               # App-global shared components/types
│   │   ├── i18n/
│   │   └── utils/
│   ├── docs/architecture/
│   │   └── system-structure.md
│   ├── helm/                     # UI Helm subchart
│   ├── Dockerfile
│   └── package.json
├── docs/
│   └── architecture/
│       └── README.md             # Architecture index
├── helm/                         # Root Helm chart (api + ui + mariadb + redis)
│   ├── values/
│   │   ├── development.yaml
│   │   └── production.yaml
│   └── Chart.yaml
├── .github/workflows/            # CI/CD (lint-and-build, bake-release, deploy)
├── docker-bake.hcl               # Docker Buildx multi-image build
├── Makefile                      # Cluster, build, install commands
├── secrets.yaml.example          # Secrets template
└── README.md
```

---

## 🚀 Getting Started

### Requirements

- **Node.js** ≥ 22, **pnpm** 10
- **Docker** (for image builds)
- **Local dev**: [k3d](https://k3d.io/) (vCore ≥ 1, memory ≥ 4GB)
- **Production**: Kubernetes (vCore ≥ 0.3, memory ≥ 512MB)

### 1. Clone and install dependencies

```bash
git clone https://github.com/eunsoogi/kkalla.git
cd kkalla
pnpm i -r   # install in both api and ui from repo root (if using a workspace)
# or
cd api && pnpm i
cd ../ui && pnpm i
```

### 2. Configure secrets

Copy `secrets.yaml.example` to `secrets.yaml` and fill in the values. See [Configuration](#-configuration).

```bash
cp secrets.yaml.example secrets.yaml
# edit secrets.yaml
```

---

## 💻 Development (k3d)

Run API + UI + MariaDB + Redis locally with a k3d cluster.

```bash
# Create cluster
make create-cluster

# Build images (development target)
make build ENV=development IMAGE_TAG=latest

# Load images into the cluster
make import IMAGE_TAG=latest

# Install via Helm (development values + secrets.yaml)
make install ENV=development
```

**URLs**: `http://localhost` (proxy), API `http://localhost:3001`, UI `http://localhost:3000`

**Teardown:**

```bash
make uninstall
make delete-cluster
```

---

## 🌐 Production (Kubernetes)

Pushing a **`v*.*.*`** tag triggers GitHub Actions to build and push images, then deploy.

**Manual deploy:**

```bash
# Bump chart appVersion
make version VERSION=2.11.0

# Build production images (push to registry separately if needed)
make build ENV=production IMAGE_TAG=2.11.0

# Install with production values
make install ENV=production
```

**Undeploy:**

```bash
make uninstall
```

> **CI/CD**: On `v*.*.*` tag push, the `bake-release` workflow builds and pushes images; the `deploy` workflow runs Helm install.  
> For AWS setup, see [this issue comment](https://github.com/eunsoogi/kkalla/issues/448#issuecomment-2614849972).

---

## ⚙️ Configuration

Use `secrets.yaml` (copy from `secrets.yaml.example`) and set the following.

### Auth, DB & cache

| Key | Description |
|-----|-------------|
| `auth.db.password` | MariaDB user password |
| `auth.db.rootPassword` | MariaDB root password |
| `auth.redis.password` | Redis password |
| `auth.google.id` | [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2/web-server) client ID |
| `auth.google.secret` | Google OAuth 2.0 client secret |

### API services

| Key | Description |
|-----|-------------|
| `api.openai.project` | OpenAI project (optional) |
| `api.openai.secretKey` | [OpenAI API](https://platform.openai.com/docs/quickstart) key |
| `api.upbit.accessKey` | [Upbit Open API](https://upbit.com/service_center/open_api_guide) access key |
| `api.upbit.secretKey` | Upbit secret key |
| `api.aws.accessKey` | AWS access key (e.g. SQS) |
| `api.aws.secretKey` | AWS secret key |
| `api.notify.secretKey` | Notify secret (e.g. signing/verification) |
| `api.notify.channel` | Slack channel or notify target |
| `api.admin.email` | Initial admin email |

---

## 📜 License

[MIT License](LICENSE) © Eunsoo Lee
