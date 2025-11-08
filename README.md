# Langfuse MCP Server

**Version 1.1.0** - An MCP server for querying Langfuse analytics, cost metrics, and usage data across multiple projects.

## Features

- **18 Comprehensive Tools** - Complete analytics, system management, and monitoring capabilities
- **Multi-project Support** - Environment-based configuration with secure credential management
- **Cost & Usage Analytics** - Detailed breakdowns by model, service, environment, and time periods
- **Trace Analysis & Debugging** - Advanced filtering, search, and detailed trace inspection
- **System Management** - Health monitoring, model management, and prompt template operations
- **Metrics API Integration** - Server-side aggregation for optimal performance
- **Real-time Testing** - Comprehensive test suite with dotenv integration

## What's New in v1.1.0

✅ **6 New System Management Tools**:
- Observation detail retrieval with metadata
- Health status monitoring and system checks
- AI model listing and detailed model information
- Prompt template management with versioning

✅ **Enhanced Testing Infrastructure**:
- Dotenv integration for secure credential management
- 13 comprehensive tests against real Langfuse data
- Automated CI/CD ready testing pipeline

✅ **Improved Documentation**:
- Comprehensive docs/ folder with architecture guides
- Step-by-step developer workflows
- Visual technical diagrams and system flows

## Installation

### Option 1: Using npx (When Published)

```bash
# No installation needed - run directly with npx
npx langfuse-mcp
```

**Note:** Package is configured for npm publishing but not yet published. Use local development option below for now.

### Option 2: Local Development

```bash
git clone https://github.com/therealsachin/langfuse-mcp-server.git
cd langfuse-mcp
npm install
npm run build
```

## Configuration

Set environment variables for each Langfuse project:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASEURL=https://us.cloud.langfuse.com
```

## Available Tools (18 Total)

### Core Analytics Tools (6)
1. **list_projects** - List all configured Langfuse projects
2. **project_overview** - Get cost, tokens, and trace summary for a project
3. **usage_by_model** - Break down usage and cost by AI model
4. **usage_by_service** - Analyze usage by service/feature tag
5. **top_expensive_traces** - Find the most expensive traces
6. **get_trace_detail** - Get detailed information about a specific trace

### Extended Analytics Tools (6)
7. **get_projects** - Alias for list_projects (list available Langfuse projects)
8. **get_metrics** - Query aggregated metrics (costs, tokens, counts) with flexible filtering
9. **get_traces** - Fetch traces with comprehensive filtering options
10. **get_observations** - Get LLM generations/spans with details and filtering
11. **get_cost_analysis** - Specialized cost breakdowns by model/user/daily trends
12. **get_daily_metrics** - Daily usage trends and patterns with averages

### System & Management Tools (6)
13. **get_observation_detail** - Get detailed information about a specific observation/generation
14. **get_health_status** - Monitor Langfuse system health and status
15. **list_models** - List all AI models available in the project
16. **get_model_detail** - Get detailed information about a specific AI model
17. **list_prompts** - List all prompt templates with filtering and pagination
18. **get_prompt_detail** - Get detailed information about a specific prompt template

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

### Option 1: Using npx (When Published)

```json
{
  "mcpServers": {
    "langfuse-analytics": {
      "command": "npx",
      "args": ["langfuse-mcp"],
      "env": {
        "LANGFUSE_PUBLIC_KEY": "pk-lf-xxx",
        "LANGFUSE_SECRET_KEY": "sk-lf-xxx",
        "LANGFUSE_BASEURL": "https://us.cloud.langfuse.com"
      }
    }
  }
}
```

### Option 2: Local Installation

```json
{
  "mcpServers": {
    "langfuse-analytics": {
      "command": "node",
      "args": ["/path/to/langfuse-mcp/build/index.js"],
      "env": {
        "LANGFUSE_PUBLIC_KEY": "pk-lf-xxx",
        "LANGFUSE_SECRET_KEY": "sk-lf-xxx",
        "LANGFUSE_BASEURL": "https://us.cloud.langfuse.com"
      }
    }
  }
}
```

## Example Queries

Once integrated with Claude Desktop, you can ask questions like:

### Analytics Queries
- "Show me the cost overview for the last 7 days"
- "Which AI models are most expensive this month?"
- "Find the top 10 most expensive traces from yesterday"
- "Break down usage by service for the production environment"
- "Show me details for trace xyz-123"

### System Management Queries
- "Check the health status of my Langfuse system"
- "List all available AI models in my project"
- "Show me details for the GPT-4 model"
- "What prompt templates do I have available?"
- "Get details for the 'customer-support' prompt"

### Advanced Analysis
- "Show me detailed information for observation abc-123"
- "What's the daily cost trend for the last month?"
- "Find all traces that cost more than $0.10"
- "Which users are generating the highest costs?"

## Development

```bash
# Watch mode for development
npm run watch

