import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { ServiceUsage } from '../types.js';

export const usageByServiceSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  serviceTagKey: z.string().default('service'),
  environment: z.string().optional(),
  limit: z.number().optional().default(20),
});

export async function usageByService(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof usageByServiceSchema>
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
    dimensions: [{ field: 'tags' }],
    filters,
  });

  // Post-process to extract service from tags
  const serviceMap = new Map<string, ServiceUsage>();

  if (response.data && Array.isArray(response.data)) {
    response.data.forEach((row: any) => {
      const tags = Array.isArray(row.tags) ? row.tags : [];

      // Find service tag
      const serviceTag = tags.find((tag: string) =>
        typeof tag === 'string' && tag.startsWith(`${args.serviceTagKey}:`)
      );

      if (serviceTag) {
        const service = serviceTag.split(':')[1];
        const existing = serviceMap.get(service) || {
          service,
          totalCost: 0,
          totalTokens: 0,
          traceCount: 0,
        };

        serviceMap.set(service, {
          service,
          totalCost: existing.totalCost + (row.totalCost_sum || 0),
          totalTokens: existing.totalTokens + (row.totalTokens_sum || 0),
          traceCount: existing.traceCount + (row.count_count || 0),
        });
      }
    });
  }

  const serviceUsages = Array.from(serviceMap.values())
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
            serviceTagKey: args.serviceTagKey,
            services: serviceUsages,
          },
          null,
          2
        ),
      },
    ],
  };
}