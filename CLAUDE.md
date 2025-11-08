# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Langfuse MCP (Model Context Protocol) Server v1.1.0** that provides 18 comprehensive APIs for Langfuse analytics, cost monitoring, and management. It acts as a typed facade over the Langfuse public APIs, enabling integration with Claude Desktop and other MCP clients.

### Version 1.1.0 Features
- **18 Total Tools**: Complete analytics, system management, and monitoring capabilities
- **Enhanced Testing**: Dotenv integration with 13 comprehensive tests
- **System Management**: Health monitoring, model management, prompt operations
- **Comprehensive Documentation**: Organized docs/ folder with architecture guides

## Core Architecture

### MCP Server Structure
- **Entry Point**: `src/index.ts` - Contains the MCP server class with tool registry and request handlers
- **Client Wrapper**: `src/langfuse-client.ts` - HTTP client with Basic Auth for all Langfuse API calls
- **Tool System**: 18 individual tool files in `src/tools/` following consistent patterns
- **Configuration**: `src/config.ts` loads and validates environment variables
- **Types**: `src/types.ts` defines all TypeScript interfaces

### Tool Categories (18 Total)

1. **Core Analytics Tools** (6 tools):
   - list_projects, project_overview, usage_by_model, usage_by_service, top_expensive_traces, get_trace_detail

2. **Extended Analytics Tools** (6 tools):
   - get_projects, get_metrics, get_traces, get_observations, get_cost_analysis, get_daily_metrics

3. **System & Management Tools** (6 tools - New in v1.1.0):
   - get_observation_detail, get_health_status, list_models, get_model_detail, list_prompts, get_prompt_detail

### Data Flow Pattern
```
MCP Request → Zod Validation → Client API Call → Response Processing → MCP Response
```

## Development Commands

### Build and Test
```bash
npm run build          # Compile TypeScript
npm run watch          # Watch mode for development
npm run test           # Run comprehensive endpoint tests (requires .env)
npm run inspector      # Run MCP inspector for debugging
```

### Environment Setup
Create `.env` file with real Langfuse credentials for testing:
```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASEURL=https://us.cloud.langfuse.com
```

## Adding New MCP Tools

### 1. Create Tool File Pattern
Every tool follows this structure in `src/tools/`:
```typescript
import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const toolNameSchema = z.object({
  // Define parameters with descriptions
});

export type ToolNameArgs = z.infer<typeof toolNameSchema>;

export async function toolName(
  client: LangfuseAnalyticsClient,
  args: ToolNameArgs
) {
  try {
    const data = await client.apiMethod(args);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}
```

### 2. Add Client Method
Add corresponding method to `LangfuseAnalyticsClient` in `src/langfuse-client.ts`:
```typescript
async apiMethod(params: ParamsType): Promise<any> {
  const authHeader = 'Basic ' + Buffer.from(
    `${this.config.publicKey}:${this.config.secretKey}`
  ).toString('base64');

  const response = await fetch(`${this.config.baseUrl}/api/public/endpoint`, {
    headers: { 'Authorization': authHeader },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
```

### 3. Register in Main Server
Add to `src/index.ts`:
- Import the tool and schema
- Add tool definition to tools array
- Add case handler in CallToolRequestSchema handler

### 4. Add Test Coverage
Extend `test-endpoints.js` with test case following existing patterns:
- Current test suite has 13 comprehensive tests covering all critical functionality
- Tests use dotenv for secure credential management
- Include both success and failure scenarios
- Test against real Langfuse data for validation

## Key Architectural Decisions

### API Strategy
- **Single Project per Instance**: Each MCP server connects to one Langfuse project
- **Server-side Aggregation**: Use Langfuse's aggregation APIs rather than client-side calculations
- **Field Mapping**: Some APIs return aggregated fields like `totalCost_sum` instead of `totalCost`

### Error Handling
- **Layered Validation**: Zod schema validation + runtime error handling
- **MCP Error Flag**: Always return `isError: true` for failed requests
- **Descriptive Messages**: Include API status codes and response details

### Response Management
- **Content Truncation**: Large responses are truncated to avoid MCP limits
- **JSON Formatting**: All responses use `JSON.stringify(data, null, 2)`
- **Consistent Structure**: All tools return same response format

