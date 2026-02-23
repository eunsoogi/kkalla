# API System Architecture

Scope: backend runtime and source structure under `api/src`.

## 1) Runtime Context

```mermaid
flowchart LR
  CLIENTS["Clients / Operators"] -->|"HTTP /api/v1"| API["NestJS Application (AppModule)"]
  CRON["Nest Scheduler"] --> API

  API --> DB[("MySQL / TypeORM")]
  API --> REDIS[("Redis / Cache + Redlock")]
  API --> OPENAI["OpenAI Responses + Batch"]
  API --> UPBIT["Upbit Exchange API"]
  API --> NEWSAPI["News Providers"]
  API --> FGAPI["Fear & Greed Source"]
  API --> SLACK["Slack API"]
  API --> SQS["AWS SQS"]
```

## 2) Source Boundaries

```mermaid
flowchart TB
  subgraph SRC["api/src"]
    APP["app.module.ts\nRoot composition"]
    MOD["modules/**\nNest feature modules"]
    CORE["modules/allocation-core/**\nShared allocation domain types/helpers"]
    UTL["utils/**\nCross-cutting pure utilities"]
    DBL["databases/**\nTypeORM + migrations"]
  end

  APP --> MOD
  MOD --> CORE
  MOD --> UTL
  APP --> DBL
```

Boundary contract:

- `modules/**`: feature/application code, controllers, entities, services.
- `modules/allocation-core/**`: shared types and pure helpers used by `allocation`, `market-risk`, and related parsing/pipeline code.
- `utils/**`: framework-agnostic utility code. The rule "utils must not import module-layer code" is enforced by `api/src/utils/utils-boundary.spec.ts`.
- `modules/**/prompts/*.prompt.md`: prompt source of truth; `.prompt.ts` files load markdown via `api/src/utils/prompt-loader.ts`.

## 3) Module Topology And Inter-References

### 3.1 Bounded Context Topology

```mermaid
flowchart TB
  subgraph ACCESS["Access / Identity"]
    AUTH["AuthModule"]
    USER["UserModule"]
    ROLE["RoleModule"]
    PERM["PermissionModule"]
  end

  subgraph DECISION["Decision Engines"]
    MI["MarketIntelligenceModule"]
    ALLOC["AllocationModule"]
    RISK["MarketRiskModule"]
    AUDIT["AllocationAuditModule"]
    SCHED["ScheduleModule"]
  end

  subgraph EXEC["Execution + Read Models"]
    TRADE["TradeModule"]
    LEDGER["TradeExecutionLedgerModule"]
    HOLD["HoldingLedgerModule"]
    PROFIT["ProfitModule"]
    DASH["DashboardModule"]
  end

  subgraph INTEGRATION["Infra + External Adapters"]
    UPBIT_M["UpbitModule"]
    OPENAI_M["OpenaiModule"]
    NEWS_M["NewsModule"]
    FG_M["FeargreedModule"]
    FEATURE_M["FeatureModule"]
    NOTIFY_M["NotifyModule"]
    SLACK_M["SlackModule"]
    CACHE_M["CacheModule"]
    REDLOCK_M["RedlockModule"]
    ERROR_M["ErrorModule"]
  end

  AUTH --> USER
  USER --> ROLE

  SCHED --> MI
  SCHED --> ALLOC
  SCHED --> AUDIT

  MI --> OPENAI_M
  MI --> UPBIT_M
  MI --> NEWS_M
  MI --> FG_M
  MI --> FEATURE_M
  MI --> AUDIT
  MI --> CACHE_M
  MI --> ERROR_M
  MI --> NOTIFY_M

  ALLOC --> OPENAI_M
  ALLOC --> UPBIT_M
  ALLOC --> NEWS_M
  ALLOC --> FG_M
  ALLOC --> FEATURE_M
  ALLOC --> HOLD
  ALLOC --> PROFIT
  ALLOC --> USER
  ALLOC --> LEDGER
  ALLOC --> AUDIT
  ALLOC --> CACHE_M
  ALLOC --> REDLOCK_M
  ALLOC --> SCHED

  RISK --> OPENAI_M
  RISK --> UPBIT_M
  RISK --> NEWS_M
  RISK --> FG_M
  RISK --> FEATURE_M
  RISK --> HOLD
  RISK --> PROFIT
  RISK --> USER
  RISK --> LEDGER
  RISK --> AUDIT
  RISK --> CACHE_M
  RISK --> REDLOCK_M
  RISK --> SCHED
  RISK --> SLACK_M

  DASH --> MI
  DASH --> HOLD
  DASH --> TRADE
  DASH --> PROFIT
  DASH --> NEWS_M
  DASH --> FG_M

  OPENAI_M --> ERROR_M
  OPENAI_M --> NOTIFY_M
  UPBIT_M --> ERROR_M
  UPBIT_M --> NOTIFY_M
  UPBIT_M --> CACHE_M
  NOTIFY_M --> SLACK_M
```

