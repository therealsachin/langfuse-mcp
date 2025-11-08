# Langfuse MCP Server - Comprehensive Architecture Documentation

## Overview

The Langfuse MCP (Model Context Protocol) Server is a TypeScript-based analytics and cost monitoring gateway that bridges the Model Context Protocol with the Langfuse analytics platform. It provides 18 specialized tools for querying LLM observability data, cost analysis, and usage metrics across Langfuse projects.

**Key Purpose**: Enable AI assistants (Claude, etc.) to query LLM observability data, analyze costs, debug traces, and monitor system health through a standardized MCP interface.

**Project Stats**:
- 18 MCP tools across multiple analytical domains
- TypeScript with strict typing (zod validation)
- ES2022 target with Node 16 module resolution
- Single-project per instance (environment-variable scoped)
- ~1,800 lines of source code across 22 files

---

## 1. Architecture Overview

### 1.1 High-Level Conceptual Design

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client Layer                         │
│                   (Claude Desktop, etc)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol (stdio)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          MCP Server Entry Point (index.ts)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - Server initialization & capability setup          │  │
│  │  - Tool registry & dispatching                       │  │
│  │  - Error handling & shutdown management              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌────────┐   ┌─────────────┐   ┌──────────┐
    │18 Tool │   │ Langfuse    │   │ Config   │
    │Handlers│──▶│ Client      │──▶│ Manager  │
    └────────┘   │ Wrapper     │   └──────────┘
                 └─────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │  HTTP Fetch + Basic Auth       │
        │  (to Langfuse APIs)            │
        └────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   Langfuse Public APIs         │
        │   - /api/public/metrics        │
        │   - /api/public/traces         │
        │   - /api/public/observations   │
        │   - /api/public/metrics/daily  │
        │   - /api/public/health         │
        │   - /api/public/models         │
        │   - /api/public/prompts        │
        └────────────────────────────────┘
```

### 1.2 Design Philosophy

This is a **thin, typed, single-project analytics facade** over the Langfuse Metrics and Traces APIs:

1. **No manual aggregation**: Server-side aggregation is performed by Langfuse Metrics API; MCP server acts as query translator
2. **Strict typing throughout**: Zod schemas for validation; TypeScript interfaces for all data structures
3. **Single project per instance**: Each MCP server instance connects to one Langfuse project via environment variables
4. **Error handling first**: All operations wrapped in try-catch; errors returned as MCP error responses
5. **Content size management**: Large responses truncated/paginated to avoid MCP token limits

---

## 2. File Structure and Key Directories

```
langfuse-mcp/
├── src/
│   ├── index.ts                    # Main MCP server entry point
│   ├── config.ts                   # Environment variable loading & validation
│   ├── types.ts                    # TypeScript interfaces for all data types
│   ├── langfuse-client.ts          # HTTP wrapper around Langfuse APIs
│   │
│   └── tools/                      # 18 MCP tool implementations
│       │
│       ├── Core Analytics Tools (Original)
│       ├── ├── list-projects.ts           # List configured projects
│       ├── ├── project-overview.ts        # Cost/tokens/traces summary
│       ├── ├── usage-by-model.ts          # Model-specific breakdowns
│       ├── ├── usage-by-service.ts        # Service-specific breakdowns
│       ├── ├── top-expensive-traces.ts    # Find costly traces
│       ├── └── get-trace-detail.ts        # Detailed trace inspection
│       │
│       ├── Aggregation & Filtering Tools (Extended)
│       ├── ├── get-metrics.ts             # Low-level metrics API wrapper
│       ├── ├── get-traces.ts              # Advanced trace filtering
│       ├── ├── get-observations.ts        # LLM generation details
│       ├── ├── get-cost-analysis.ts       # Multi-dimensional cost breakdown
│       ├── ├── get-daily-metrics.ts       # Daily usage trends
│       ├── └── get-projects.ts            # Alias for list-projects
│       │
│       └── Additional API Tools
│           ├── get-observation-detail.ts  # Single observation inspection
│           ├── get-health-status.ts       # API health monitoring
│           ├── list-models.ts             # Available AI models
│           ├── get-model-detail.ts        # Model-specific information
│           ├── list-prompts.ts            # Prompt template listing
│           └── get-prompt-detail.ts       # Prompt version inspection
│
├── build/                          # Compiled JavaScript (generated)
├── node_modules/                   # Dependencies
│
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
├── test-endpoints.js               # Integration test suite
├── README.md                        # User-facing documentation
├── IMPLEMENTATION_NOTES.md         # Developer notes
└── .langfuse.json                  # Multi-project Langfuse config
```

### 2.1 File Purpose Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `index.ts` | MCP server initialization, tool registry, request dispatcher | `LangfuseAnalyticsServer` class |
| `config.ts` | Load and validate environment variables | `getProjectConfig()` function |
| `types.ts` | All TypeScript interfaces | `LangfuseProjectConfig`, `ProjectOverview`, etc |
| `langfuse-client.ts` | HTTP API wrapper with Basic Auth | `LangfuseAnalyticsClient` class |
| Each tool file | Implements one MCP tool | `{toolName}` function, `{toolName}Schema` |

---

## 3. MCP Server Structure

### 3.1 Entry Point (index.ts)

The server follows the Model Context Protocol specification:

**Class**: `LangfuseAnalyticsServer`
- **Constructor**: Initializes MCP Server, Langfuse client, error handling
- **setupHandlers()**: Registers two critical MCP handlers
  - `ListToolsRequestSchema`: Returns 18 available tools with descriptions & schemas
  - `CallToolRequestSchema`: Dispatches tool calls by name to handlers
- **setupErrorHandling()**: Sets up process signal handlers and error listeners
- **run()**: Starts stdio transport and connects MCP server

**Flow**:
```
MCP Client → Stdio Transport → ListToolsRequest/CallToolRequest
                                        ↓
                              index.ts (Server)
                                        ↓
                              Tool validator (zod)
                                        ↓
                              Tool handler function
                                        ↓
                              Langfuse API call
                                        ↓
                              MCP Response (text content)
