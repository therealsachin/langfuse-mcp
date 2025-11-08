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
  // Use daily metrics API which works correctly (same approach as get-cost-analysis)
  try {
    const dailyResponse = await client.getDailyMetrics({
      tags: args.environment ? [`environment:${args.environment}`] : undefined,
    });

    const modelMap = new Map<string, {
      totalCost: number;
      totalTokens: number;
      observationCount: number;
    }>();

    if (dailyResponse.data && Array.isArray(dailyResponse.data)) {
      // Filter by date range and aggregate model data
      const fromDate = new Date(args.from);
      const toDate = new Date(args.to);

      dailyResponse.data.forEach((day: any) => {
        const dayDate = new Date(day.date);
        if (dayDate >= fromDate && dayDate <= toDate) {
          // Process model usage from daily breakdown
          if (day.usage && Array.isArray(day.usage)) {
            day.usage.forEach((usage: any) => {
              const modelName = usage.model || 'unknown';
              const existing = modelMap.get(modelName) || {
                totalCost: 0,
                totalTokens: 0,
                observationCount: 0
              };

              modelMap.set(modelName, {
                totalCost: existing.totalCost + (usage.totalCost || 0),
                totalTokens: existing.totalTokens + (usage.totalUsage || usage.inputUsage + usage.outputUsage || 0),
                observationCount: existing.observationCount + (usage.countObservations || 0),
              });
            });
          }
        }
      });
    }

    // Convert map to array and sort by cost
    const modelUsages: ModelUsage[] = Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      totalCost: data.totalCost,
      totalTokens: data.totalTokens,
      observationCount: data.observationCount,
    }));

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
  } catch (error) {
    // Fallback to broken metrics API for debugging
    console.error('Error using daily metrics for usage by model:', error);

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

    console.log('DEBUG - Fallback metrics response:', JSON.stringify(response, null, 2));

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
              error: 'Used fallback metrics API due to daily metrics error',
            },
            null,
            2
          ),
        },
      ],
    };
  }
}