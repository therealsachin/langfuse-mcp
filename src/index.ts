#!/usr/bin/env node

// Parse command line arguments for mode selection
function parseCommandLineMode(): 'readonly' | 'readwrite' | null {
  const args = process.argv.slice(2);

  // Check for explicit mode flag: --mode=readonly or --mode=readwrite
  const modeFlag = args.find(arg => arg.startsWith('--mode='));
  if (modeFlag) {
    const mode = modeFlag.split('=')[1]?.toLowerCase();
    if (mode === 'readonly' || mode === 'readwrite') {
      return mode;
    }
  }

  // Check for readwrite flag: --readwrite
  if (args.includes('--readwrite') || args.includes('--rw')) {
    return 'readwrite';
  }

  // Check for readonly flag: --readonly or --ro (explicit readonly)
  if (args.includes('--readonly') || args.includes('--ro')) {
    return 'readonly';
  }

  // No explicit mode specified via CLI
  return null;
}

// Set mode based on CLI args, fallback to environment variables, default to readonly
const cliMode = parseCommandLineMode();
if (cliMode) {
  process.env.LANGFUSE_MCP_MODE = cliMode;
} else if (!process.env.LANGFUSE_MCP_MODE) {
  // Safe default: readonly mode if no explicit configuration
  process.env.LANGFUSE_MCP_MODE = 'readonly';
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getProjectConfig, getServerModeConfig, getCurrentServerMode } from './config.js';
import { LangfuseAnalyticsClient } from './langfuse-client.js';
import { ServerMode, ServerModeConfig } from './types.js';
import { isToolAllowed, isWriteTool, assertWriteEnabled, validateConfirmation } from './mode-config.js';
import { AuditLogger } from './audit-logger.js';

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
// Additional API tools
import { getObservationDetail, getObservationDetailSchema } from './tools/get-observation-detail.js';
import { getHealthStatus, getHealthStatusSchema } from './tools/get-health-status.js';
import { listModels, listModelsSchema } from './tools/list-models.js';
import { getModelDetail, getModelDetailSchema } from './tools/get-model-detail.js';
import { listPrompts, listPromptsSchema } from './tools/list-prompts.js';
import { getPromptDetail, getPromptDetailSchema } from './tools/get-prompt-detail.js';
// Dataset management tools
import { createDataset, createDatasetSchema } from './tools/create-dataset.js';
import { listDatasets, listDatasetsSchema } from './tools/list-datasets.js';
import { getDataset, getDatasetSchema } from './tools/get-dataset.js';
import { createDatasetItem, createDatasetItemSchema } from './tools/create-dataset-item.js';
import { listDatasetItems, listDatasetItemsSchema } from './tools/list-dataset-items.js';
import { getDatasetItem, getDatasetItemSchema } from './tools/get-dataset-item.js';
import { deleteDatasetItem, deleteDatasetItemSchema } from './tools/delete-dataset-item.js';
// Comment management tools
import { createComment, createCommentSchema } from './tools/create-comment.js';
import { listComments, listCommentsSchema } from './tools/list-comments.js';
import { getComment, getCommentSchema } from './tools/get-comment.js';

class LangfuseAnalyticsServer {
  private server: Server;
  private client: LangfuseAnalyticsClient;
  private mode: ServerMode;
  private modeConfig: ServerModeConfig;
  private auditLogger: AuditLogger;