## Critical APIs and Endpoints

### Langfuse API Mapping

**Core Analytics APIs:**
- **Metrics**: `/api/public/metrics` (GET with query parameter) - Aggregated analytics
- **Daily Metrics**: `/api/public/metrics/daily` (GET) - Primary source for cost data
- **Traces**: `/api/public/traces` (GET with URL parameters) - Trace listing and filtering
- **Observations**: `/api/public/observations` (GET with URL parameters) - LLM generation data

**System Management APIs** (New in v1.1.0):
- **Observation Detail**: `/api/public/observations/{id}` (GET) - Individual observation details
- **Health Status**: `/api/public/health` (GET) - System health monitoring (no auth needed)
- **Models**: `/api/public/models` (GET) - AI model listing and configuration
- **Model Detail**: `/api/public/models/{id}` (GET) - Individual model details
- **Prompts**: `/api/public/prompts` (GET) - Prompt template listing with pagination
- **Prompt Detail**: `/api/public/prompts/{name}` (GET) - Individual prompt details with versioning

### Authentication
All API calls use HTTP Basic Auth:
```typescript
const authHeader = 'Basic ' + Buffer.from(
  `${publicKey}:${secretKey}`
).toString('base64');
```

## Testing and Validation

### Test Suite Structure
- **13 Comprehensive Tests**: Covers all critical MCP tool functionality
- **Real Data Validation**: Tests run against actual Langfuse instance using dotenv
- **Success Metrics**: High pass rate with real credentials (varies by data availability)
- **Conditional Testing**: Some tests skip gracefully if no data available (e.g., observations, models, prompts)

### Common Test Patterns
- Load data from API to get IDs for detail tests
- Validate response structure and data types
- Check for non-zero values where expected
- Handle graceful failures for missing data

## Known Limitations

### API Constraints
- **Prompts API**: May return errors if no prompts configured in Langfuse instance
- **Response Size**: Large observation responses can exceed MCP token limits
- **Rate Limiting**: No built-in rate limiting (relies on Langfuse limits)

### Current Scope
- **Single Project**: Cannot query multiple Langfuse projects simultaneously
- **Read-Only**: No write operations (create/update/delete)
- **No Caching**: All requests hit Langfuse APIs directly

## File Organization Principles

### Tool Files
- One file per MCP tool in `src/tools/`
- Export schema, type, and function with consistent naming
- Follow kebab-case for filenames matching tool names

### Client Methods
- One method per Langfuse API endpoint
- Descriptive error messages with status codes
- Consistent parameter and response handling

### Type Safety
- Zod schemas for all tool parameters
- TypeScript interfaces for all data structures
- Runtime validation at tool entry points

## Documentation Structure

The project includes comprehensive documentation in the `docs/` folder:

### Core Documentation Files
- **`docs/ARCHITECTURE.md`** (1,300+ lines): Complete system design, patterns, and implementation details
- **`docs/DEVELOPER_GUIDE.md`** (550+ lines): Step-by-step development workflows and common tasks
- **`docs/TECHNICAL_DIAGRAMS.md`** (500+ lines): Visual system flows and component diagrams
- **`docs/IMPLEMENTATION_NOTES.md`** (95 lines): API implementation details and known limitations
- **`docs/DOCUMENTATION_INDEX.md`** (340+ lines): Complete navigation guide for all documentation

### Documentation Usage
- **For Architecture Understanding**: Start with docs/ARCHITECTURE.md sections 1-3
- **For Development Tasks**: Use docs/DEVELOPER_GUIDE.md with hands-on examples
- **For Visual Understanding**: Reference docs/TECHNICAL_DIAGRAMS.md for component flows
- **For Navigation**: Use docs/DOCUMENTATION_INDEX.md as your primary guide

### Quick Reference
When working on this codebase, consult:
1. **Adding new tools**: docs/DEVELOPER_GUIDE.md Task 1 (complete working example)
2. **Understanding tool patterns**: docs/ARCHITECTURE.md Section 7 (implementation patterns)
3. **API integration**: docs/ARCHITECTURE.md Section 4 (Langfuse client design)
4. **Troubleshooting**: docs/DEVELOPER_GUIDE.md debugging section