### 3.2 Dependency Degree Index (`*.module.ts` imports)

| Module | Direct Imports | Imported By | Notes |
| --- | ---: | ---: | --- |
| `AllocationModule` | 17 | 1 | Allocation recommendation orchestration + SQS producer/consumer |
| `MarketRiskModule` | 17 | 0 | Volatility monitor + risk-triggered execution |
| `MarketIntelligenceModule` | 11 | 2 | Market signal generation and storage |
| `ErrorModule` | 1 | 8 | Shared retry/fallback and error handling |
| `AllocationAuditModule` | 4 | 4 | Validation run/item lifecycle and calibration |
| `UpbitModule` | 3 | 5 | Exchange adapter and market data access |
| `NotifyModule` | 1 | 7 | User/server notification abstraction |
| `CacheModule` | 0 | 7 | Redis cache access |
| `DashboardModule` | 6 | 0 | Aggregated read model API |
| `ScheduleModule` | 4 | 2 | Schedule config + controlled execution |
| `FeargreedModule` | 2 | 4 | Market sentiment adapter |
| `NewsModule` | 2 | 4 | News adapter |
| `OpenaiModule` | 2 | 4 | LLM calls and batch orchestration |
| `HoldingLedgerModule` | 2 | 3 | Holdings snapshot/ledger updates |
| `UserModule` | 1 | 3 | User aggregate and relations |
| `RedlockModule` | 0 | 4 | Distributed locking |
| `CategoryModule` | 0 | 3 | Category authorization/constraints |
| `FeatureModule` | 0 | 3 | Market feature extraction |
| `ProfitModule` | 0 | 3 | Profit read model |
| `AuthModule` | 2 | 0 | Authentication + role hydration |
| `BlacklistModule` | 0 | 2 | Symbol exclusion rules |
| `SlackModule` | 0 | 2 | Slack transport |
| `TradeExecutionLedgerModule` | 0 | 2 | Idempotency and execution state ledger |
| `RoleModule` | 0 | 1 | Role entity/read/write |
| `TradeModule` | 0 | 1 | Trade history read model |
| `HealthModule` | 0 | 0 | Health probe endpoint |
| `IpModule` | 0 | 0 | External IP utility endpoint |
| `PermissionModule` | 0 | 0 | Permission catalog endpoint |
| `SequenceModule` | 0 | 0 | Sequence generator persistence |
| `TranslateModule` | 0 | 0 | i18n translation bootstrap |

### 3.3 Explicit Reciprocal Module Dependency

- `AllocationModule <-> ScheduleModule`
  - Implemented with `forwardRef` to allow schedule-triggered allocation execution and allocation-side schedule user reads.

No other reciprocal pair was detected in module import edges.

### 3.4 Full Module Import Adjacency

```text
AllocationAuditModule -> ErrorModule, NotifyModule, OpenaiModule, UpbitModule
AllocationModule -> AllocationAuditModule, BlacklistModule, CacheModule, CategoryModule, ErrorModule, FeargreedModule, FeatureModule, HoldingLedgerModule, NewsModule, NotifyModule, OpenaiModule, ProfitModule, RedlockModule, ScheduleModule, TradeExecutionLedgerModule, UpbitModule, UserModule
AuthModule -> CacheModule, UserModule
DashboardModule -> FeargreedModule, HoldingLedgerModule, MarketIntelligenceModule, NewsModule, ProfitModule, TradeModule
ErrorModule -> NotifyModule
FeargreedModule -> CacheModule, ErrorModule
HoldingLedgerModule -> CategoryModule, UpbitModule
MarketIntelligenceModule -> AllocationAuditModule, BlacklistModule, CacheModule, ErrorModule, FeargreedModule, FeatureModule, NewsModule, NotifyModule, OpenaiModule, RedlockModule, UpbitModule
MarketRiskModule -> AllocationAuditModule, CacheModule, CategoryModule, ErrorModule, FeargreedModule, FeatureModule, HoldingLedgerModule, NewsModule, NotifyModule, OpenaiModule, ProfitModule, RedlockModule, ScheduleModule, SlackModule, TradeExecutionLedgerModule, UpbitModule, UserModule
NewsModule -> CacheModule, ErrorModule
NotifyModule -> SlackModule
OpenaiModule -> ErrorModule, NotifyModule
ScheduleModule -> AllocationAuditModule, AllocationModule, MarketIntelligenceModule, RedlockModule
UpbitModule -> CacheModule, ErrorModule, NotifyModule
UserModule -> RoleModule
```