```

**Key Pattern**:
```typescript
// All tools follow this pattern
case 'tool_name': {
  const args = toolNameSchema.parse(request.params.arguments);
  return await toolNameHandler(this.client, args);
}
```

### 3.2 Tool Architecture

All 18 tools follow an identical pattern:

```typescript
// File: src/tools/tool-name.ts

// 1. Zod schema for input validation
export const toolNameSchema = z.object({
  requiredParam: z.string(),
  optionalParam: z.string().optional(),
  dateRange: z.string().datetime(),
});

// 2. Tool implementation function
export async function toolName(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof toolNameSchema>
) {
  try {
    // API calls via client
    const response = await client.methodName(...);
    
    // Data transformation
    const result = transform(response);
    
    // Return MCP response
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    // Error handling
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ error, message }, null, 2),
      }],
      isError: true,
    };
  }
}
```

**Characteristics**:
- All inputs validated with Zod before execution
- All outputs wrapped in MCP-compliant content array
- All errors caught and formatted as error responses
- No exceptions escape to MCP layer

### 3.3 Tool Categories (18 Total)

#### Category A: Core Analytics (6 tools)
Used for high-level insights and cost overview:

1. **list_projects** - List configured projects (single project per instance)
2. **project_overview** - Cost/tokens/traces summary for date range
3. **usage_by_model** - Model-specific cost & token breakdown
4. **usage_by_service** - Service-specific breakdown by tag
5. **top_expensive_traces** - Find N most expensive traces
6. **get_trace_detail** - Get full trace with all observations

#### Category B: Advanced Metrics & Filtering (6 tools)
Lower-level APIs for custom queries:

7. **get_metrics** - Query Metrics API directly with custom dimensions
8. **get_traces** - List traces with filtering, pagination, sorting
9. **get_observations** - List LLM generations with filtering, content size control
10. **get_cost_analysis** - Multi-dimensional cost breakdown
11. **get_daily_metrics** - Daily usage trends and patterns
12. **get_projects** - Alias for list_projects

#### Category C: Additional APIs (6 tools)
Specialized domain lookups:

13. **get_observation_detail** - Single observation by ID
14. **get_health_status** - API health & availability check
15. **list_models** - Available AI models in project
16. **get_model_detail** - Single model information
17. **list_prompts** - Prompt templates in project
18. **get_prompt_detail** - Single prompt version/label

---

## 4. The Langfuse Client (langfuse-client.ts)

### 4.1 Architecture

Wrapper around native HTTP fetch with Basic Auth:

```typescript
class LangfuseAnalyticsClient {
  private client: Langfuse;  // Native Langfuse SDK (for shutdown)
  private config: LangfuseProjectConfig;

