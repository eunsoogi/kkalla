# UI System Architecture

Scope: frontend runtime and source structure under `ui/src`.

## 1) Runtime Context

```mermaid
flowchart LR
  Browser["Browser"] --> App["Next.js App Router"]
  App --> BFF["Route Handlers (/app/api/*)"]
  App --> Auth["next-auth session"]
  Auth --> Google["Google OAuth"]
  BFF --> Upstream["Upstream HTTP API"]
  App --> Upstream
```

## 2) Source Boundaries

```mermaid
flowchart TB
  subgraph APP["ui/src/app"]
    ROOT["layout.tsx / providers.tsx"]
    AUTH_G["(auth) routes"]
    DASH_G["(dashboard) routes"]
    API_G["app/api route handlers"]
    APP_SHARED["app/_shared"]
  end

  subgraph DASH_PRIVATE["(dashboard) internals"]
    LOCAL["route-local: _components / _actions / _types"]
    DASH_SHARED["(dashboard)/_shared"]
  end

  subgraph GLOBAL["Global shared"]
    LAYOUTS["layouts/**"]
    SHARED["shared/**"]
    HOOKS["hooks/**"]
    UTILS["utils/**"]
    I18N["i18n/**"]
  end

  ROOT --> AUTH_G
  ROOT --> DASH_G
  ROOT --> API_G

  DASH_G --> LOCAL
  DASH_G --> DASH_SHARED
  DASH_G --> APP_SHARED

  LOCAL --> SHARED
  DASH_SHARED --> SHARED
  LAYOUTS --> SHARED
  LOCAL --> HOOKS
  DASH_SHARED --> HOOKS
  ROOT --> I18N
  ROOT --> UTILS
```

Boundary contract:

- Route-local private folders (`_components`, `_actions`, `_types`) contain page-specific implementation.
- `(dashboard)/_shared/*` contains reusable dashboard-wide features (auth guard, inference UI, shared table styles, shared settings actions).
- `shared/*` contains app-global reusable UI/types.
- `layouts/*` is the visual shell (header, sidebar, logo).
- `app/api/*` route handlers are BFF endpoints used when session-bound forwarding is needed.

## 3) App Router Topology

```mermaid
flowchart TB
  ROOT["app/layout.tsx"] --> AUTH_LAYOUT["(auth)"]
  ROOT --> DASH_LAYOUT["(dashboard)/layout.tsx"]
  ROOT --> API_ROUTES["app/api/**"]

  AUTH_LAYOUT --> SIGNIN["signin/page.tsx"]

  DASH_LAYOUT --> HOME["/ (dashboard home)"]
  DASH_LAYOUT --> MARKET["/market-signals"]
  DASH_LAYOUT --> ALLOC["/allocation-recommendations"]
  DASH_LAYOUT --> AUDIT["/allocation-audits"]
  DASH_LAYOUT --> NEWS["/news + /news/[id]"]
  DASH_LAYOUT --> TRADES["/trades"]
  DASH_LAYOUT --> PROFITS["/profits"]
  DASH_LAYOUT --> REGISTER["/register"]
  DASH_LAYOUT --> NOTIFY["/notify"]
  DASH_LAYOUT --> SCHEDULES["/schedules"]
  DASH_LAYOUT --> BLACKLISTS["/blacklists + create + [id]"]
  DASH_LAYOUT --> ROLES["/roles + create + [id]"]
  DASH_LAYOUT --> USERS["/users + [id]"]

  API_ROUTES --> AUTH_API["/api/auth/[...nextauth]"]
  API_ROUTES --> SUMMARY_API["/api/dashboard/summary"]
  API_ROUTES --> NOTIFY_CURSOR_API["/api/dashboard/notify/cursor"]
```

## 4) Module Inter-Reference Map (UI Internals)

### 4.1 Page-to-Shared Reference Rules

Common references across dashboard routes:

- permission gate: `ui/src/app/(dashboard)/_shared/auth/PermissionGuard.tsx`
- forbidden fallback: `ui/src/app/(dashboard)/_shared/errors/ForbiddenError.tsx`
- route-specific actions: `ui/src/app/(dashboard)/**/_actions/*.ts`
- route-specific types: `ui/src/app/(dashboard)/**/_types/*.ts`

### 4.2 Action Ownership Matrix

Extracted from `ui/src/app/(dashboard)/**/_actions/*.ts`:

| Action File | Upstream Endpoints |
| --- | --- |
| `.../home/_actions/dashboard-home.actions.ts` | `/api/v1/market-intelligence/latest`, `/api/v1/holdings`, `/api/v1/news/dashboard` |
| `.../home/feargreed/_actions/feargreed.actions.ts` | `/api/v1/feargreeds`, `/api/v1/feargreeds/history` |
| `.../_shared/inference/_actions/inference.actions.ts` | `/api/v1/market-intelligence/market-signals`, `/api/v1/market-intelligence/market-signals/cursor`, `/api/v1/allocation/allocation-recommendations`, `/api/v1/allocation/allocation-recommendations/cursor` |
| `.../_shared/settings/_actions/settings.actions.ts` | `/api/v1/schedules`, `/api/v1/slack/config`, `/api/v1/slack/status`, `/api/v1/upbit/config`, `/api/v1/upbit/status`, `/api/v1/ip` |
| `.../allocation-audits/_actions/allocation-audit.actions.ts` | `/api/v1/allocation-audit/runs`, `/api/v1/allocation-audit/runs/:runId/items` |
| `.../blacklists/_actions/blacklist.actions.ts` | `/api/v1/blacklists`, `/api/v1/blacklists/:id` |
| `.../news/_actions/news.actions.ts` | `/api/v1/news/cursor` |
| `.../profits/_actions/profit.actions.ts` | `/api/v1/profits`, `/api/v1/profits/my` |
| `.../register/_actions/category.actions.ts` | `/api/v1/categories`, `/api/v1/categories/:id` |
| `.../roles/_actions/role.actions.ts` | `/api/v1/roles`, `/api/v1/roles/:id`, `/api/v1/permissions` |
| `.../schedules/_actions/schedule.actions.ts` | `/api/v1/schedules/execution-plans`, `/api/v1/schedules/locks`, `/api/v1/schedules/locks/:task/release`, `/api/v1/schedules/execute/*` |
| `.../trades/_actions/trade.actions.ts` | `/api/v1/trades`, `/api/v1/trades/cursor` |
| `.../users/_actions/user.actions.ts` | `/api/v1/users`, `/api/v1/users/:id`, `/api/v1/roles/all` |

### 4.3 Layout-to-Feature References

```mermaid
flowchart LR
  Sidebar["layouts/vertical/sidebar/Sidebaritems.ts"] --> Guard["hooks/usePermissions + session permissions"]
  Sidebar --> DashboardRoutes["dashboard route URLs"]

  Header["layouts/vertical/header/Header.tsx"] --> Notification["header/Notification.tsx"]
  Header --> Profile["header/Profile.tsx"]
  Header --> SharedCommon["shared/components/common/*"]
```

## 5) Runtime Scenario Flows

### 5.1 Sign-in + Session Permission Hydration

```mermaid
sequenceDiagram
  participant Browser
  participant NextAuth as /api/auth/[...nextauth]
  participant Google
  participant JWT as jwt callback
  participant Session as session callback
  participant Roles as fetchRoles()

  Browser->>NextAuth: Sign-in request
  NextAuth->>Google: OAuth authorization code flow
  Google-->>NextAuth: access + refresh tokens
  NextAuth->>JWT: persist token data / refresh if expired
  NextAuth->>Session: build session
  Session->>Roles: GET /api/v1/auth/roles
  Roles-->>Session: roles + permissions
  Session-->>Browser: session with permissions
```

### 5.2 Dashboard Summary Load (Client Query + BFF)

