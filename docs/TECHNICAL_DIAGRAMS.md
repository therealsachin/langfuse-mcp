# Technical Diagrams - Langfuse MCP Server

Visual representations of key architectural concepts and data flows.

---

## 1. Request Processing Flow

Shows how an MCP client request flows through the system:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP Client (e.g., Claude)                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ JSON-RPC 2.0
                             │ (over stdio)
                             ▼
        ┌────────────────────────────────────────┐
        │     index.ts: LangfuseAnalyticsServer  │
        │                                        │
        │  CallToolRequestSchema Handler         │
        │  {                                     │
        │    name: "get_traces",                 │
        │    arguments: { ... }                  │
        │  }                                     │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │         Zod Input Validation           │
        │    getTracesSchema.parse(args)         │
        │  Throws ZodError if invalid            │
        └────────────────┬───────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │ Valid inputs              Valid inputs
          ▼                            ▼
    ┌──────────────────┐    ┌──────────────────────┐
    │ Tool Handler     │    │ Error Handler        │
    │ getTraces()      │    │ Return MCP error     │
    │                  │    │ isError: true        │
    └────────┬─────────┘    └──────────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │  LangfuseAnalyticsClient         │
    │  .listTraces({...})              │
    │  (HTTP wrapper + Basic Auth)     │
    └────────────────┬─────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────┐
    │  HTTP Fetch to Langfuse API          │
    │  GET /api/public/traces?params       │
    │  Headers: { Authorization: Basic }   │
    └────────────────┬─────────────────────┘
                     │
    ┌────────────────┴────────────────┐
    │                                  │
   Success                            Error
    │                                  │
    ▼                                  ▼
JSON Response              throw new Error(...)
    │                                  │
    └──────────────┬───────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │  Tool: Data Processing           │
    │  - Map API response              │
    │  - Apply filters/sorting          │
    │  - Build typed response           │
    └────────────────┬─────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────┐
    │  MCP Response Format             │
    │  {                               │
    │    content: [{                   │
    │      type: 'text',               │
    │      text: JSON string           │
    │    }],                           │
    │    isError?: boolean             │
    │  }                               │
    └────────────────┬─────────────────┘
                     │
                     ▼ (JSON-RPC response)
        ┌────────────────────────────────────┐
        │       MCP Client Receives Result   │
        │       Parses JSON response         │
        │       Updates UI/state             │
        └────────────────────────────────────┘