  // Public methods match Langfuse API endpoints
  async getMetrics(params): Promise<any>
  async listTraces(params): Promise<any>
  async getTrace(traceId): Promise<any>
  async listObservations(params): Promise<any>
  async getDailyMetrics(params): Promise<any>
  async getObservation(observationId): Promise<any>
  async getHealthStatus(): Promise<any>
  async listModels(params): Promise<any>
  async getModel(modelId): Promise<any>
  async listPrompts(params): Promise<any>
  async getPrompt(promptName, version?, label?): Promise<any>
  async shutdown(): Promise<void>
}
```

### 4.2 API Methods by Endpoint

| Method | Endpoint | Purpose | HTTP Method |
|--------|----------|---------|-------------|
| `getMetrics()` | `/api/public/metrics` | Aggregated metrics with dimensions | GET (query param) |
| `listTraces()` | `/api/public/traces` | List & filter traces | GET |
| `getTrace()` | `/api/public/traces/{id}` | Single trace detail | GET |
| `listObservations()` | `/api/public/observations` | List & filter observations | GET |
| `getDailyMetrics()` | `/api/public/metrics/daily` | Daily aggregated usage | GET |
| `getObservation()` | `/api/public/observations/{id}` | Single observation | GET |
| `getHealthStatus()` | `/api/public/health` | System health | GET |
| `listModels()` | `/api/public/models` | Available models | GET |
| `getModel()` | `/api/public/models/{id}` | Model details | GET |
| `listPrompts()` | `/api/public/prompts` | Prompt templates | GET |
| `getPrompt()` | `/api/public/prompts/{name}` | Prompt version | GET |

### 4.3 Authentication (Basic Auth)

Every request includes:
```typescript
const authHeader = 'Basic ' + Buffer.from(
  `${this.config.publicKey}:${this.config.secretKey}`
).toString('base64');

// Added to headers:
{ 'Authorization': authHeader }
```

**Security Note**: 
- Auth credentials never logged or exposed
- Computed fresh for each request
- Server-side only; never sent to client

### 4.4 Key Implementation Details

**Metrics API (GET with query param)**:
```typescript
const queryParam = encodeURIComponent(JSON.stringify(query));
const response = await fetch(
  `${this.config.baseUrl}/api/public/metrics?query=${queryParam}`,
  { method: 'GET', headers: { 'Authorization': authHeader } }
);
```

**Traces/Observations (GET with URLSearchParams)**:
```typescript
const queryParams = new URLSearchParams();
queryParams.append('limit', limit.toString());
// ... add more params
const response = await fetch(
  `${this.config.baseUrl}/api/public/traces?${queryParams}`,
  { headers: { 'Authorization': authHeader } }
);
```

**Error Handling**:
```typescript
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`API error: ${response.status}. Response: ${errorText}`);
}
return await response.json();
```

---

## 5. Configuration System (config.ts)

### 5.1 Environment-Based Single Project Configuration

```typescript
function getProjectConfig(): LangfuseProjectConfig {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    throw new Error('Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY');
  }

  // Extract project ID from public key prefix
  const projectId = publicKey.split('-')[2]?.substring(0, 8) || 'default';

  return { id: projectId, baseUrl, publicKey, secretKey };
}
```

**Environment Variables**:
- `LANGFUSE_PUBLIC_KEY` - Required, format: `pk-lf-*`
- `LANGFUSE_SECRET_KEY` - Required, format: `sk-lf-*`
- `LANGFUSE_BASEURL` - Optional, default: `https://cloud.langfuse.com`

**Multi-Project Strategy**:
- Current architecture: **One project per MCP server instance**
- Multiple projects require multiple MCP server instances with different env vars
- Example `.langfuse.json` shows 6 separate Langfuse instances for 6 projects

---

## 6. Type System (types.ts)

All TypeScript interfaces ensure end-to-end type safety:

### 6.1 Configuration Types
```typescript
interface LangfuseProjectConfig {
  id: string;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
}
```

### 6.2 Response Types

**ProjectOverview** - High-level project summary
```typescript
{
  projectId: string;
  from: string;
  to: string;
  totalCostUsd: number;
  totalTokens: number;
  totalTraces: number;
  byEnvironment?: Array<{ environment, cost, tokens, traces }>;
}
```

**ModelUsage** - Per-model breakdown
```typescript
{
  model: string;
  totalCost: number;
  totalTokens: number;
  observationCount: number;
}
```

**CostAnalysis** - Multi-dimensional cost view
```typescript
{
  projectId: string;
  from: string;
  to: string;
  totalCost: number;
  breakdown: {
    byModel?: Array<{model, cost, tokens, observations, percentage}>;
    byUser?: Array<{userId, cost, tokens, traces, percentage}>;
    byDay?: Array<{date, cost, tokens, traces}>;
  };
}
```

