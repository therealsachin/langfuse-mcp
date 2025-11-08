import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { TracesResponse } from '../types.js';

export const getTracesSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(25),
  page: z.number().min(1).default(1),
  orderBy: z.enum(['timestamp', 'totalCost', 'name']).default('timestamp'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
  userId: z.string().optional(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  environment: z.string().optional(),
  minCost: z.number().optional(),
  maxCost: z.number().optional(),
});

export async function getTraces(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof getTracesSchema>
) {
  // Build tags array with environment and other filters
  const tags: string[] = [];
  if (args.environment) {
    tags.push(`environment:${args.environment}`);
  }
  if (args.tags) {
    tags.push(...args.tags);
  }

  try {
    const response = await client.listTraces({
      page: args.page,
      limit: args.limit,
      name: args.name,
      userId: args.userId,
      tags: tags.length > 0 ? tags : undefined,
      orderBy: args.orderBy,
      orderDirection: args.orderDirection,
      fromTimestamp: args.from,
      toTimestamp: args.to,
    });

  let traces = [];
  if (response.data && Array.isArray(response.data)) {
    traces = response.data.map((trace: any) => ({
      id: trace.id,
      name: trace.name || 'Unnamed trace',
      timestamp: trace.timestamp || trace.startTime,
      totalCost: trace.totalCost || 0,
      totalTokens: trace.totalTokens || 0,
      userId: trace.userId,
      tags: trace.tags || [],
      metadata: trace.metadata,
      sessionId: trace.sessionId,
      version: trace.version,
      release: trace.release,
    }));

    // Apply cost filters if specified
    if (args.minCost !== undefined) {
      traces = traces.filter((trace: any) => trace.totalCost >= args.minCost!);
    }
    if (args.maxCost !== undefined) {
      traces = traces.filter((trace: any) => trace.totalCost <= args.maxCost!);
    }

    // Apply ordering (API might handle this, but ensure local sorting)
    traces.sort((a: any, b: any) => {
      let comparison = 0;
      switch (args.orderBy) {
        case 'timestamp':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'totalCost':
          comparison = (a.totalCost || 0) - (b.totalCost || 0);
          break;
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
      }
      return args.orderDirection === 'desc' ? -comparison : comparison;
    });
  }

    const result: TracesResponse = {
      projectId: client.getProjectId(),
      traces,
      pagination: {
        page: args.page,
        limit: args.limit,
        total: response.meta?.totalItems || traces.length,
      },
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    // Return error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Failed to fetch traces',
            message: errorMessage,
            requestParams: {
              from: args.from,
              to: args.to,
              name: args.name,
              limit: args.limit,
              orderBy: args.orderBy,
            },
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}