```

---

## 2. Tool Categories & Dependencies

Tool organization and what each depends on:

```
┌──────────────────────────────────────────────────────────────┐
│              MCP Server (index.ts)                           │
│  Registers 18 tools & dispatches requests                   │
└──────────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    Config        LangfuseClient         Types
    (config.ts)   (langfuse-client.ts)   (types.ts)
        │                │                │
        │      ┌─────────┴────────┐       │
        │      │                  │       │
        ▼      ▼                  ▼       ▼
    ┌─────────────────────────────────────────┐
    │         18 Tool Handlers                 │
    │         (src/tools/*.ts)                 │
    │                                         │
    │  ┌─────────────────────────────────┐   │
    │  │ Category A: Core Analytics (6)  │   │
    │  │ ├─ list_projects                │   │
    │  │ ├─ project_overview             │   │
    │  │ ├─ usage_by_model               │   │
    │  │ ├─ usage_by_service             │   │
    │  │ ├─ top_expensive_traces         │   │
    │  │ └─ get_trace_detail             │   │
    │  │                                 │   │
    │  │ Uses: getDailyMetrics(),        │   │
    │  │       listTraces(),             │   │
    │  │       getTrace()                │   │
    │  └─────────────────────────────────┘   │
    │                                         │
    │  ┌─────────────────────────────────┐   │
    │  │ Category B: Advanced (6)         │   │
    │  │ ├─ get_metrics                  │   │
    │  │ ├─ get_traces                   │   │
    │  │ ├─ get_observations             │   │
    │  │ ├─ get_cost_analysis            │   │
    │  │ ├─ get_daily_metrics            │   │
    │  │ └─ get_projects                 │   │
    │  │                                 │   │
    │  │ Uses: getMetrics(),             │   │
    │  │       listObservations(),       │   │
    │  │       getDailyMetrics()         │   │
    │  └─────────────────────────────────┘   │
    │                                         │
    │  ┌─────────────────────────────────┐   │
    │  │ Category C: Additional APIs (6) │   │
    │  │ ├─ get_observation_detail       │   │
    │  │ ├─ get_health_status            │   │
    │  │ ├─ list_models                  │   │
    │  │ ├─ get_model_detail             │   │
    │  │ ├─ list_prompts                 │   │
    │  │ └─ get_prompt_detail            │   │
    │  │                                 │   │
    │  │ Uses: getObservation(),         │   │
    │  │       getHealthStatus(),        │   │
    │  │       listModels(), etc.        │   │
    │  └─────────────────────────────────┘   │
    └─────────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
    ┌──────────────────┐    ┌────────────────┐
    │  Zod Schemas     │    │  Type Inference│
    │  (Validation)    │    │  z.infer<>     │
    └──────────────────┘    └────────────────┘
```

---

## 3. API Endpoint Map

Which tools use which Langfuse API endpoints:

```
LANGFUSE APIs                    Tools Using Them
─────────────────────────────────────────────────────────────

/api/public/metrics              get_metrics
│                                get_cost_analysis (fallback)
│                                usage_by_model (fallback)
│
├─ view: "traces"
├─ metrics: [...]
├─ dimensions: [...]
└─ filters: [...]

/api/public/metrics/daily        project_overview
│                                usage_by_model
│                                get_cost_analysis
│                                get_daily_metrics
│
├─ Aggregated per day
├─ Includes usage breakdown
└─ Field names: totalCost, countTraces, usage[]

/api/public/traces               get_traces
│                                top_expensive_traces
│                                count_active_users (example)
│
├─ Filtering by: name, userId, tags, timestamp
├─ Ordering by: timestamp, cost, name
└─ Pagination: page, limit

/api/public/traces/{id}          get_trace_detail
│
└─ Returns full trace with observations array

/api/public/observations         get_observations
│                                usage_by_service (future)
│
├─ Filtering by: type, model, name, level, traceId
├─ Time filtering
└─ Pagination: page, limit

/api/public/observations/{id}    get_observation_detail
│
└─ Returns single observation details

/api/public/health              get_health_status
│
└─ Returns system health status

/api/public/models              list_models
│
├─ Pagination: page, limit
└─ Returns available AI models

/api/public/models/{id}         get_model_detail
│
└─ Returns single model details

/api/public/prompts             list_prompts
│
├─ Pagination: page, limit
└─ Optional name filter

/api/public/prompts/{name}      get_prompt_detail
│
├─ Optional: version number
├─ Optional: label
└─ Returns prompt template
```

---

## 4. Data Flow: From API Response to MCP Response

Example: `get_cost_analysis` tool multi-step aggregation

```
┌─────────────────────────────────────────────────────────┐
│  Input: { from: "2024-01-01", to: "2024-01-31" }        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  Step 1: Get Daily Data                │
    │  client.getDailyMetrics({...})         │
    │  Returns: Array of daily summaries     │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Response:                             │
    │  [                                     │
    │    {                                   │
    │      date: "2024-01-01",               │
    │      totalCost: 10.50,                 │
    │      countTraces: 150,                 │
    │      usage: [                          │
    │        {                               │
    │          model: "gpt-4",               │
    │          totalCost: 8.00,              │
    │          totalUsage: 5000,             │
    │          countObservations: 100        │
    │        },                              │
    │        ...                             │
    │      ]                                 │
    │    },                                  │
    │    ...                                 │
    │  ]                                     │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Step 2: Filter by Date Range          │
    │  Remove dates outside [from, to]       │
    │  Keeps: 31 days of data                │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Step 3: Calculate Total Cost          │
    │  Sum all daily costs                   │
    │  Total: $321.45                        │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Step 4: Aggregate by Model            │
    │  For each day's usage data:            │
    │    - Accumulate cost per model         │
    │    - Accumulate tokens per model       │
    │    - Count observations per model      │
    │  Result:                               │
    │  {                                     │
    │    "gpt-4": {                          │
    │      cost: 250.00,                     │
    │      tokens: 500000,                   │
    │      observations: 3100,               │
    │      percentage: 77.8%                 │
    │    },                                  │
    │    "gpt-3.5-turbo": {                  │
    │      cost: 71.45,                      │
    │      tokens: 200000,                   │
    │      observations: 2200,               │
    │      percentage: 22.2%                 │
    │    }                                   │
    │  }                                     │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Step 5: Get User Breakdown (opt)      │
    │  Call getMetrics() separately          │
    │  Dimension by userId                   │
    │  Result: Array of user costs           │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Step 6: Build Response Object         │
    │  {                                     │
    │    projectId: "abc12345",              │
    │    from: "2024-01-01",                 │
    │    to: "2024-01-31",                   │
    │    totalCost: 321.45,                  │
    │    breakdown: {                        │
    │      byModel: [{model, cost, ...}],    │
    │      byUser: [{userId, cost, ...}],    │
    │      byDay: [{date, cost, ...}]        │
    │    }                                   │
    │  }                                     │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Step 7: MCP Response Wrapper          │
    │  {                                     │
    │    content: [{                         │
    │      type: 'text',                     │
    │      text: JSON.stringify(response)    │
    │    }]                                  │
    │  }                                     │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  Return to MCP Client                  │
    │  (JSON-RPC response)                   │
    └────────────────────────────────────────┘
```

---

## 5. Authentication Flow

How API keys are converted to HTTP headers:

```
┌──────────────────────────────────────┐
│  Environment Variables               │
│                                      │
│  LANGFUSE_PUBLIC_KEY=pk-lf-xxx       │
│  LANGFUSE_SECRET_KEY=sk-lf-xxx       │
└────────────────┬─────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  config.ts: getProjectConfig()         │
    │  - Read from process.env               │
    │  - Validate required fields            │
    │  - Return typed config object          │
    └────────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  index.ts: Initialize LangfuseClient   │
    │  new LangfuseAnalyticsClient(config)   │
    └────────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  langfuse-client.ts: Each API call     │
    │                                        │
    │  const credentials =                   │
    │    `${config.publicKey}:${config.secretKey}`
    │                                        │
    │  const encoded = Buffer.from(          │
    │    credentials                         │
    │  ).toString('base64')                  │
    │                                        │
    │  Result: "cGstbGYtMDEyMzpzay1sZi1hYmMx" │
    │                                        │
    └────────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  HTTP Header Construction              │
    │                                        │
    │  Authorization: Basic + encoded        │
    │  Authorization: Basic cGstbGYtMDEyMzpz... │
    └────────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  fetch(url, {                          │
    │    headers: { Authorization: authHeader}│
    │  })                                    │
    └────────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  Langfuse API                          │
    │  - Decodes Authorization header        │
    │  - Verifies credentials                │
    │  - Returns data for authenticated user │
    └────────────────────────────────────────┘
```

---

## 6. Error Handling Architecture

How errors flow through the system:

```
                  Error Source
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    Validation     API Call        Tool Logic
    Error          Error           Error
        │              │              │
        │              │  Network,    │
        │  Zod.parse   │  Auth,       │  Parsing,
        │  failure     │  404, 500    │  Type error
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
            ┌──────────────────────────────┐
            │  Try-Catch Block             │
            │  In Tool Handler             │
            └────────────┬─────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
    Synchronous                    Asynchronous
    Errors (Zod)                  Errors (API)
        │                                 │
        │                                 ▼
        │                      Await fetch + response
        │                      Catch network errors
        │                      │
        │                      ├─ Response not ok?
        │                      │  Throw: "API error: 404"
        │                      │
        │                      └─ Throw other error
        │                         from client method
        │
        └──────────────────────────┬────────────────┐
                                   │                │
                                   ▼                ▼
                              Error object    error instanceof?
                              extraction      Error → message
                                   │              │
                                   │              → "Unknown"
                                   │                │
                                   └────────┬───────┘
                                            │
                                            ▼
                                   ┌─────────────────────┐
                                   │ Build Error Response │
                                   │ {                   │
                                   │   content: [{       │
                                   │     type: 'text',   │
                                   │     text: JSON      │
                                   │   }],               │
                                   │   isError: true     │
                                   │ }                   │
                                   └────────┬────────────┘
                                            │
                                            ▼
                                   ┌──────────────────────┐
                                   │ Return to MCP Client │
                                   │ Client logs error    │
                                   │ User informed        │
                                   └──────────────────────┘
```

---

## 7. Tool Registration & Dispatch Mechanism

How tools are registered and called:

```
┌──────────────────────────────────────────────────────────┐
│  Server Initialization: Constructor                      │
│                                                          │
│  1. Create MCP Server instance                          │
│  2. Initialize Langfuse client                          │
│  3. Call setupHandlers()                                │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │  setupHandlers(): Register 2 endpoints    │
    │                                            │
    │  - ListToolsRequestSchema handler          │
    │  - CallToolRequestSchema handler           │
    └────────────┬───────────────────────────────┘
                 │
                 │ ListToolsRequestSchema
                 ▼
    ┌────────────────────────────────────────────┐
    │  Return Tool Registry                      │
    │  (18 tools)                                │
    │  [                                         │
    │    {                                       │
    │      name: "list_projects",                │
    │      description: "...",                   │
    │      inputSchema: { type: 'object', ... }  │
    │    },                                      │
    │    {                                       │
    │      name: "project_overview",             │
    │      description: "...",                   │
    │      inputSchema: { ... }                  │
    │    },                                      │
    │    ... 16 more tools                       │
    │  ]                                         │
    └────────────┬───────────────────────────────┘
                 │
                 │ Client discovers tools
                 │
                 │ CallToolRequestSchema
                 ▼
    ┌────────────────────────────────────────────┐
    │  Tool Dispatch Switch Statement            │
    │                                            │
    │  switch(request.params.name) {             │
    │    case 'list_projects':                   │
    │      args = schema.parse(arguments)        │
    │      return listProjects(client)           │
    │                                            │
    │    case 'project_overview':                │
    │      args = schema.parse(arguments)        │
    │      return projectOverview(client, args)  │
    │                                            │
    │    ... (16 more cases)                     │
    │                                            │
    │    default:                                │
    │      throw Error("Unknown tool")           │
    │  }                                         │
    └────────────┬───────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    Zod Parse      Tool Handler
    Input          Execution
        │                 │
        │ Valid           ▼
        │          1. Prepare params
        │          2. Call client API
        │          3. Process response
        │          4. Build MCP response
        │
        └────────┬────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  MCP Response                          │
    │  {                                     │
    │    content: [{ type, text }],          │
    │    isError?: boolean                   │
    │  }                                     │
    └────────────────────────────────────────┘
```

---

## 8. Dependency Injection Pattern

How the Langfuse client is passed through the system:

```
┌──────────────────────────────────────────────┐
│  index.ts: Constructor                       │
│                                              │
│  const config = getProjectConfig()           │
│  this.client = new LangfuseAnalyticsClient(  │
│    config                                    │
│  )                                           │
└────────────┬─────────────────────────────────┘
             │
             │ Stored as instance property
             │ this.client
             │
             ▼
    ┌────────────────────────────────────┐
    │  setupHandlers()                   │
    │                                    │
    │  For each tool:                    │
    │  return toolHandler(              │
    │    this.client,  ← injected        │
    │    parsedArgs                      │
    │  )                                 │
    │                                    │
    └────────────┬───────────────────────┘
                 │
    ┌────────────┴────────────────────────────┐
    │            Tool Handler (tools/*.ts)    │
    │                                         │
    │  export async function toolHandler(     │
    │    client: LangfuseAnalyticsClient,     │
    │    args: ArgsType                       │
    │  ) {                                    │
    │    const response =                     │
    │      await client.method(...)  ← use    │
    │  }                                      │
    └────────────┬────────────────────────────┘
                 │
                 │ Client has all credentials
                 │ and API methods
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  LangfuseAnalyticsClient               │
    │  - this.config (publicKey, secretKey)  │
    │  - getMetrics(), listTraces(), etc.    │
    └────────────────────────────────────────┘

Benefits:
- Tools don't create own client
- Single client instance reused
- Credentials centralized
- Easy to mock for testing
- Follows dependency injection pattern
```

---

## 9. Type System Validation Flow

How Zod validation ensures type safety:

```
┌────────────────────────────────────┐
│  Tool File (e.g., get-traces.ts)   │
│                                    │
│  export const getTracesSchema =    │
│    z.object({                      │
│      from: z.string().datetime(),  │
│      to: z.string().datetime(),    │
│      limit: z.number()             │
│        .min(1).max(100)            │
│        .default(25),               │
│      orderBy: z.enum([             │
│        'timestamp',                │
│        'totalCost'                 │
│      ])                            │
│      .default('timestamp'),        │
│    })                              │
│                                    │
│  export async function getTraces(  │
│    client,                         │
│    args: z.infer<                  │
│      typeof getTracesSchema        │
│    >                               │
│  ) { ... }                         │
└────────────┬───────────────────────┘
             │
             │ Schema definition
             │
             ▼
    ┌────────────────────────────────┐
    │  MCP Client sends:             │
    │  {                             │
    │    from: "2024-01-01T...",     │
    │    to: "2024-01-31T...",       │
    │    limit: 10,                  │
    │    orderBy: "totalCost"        │
    │  }                             │
    └────────────┬────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │  index.ts: CallToolRequest     │
    │                                │
    │  const args =                  │
    │    getTracesSchema.parse(      │
    │      request.params.arguments  │
    │    )                           │
    └────────────┬────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    Valid              Invalid
    args                 args
        │                 │
        ▼                 ▼
    Continue        throw ZodError
    Execution            │
                         │ Error details:
                         │ - field name
                         │ - expected type
                         │ - actual value
                         │
                         ▼
                 ┌─────────────────────┐
                 │ Catch ZodError      │
                 │ Return error        │
                 │ response to client  │
                 └─────────────────────┘

Type Safety Guarantees:
- args.from: definitely a datetime string
- args.limit: definitely a number, 1-100
- args.orderBy: definitely one of enum values
- TypeScript knows exact types (z.infer)
- Runtime validation ensures contract
```

---

## 10. Multi-Project Architecture (Future)

How the server could support multiple projects:

```
Current (Single Project):
┌──────────────────────────────────────┐
│  MCP Server Instance                 │
│  ├─ Config: LANGFUSE_PUBLIC_KEY      │
│  ├─ Config: LANGFUSE_SECRET_KEY      │
│  └─ LangfuseAnalyticsClient          │
│     └─ One project only              │
└──────────────────────────────────────┘


Future (Multi-Project):
┌────────────────────────────────────────┐
│  MCP Server Instance                   │
│  ├─ Config: {projects: [...]}          │
│  ├─ ProjectRegistry                    │
│  │  ├─ Project A: config + client      │
│  │  ├─ Project B: config + client      │
│  │  └─ Project C: config + client      │
│  │                                     │
│  └─ All Tools:                         │
│     Tools take projectId parameter     │
│     Lookup correct client in registry  │
│     Execute with project-specific auth │
└────────────────────────────────────────┘

Tool Signature Change:
  Before:
    getTraces(client, args)
  
  After:
    getTraces(client, args, projectId)
    → client = registry.getClient(projectId)
    → proceed as before

Benefits:
- Single server for multiple projects
- Same credentials system
- No code duplication
- Cleaner Claude Desktop config
```

