import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { DailyMetrics } from '../types.js';

export const getDailyMetricsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  environment: z.string().optional(),
  fillMissingDays: z.boolean().default(true),
});

export async function getDailyMetrics(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof getDailyMetricsSchema>
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

  // Get trace metrics grouped by day
  const traceResponse = await client.getMetrics({
    view: 'traces',
    from: args.from,
    to: args.to,
    metrics: [
      { measure: 'totalCost', aggregation: 'sum' },
      { measure: 'totalTokens', aggregation: 'sum' },
      { measure: 'count', aggregation: 'count' },
    ],
    dimensions: [{ field: 'timestamp' }],
    filters,
  });

  // Get observation metrics for total observations count
  const observationResponse = await client.getMetrics({
    view: 'observations',
    from: args.from,
    to: args.to,
    metrics: [{ measure: 'count', aggregation: 'count' }],
    dimensions: [{ field: 'timestamp' }],
    filters,
  });

  // Process data by day
  const dailyDataMap = new Map<string, {
    totalCost: number;
    totalTokens: number;
    totalTraces: number;
    totalObservations: number;
  }>();

  // Process trace data
  if (traceResponse.data && Array.isArray(traceResponse.data)) {
    traceResponse.data.forEach((row: any) => {
      if (row.timestamp) {
        const date = new Date(row.timestamp).toISOString().split('T')[0];
        const existing = dailyDataMap.get(date) || {
          totalCost: 0,
          totalTokens: 0,
          totalTraces: 0,
          totalObservations: 0,
        };

        dailyDataMap.set(date, {
          ...existing,
          totalCost: existing.totalCost + (row.totalCost_sum || 0),
          totalTokens: existing.totalTokens + (row.totalTokens_sum || 0),
          totalTraces: existing.totalTraces + (row.count_count || 0),
        });
      }
    });
  }

  // Process observation data
  if (observationResponse.data && Array.isArray(observationResponse.data)) {
    observationResponse.data.forEach((row: any) => {
      if (row.timestamp) {
        const date = new Date(row.timestamp).toISOString().split('T')[0];
        const existing = dailyDataMap.get(date) || {
          totalCost: 0,
          totalTokens: 0,
          totalTraces: 0,
          totalObservations: 0,
        };

        dailyDataMap.set(date, {
          ...existing,
          totalObservations: existing.totalObservations + (row.count_count || 0),
        });
      }
    });
  }

  // Generate daily data array
  const dailyData = [];

  if (args.fillMissingDays) {
    // Fill in missing days with zero values
    const startDate = new Date(args.from);
    const endDate = new Date(args.to);

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const data = dailyDataMap.get(dateStr) || {
        totalCost: 0,
        totalTokens: 0,
        totalTraces: 0,
        totalObservations: 0,
      };

      dailyData.push({
        date: dateStr,
        totalCost: data.totalCost,
        totalTokens: data.totalTokens,
        totalTraces: data.totalTraces,
        totalObservations: data.totalObservations,
        avgCostPerTrace: data.totalTraces > 0
          ? Math.round((data.totalCost / data.totalTraces) * 10000) / 10000
          : 0,
        avgTokensPerTrace: data.totalTraces > 0
          ? Math.round((data.totalTokens / data.totalTraces) * 100) / 100
          : 0,
      });
    }
  } else {
    // Only include days with actual data
    Array.from(dailyDataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, data]) => {
        dailyData.push({
          date,
          totalCost: data.totalCost,
          totalTokens: data.totalTokens,
          totalTraces: data.totalTraces,
          totalObservations: data.totalObservations,
          avgCostPerTrace: data.totalTraces > 0
            ? Math.round((data.totalCost / data.totalTraces) * 10000) / 10000
            : 0,
          avgTokensPerTrace: data.totalTraces > 0
            ? Math.round((data.totalTokens / data.totalTraces) * 100) / 100
            : 0,
        });
      });
  }

  const result: DailyMetrics = {
    projectId: client.getProjectId(),
    from: args.from,
    to: args.to,
    dailyData,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}