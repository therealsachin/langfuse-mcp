#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getProjectConfig } from './config.js';
import { LangfuseAnalyticsClient } from './langfuse-client.js';

// Import tool handlers
import { listProjects, listProjectsSchema } from './tools/list-projects.js';
import { projectOverview, projectOverviewSchema } from './tools/project-overview.js';
import { usageByModel, usageByModelSchema } from './tools/usage-by-model.js';
import { usageByService, usageByServiceSchema } from './tools/usage-by-service.js';
import { topExpensiveTraces, topExpensiveTracesSchema } from './tools/top-expensive-traces.js';
import { getTraceDetail, getTraceDetailSchema } from './tools/get-trace-detail.js';
// New requested tools
import { getMetrics, getMetricsSchema } from './tools/get-metrics.js';
import { getTraces, getTracesSchema } from './tools/get-traces.js';
import { getObservations, getObservationsSchema } from './tools/get-observations.js';
import { getCostAnalysis, getCostAnalysisSchema } from './tools/get-cost-analysis.js';
import { getDailyMetrics, getDailyMetricsSchema } from './tools/get-daily-metrics.js';
import { getProjects, getProjectsSchema } from './tools/get-projects.js';

class LangfuseAnalyticsServer {
  private server: Server;
  private client: LangfuseAnalyticsClient;

