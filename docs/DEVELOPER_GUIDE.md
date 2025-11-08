# Developer Guide - Langfuse MCP Server

This guide is a companion to `ARCHITECTURE.md` with practical, hands-on instructions for developers working with this codebase.

## Quick Start

### 1. Setup

```bash
# Clone and install
git clone <repo-url>
cd langfuse-mcp
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Langfuse credentials
nano .env
```

### 2. Build

```bash
npm run build
# Compiles src/ → build/
```

### 3. Test

```bash
npm run test
# Runs test-endpoints.js against your .env credentials
```

### 4. Develop

```bash
# Terminal 1: Watch mode
npm run watch

# Terminal 2: Test/inspect
npm run inspector
```

---

## Common Development Tasks

### Task 1: Add a New MCP Tool

**Goal**: Expose a new Langfuse API as an MCP tool

**Example**: Add `count_active_users` tool

**Steps**:

1. Create tool file:
```bash
cat > src/tools/count-active-users.ts << 'TOOL'
import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const countActiveUsersSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export async function countActiveUsers(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof countActiveUsersSchema>
) {
  try {
    const response = await client.listTraces({
      fromTimestamp: args.from,
      toTimestamp: args.to,
      limit: 1,
    });

    const userIds = new Set<string>();
    if (response.data && Array.isArray(response.data)) {
      response.data.forEach((trace: any) => {
        if (trace.userId) userIds.add(trace.userId);
      });
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          projectId: client.getProjectId(),
          activeUserCount: userIds.size,
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
TOOL
```

2. Import in index.ts:
```typescript
import { countActiveUsers, countActiveUsersSchema } from './tools/count-active-users.js';
```

3. Register tool (in index.ts, ListToolsRequestSchema):
```typescript
{
  name: 'count_active_users',
  description: 'Count unique active users within a date range',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
    },
    required: ['from', 'to'],
  },
}
```

4. Add dispatcher (in index.ts, CallToolRequestSchema):
```typescript
case 'count_active_users': {
  const args = countActiveUsersSchema.parse(request.params.arguments);
  return await countActiveUsers(this.client, args);
}
```

5. Build and test:
```bash
npm run build
npm run inspector
# Test the tool in MCP Inspector UI
```

---

### Task 2: Add a New Langfuse API Endpoint

**Goal**: Support a new Langfuse API that tools can call

**Example**: Add support for `/api/public/scores` endpoint

**Steps**:

1. Add type to `types.ts`:
```typescript
export interface Score {
  id: string;
  traceId: string;
  name: string;
  value: number;
  timestamp: string;
}

export interface ScoresResponse {
  projectId: string;
  scores: Score[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}
```

2. Add method to `LangfuseAnalyticsClient` in `langfuse-client.ts`:
```typescript
async listScores(params: {
  page?: number;
  limit?: number;
  traceId?: string;
  name?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.traceId) queryParams.append('traceId', params.traceId);
  if (params.name) queryParams.append('name', params.name);
  if (params.fromTimestamp) queryParams.append('fromTimestamp', params.fromTimestamp);
  if (params.toTimestamp) queryParams.append('toTimestamp', params.toTimestamp);

  const authHeader = 'Basic ' + Buffer.from(
    `${this.config.publicKey}:${this.config.secretKey}`
  ).toString('base64');

  const response = await fetch(
    `${this.config.baseUrl}/api/public/scores?${queryParams}`,
    { headers: { 'Authorization': authHeader } }
  );

  if (!response.ok) {
    throw new Error(`Scores API error: ${response.status}`);
  }

  return await response.json();
}
```

3. Create tool that uses it (e.g., `get-scores.ts`):
```typescript
import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const getScoresSchema = z.object({
  traceId: z.string().optional(),
  name: z.string().optional(),
  limit: z.number().min(1).max(100).default(25),
});

export async function getScores(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof getScoresSchema>
) {
  try {
    const response = await client.listScores({
      traceId: args.traceId,
      name: args.name,
      limit: args.limit,
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          projectId: client.getProjectId(),
          scores: response.data || [],
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

4. Register tool (follow Task 1 steps 2-5)

---

### Task 3: Fix a Broken Tool

**Scenario**: Tool returns errors or wrong data

**Debugging steps**:

1. **Check inputs**:
   - Run tool with sample data
   - Verify date formats are ISO 8601
   - Check required vs optional parameters

2. **Check API response**:
```bash
# Test API directly with curl
curl -u "pk-lf-xxx:sk-lf-xxx" \
  "https://cloud.langfuse.com/api/public/traces?limit=1"