# Test with MCP Inspector
npm run inspector

# Test endpoints (requires .env file)
npm run test
```

### Testing with Real Langfuse Data

For comprehensive testing against real Langfuse data, create a `.env` file in the project root:

```bash
# .env file (never commit this - it's in .gitignore)
LANGFUSE_PUBLIC_KEY=pk-lf-your-actual-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-actual-secret-key
LANGFUSE_BASEURL=https://us.cloud.langfuse.com
```

The test suite (`npm run test`) will automatically load these credentials using dotenv and run 13 comprehensive tests against your actual Langfuse project:

- ✅ Project overview with real cost/token data
- ✅ Trace retrieval with server-side sorting
- ✅ Top expensive traces analysis
- ✅ Daily metrics aggregation
- ✅ Cost analysis breakdowns
- ✅ Health status monitoring
- ✅ Model and prompt management
- ✅ Observation detail retrieval

**Note**: The `.env` file is automatically ignored by git to keep your credentials secure.

## Publishing to NPM

To make the package available via `npx langfuse-mcp`:

```bash
# Login to npm (first time only)
npm login

# Publish the package
npm publish

# Test global installation
npx langfuse-mcp
```

## Project Structure

```
src/
├── index.ts              # Main server entry point
├── config.ts             # Project configuration loader
├── langfuse-client.ts    # Langfuse client wrapper with 18+ API methods
├── types.ts              # TypeScript type definitions
└── tools/                # All 18 MCP tools
    # Core Analytics Tools (6)
    ├── list-projects.ts
    ├── project-overview.ts
    ├── usage-by-model.ts
    ├── usage-by-service.ts
    ├── top-expensive-traces.ts
    ├── get-trace-detail.ts
    # Extended Analytics Tools (6)
    ├── get-projects.ts          # Alias for list-projects
    ├── get-metrics.ts           # Aggregated metrics
    ├── get-traces.ts            # Trace filtering
    ├── get-observations.ts      # LLM generations
    ├── get-cost-analysis.ts     # Cost breakdowns
    ├── get-daily-metrics.ts     # Daily trends
    # System & Management Tools (6)
    ├── get-observation-detail.ts    # Observation details
    ├── get-health-status.ts         # Health monitoring
    ├── list-models.ts               # AI models listing
    ├── get-model-detail.ts          # Model details
    ├── list-prompts.ts              # Prompt templates
    └── get-prompt-detail.ts         # Prompt details

docs/                     # Comprehensive documentation
├── ARCHITECTURE.md       # System design and patterns
├── DEVELOPER_GUIDE.md    # Development workflows
├── TECHNICAL_DIAGRAMS.md # Visual system flows
├── IMPLEMENTATION_NOTES.md # API implementation details
└── DOCUMENTATION_INDEX.md # Navigation guide