  constructor() {
    this.server = new Server(
      {
        name: 'langfuse-analytics',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize Langfuse client
    const config = getProjectConfig();
    this.client = new LangfuseAnalyticsClient(config);

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.client.shutdown();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_projects',
          description: 'List configured Langfuse projects available to this MCP server.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'project_overview',
          description:
            'Get a summary of total cost, tokens, and traces for a project over a time window.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              environment: {
                type: 'string',
                description: 'Optional environment filter (e.g., "production", "staging")',
              },
            },
            required: ['from', 'to'],
          },
        },
        {
          name: 'usage_by_model',
          description:
            'Break down usage and cost by AI model over a time period.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              environment: {
                type: 'string',
                description: 'Optional environment filter',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of models to return (default: 20)',
              },
            },
            required: ['from', 'to'],
          },
        },
        {
          name: 'usage_by_service',
          description:
            'Analyze usage and cost by service/feature tag over a time period.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              serviceTagKey: {
                type: 'string',
                description: 'Tag key for service identification (default: "service")',
              },
              environment: {
                type: 'string',
                description: 'Optional environment filter',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of services to return (default: 20)',
              },
            },
            required: ['from', 'to'],
          },
        },
        {
          name: 'top_expensive_traces',
          description:
            'Find the most expensive traces by cost over a time period.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of traces to return (default: 10)',
              },
              environment: {
                type: 'string',
                description: 'Optional environment filter',
              },
            },
            required: ['from', 'to'],
          },
        },
        {
          name: 'get_trace_detail',
          description:
            'Get detailed information about a specific trace including all observations.',
          inputSchema: {
            type: 'object',
            properties: {
              traceId: {
                type: 'string',
                description: 'The trace ID to retrieve',
              },
            },
            required: ['traceId'],
          },
        },
        // New requested tools
        {
          name: 'get_projects',
          description: 'List available Langfuse projects (alias for list_projects).',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_metrics',
          description: 'Query aggregated metrics (costs, tokens, counts) with flexible filtering and dimensions.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              view: {
                type: 'string',
                enum: ['traces', 'observations'],
                description: 'Data view to query (default: traces)',
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    measure: { type: 'string' },
                    aggregation: { type: 'string' },
                  },
                },
                description: 'Metrics to aggregate',
              },
              dimensions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                  },
                },
                description: 'Dimensions to group by',
              },
              environment: {
                type: 'string',
                description: 'Optional environment filter',
              },
            },
            required: ['from', 'to'],
          },
        },
        {
          name: 'get_traces',
          description: 'Fetch traces with flexible filtering options.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 100,
                description: 'Maximum number of traces to return (default: 25)',
              },
              orderBy: {
                type: 'string',
                enum: ['timestamp', 'totalCost', 'totalTokens'],
                description: 'Field to order by (default: timestamp)',
              },
              orderDirection: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Order direction (default: desc)',
              },
              userId: {
                type: 'string',
                description: 'Filter by user ID',
              },
              name: {
                type: 'string',
                description: 'Filter by trace name (substring match)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              environment: {
                type: 'string',
                description: 'Filter by environment',
              },
              minCost: {
                type: 'number',
                description: 'Minimum cost filter',
              },
              maxCost: {
                type: 'number',
                description: 'Maximum cost filter',
              },
            },
          },
        },
        {
          name: 'get_observations',
          description: 'Get LLM generations/spans with details and filtering.',
          inputSchema: {
            type: 'object',
            properties: {
              traceId: {
                type: 'string',
                description: 'Filter by specific trace ID',
              },
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 100,
                description: 'Maximum number of observations to return (default: 25)',
              },
              type: {
                type: 'string',
                enum: ['GENERATION', 'SPAN', 'EVENT'],
                description: 'Filter by observation type',
              },
              model: {
                type: 'string',
                description: 'Filter by model name (substring match)',
              },
              name: {
                type: 'string',
                description: 'Filter by observation name (substring match)',
              },
              level: {
                type: 'string',
                enum: ['DEBUG', 'DEFAULT', 'WARNING', 'ERROR'],
                description: 'Filter by log level',
              },
            },
          },
        },
        {
          name: 'get_cost_analysis',
          description: 'Specialized cost breakdowns by model, user, and daily trends.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              environment: {
                type: 'string',
                description: 'Optional environment filter',
              },
              includeModelBreakdown: {
                type: 'boolean',
                description: 'Include breakdown by model (default: true)',
              },
              includeUserBreakdown: {
                type: 'boolean',
                description: 'Include breakdown by user (default: true)',
              },
              includeDailyBreakdown: {
                type: 'boolean',
                description: 'Include daily breakdown (default: true)',
              },
              limit: {
                type: 'number',
                minimum: 5,
                maximum: 100,
                description: 'Maximum items per breakdown (default: 20)',
              },
            },
            required: ['from', 'to'],
          },
        },
        {
          name: 'get_daily_metrics',
          description: 'Daily usage trends and patterns.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time',
                description: 'Start timestamp (ISO 8601)',
              },
              to: {
                type: 'string',
                format: 'date-time',
                description: 'End timestamp (ISO 8601)',
              },
              environment: {
                type: 'string',
                description: 'Optional environment filter',
              },
              fillMissingDays: {
                type: 'boolean',
                description: 'Fill missing days with zero values (default: true)',
              },
            },
            required: ['from', 'to'],
          },
        },
      ],
    }));

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'list_projects': {
            const args = listProjectsSchema.parse(request.params.arguments);
            return await listProjects(this.client);
          }

          case 'project_overview': {
            const args = projectOverviewSchema.parse(request.params.arguments);
            return await projectOverview(this.client, args);
          }

          case 'usage_by_model': {
            const args = usageByModelSchema.parse(request.params.arguments);
            return await usageByModel(this.client, args);
          }

          case 'usage_by_service': {
            const args = usageByServiceSchema.parse(request.params.arguments);
            return await usageByService(this.client, args);
          }

          case 'top_expensive_traces': {
            const args = topExpensiveTracesSchema.parse(request.params.arguments);
            return await topExpensiveTraces(this.client, args);
          }

          case 'get_trace_detail': {
            const args = getTraceDetailSchema.parse(request.params.arguments);
            return await getTraceDetail(this.client, args);
          }

          // New requested tools
          case 'get_projects': {
            const args = getProjectsSchema.parse(request.params.arguments);
            return await getProjects(this.client);
          }

          case 'get_metrics': {
            const args = getMetricsSchema.parse(request.params.arguments);
            return await getMetrics(this.client, args);
          }

          case 'get_traces': {
            const args = getTracesSchema.parse(request.params.arguments);
            return await getTraces(this.client, args);
          }

          case 'get_observations': {
            const args = getObservationsSchema.parse(request.params.arguments);
            return await getObservations(this.client, args);
          }

          case 'get_cost_analysis': {
            const args = getCostAnalysisSchema.parse(request.params.arguments);
            return await getCostAnalysis(this.client, args);
          }

          case 'get_daily_metrics': {
            const args = getDailyMetricsSchema.parse(request.params.arguments);
            return await getDailyMetrics(this.client, args);
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Langfuse Analytics MCP server running on stdio');
  }
}

const server = new LangfuseAnalyticsServer();
server.run().catch(console.error);