```

3. **Add debug logging**:
```typescript
console.error('DEBUG - Response:', JSON.stringify(response, null, 2));
console.error('DEBUG - Request params:', params);
```

4. **Check field names**:
   - Langfuse API returns aggregated fields like `totalCost_sum`, `count_count`
   - Not simple field names like `totalCost`
   - See `get-cost-analysis.ts` for example

5. **Test incrementally**:
```bash
npm run build
# Add debug logging
npm run inspector
# Test specific tool
```

---

### Task 4: Add Configuration Option

**Goal**: Support new environment variable

**Example**: Add `LANGFUSE_TIMEOUT` option

**Steps**:

1. Update `config.ts`:
```typescript
export interface LangfuseProjectConfig {
  id: string;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  timeout?: number;  // New field
}

export function getProjectConfig(): LangfuseProjectConfig {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com';
  const timeout = process.env.LANGFUSE_TIMEOUT 
    ? parseInt(process.env.LANGFUSE_TIMEOUT, 10) 
    : 30000;

  if (!publicKey || !secretKey) {
    throw new Error('Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY');
  }

  const projectId = publicKey.split('-')[2]?.substring(0, 8) || 'default';

  return { id: projectId, baseUrl, publicKey, secretKey, timeout };
}
```

2. Update `types.ts` to match:
```typescript
export interface LangfuseProjectConfig {
  id: string;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  timeout?: number;
}
```

3. Use in `langfuse-client.ts`:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

try {
  const response = await fetch(url, { 
    headers,
    signal: controller.signal 
  });
  clearTimeout(timeoutId);
  // ... rest of logic
}
```

4. Document in `.env.example`:
```bash
# Timeout for API requests in milliseconds (default: 30000)
LANGFUSE_TIMEOUT=30000
```

---

### Task 5: Update/Fix Tool Tests

**Goal**: Add test case or fix failing test

**File**: `test-endpoints.js`

**Pattern**:
```javascript
// Test N: Tool name
console.log('\nNK️⃣ Testing tool_name...');
try {
  const result = await toolName(client, {
    // Required params
    from: fromDate,
    to: toDate,
    // Optional params
    limit: 5,
  });
  
  const data = JSON.parse(result.content[0].text);
  
  if (data.expectedField > 0) {
    console.log(`   ✅ PASS - Got expected data`);
    passed++;
  } else {
    console.log(`   ❌ FAIL - Unexpected data structure`);
    failed++;
  }
} catch (error) {
  console.log(`   ❌ FAIL - Error: ${error.message}`);
  failed++;
}
```

**Add test**:
1. Import tool in test file
2. Add test case before `runTests()` returns
3. Run: `npm run build && npm run test`

---

## Code Organization Principles

### 1. Tool Files Structure
```
src/tools/
├── Category A: Core Analytics
│   ├── list-projects.ts
│   ├── project-overview.ts
│   ├── usage-by-model.ts
│   ├── usage-by-service.ts
│   ├── top-expensive-traces.ts
│   └── get-trace-detail.ts
│
├── Category B: Advanced Filtering
│   ├── get-metrics.ts
│   ├── get-traces.ts
│   ├── get-observations.ts
│   ├── get-cost-analysis.ts
│   ├── get-daily-metrics.ts
│   └── get-projects.ts
│
└── Category C: Additional APIs
    ├── get-observation-detail.ts
    ├── get-health-status.ts
    ├── list-models.ts
    ├── get-model-detail.ts
    ├── list-prompts.ts
    └── get-prompt-detail.ts
```

### 2. Naming Conventions

**Tools**: 
- File: `kebab-case.ts` (e.g., `count-active-users.ts`)
- Function: `camelCase` (e.g., `countActiveUsers`)
- MCP name: `snake_case` (e.g., `count_active_users`)

**API Methods**:
- Method: `camelCase` (e.g., `listTraces`, `getMetrics`)
- Endpoint: `/api/public/path` (follows Langfuse convention)

**Types**:
- Interface: `PascalCase` (e.g., `TraceDetail`, `ProjectConfig`)
- Property: `camelCase` (e.g., `totalCost`, `userId`)

### 3. Error Handling Pattern

Every tool must follow:
```typescript
try {
  // Main logic
  const result = await client.method(...);
  // Transform result
  return { content: [{ type: 'text', text: JSON.stringify(...) }] };
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: message }, null, 2),
    }],
    isError: true,  // Important: MCP error flag
  };
}
```

### 4. Type Validation Pattern

Every tool must define schema:
```typescript
export const toolNameSchema = z.object({
  requiredString: z.string(),
  optionalNumber: z.number().optional(),
  dateTime: z.string().datetime(),
  enumField: z.enum(['option1', 'option2']),
  numberWithRange: z.number().min(1).max(100).default(50),
});

// Use in function signature
export async function toolName(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof toolNameSchema>
) { ... }
```

---

## Debugging Tips

### 1. Enable Debug Logging

