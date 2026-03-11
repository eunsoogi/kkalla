# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-12
**Commit:** `310b58e`

## OVERVIEW

Kkalla is a TypeScript monorepo for an AI investment assistant. `api/` is a NestJS backend with heavy domain logic around allocation, market-risk, audits, and trade execution; `ui/` is a Next.js App Router dashboard; root-level `helm/`, `docker-bake.hcl`, and `Makefile` drive local k3d and production Kubernetes flows.

## STRUCTURE

```text
jolly-canyon/
|- api/                 # NestJS app, migrations, seeds, architecture docs
|- ui/                  # Next.js 16 app, App Router dashboard, BFF routes
|- helm/                # Root chart bundling api + ui + mariadb + redis
|- docs/architecture/   # Index only; app-specific details live under api/ui docs
|- .github/workflows/   # lint/build, api test, release, deploy, undeploy
|- docker-bake.hcl      # buildx targets for api and ui images
`- Makefile             # k3d, bake, import, helm install/uninstall
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| API bootstrap | `api/src/main.ts` | Validation pipe, Swagger `/docs`, listens on `PORT` or `3000` |
| API composition | `api/src/app.module.ts` | Root module list; feature modules kept in alphabetical order |
| Core trading logic | `api/src/modules/allocation-core/` | Shared orchestration/policy used by allocation and market-risk |
| Feature hotspots | `api/src/modules/allocation/`, `api/src/modules/market-risk/`, `api/src/modules/allocation-audit/` | Largest and most interconnected backend areas |
| UI bootstrap | `ui/src/app/layout.tsx`, `ui/src/app/providers.tsx` | Theme, intl, session, TanStack Query provider stack |
| UI route boundaries | `ui/src/app/(dashboard)/`, `ui/src/app/_shared/` | Route-local code lives in private folders; dashboard-wide reuse stays in `_shared` |
| Session-bound BFF routes | `ui/src/app/api/` | NextAuth and token-forwarding route handlers |
| DB and migrations | `api/src/databases/` | TypeORM config, migrations, seeds |
| Prompt source | `api/src/modules/**/prompts/*.prompt.md` | Markdown is source of truth; `.prompt.ts` loads it |
| Deployment flow | `Makefile`, `docker-bake.hcl`, `helm/`, `.github/workflows/` | Local cluster and production release path |

## CONVENTIONS

- Write repository documentation and persistent project notes in English.
- Respond to the user in Korean by default unless the user explicitly asks for another conversation language.
- API root module imports core modules first, then feature modules in alphabetical order.
- Shared backend domain logic belongs in `api/src/modules/allocation-core/**`, not duplicated across `allocation` and `market-risk`.
- Backend module-local contracts use `*.types.ts`; prompt content lives in `*.prompt.md` and is loaded at runtime.
- `api/src/utils/**` is framework-agnostic. A boundary spec forbids importing module-layer code into utils.
- UI route-specific code stays in route-local private folders like `_components`, `_actions`, `_types`.
- UI dashboard-wide reuse belongs in `ui/src/app/(dashboard)/_shared/**`; app-wide primitives belong in `ui/src/shared/**` or `ui/src/layouts/**`.
- Prettier sorts imports in both apps. API import order is Nest -> third party -> `@/` -> relative; UI import order is React/Next -> third party -> `@/` -> relative.
- ESLint is permissive about `no-explicit-any` and non-null assertions in both apps, so do not assume strict type discipline is enforced by config.

## ANTI-PATTERNS (THIS PROJECT)

- Do not import `api/src/modules/**` from `api/src/utils/**`; `api/src/utils/utils-boundary.spec.ts` exists to catch that.
- Do not duplicate allocation/risk execution logic outside `api/src/modules/allocation-core/trade-orchestration.service.ts` and related shared helpers.
- Do not inline AI prompt text in TypeScript when a `*.prompt.md` file already owns that content.
- Do not put page-local dashboard code into app-global shared folders; keep private route logic near the route.
- Do not add implementation detail to `docs/architecture/README.md`; it is an index that points to app-specific architecture docs.
- Do not version root, API, and UI charts independently during release work; CI expects aligned `appVersion` values.

## UNIQUE STYLES

- The backend is feature-first, but the real center of gravity is the allocation/risk/audit pipeline and its shared execution ledger/orchestration layers.
- The UI mixes App Router pages with BFF route handlers so authenticated requests can be forwarded with session tokens.
- Root-level operations assume image-first deployment: build with Docker Bake, install with Helm, and wire secrets at deploy time.
- Architecture docs are unusually rich and worth reading before invasive refactors in either app.

## COMMANDS

```bash
# install per app
(cd api && pnpm install)
(cd ui && pnpm install)

# backend
(cd api && pnpm start:dev)
(cd api && pnpm test --ci)
(cd api && pnpm build)

# frontend
(cd ui && pnpm start:dev)
(cd ui && pnpm build)

# local full stack (k3d + Helm)
make create-cluster
make build ENV=development IMAGE_TAG=latest
make import IMAGE_TAG=latest
make install ENV=development

# production-style release path
make version VERSION=<x.y.z>
make build ENV=production IMAGE_TAG=<x.y.z>
make install ENV=production SET_IMAGE_TAG=<x.y.z>
```

## NOTES

- Root README documents local URLs as proxy `http://localhost`, API `http://localhost:3001`, UI `http://localhost:3000` for the k3d flow; standalone API boot still defaults to `3000`.
- `docker-bake.hcl` builds both `api` and `ui` images from their own contexts and tags them as `ghcr.io/eunsoogi/kkalla-{api,ui}:<tag>`.
- `lint-and-build` runs per changed project; `test.yaml` only exercises `api/` tests.
- `bake-release.yaml` triggers release work when chart versions drift or when the newest `v*.*.*` tag does not match chart `appVersion`.
- Production deploy and undeploy workflows create `secrets.yaml` on the fly and drive Helm through the root `Makefile`.
