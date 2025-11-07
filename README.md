# Langfuse Analytics MCP Server

An MCP server for querying Langfuse analytics, cost metrics, and usage data across multiple projects.

## Features

- Multi-project support with environment-based configuration
- Cost and usage analytics by model, service, and environment
- Trace analysis and debugging tools
- Metrics API integration for aggregated analytics

## Installation

```bash
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

## Available Tools

### Core Tools (original)
1. **list_projects** - List all configured Langfuse projects
2. **project_overview** - Get cost, tokens, and trace summary for a project
3. **usage_by_model** - Break down usage and cost by AI model
4. **usage_by_service** - Analyze usage by service/feature tag
5. **top_expensive_traces** - Find the most expensive traces
6. **get_trace_detail** - Get detailed information about a specific trace

### Extended Tools (requested)
7. **get_projects** - Alias for list_projects (list available Langfuse projects)
8. **get_metrics** - Query aggregated metrics (costs, tokens, counts) with flexible filtering
9. **get_traces** - Fetch traces with comprehensive filtering options
10. **get_observations** - Get LLM generations/spans with details and filtering
11. **get_cost_analysis** - Specialized cost breakdowns by model/user/daily trends
12. **get_daily_metrics** - Daily usage trends and patterns with averages

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

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

- "Show me the cost overview for the last 7 days"
- "Which AI models are most expensive this month?"
- "Find the top 10 most expensive traces from yesterday"
- "Break down usage by service for the production environment"
- "Show me details for trace xyz-123"

## Development

```bash
# Watch mode for development
npm run watch

# Test with MCP Inspector
npm run inspector
```

## Project Structure

```
src/
├── index.ts              # Main server entry point
├── config.ts             # Project configuration loader
├── langfuse-client.ts    # Langfuse client wrapper
├── types.ts              # TypeScript type definitions
└── tools/
    ├── list-projects.ts
    ├── project-overview.ts
    ├── usage-by-model.ts
    ├── usage-by-service.ts
    ├── top-expensive-traces.ts
    └── get-trace-detail.ts
```

## API Integration

This server uses the Langfuse public API endpoints:
- `/api/public/metrics` - For aggregated analytics using GET with JSON query parameter
- `/api/public/metrics/daily` - For daily usage metrics and cost breakdowns
- `/api/public/traces` - For trace listing, filtering, and individual trace retrieval
- `/api/public/observations` - For detailed observation analysis and LLM generation metrics

**API Implementation Notes**:
- **Metrics API**: Uses GET method with URL-encoded JSON in the `query` parameter
- **Traces API**: Supports advanced filtering, pagination, and ordering
- **Observations API**: Provides detailed LLM generation and span data
- **Daily Metrics API**: Specialized endpoint for daily aggregated usage statistics

All authentication is handled server-side using Basic Auth with your Langfuse API keys.

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