**TraceDetail** - Trace with observations
```typescript
{
  traceId: string;
  name: string;
  totalCost: number;
  totalTokens: number;
  timestamp: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  observations: Array<{
    id, type, name, startTime, endTime, model,
    inputTokens, outputTokens, totalTokens, cost
  }>;
}
```

**Full list** (from types.ts):
- `LangfuseProjectConfig`
- `ProjectOverview`
- `ModelUsage`
- `ServiceUsage`
- `ExpensiveTrace`
- `TraceDetail`
- `MetricsResponse`
- `TracesResponse`
- `ObservationsResponse`
- `CostAnalysis`
- `DailyMetrics`

---

## 7. Tool Implementation Patterns

### 7.1 Pattern 1: Simple List Tools (list_projects, get_projects)

**Purpose**: Return static data from config
**Code**: 5-20 lines

```typescript
export async function listProjects(client: LangfuseAnalyticsClient) {
  const projectId = client.getProjectId();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ projects: [projectId] }, null, 2),
    }],
  };
}
```

**Files**: `list-projects.ts`, `get-projects.ts`

### 7.2 Pattern 2: Metrics API Query Tools

**Purpose**: Query Langfuse Metrics API with dimensions/filters
**Code**: 50-100 lines
**Example**: `usage-by-model.ts`

**Key Steps**:
1. Validate input with Zod
2. Call `client.getDailyMetrics()` or `client.getMetrics()`
3. Parse response and aggregate data
4. Format into typed response
5. Handle errors gracefully

**Special Handling**:
- `usage_by_model.ts`: Uses daily metrics for accurate cost calculation
- `usage_by_service.ts`: Filters by service tag keys
- `project_overview.ts`: Filters by environment tag

### 7.3 Pattern 3: Trace/Observation Query Tools

**Purpose**: List & filter individual traces/observations
**Code**: 80-150 lines
**Example**: `get-traces.ts`, `get-observations.ts`

**Key Steps**:
1. Build query parameters from args
2. Call `client.listTraces()` or `client.listObservations()`
3. Map API response to typed objects
4. Apply client-side filtering (cost ranges, sorting)
5. Handle pagination metadata

**Content Size Management**:
- `get_observations.ts`: Has `includeInputOutput` flag to exclude large content
- Truncation function for long strings/JSON: truncate at 500 chars by default
- Reduced default limit (10 vs 25) for observations

### 7.4 Pattern 4: Complex Analysis Tools

**Purpose**: Multi-step API calls with aggregation
**Code**: 150-200 lines
**Example**: `get-cost-analysis.ts`

**Steps**:
1. Get daily metrics for total cost (working endpoint)
2. Aggregate model costs from daily usage breakdown
3. Query metrics API for user breakdown (with debugging)
4. Build multi-dimensional response
5. Calculate percentages for each breakdown

**Error Handling**:
- Try/catch for each section
- Partial results on API failure (e.g., user breakdown fails but model breakdown succeeds)
- Debug logging for troubleshooting

### 7.5 Pattern 5: Detail/Lookup Tools

**Purpose**: Get single entity by ID
**Code**: 30-80 lines
**Example**: `get-trace-detail.ts`, `get-observation-detail.ts`

**Key Steps**:
1. Validate ID parameter with Zod
2. Call `client.getTrace(id)` or similar
3. Format into typed response
4. Handle not-found case

---

## 8. Data Processing & Aggregation Strategy

### 8.1 Working APIs vs Broken APIs

**Issue Discovered During Development**:
- The Metrics API field mapping returns aggregated field names like `totalCost_sum`, `count_count`, `totalTokens_sum`
- Some tools returned zero values despite real data existing

**Solution Applied**:
- **Primary method** for cost data: Use `getDailyMetrics()` API which returns pre-aggregated, correctly formatted data
- **Fallback method**: Metrics API with correct field name mapping (`totalCost_sum` instead of `totalCost`)
- **Tools using daily metrics**: `usage_by_model.ts`, `project_overview.ts`, `get_cost_analysis.ts`

### 8.2 Aggregation Pattern: From Daily Data