test-endpoints.js         # Comprehensive test suite (13 tests)
```

## API Integration

This server integrates with multiple Langfuse public API endpoints:

### Core Analytics APIs
- `/api/public/metrics` - Aggregated analytics using GET with JSON query parameter
- `/api/public/metrics/daily` - Daily usage metrics and cost breakdowns
- `/api/public/traces` - Trace listing, filtering, and individual trace retrieval
- `/api/public/observations` - Detailed observation analysis and LLM generation metrics

### System Management APIs
- `/api/public/observations/{id}` - Individual observation details and metadata
- `/api/public/health` - System health status and monitoring
- `/api/public/models` - AI model listing and configuration
- `/api/public/prompts` - Prompt template management and versioning

**API Implementation Notes**:
- **Metrics API**: Uses GET method with URL-encoded JSON in the `query` parameter
- **Traces API**: Supports advanced filtering, pagination, and ordering
- **Observations API**: Provides detailed LLM generation and span data
- **Daily Metrics API**: Specialized endpoint for daily aggregated usage statistics
- **Health API**: Simple endpoint for system status monitoring
- **Models/Prompts APIs**: Support pagination, filtering, and detailed retrieval

All authentication is handled server-side using Basic Auth with your Langfuse API keys.

### Documentation

For detailed architecture, development guides, and technical diagrams, see the [comprehensive documentation](docs/):
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design, patterns, and implementation details
- **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** - Development workflows and common tasks
- **[docs/TECHNICAL_DIAGRAMS.md](docs/TECHNICAL_DIAGRAMS.md)** - Visual system flows and component diagrams
- **[docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)** - Complete navigation guide

## Troubleshooting

### ✅ Fixed: 405 Method Not Allowed Errors

**Previous Issue**: Earlier versions encountered "405 Method Not Allowed" errors due to incorrect API usage.

**Solution**: This has been **FIXED** in the current version by using the correct Langfuse API implementation:
- **Metrics API**: Now uses GET method with URL-encoded JSON `query` parameter (correct approach)
- **Traces API**: Uses the actual `/api/public/traces` endpoint with proper filtering
- **Observations API**: Uses `/api/public/observations` endpoint with correct parameters
- **Daily Metrics**: Uses specialized `/api/public/metrics/daily` endpoint

### ✅ Fixed: Cost Values Returning as Zero

**Previous Issue**: Cost analysis tools were returning zero values even when actual cost data existed.

**Solution**: This has been **FIXED** by correcting field name mapping in API response parsing:
- **Metrics API Response Structure**: The API returns aggregated field names like `totalCost_sum`, `count_count`, `totalTokens_sum`
- **Updated Field Access**: All tools now use correct aggregated field names instead of direct field names
- **Daily Metrics Integration**: Cost analysis now uses `getDailyMetrics` API for cleaner daily cost breakdowns
- **Affected Tools**: get-cost-analysis, get-metrics, usage-by-model, usage-by-service, project-overview, get-daily-metrics

### ✅ Fixed: Response Size and API Parameter Issues

**Previous Issues**:
1. `get_observations` returning responses exceeding MCP token limits (200k+ tokens)
2. `get_traces` returning 400 Bad Request errors

**Solutions Applied**:
- **get_observations Response Size Control**:
  - Added `includeInputOutput: false` parameter (default) to exclude large prompt/response content
  - Added `truncateContent: 500` parameter to limit content size when included
  - Reduced default limit from 25 to 10 observations
  - Content truncation for input/output fields when enabled
- **get_traces API Parameter Fixes**:
  - Added parameter validation for `orderBy` field
  - Enhanced error logging with full request details for debugging
  - Added proper error handling with detailed error responses

### ✅ Fixed: Cost Analysis Data Aggregation

**Previous Issue**: Cost analysis was showing zero values for total costs and model breakdowns while daily data worked correctly.

**Root Cause**: The Metrics API field mapping was still incorrect despite earlier fixes.

**Solution**: Switched to using the working Daily Metrics API data for all aggregations:
- **Total Cost Calculation**: Now sums from daily data instead of broken metrics API
- **Model Breakdown**: Extracts and aggregates model costs from daily usage data
- **Daily Breakdown**: Optimized to reuse already-fetched daily data
- **User Breakdown**: Still uses metrics API but with enhanced debugging

**Result**:
- ✅ `totalCost` now shows correct values (sum of daily costs)
- ✅ `byModel` now populated with real model cost breakdowns
- ✅ `byDay` continues to work perfectly
- 🔍 `byUser` includes debugging to identify any remaining field mapping issues

### ✅ Fixed: usage_by_model Showing Zero Costs/Tokens

**Previous Issue**: usage_by_model showed observation counts correctly but all costs and tokens as zero.

**Root Cause**: Same metrics API field mapping issue affecting cost calculations.

**Solution**: Applied the same daily metrics approach used in cost analysis:
- **Primary Method**: Uses `getDailyMetrics` API to aggregate model costs and tokens from daily usage breakdowns
- **Fallback Method**: Falls back to original metrics API with enhanced debugging if daily API fails
- **Data Aggregation**: Properly extracts `totalCost`, `totalUsage`, and `countObservations` from daily data

**Result**:
- ✅ Models now show real `totalCost` values instead of 0
- ✅ Models now show real `totalTokens` values instead of 0
- ✅ `observationCount` continues to work correctly

### Performance Considerations

**API Efficiency**: The server now uses native Langfuse endpoints efficiently:
- Metrics queries are processed server-side by Langfuse for optimal performance
- Trace and observation filtering happens at the API level to reduce data transfer
- Daily metrics use the specialized endpoint for pre-aggregated data

### Environment Variables

Make sure these environment variables are properly set:
```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx     # Your Langfuse public key
LANGFUSE_SECRET_KEY=sk-lf-xxx     # Your Langfuse secret key
LANGFUSE_BASEURL=https://us.cloud.langfuse.com  # Your Langfuse instance URL
```