import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { ExpensiveTrace } from '../types.js';

export const topExpensiveTracesSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  limit: z.number().optional().default(10),
  environment: z.string().optional(),
});

export async function topExpensiveTraces(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof topExpensiveTracesSchema>
) {
  const tags = args.environment ? [`environment:${args.environment}`] : undefined;

  const response = await client.listTraces({
    fromTimestamp: args.from,
    toTimestamp: args.to,
    orderBy: 'totalCost',
    limit: args.limit,
    tags,
  });

  const traces: ExpensiveTrace[] = [];

  // Parse the response data - correct structure based on Langfuse API
  if (response.traces && Array.isArray(response.traces)) {
    response.traces
      .filter((trace: any) => (trace.totalCost || 0) > 0) // Only include traces with cost
      .sort((a: any, b: any) => (b.totalCost || 0) - (a.totalCost || 0)) // Sort by cost descending
      .slice(0, args.limit) // Limit results
      .forEach((trace: any) => {
        traces.push({
          traceId: trace.id,
          name: trace.name || 'Unnamed trace',
          totalCost: trace.totalCost || 0,
          totalTokens: trace.totalTokens || 0,
          timestamp: trace.timestamp || trace.startTime,
          userId: trace.userId,
          tags: trace.tags || [],
          metadata: trace.metadata,
        });
      });
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            projectId: client.getProjectId(),
            from: args.from,
            to: args.to,
            environment: args.environment,
            traces,
          },
          null,
          2
        ),
      },
    ],
  };
}