```typescript
const dailyResponse = await client.getDailyMetrics({
  tags: args.environment ? [`environment:${args.environment}`] : undefined,
});

// Filter by date range
const filteredData = dailyResponse.data.filter((day: any) => {
  const dayDate = new Date(day.date);
  return dayDate >= fromDate && dayDate <= toDate;
});

// Aggregate per model
const modelMap = new Map<string, { cost, tokens, observations }>();
filteredData.forEach((day: any) => {
  if (day.usage && Array.isArray(day.usage)) {
    day.usage.forEach((usage: any) => {
      const modelName = usage.model || 'unknown';
      const existing = modelMap.get(modelName) || { cost: 0, tokens: 0, observations: 0 };
      modelMap.set(modelName, {
        cost: existing.cost + (usage.totalCost || 0),
        tokens: existing.tokens + (usage.totalUsage || 0),
        observations: existing.observations + (usage.countObservations || 0),
      });
    });
  }
});

// Convert to array, sort, and limit
const result = Array.from(modelMap.entries())
  .map(([model, data]) => ({ model, ...data }))
  .sort((a, b) => b.cost - a.cost)
  .slice(0, limit);
```

### 8.3 Content Truncation Pattern

Used in `get_observations.ts`:

```typescript
const truncateContent = (content: any, maxLength: number): any => {
  if (!content) return content;
  if (typeof content === 'string') {
    return content.length > maxLength
      ? content.substring(0, maxLength) + '...[truncated]'
      : content;
  }
  if (typeof content === 'object') {
    const jsonStr = JSON.stringify(content);
    return jsonStr.length > maxLength
      ? jsonStr.substring(0, maxLength) + '...[truncated]'
      : content;
  }
  return content;
};
```

---

## 9. Error Handling Strategy

### 9.1 Validation Layer (Zod)

All tools validate inputs before execution:

```typescript
export const exampleSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  limit: z.number().min(1).max(100).default(25),
  orderBy: z.enum(['timestamp', 'cost']).default('timestamp'),
});
```

Parsing throws `ZodError` if invalid, caught in MCP dispatcher.

### 9.2 API Call Error Handling

```typescript
try {
  const response = await fetch(url, { headers, method });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  return await response.json();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`API call failed: ${message}`);
}
```

### 9.3 Tool-Level Error Handling

Every tool wrapped in try-catch:

```typescript
try {
  // Main logic
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        error: 'Operation failed',
        message: errorMessage,
        // Include context for debugging
      }, null, 2),
    }],
    isError: true,  // MCP flag indicating error response
  };
}
```

### 9.4 Process-Level Error Handling

```typescript
private setupErrorHandling(): void {
  this.server.onerror = (error) => {
    console.error('[MCP Error]', error);
  };

  process.on('SIGINT', async () => {
    await this.client.shutdown();
    process.exit(0);
  });
}
```

---

## 10. Building & Development Process

### 10.1 Build Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Key Settings**:
- **Target**: ES2022 for modern JavaScript features
- **Module**: Node16 for native ESM support
- **Strict**: Full type checking enabled
- **Declaration**: Generate `.d.ts` files for consumers
- **Source Maps**: Enable debugging in built files

### 10.2 Build & Development Commands

```bash
npm run build        # Compile TypeScript to build/
npm run watch        # Watch mode (recompile on changes)
npm run dev          # Alias for watch
npm run inspector    # Run server with MCP Inspector for testing
npm run test         # Run test suite (test-endpoints.js)
npm run prepare      # Pre-publish hook (runs build)
```

### 10.3 Project as Executable

The compiled `build/index.ts` is marked as executable:

```bash
#!/usr/bin/env node
// (First line of index.ts)
```

Allows running as:
```bash
npm run inspector          # Direct execution
./build/index.js           # Via path
npx langfuse-mcp           # Via npm publish
```

### 10.4 Build Output Structure

```
build/
├── index.js                          # Main server (executable)
├── config.js
├── langfuse-client.js
├── types.js
├── tools/
│   ├── list-projects.js
│   ├── get-traces.js
│   ├── ... (18 tools total)
│
├── index.d.ts                        # Type declarations
├── config.d.ts
├── ... (all .d.ts files)
│
├── index.js.map                      # Source maps for debugging
├── config.js.map
├── ... (all .js.map files)
```

---

## 11. Testing Framework

### 11.1 Test File: test-endpoints.js

Comprehensive integration test suite testing 18 endpoints:

```javascript
// Format: node test-endpoints.js

Tests:
 1. project_overview       - Verify real costs/tokens/traces
 2. get_traces             - Server-side cost sorting
 3. usage_by_model         - Model breakdown with aggregation
 4. usage_by_service       - Service tag filtering
 5. top_expensive_traces   - Expensive trace ranking
 6. get_trace_detail       - Single trace with observations
 7. get_cost_analysis      - Multi-dimensional breakdown
 8. get_daily_metrics      - Daily aggregation
 9. get_observations       - Observation filtering & truncation
10. get_metrics            - Custom dimension queries
11. get_observation_detail - Single observation lookup
12. get_health_status      - API health check
13. list_models            - Model enumeration
14. get_model_detail       - Model information
15. list_prompts           - Prompt template listing
16. get_prompt_detail      - Prompt version lookup
17. ... (up to 18 total)
```

