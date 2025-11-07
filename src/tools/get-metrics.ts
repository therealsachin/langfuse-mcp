import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { MetricsResponse } from '../types.js';

export const getMetricsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  view: z.enum(['traces', 'observations']).default('traces'),
  metrics: z.array(z.object({
    measure: z.string(),
    aggregation: z.string(),
  })).default([
    { measure: 'totalCost', aggregation: 'sum' },
    { measure: 'totalTokens', aggregation: 'sum' },
    { measure: 'count', aggregation: 'count' },
  ]),
  dimensions: z.array(z.object({
    field: z.string(),
  })).optional(),
  filters: z.array(z.object({
    column: z.string(),
    operator: z.string(),
    value: z.any(),
    type: z.string().optional(),
  })).optional(),
  environment: z.string().optional(),
});

export async function getMetrics(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof getMetricsSchema>
) {
  const filters: any[] = args.filters || [];

  // Add environment filter if specified
  if (args.environment) {
    filters.push({
      column: 'environment',
      operator: 'equals',
      value: args.environment,
      type: 'string',
    });
  }

  const response = await client.getMetrics({
    view: args.view,
    from: args.from,
    to: args.to,
    metrics: args.metrics,
    dimensions: args.dimensions,
    filters,
  });

  // Process the response into a structured format
  const metricsResult: MetricsResponse = {
    projectId: client.getProjectId(),
    from: args.from,
    to: args.to,
    view: args.view,
    metrics: [],
    dimensions: [],
  };

  // Parse metrics data from response
  if (response.data && Array.isArray(response.data)) {
    // Aggregate metrics across all rows
    const aggregatedMetrics: Record<string, number> = {};

    response.data.forEach((row: any) => {
      args.metrics.forEach(metric => {
        const key = `${metric.measure}_${metric.aggregation}`;
        // Metrics API returns aggregated field names like 'totalCost_sum', 'count_count'
        const aggregatedFieldName = `${metric.measure}_${metric.aggregation}`;
        if (row[aggregatedFieldName] !== undefined) {
          if (metric.aggregation === 'sum' || metric.aggregation === 'count') {
            aggregatedMetrics[key] = (aggregatedMetrics[key] || 0) + (row[aggregatedFieldName] || 0);
          } else if (metric.aggregation === 'avg') {
            // For average, we'll need to handle this differently
            aggregatedMetrics[key] = row[aggregatedFieldName] || 0;
          }
        }
      });
    });

    // Convert aggregated metrics to result format
    metricsResult.metrics = Object.entries(aggregatedMetrics).map(([key, value]) => {
      const [measure, aggregation] = key.split('_');
      return { measure, aggregation, value };
    });

    // Extract dimension data if present
    if (args.dimensions && response.data.length > 0) {
      const dimensions = new Set<string>();
      response.data.forEach((row: any) => {
        args.dimensions?.forEach(dim => {
          if (row[dim.field] !== undefined) {
            dimensions.add(`${dim.field}:${row[dim.field]}`);
          }
        });
      });

      metricsResult.dimensions = Array.from(dimensions).map(dimStr => {
        const [field, value] = dimStr.split(':');
        return { field, value };
      });
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(metricsResult, null, 2),
      },
    ],
  };
}