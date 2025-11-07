import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { ModelUsage } from '../types.js';

export const usageByModelSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  environment: z.string().optional(),
  limit: z.number().optional().default(20),
});

export async function usageByModel(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof usageByModelSchema>
) {
  const filters: any[] = [];

  if (args.environment) {
    filters.push({
      column: 'environment',
      operator: 'equals',
      value: args.environment,
      type: 'string',
    });
  }

  const response = await client.getMetrics({
    view: 'observations',
    from: args.from,
    to: args.to,
    metrics: [
      { measure: 'totalCost', aggregation: 'sum' },
      { measure: 'totalTokens', aggregation: 'sum' },
      { measure: 'count', aggregation: 'count' },
    ],
    dimensions: [{ field: 'providedModelName' }],
    filters,
  });

  const modelUsages: ModelUsage[] = [];

  // Parse the response data - use correct aggregated field names
  if (response.data && Array.isArray(response.data)) {
    response.data.forEach((row: any) => {
      modelUsages.push({
        model: row.providedModelName || 'unknown',
        totalCost: row.totalCost_sum || 0,
        totalTokens: row.totalTokens_sum || 0,
        observationCount: row.count_count || 0,
      });
    });
  }

  // Sort by cost descending and limit results
  const sortedModels = modelUsages
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, args.limit);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            projectId: client.getProjectId(),
            from: args.from,
            to: args.to,
            models: sortedModels,
          },
          null,
          2
        ),
      },
    ],
  };
}