**Test Structure**:
- Load environment variables from `.env`
- Initialize Langfuse client with credentials
- Run sequential tests against real Langfuse API
- Report PASS/FAIL/ERROR status
- Verify data quality (e.g., costs > 0, correct sorting)

### 11.2 Running Tests

```bash
# Prerequisite: Set up .env with real Langfuse credentials
cp .env.example .env
# Edit .env with your LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASEURL

# Build project
npm run build

# Run tests
npm run test
```

Expected output:
```
🧪 Langfuse MCP Server - Enhanced Endpoint Tests (18 Total Tests)
============================================================
🔗 Testing against: https://us.cloud.langfuse.com
📊 Project ID: abc12345

1️⃣ Testing project_overview...
   ✅ PASS - Real costs: $123.45
   ...
```

---

## 12. Key Dependencies & Their Roles

### 12.1 Production Dependencies

| Package | Version | Role |
|---------|---------|------|
| `@modelcontextprotocol/sdk` | ^1.0.4 | MCP protocol implementation, server transport |
| `langfuse` | ^3.29.0 | Native Langfuse SDK (used for shutdown only) |
| `zod` | ^3.23.8 | Runtime schema validation for all inputs |

### 12.2 Development Dependencies

| Package | Version | Role |
|---------|---------|------|
| `@types/node` | ^22.10.2 | Node.js type definitions |
| `typescript` | ^5.7.2 | TypeScript compiler |
| `dotenv` | ^17.2.3 | Load `.env` files (test suite only) |

### 12.3 Dependency Justification

**@modelcontextprotocol/sdk**:
- Provides MCP Server, StdioServerTransport, request/response schemas
- Required for stdio communication with MCP clients
- Handles protocol-level concerns (JSON-RPC, tool registry)

**langfuse**:
- Imported for graceful shutdown (`client.shutdownAsync()`)
- Not currently used for API calls (using native fetch with Basic Auth instead)
- Could be extended for future SDK features

**zod**:
- Runtime validation library (not TypeScript-only!)
- Ensures all tool inputs match expected schema
- Provides user-friendly error messages on invalid input
- Enables safe parsing: `schema.parse(data)` throws on invalid data

---

## 13. Configuration Patterns & Best Practices

### 13.1 Environment-Based Configuration

**Single Project Setup** (.env):
```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
LANGFUSE_BASEURL=https://us.cloud.langfuse.com  # Optional, default shown
```

**Multi-Project Setup** (.langfuse.json):
```json
{
  "langfuse-analytics": {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/build/index.js"],
    "env": {
      "LANGFUSE_PUBLIC_KEY": "pk-lf-proj-1-...",
      "LANGFUSE_SECRET_KEY": "sk-lf-proj-1-...",
      "LANGFUSE_BASEURL": "https://us.cloud.langfuse.com"
    }
  },
  "langfuse-staging": {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/build/index.js"],
    "env": {
      "LANGFUSE_PUBLIC_KEY": "pk-lf-proj-2-...",
      "LANGFUSE_SECRET_KEY": "sk-lf-proj-2-...",
      "LANGFUSE_BASEURL": "https://eu.cloud.langfuse.com"
    }
  }
}
```

### 13.2 MCP Tool Schema Definition Pattern

Every tool exports:
1. **Schema**: Zod object defining inputs
2. **Function**: Async function implementing tool logic

```typescript
// Schema
export const myToolSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
  dateRange: z.string().datetime(),
});

// Implementation
export async function myTool(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof myToolSchema>
) {
  // Implementation
}
```

### 13.3 Tool Registration Pattern

In `index.ts`:
```typescript
// 1. Import schema and handler
import { myTool, myToolSchema } from './tools/my-tool.js';

// 2. Add to tool registry in ListToolsRequestSchema
{
  name: 'my_tool',
  description: 'Description of what tool does',
  inputSchema: { type: 'object', properties: {...} },
}

// 3. Add to dispatcher in CallToolRequestSchema
case 'my_tool': {
  const args = myToolSchema.parse(request.params.arguments);
  return await myTool(this.client, args);
}
```

### 13.4 API Endpoint Pattern