## 4) HTTP Surface (Controller Ownership)

| Module | Base Path | Main Endpoints |
| --- | --- | --- |
| `AuthModule` | `/api/v1/auth` | `GET /roles` |
| `BlacklistModule` | `/api/v1/blacklists` | list/get/create/update/delete |
| `CategoryModule` | `/api/v1/categories` | list/enabled/create/update/delete |
| `DashboardModule` | `/api/v1/dashboard` | `GET /summary` |
| `FeargreedModule` | `/api/v1/feargreeds` | `GET /`, `GET /history` |
| `HoldingLedgerModule` | `/api/v1/holdings` | `GET /` |
| `IpModule` | `/api/v1/ip` | `GET /` |
| `MarketIntelligenceModule` | `/api/v1/market-intelligence` | `GET /market-signals`, `GET /market-signals/cursor`, `GET /latest` |
| `NewsModule` | `/api/v1/news` | `GET /cursor`, `GET /dashboard` |
| `NotifyModule` | `/api/v1/notify` | `GET /`, `GET /log`, `GET /cursor`, `POST /` |
| `PermissionModule` | `/api/v1/permissions` | `GET /` |
| `ProfitModule` | `/api/v1/profits` | `GET /`, `GET /my` |
| `RoleModule` | `/api/v1/roles` | `GET /all`, list/get/create/update/delete |
| `ScheduleModule` | `/api/v1/schedules` | read/update schedule, execution plans, lock state/release, execute task endpoints |
| `SlackModule` | `/api/v1/slack` | config/status/server notify endpoints |
| `TradeModule` | `/api/v1/trades` | `GET /`, `GET /cursor` |
| `UpbitModule` | `/api/v1/upbit` | order/config/status/balances endpoints |
| `UserModule` | `/api/v1/users` | list/get/create/update |
| `AllocationModule` | `/api/v1/allocation` | `GET /allocation-recommendations`, `GET /allocation-recommendations/cursor` |
| `AllocationAuditModule` | `/api/v1/allocation-audit` | `GET /runs`, `GET /runs/:runId/items` |
| `HealthModule` | `/health` | `GET /` |

## 5) Runtime Scenario Flows

### 5.1 Manual Schedule Execution + Lock Control

```mermaid
sequenceDiagram
  participant Client
  participant Controller as ScheduleController
  participant Guard as Auth/Permission Guards
  participant Exec as ScheduleExecutionService
  participant Lock as RedlockService
  participant Domain as Target Service

  Client->>Controller: POST /api/v1/schedules/execute/*
  Controller->>Guard: authorize task permission
  Guard-->>Controller: pass/fail
  Controller->>Exec: execute*(task)
  Exec->>Lock: startWithLock(resourceName, duration)
  alt lock acquired
    Lock->>Domain: execute*Task() (background)
    Exec-->>Controller: {status: "started"}
  else lock already held
    Exec-->>Controller: {status: "skipped_lock"}
  end
```

### 5.2 Market Signal Generation (`MarketIntelligenceService`)

```mermaid
sequenceDiagram
  participant Trigger as Cron/Manual Execute
  participant MI as MarketIntelligenceService
  participant Upbit
  participant Blacklist
  participant Context as News/Feargreed/Features/AuditGuardrail
  participant OpenAI
  participant DB as MarketSignal
  participant Cache
  participant Notify
  participant Audit as AllocationAuditService

  Trigger->>MI: executeMarketSignalTask()
  MI->>Upbit: getAllKrwMarkets()
  MI->>Blacklist: findAll()
  MI->>MI: filterSignalCandidates()
  MI->>Context: buildMarketSignalMessages()
  MI->>OpenAI: createBatch + waitBatch
  MI->>DB: saveMarketSignal(...) for normalized results
  MI->>Cache: set latest signal state
  MI->>Notify: notifyServer(market signal summary)
  MI->>Audit: enqueueMarketBatchValidation(batchId)
```

Key behavior:

- Market context fetches use fallback wrappers (`fetchCoinNewsWithFallback`, `fetchFearGreedIndexWithFallback`).
- Validation guardrail text is injected into prompt context when available.
- Latest signal state is cached for downstream freshness checks.