Add to tools temporarily:
```typescript
console.error('DEBUG - API response:', JSON.stringify(response, null, 2));
console.error('DEBUG - Parsed result:', result);
```

Run server:
```bash
npm run inspector 2>&1 | tee debug.log
```

Check `debug.log` for output.

### 2. Test API Directly

```bash
# Set up auth
export AUTH=$(echo -n "pk-lf-xxx:sk-lf-xxx" | base64)

# Test traces endpoint
curl -H "Authorization: Basic $AUTH" \
  "https://cloud.langfuse.com/api/public/traces?limit=1"

# Test metrics endpoint with query param
curl -H "Authorization: Basic $AUTH" \
  "https://cloud.langfuse.com/api/public/metrics?query=%7B%22view%22:%22traces%22%7D"
```

### 3. Inspect Type Errors

```bash
npm run build 2>&1 | tee build.log
# Check for TypeScript compilation errors
```

### 4. Test Individual Tool

Create a test file:
```typescript
// test-one-tool.ts
import { getProjectConfig } from './src/config.js';
import { LangfuseAnalyticsClient } from './src/langfuse-client.js';
import { toolName, toolNameSchema } from './src/tools/tool-name.js';

const config = getProjectConfig();
const client = new LangfuseAnalyticsClient(config);

const result = await toolName(client, {
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  to: new Date().toISOString(),
});

console.log(JSON.parse(result.content[0].text));
```

Build and run:
```bash
npx tsx test-one-tool.ts
```

---

## Common Issues & Solutions

### Issue: 401 Unauthorized

**Cause**: Invalid API keys in `.env`

**Solution**:
1. Verify `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are correct
2. Check format: `pk-lf-*` and `sk-lf-*`
3. Verify keys belong to same project
4. Test: `curl -u "pk:sk" https://url/api/public/health`

### Issue: 404 Not Found

**Cause**: Wrong base URL or endpoint path

**Solution**:
1. Check `LANGFUSE_BASEURL` in `.env`
2. Verify endpoint exists: https://langfuse.com/docs/api-and-data-platform
3. Test: `curl -H "Auth" https://url/api/public/traces?limit=1`

### Issue: Tool Returns Zero Values

**Cause**: API response field name mismatch

**Solution**:
1. Log API response: `console.error(JSON.stringify(response))`
2. Check actual field names in response
3. Update tool to use correct field name
4. Example: `totalCost_sum` not `totalCost`

### Issue: High Memory Usage

**Cause**: Large result sets not paginated

**Solution**:
1. Reduce `limit` parameter (max 100)
2. Use time windows (shorter date ranges)
3. Add filtering (by userId, tags, etc.)
4. See `get_observations.ts` for truncation example

### Issue: Tool Timeout

**Cause**: Large dataset or slow network

**Solution**:
1. Set `LANGFUSE_TIMEOUT` to higher value
2. Reduce query scope (smaller date range)
3. Add pagination
4. Check Langfuse API status

---

## Release & Deployment

### Publishing to NPM

```bash
# Update version in package.json
npm version patch  # or minor, major

# Build
npm run build

# Test
npm run test

# Publish
npm publish

# Verify
npm info langfuse-mcp

# Install globally
npm install -g langfuse-mcp
```

### Using in Claude Desktop

1. Build locally:
```bash
npm run build
```

2. Update `~/.config/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "langfuse": {
      "command": "node",
      "args": ["/path/to/langfuse-mcp/build/index.js"],
      "env": {
        "LANGFUSE_PUBLIC_KEY": "pk-lf-...",
        "LANGFUSE_SECRET_KEY": "sk-lf-...",
        "LANGFUSE_BASEURL": "https://cloud.langfuse.com"
      }
    }
  }
}
```

3. Restart Claude Desktop

---

## Testing Checklist

Before committing:
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes
- [ ] Tool validates inputs with Zod
- [ ] Tool handles errors gracefully
- [ ] No console.log (use console.error for debug)
- [ ] Types updated in `types.ts`
- [ ] Documentation updated in README.md

---

## Useful Resources

- **Langfuse Docs**: https://langfuse.com/docs
- **Langfuse API**: https://langfuse.com/docs/api-and-data-platform
- **MCP Spec**: https://modelcontextprotocol.io
- **Zod Docs**: https://zod.dev
- **TypeScript**: https://www.typescriptlang.org

---

## Questions & Support

Refer to `ARCHITECTURE.md` for:
- Design decisions
- API integration patterns
- Configuration strategies
- Adding new tools/APIs

Refer to `README.md` for:
- User-facing documentation
- Installation
- Usage examples
- Configuration

Refer to `IMPLEMENTATION_NOTES.md` for:
- Known limitations
- Performance considerations
- Troubleshooting