In `langfuse-client.ts`:
```typescript
async myApiMethod(params: {
  requiredParam: string;
  optionalParam?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  
  if (params.requiredParam) 
    queryParams.append('requiredParam', params.requiredParam);
  if (params.optionalParam) 
    queryParams.append('optionalParam', params.optionalParam);

  const authHeader = 'Basic ' + Buffer.from(
    `${this.config.publicKey}:${this.config.secretKey}`
  ).toString('base64');

  const response = await fetch(
    `${this.config.baseUrl}/api/public/endpoint?${queryParams}`,
    { headers: { 'Authorization': authHeader } }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}
```

---

## 14. How to Add New Tools/APIs

### 14.1 Step-by-Step Guide to Add a New Tool

**Scenario**: Add new tool `count_events` that counts events by type

**Step 1**: Create tool file `/src/tools/count-events.ts`
```typescript
import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const countEventsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  eventType: z.enum(['GENERATION', 'SPAN', 'EVENT']),
});

export async function countEvents(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof countEventsSchema>
) {
  try {
    const response = await client.listObservations({
      fromStartTime: args.from,
      toStartTime: args.to,
      type: args.eventType,
      limit: 1, // Just need count
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          projectId: client.getProjectId(),
          eventType: args.eventType,
          count: response.meta?.totalItems || 0,
          from: args.from,
          to: args.to,
        }, null, 2),
      }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ error: message }, null, 2),
      }],
      isError: true,
    };
  }
}
```

**Step 2**: Add client method in `/src/langfuse-client.ts` (if needed)

Most tools reuse existing methods like `listObservations()`. Only add new methods if calling a new API endpoint.

**Step 3**: Import and register in `/src/index.ts`
```typescript
import { countEvents, countEventsSchema } from './tools/count-events.js';

// In ListToolsRequestSchema handler:
{
  name: 'count_events',
  description: 'Count events by type over a date range',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
      eventType: { type: 'string', enum: ['GENERATION', 'SPAN', 'EVENT'] },
    },
    required: ['from', 'to', 'eventType'],
  },
}

// In CallToolRequestSchema dispatcher:
case 'count_events': {
  const args = countEventsSchema.parse(request.params.arguments);
  return await countEvents(this.client, args);
}
```

**Step 4**: Test
```bash
npm run build
npm run inspector  # Test in MCP Inspector
npm run test       # Add test case to test-endpoints.js
```

### 14.2 Step-by-Step Guide to Add New Client Method

**Scenario**: Add support for `/api/public/custom-endpoint`

**Step 1**: Add method to `LangfuseAnalyticsClient`:
```typescript
async getCustomData(params: {
  filters?: string;
  limit?: number;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  
  if (params.filters) queryParams.append('filters', params.filters);
  if (params.limit) queryParams.append('limit', params.limit.toString());

  const authHeader = 'Basic ' + Buffer.from(
    `${this.config.publicKey}:${this.config.secretKey}`
  ).toString('base64');

  const response = await fetch(
    `${this.config.baseUrl}/api/public/custom-endpoint?${queryParams}`,
    { headers: { 'Authorization': authHeader } }
  );

  if (!response.ok) {
    throw new Error(`Custom endpoint error: ${response.status}`);
  }

  return await response.json();
}
```

**Step 2**: Add type to `/src/types.ts` if needed:
```typescript
export interface CustomData {
  id: string;
  value: number;
  // ... fields
}
```

**Step 3**: Use in a new tool (follow tool creation steps above)

---

## 15. Architectural Decisions & Trade-offs

### 15.1 Why Single Project Per Instance?

**Decision**: Each MCP server instance connects to exactly one Langfuse project

**Rationale**:
- Langfuse API keys are project-scoped
- Can't enumerate all projects with a single API key
- Simplifies configuration and error handling
- Enables multiple servers for multiple projects

**Trade-off**:
- Less convenient for multi-project users
- Can be mitigated with `.langfuse.json` configuration in Claude Desktop

### 15.2 Why Metrics API for Aggregation?

**Decision**: Use Langfuse Metrics API instead of manually aggregating traces

**Rationale**:
- Server-side aggregation more efficient than fetching millions of rows
- Langfuse optimizes queries for aggregates
- Reduces data transfer and computation
- Simpler, more maintainable tool code

**Trade-off**:
- Less flexible for custom aggregations
- Requires learning Metrics API query format

### 15.3 Why Zod Validation?

**Decision**: Runtime validation with Zod for all inputs

**Rationale**:
- TypeScript types are compile-time only
- MCP clients send untrusted data
- Zod catches invalid data before tools execute
- Provides friendly error messages
- Single source of truth for schema (no duplication)