```mermaid
sequenceDiagram
  participant Page as (dashboard)/page.tsx
  participant Query as TanStack Query
  participant ClientFetch as dashboard-summary.client.ts
  participant BFF as /api/dashboard/summary route
  participant Session as getServerSession(authOptions)
  participant Upstream

  Page->>Query: useQuery(['dashboard-summary'])
  Query->>ClientFetch: getDashboardSummary()
  ClientFetch->>BFF: GET /api/dashboard/summary
  BFF->>Session: resolve access token
  BFF->>Upstream: forward GET /api/v1/dashboard/summary
  Upstream-->>BFF: summary payload
  BFF-->>ClientFetch: passthrough response
  ClientFetch-->>Query: typed summary
  Query-->>Page: render home widgets
```

### 5.3 Permission-Gated Rendering

```mermaid
sequenceDiagram
  participant Route as Dashboard Page
  participant Guard as PermissionGuard
  participant SessionHook as useSession()
  participant PermHook as usePermissions()

  Route->>Guard: wrap protected content
  Guard->>SessionHook: read session status
  Guard->>PermHook: hasPermission(required[])
  alt allowed
    Guard-->>Route: render children
  else denied
    Guard-->>Route: render fallback (ForbiddenError or null)
  end
```

### 5.4 Schedule Execute / Lock Release Action

```mermaid
sequenceDiagram
  participant UI as schedules/page.tsx
  participant Action as schedules/_actions/schedule.actions.ts
  participant Client as getClient()
  participant Upstream

  UI->>Action: execute*Action() or releaseScheduleLockAction(task)
  Action->>Client: create server-side API client with session token
  Action->>Upstream: POST /api/v1/schedules/execute/* or /locks/:task/release
  Upstream-->>Action: status payload
  Action->>Action: runtime shape guards + i18n status mapping
  Action-->>UI: normalized action state
```

### 5.5 Cursor/Infinite List Pattern

```mermaid
sequenceDiagram
  participant Component as List component
  participant Action as route _actions
  participant Upstream

  Component->>Action: get*CursorAction(cursor,limit)
  Action->>Upstream: GET /api/v1/*/cursor
  Upstream-->>Action: items + next cursor
  Action-->>Component: typed cursor response
  Component->>Component: append list and request next page on scroll
```

## 6) Provider Stack And Cross-Cutting Runtime

`ui/src/app/layout.tsx` and `ui/src/app/providers.tsx` compose runtime wrappers in this order:

1. `ThemeProvider` (Flowbite custom theme)
2. `NextIntlClientProvider` (locale/messages/time zone)
3. `SessionProvider` (next-auth client session)
4. `QueryClientProvider` (TanStack Query cache)
5. `ReactQueryDevtools`

Implications:

- i18n is available in both route components and server actions (`getTranslations`).
- permission checks read from hydrated session permissions.
- server actions use `getClient()` / `getClientWithAccessToken()` for authenticated upstream calls.

## 7) BFF Route Handlers

| Route Handler | Responsibility |
| --- | --- |
| `ui/src/app/api/auth/[...nextauth]/route.ts` | next-auth handler export |
| `ui/src/app/api/dashboard/summary/route.ts` | token-bound proxy for dashboard summary |
| `ui/src/app/api/dashboard/notify/cursor/route.ts` | token-bound proxy for notify cursor stream |

Both dashboard BFF routes:

- enforce token presence from session (`401` if missing),
- forward to upstream with `Authorization: Bearer <token>`,
- preserve upstream status and content type.

## 8) Naming And Placement Rules Used In Source

- Route-facing UI and state: keep in route-local private folders.
- Dashboard-wide reusable features: place in `(dashboard)/_shared`.
- App-wide reusable visual primitives and global types: place in `shared`.
- Layout shell logic: keep in `layouts/vertical/*` and `layouts/shared/*`.
- Access rules:
  - sidebar menu visibility derives from `usePermissions()`.
  - route-level protected content uses `PermissionGuard`.
  - fallback UI uses `ForbiddenError` or route-specific fallback blocks.