  constructor() {
    // Initialize mode configuration
    this.mode = getCurrentServerMode();
    this.modeConfig = getServerModeConfig();
    this.auditLogger = AuditLogger.getInstance();

    this.server = new Server(
      {
        name: `langfuse-analytics-${this.mode}`,
        version: '1.4.0',
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

    // Log mode initialization
    this.logModeStartup();

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private logModeStartup(): void {
    console.error(`🔒 Langfuse MCP Server v1.4.0 - Running in ${this.mode.toUpperCase()} mode`);
    if (this.mode === 'readonly') {
      console.error('   ✅ Only read operations allowed. This is the safe default mode.');
      console.error('   💡 Set LANGFUSE_MCP_MODE=readwrite to enable write operations.');
    } else {
      console.error('   ⚠️  Write operations enabled - this can modify your Langfuse data.');
      console.error('   📝 All write operations will be logged for audit purposes.');
    }

    // Log to audit logger
    this.auditLogger.logModeInitialization(this.mode, this.modeConfig.allowedTools.size);
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
    // List tools handler - filter tools based on current mode
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [
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
        // Additional API tools
        {
          name: 'get_observation_detail',
          description: 'Get detailed information about a specific observation by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              observationId: {
                type: 'string',
                description: 'The observation ID to retrieve detailed information for',
              },
            },
            required: ['observationId'],
          },
        },
        {
          name: 'get_health_status',
          description: 'Get system health status and availability information.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_models',
          description: 'List all available AI models in the Langfuse project.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of models to return (default: 50)',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination',
              },
            },
          },
        },
        {
          name: 'get_model_detail',
          description: 'Get detailed information about a specific AI model.',
          inputSchema: {
            type: 'object',
            properties: {
              modelId: {
                type: 'string',
                description: 'The model ID to retrieve detailed information for',
              },
            },
            required: ['modelId'],
          },
        },
        {
          name: 'list_prompts',
          description: 'List all prompt templates in the Langfuse project.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of prompts to return (default: 50)',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination',
              },
              name: {
                type: 'string',
                description: 'Filter by prompt name (substring match)',
              },
            },
          },
        },
        {
          name: 'get_prompt_detail',
          description: 'Get detailed information about a specific prompt template.',
          inputSchema: {
            type: 'object',
            properties: {
              promptName: {
                type: 'string',
                description: 'The prompt name to retrieve',
              },
              version: {
                type: 'number',
                description: 'Specific version to retrieve (if not provided, gets latest)',
              },
              label: {
                type: 'string',
                description: 'Specific label to retrieve',
              },
            },
            required: ['promptName'],
          },
        },
        // Dataset management tools
        {
          name: 'create_dataset',
          description: 'Create a new dataset for organizing test data and examples.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the dataset (required)',
              },
              description: {
                type: 'string',
                description: 'Optional description of the dataset',
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata object for the dataset',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'list_datasets',
          description: 'List all datasets in the project with pagination support.',
          inputSchema: {
            type: 'object',
            properties: {
              page: {
                type: 'number',
                description: 'Page number for pagination (starts at 1)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of datasets to return (default: 50)',
              },
            },
          },
        },
        {
          name: 'get_dataset',
          description: 'Get detailed information about a specific dataset by name.',
          inputSchema: {
            type: 'object',
            properties: {
              datasetName: {
                type: 'string',
                description: 'Name of the dataset to retrieve',
              },
            },
            required: ['datasetName'],
          },
        },
        {
          name: 'create_dataset_item',
          description: 'Add a new item to a dataset with input/output examples.',
          inputSchema: {
            type: 'object',
            properties: {
              datasetName: {
                type: 'string',
                description: 'Name of the dataset to add the item to (required)',
              },
              input: {
                type: 'object',
                description: 'Input data for the dataset item',
              },
              expectedOutput: {
                type: 'object',
                description: 'Expected output for the dataset item',
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata object for the dataset item',
              },
              sourceTraceId: {
                type: 'string',
                description: 'Optional trace ID this dataset item is derived from',
              },
              sourceObservationId: {
                type: 'string',
                description: 'Optional observation ID this dataset item is derived from',
              },
              status: {
                type: 'string',
                enum: ['ACTIVE', 'ARCHIVED'],
                description: 'Status of the dataset item (default: ACTIVE)',
              },
            },
            required: ['datasetName'],
          },
        },
        {
          name: 'list_dataset_items',
          description: 'List items in datasets with filtering and pagination.',
          inputSchema: {
            type: 'object',
            properties: {
              datasetName: {
                type: 'string',
                description: 'Filter by dataset name',
              },
              sourceTraceId: {
                type: 'string',
                description: 'Filter by source trace ID',
              },
              sourceObservationId: {
                type: 'string',
                description: 'Filter by source observation ID',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (starts at 1)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of items to return (default: 50)',
              },
            },
          },
        },
        {
          name: 'get_dataset_item',
          description: 'Get detailed information about a specific dataset item.',
          inputSchema: {
            type: 'object',
            properties: {
              itemId: {
                type: 'string',
                description: 'ID of the dataset item to retrieve',
              },
            },
            required: ['itemId'],
          },
        },
        {
          name: 'delete_dataset_item',
          description: '⚠️ DESTRUCTIVE: Delete a dataset item permanently from the dataset.',
          inputSchema: {
            type: 'object',
            properties: {
              itemId: {
                type: 'string',
                description: 'ID of the dataset item to delete',
              },
              confirmed: {
                type: 'boolean',
                description: 'Set to true to confirm you want to permanently delete this item',
              },
            },
            required: ['itemId'],
          },
        },
        // Comment management tools
        {
          name: 'create_comment',
          description: 'Create a new comment on traces, observations, sessions, or prompts.',
          inputSchema: {
            type: 'object',
            properties: {
              objectType: {
                type: 'string',
                enum: ['trace', 'observation', 'session', 'prompt'],
                description: 'The type of object to comment on',
              },
              objectId: {
                type: 'string',
                description: 'The unique identifier of the object to comment on',
              },
              content: {
                type: 'string',
                description: 'The content/text of the comment',
              },
              authorUserId: {
                type: 'string',
                description: 'The user ID of the comment author (optional)',
              },
            },
            required: ['objectType', 'objectId', 'content'],
          },
        },
        {
          name: 'list_comments',
          description: 'List comments with filtering options for objects and users.',
          inputSchema: {
            type: 'object',
            properties: {
              page: {
                type: 'number',
                description: 'Page number for pagination (starts at 1)',
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 100,
                description: 'Maximum number of comments to return (max 100)',
              },
              objectType: {
                type: 'string',
                enum: ['trace', 'observation', 'session', 'prompt'],
                description: 'Filter comments by object type',
              },
              objectId: {
                type: 'string',
                description: 'Filter comments by specific object ID',
              },
              authorUserId: {
                type: 'string',
                description: 'Filter comments by author user ID',
              },
            },
          },
        },
        {
          name: 'get_comment',
          description: 'Get detailed information about a specific comment.',
          inputSchema: {
            type: 'object',
            properties: {
              commentId: {
                type: 'string',
                description: 'The unique identifier of the comment to retrieve',
              },
            },
            required: ['commentId'],
          },
        },
        // Write operations with clear prefixing (New in v1.4.0)
        {
          name: 'write_create_dataset',
          description: 'Create a new dataset for organizing test data and examples. This write operation will modify your Langfuse project.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the dataset',
              },
              description: {
                type: 'string',
                description: 'Description of the dataset',
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata for the dataset',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'write_create_dataset_item',
          description: 'Add an item to a dataset with input/output examples. This write operation will modify your Langfuse project.',
          inputSchema: {
            type: 'object',
            properties: {
              datasetName: {
                type: 'string',
                description: 'Name of the dataset to add the item to',
              },
              input: {
                description: 'Input data for the dataset item',
              },
              expectedOutput: {
                description: 'Expected output for the dataset item',
              },
              sourceTraceId: {
                type: 'string',
                description: 'Optional source trace ID to link this item',
              },
              sourceObservationId: {
                type: 'string',
                description: 'Optional source observation ID to link this item',
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata for the item',
              },
              status: {
                type: 'string',
                enum: ['ACTIVE', 'ARCHIVED'],
                description: 'Status of the dataset item',
              },
            },
            required: ['datasetName', 'input'],
          },
        },
        {
          name: 'write_delete_dataset_item',
          description: '⚠️ DESTRUCTIVE: Permanently delete a dataset item. This write operation cannot be undone.',
          inputSchema: {
            type: 'object',
            properties: {
              itemId: {
                type: 'string',
                description: 'The unique identifier of the dataset item to delete',
              },
              confirmed: {
                type: 'boolean',
                description: 'Set to true to confirm you want to permanently delete this item',
              },
            },
            required: ['itemId'],
          },
        },
        {
          name: 'write_create_comment',
          description: 'Create a comment on a trace, observation, session, or prompt. This write operation will modify your Langfuse project.',
          inputSchema: {
            type: 'object',
            properties: {
              objectType: {
                type: 'string',
                enum: ['trace', 'observation', 'session', 'prompt'],
                description: 'Type of object to comment on',
              },
              objectId: {
                type: 'string',
                description: 'ID of the object to comment on',
              },
              content: {
                type: 'string',
                description: 'Content of the comment',
              },
              authorUserId: {
                type: 'string',
                description: 'Optional author user ID (defaults to API key user)',
              },
            },
            required: ['objectType', 'objectId', 'content'],
          },
        },
      ];

      // Filter tools based on current mode
      const allowedTools = allTools.filter(tool =>
        isToolAllowed(tool.name, this.modeConfig)
      );

      // Add mode indicators to tool descriptions
      const enhancedTools = allowedTools.map(tool => {
        if (isWriteTool(tool.name) && this.mode === 'readwrite') {
          return {
            ...tool,
            description: `🔴 [WRITE] ${tool.description}`
          };
        }
        return tool;
      });

      console.error(`📊 Exposing ${enhancedTools.length}/${allTools.length} tools in ${this.mode} mode`);

      return { tools: enhancedTools };
    });

    // Call tool handler with mode validation
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      const toolName = request.params.name;

      try {
        // Runtime mode validation (defense in depth)
        if (!isToolAllowed(toolName, this.modeConfig)) {
          this.auditLogger.logPermissionDenied(toolName, this.mode);
          throw new Error(
            `Permission denied: "${toolName}" requires read-write mode. ` +
            `This server is running in ${this.mode} mode. ` +
            `Set LANGFUSE_MCP_MODE=readwrite to enable write operations.`
          );
        }

        // Log start of write operations
        if (isWriteTool(toolName)) {
          this.auditLogger.logOperationStart(toolName, request.params.arguments || {});
        }

        switch (toolName) {
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

          // Additional API tools
          case 'get_observation_detail': {
            const args = getObservationDetailSchema.parse(request.params.arguments);
            return await getObservationDetail(this.client, args);
          }

          case 'get_health_status': {
            const args = getHealthStatusSchema.parse(request.params.arguments);
            return await getHealthStatus(this.client, args);
          }

          case 'list_models': {
            const args = listModelsSchema.parse(request.params.arguments);
            return await listModels(this.client, args);
          }

          case 'get_model_detail': {
            const args = getModelDetailSchema.parse(request.params.arguments);
            return await getModelDetail(this.client, args);
          }

          case 'list_prompts': {
            const args = listPromptsSchema.parse(request.params.arguments);
            return await listPrompts(this.client, args);
          }

          case 'get_prompt_detail': {
            const args = getPromptDetailSchema.parse(request.params.arguments);
            return await getPromptDetail(this.client, args);
          }

          // Dataset management tools
          case 'create_dataset': {
            const args = createDatasetSchema.parse(request.params.arguments);
            return await createDataset(this.client, args);
          }

          case 'list_datasets': {
            const args = listDatasetsSchema.parse(request.params.arguments);
            return await listDatasets(this.client, args);
          }

          case 'get_dataset': {
            const args = getDatasetSchema.parse(request.params.arguments);
            return await getDataset(this.client, args);
          }

          case 'create_dataset_item': {
            const args = createDatasetItemSchema.parse(request.params.arguments);
            return await createDatasetItem(this.client, args);
          }

          case 'list_dataset_items': {
            const args = listDatasetItemsSchema.parse(request.params.arguments);
            return await listDatasetItems(this.client, args);
          }

          case 'get_dataset_item': {
            const args = getDatasetItemSchema.parse(request.params.arguments);
            return await getDatasetItem(this.client, args);
          }

          case 'delete_dataset_item': {
            const args = deleteDatasetItemSchema.parse(request.params.arguments);
            // Validate confirmation for destructive operation
            validateConfirmation(toolName, args.confirmed);
            return await deleteDatasetItem(this.client, args);
          }

          // Comment management tools
          case 'create_comment': {
            const args = createCommentSchema.parse(request.params.arguments);
            return await createComment(this.client, args);
          }

          case 'list_comments': {
            const args = listCommentsSchema.parse(request.params.arguments);
            return await listComments(this.client, args);
          }

          case 'get_comment': {
            const args = getCommentSchema.parse(request.params.arguments);
            return await getComment(this.client, args);
          }

          // New prefixed write tools (v1.4.0) - with enhanced validation
          case 'write_create_dataset': {
            const args = createDatasetSchema.parse(request.params.arguments);
            return await createDataset(this.client, args);
          }

          case 'write_create_dataset_item': {
            const args = createDatasetItemSchema.parse(request.params.arguments);
            return await createDatasetItem(this.client, args);
          }

          case 'write_delete_dataset_item': {
            const args = deleteDatasetItemSchema.parse(request.params.arguments);
            // Validate confirmation for destructive operation
            validateConfirmation(toolName, args.confirmed);
            return await deleteDatasetItem(this.client, args);
          }

          case 'write_create_comment': {
            const args = createCommentSchema.parse(request.params.arguments);
            return await createComment(this.client, args);
          }

          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        // Log successful write operations
        const duration = Date.now() - startTime;
        if (isWriteTool(toolName)) {
          // Note: We can't access the actual result here without changing the return flow
          // But we know it succeeded if we reach this point
          this.auditLogger.logOperationSuccess(toolName, request.params.arguments || {}, undefined, duration);
        }

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Log failed write operations
        if (isWriteTool(toolName)) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.auditLogger.logOperationError(toolName, request.params.arguments || {}, err, duration);
        }

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