**Trade-off**:
- Small runtime overhead
- Adds another dependency
- Verbose schema definitions

### 15.4 Why Stdio Transport?

**Decision**: Use stdio (standard input/output) for MCP communication

**Rationale**:
- Standard MCP practice
- Works with Claude Desktop, VS Code, and other clients
- No port management or networking concerns
- Process isolation via subprocess

**Trade-off**:
- Can't be accessed via HTTP (by design)
- Requires MCP-aware clients
- Not directly testable with curl/Postman

---

## 16. Known Limitations & Future Improvements

### 16.1 Current Limitations

1. **Single project scope**: Each instance serves one Langfuse project
   - **Mitigation**: Run multiple instances (shown in `.langfuse.json`)

2. **No caching**: All requests hit Langfuse API
   - **Impact**: Repeated queries are not cached
   - **Future**: Add optional Redis/in-memory caching

3. **API response size limits**: Large observation lists may be truncated
   - **Mitigation**: `get_observations` has `includeInputOutput` flag
   - **Current**: Default limit 10, max 50 observations

4. **No date range presets**: Requires ISO 8601 timestamps
   - **Example**: "last 7 days" must be computed by caller
   - **Future**: Add preset ranges like "7d", "30d", "mtd"

5. **Manual offset calculation for pagination**: No cursor-based pagination
   - **Current**: Page/limit model
   - **Future**: Implement cursor pagination for large datasets

### 16.2 Planned Improvements

- [ ] Add result caching (in-memory or Redis)
- [ ] Support for multiple projects in single instance
- [ ] Date range presets ("last 7 days", "this month", etc.)
- [ ] Cursor-based pagination for large datasets
- [ ] Export to CSV/JSON for reports
- [ ] Alert/notification triggering on cost thresholds
- [ ] Integration with Slack/email for alerts

### 16.3 Testing Gaps

- [ ] Unit tests for individual tools
- [ ] Integration tests with mock Langfuse API
- [ ] End-to-end tests with Claude Desktop
- [ ] Performance tests for large datasets

---

## 17. Summary: Quick Reference Guide

### Quick Facts

| Aspect | Detail |
|--------|--------|
| Language | TypeScript (ES2022) |
| Module System | ESM (Node16) |
| MCP Version | Protocol v1.0.4 |
| Tools Total | 18 across 3 categories |
| Auth Type | HTTP Basic Auth |
| Configuration | Environment variables |
| Build Output | JavaScript in `build/` |
| Type Safety | Full (TypeScript + Zod) |
| Error Handling | Try-catch with MCP error responses |

### File Locations

- **Entry Point**: `/src/index.ts`
- **API Wrapper**: `/src/langfuse-client.ts`
- **Types**: `/src/types.ts`
- **Tools**: `/src/tools/*.ts` (18 files)
- **Config**: `/src/config.ts`
- **Build**: `/build/` (generated)
- **Tests**: `/test-endpoints.js`
- **Docs**: `README.md`, `IMPLEMENTATION_NOTES.md`, this file

### Adding Something New

1. **New Tool**: Create `/src/tools/tool-name.ts`, export schema and function, register in `index.ts`
2. **New API Endpoint**: Add method to `LangfuseAnalyticsClient`, add types if needed, use in tools
3. **New Configuration**: Edit `/src/config.ts` to load new env variable
4. **New Type**: Add interface to `/src/types.ts`

### Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run watch        # Watch mode
npm run inspector    # Run in MCP Inspector
npm run test         # Run integration tests
npm run dev          # Alias for watch
```

### Debugging

1. **Check environment variables**: `echo $LANGFUSE_PUBLIC_KEY`
2. **Test API directly**: Use curl with Basic Auth header
3. **View logs**: Check console output from `npm run inspector`
4. **Check Zod validation**: Look for parse errors in error responses
5. **Inspect traces**: Use Langfuse UI to verify data exists

---

## Conclusion

The Langfuse MCP Server is a well-structured, type-safe analytics gateway that demonstrates:

- **Architectural clarity**: Clean separation between MCP layer, client wrapper, and API integration
- **Type safety**: End-to-end typing with TypeScript and Zod runtime validation
- **Error resilience**: Comprehensive error handling at every layer
- **Extensibility**: Easy to add new tools and APIs following established patterns
- **Operational robustness**: Testing framework, configuration management, process lifecycle management

The codebase is ready for production use and extensions. Future developers can confidently add new tools by following the established patterns outlined in this document.