### 5.3 Allocation Recommendation Production + Queue Publish

```mermaid
sequenceDiagram
  participant Trigger as Cron/Manual Execute
  participant A as AllocationService
  participant S as ScheduleService
  participant H as HoldingLedgerService
  participant AI as OpenAIService
  participant DB as AllocationRecommendation
  participant Q as AWS SQS
  participant Audit as AllocationAuditService

  Trigger->>A: executeAllocationRecommendation*Task()
  A->>S: getUsers()
  A->>H: fetch holdings (per user)
  A->>A: build candidate items + filters
  A->>AI: allocationRecommendation(items)
  A->>DB: saveAllocationRecommendation(batchId)
  A->>Audit: enqueueAllocationBatchValidation(batchId)
  A->>Q: publish per-user TradeExecutionMessageV2
```

Message envelope fields used by both allocation and risk pipelines:

- `version`, `module`, `runId`, `messageKey`, `userId`, `generatedAt`, `expiresAt`, `inferences`, optional `allocationMode`.

### 5.4 Shared SQS Consumer + Ledger Pipeline (Allocation/Risk)

```mermaid
sequenceDiagram
  participant Consumer as startSqsConsumer()
  participant Service as AllocationService / MarketRiskService
  participant Pipeline as processTradeExecutionMessage()
  participant Parser as parseTradeExecutionMessage()
  participant Ledger as TradeExecutionLedgerService
  participant Lock as RedlockService
  participant Exec as executeAllocationForUser / executeVolatilityTradesForUser
  participant SQS as AWS SQS

  Consumer->>Service: onMessage(message)
  Service->>Pipeline: processTradeExecutionMessage(options)
  Pipeline->>Parser: parse message body
  alt malformed
    Pipeline->>Ledger: markNonRetryableFailed (malformed)
    Pipeline->>SQS: delete message
  else valid
    Pipeline->>Ledger: acquire(module, messageKey, userId, payloadHash)
    alt existing processing
      Pipeline->>SQS: extend visibility (defer)
    else acquired
      Pipeline->>Lock: withLock(user)
      Pipeline->>Ledger: heartbeatProcessing() interval
      Pipeline->>Exec: execute locked callback
      alt success
        Pipeline->>Ledger: markSucceeded
        Pipeline->>SQS: delete message
      else non-retryable execution error
        Pipeline->>Ledger: markNonRetryableFailed
        Pipeline->>SQS: delete message
      else retryable error
        Pipeline->>Ledger: markRetryableFailed
        Pipeline-->>Consumer: throw (message retried by SQS)
      end
    end
  end
```

### 5.5 Market Risk Trigger (`MarketRiskService`)

```mermaid
sequenceDiagram
  participant Cron as Every minute
  participant Risk as MarketRiskService
  participant S as ScheduleService
  participant H as HoldingLedgerService
  participant U as Upbit
  participant AI as allocationRecommendation()
  participant Q as AWS SQS
  participant Slack

  Cron->>Risk: handleTick()
  Risk->>S: getUsers()
  Risk->>H: fetchHoldingsByUsers(users)
  Risk->>U: calculate BTC volatility (1% buckets)
  alt BTC triggered
    Risk->>AI: infer on holding items
    Risk->>Q: publish risk execution messages
    Risk->>Slack: notify server (BTC trigger)
  else BTC not triggered
    Risk->>U: calculate per-symbol volatility (5% buckets)
    Risk->>AI: infer on triggered symbols
    Risk->>Q: publish risk execution messages
    Risk->>Slack: notify server (symbol list)
  end
```

### 5.6 Allocation Audit Lifecycle (`AllocationAuditService`)

```mermaid
sequenceDiagram
  participant Source as MarketIntelligence/Allocation/MarketRisk
  participant Audit as AllocationAuditService
  participant DB as AllocationAuditRun + AllocationAuditItem
  participant Price as Upbit/Trade data
  participant OpenAI
  participant Notify

  Source->>Audit: enqueue*BatchValidation(batchId)
  Audit->>DB: create/find run + pending items (24h/72h horizons)

  loop hourly
    Audit->>Audit: executeDueAuditsTask()
    Audit->>DB: select due + stale-running + retryable-failed items
    Audit->>Price: deterministic evaluation inputs
    Audit->>DB: update deterministic fields/status
    Audit->>OpenAI: batch AI evaluation for candidates
    Audit->>DB: finalize run summary/status
  end

  loop daily
    Audit->>DB: cleanup old completed/failed runs/items
    Audit->>Audit: clear cached calibration/guardrail state
  end

  opt task failure
    Audit->>Notify: server failure notification
  end
```

