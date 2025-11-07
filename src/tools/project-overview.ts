import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { ProjectOverview } from '../types.js';

export const projectOverviewSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  environment: z.string().optional(),
});

export async function projectOverview(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof projectOverviewSchema>
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
    view: 'traces',
    from: args.from,
    to: args.to,
    metrics: [
      { measure: 'totalCost', aggregation: 'sum' },
      { measure: 'totalTokens', aggregation: 'sum' },
      { measure: 'count', aggregation: 'count' },
    ],
    dimensions: [{ field: 'environment' }],
    filters,
  });

  // Parse the response data
  const data = response.data || [];
  let totalCost = 0;
  let totalTokens = 0;
  let totalTraces = 0;
  const byEnvironment: Array<{
    environment: string;
    cost: number;
    tokens: number;
    traces: number;
  }> = [];

  // Sum up totals and extract environment breakdown - use correct aggregated field names
  if (Array.isArray(data)) {
    data.forEach((row: any) => {
      const cost = row.totalCost_sum || 0;
      const tokens = row.totalTokens_sum || 0;
      const traces = row.count_count || 0;

      totalCost += cost;
      totalTokens += tokens;
      totalTraces += traces;

      if (row.environment) {
        byEnvironment.push({
          environment: row.environment,
          cost,
          tokens,
          traces,
        });
      }
    });
  }

  const overview: ProjectOverview = {
    projectId: client.getProjectId(),
    from: args.from,
    to: args.to,
    totalCostUsd: totalCost,
    totalTokens: totalTokens,
    totalTraces: totalTraces,
    byEnvironment: byEnvironment.length > 0 ? byEnvironment : undefined,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(overview, null, 2),
      },
    ],
  };
}