### 5.7 Dashboard Summary Fan-Out

```mermaid
sequenceDiagram
  participant Client
  participant Dashboard as DashboardService
  participant Profit
  participant Trade
  participant Holdings
  participant Signals as MarketIntelligenceService
  participant News
  participant Feargreed

  Client->>Dashboard: GET /api/v1/dashboard/summary
  Dashboard->>Profit: getProfit(user)
  Dashboard->>Trade: paginateTrades(last24h)
  Dashboard->>Holdings: getHoldings(user)
  Dashboard->>Signals: getLatestWithPriceChange(10)
  Dashboard->>News: getNewsForDashboard(10)
  Dashboard->>Feargreed: getFeargreed() + getFeargreedHistory(7)
  Dashboard->>Dashboard: Promise.allSettled + fallback merge
  Dashboard-->>Client: composite summary + optional section errors
```

## 6) State Models

### 6.1 Trade Execution Ledger Status

```mermaid
stateDiagram-v2
  [*] --> processing: acquire()
  processing --> succeeded: markSucceeded
  processing --> retryable_failed: markRetryableFailed
  processing --> non_retryable_failed: markNonRetryableFailed
  processing --> stale_skipped: expired message
  retryable_failed --> processing: reacquire (atomic attempt++)

  succeeded --> [*]
  non_retryable_failed --> [*]
  stale_skipped --> [*]
  retryable_failed --> [*]
```

### 6.2 Allocation Audit Item Status

```mermaid
stateDiagram-v2
  [*] --> pending: enqueue
  pending --> running: picked by due processor
  running --> completed: deterministic + AI evaluation done
  running --> failed: deterministic/AI error
  failed --> pending: retry window elapsed
  running --> pending: stale running requeue / lock recovery

  completed --> [*]
  failed --> [*]
```

## 7) Data Ownership Map

| Module | Primary Write Models |
| --- | --- |
| `MarketIntelligenceModule` | `MarketSignal` |
| `AllocationModule` | `AllocationRecommendation` |
| `AllocationAuditModule` | `AllocationAuditRun`, `AllocationAuditItem` |
| `TradeExecutionLedgerModule` | `TradeExecutionLedger` |
| `TradeModule` | `Trade` |
| `HoldingLedgerModule` | `HoldingLedger` |
| `ScheduleModule` | `Schedule` |
| `NotifyModule` | `Notify` |
| `CategoryModule` | `UserCategory` |
| `BlacklistModule` | `Blacklist` |
| `UserModule` | `User` |
| `RoleModule` | `Role` |
| `UpbitModule` | `UpbitConfig` |
| `SlackModule` | `SlackConfig` |
| `SequenceModule` | `Sequence` |

## 8) AI Prompt Contract

Prompt source files:

- `api/src/modules/market-intelligence/prompts/market-signal.prompt.md`
- `api/src/modules/allocation/prompts/allocation-recommendation.prompt.md`
- `api/src/modules/market-risk/prompts/allocation-recommendation.prompt.md`
- `api/src/modules/allocation-audit/prompts/allocation-audit.prompt.md`

Loading mechanism:

- Prompt markdown is loaded in corresponding `.prompt.ts` via `loadPromptMarkdown(__dirname, '*.prompt.md')`.
- Shared allocation response schema/config lives in `api/src/modules/allocation-core/allocation-recommendation.prompt.shared.ts`.

## 9) Operational Timing And Lock Values

- Market signal schedule: `0 0 0 * * *`, lock duration `88,200,000 ms`.
- Allocation new schedule: `0 35 6 * * *`, lock duration `3,600,000 ms`.
- Allocation existing schedule: `0 35 0,4,8,12,16,20 * * *`, lock duration `3,600,000 ms`.
- Allocation audit execute schedule: `0 15 * * * *`, lock duration `24h + 5m`.
- Allocation audit cleanup schedule: `0 20 3 * * *`.
- Market risk schedule: every minute (`CronExpression.EVERY_MINUTE`), lock duration `30,000 ms`.
- SQS message TTL in allocation/risk producers: `30 minutes`.
- Processing heartbeat interval in allocation/risk consumers: `60 seconds`.
- Trade execution processing stale threshold (`TradeExecutionLedgerService`): `5 minutes`.
- Market risk cooldowns: symbol `1,800s`, BTC global trigger `3,600s`.
