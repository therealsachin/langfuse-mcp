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
  try {
    // Use the working daily metrics API (same approach as get-cost-analysis)
    const dailyResponse = await client.getDailyMetrics({
      tags: args.environment ? [`environment:${args.environment}`] : undefined,
    });

    let totalCost = 0;
    let totalTokens = 0;
    let totalTraces = 0;
    const byEnvironment = new Map<string, { cost: number; tokens: number; traces: number }>();

    if (dailyResponse.data && Array.isArray(dailyResponse.data)) {
      // Filter by date range
      const fromDate = new Date(args.from);
      const toDate = new Date(args.to);

      const filteredData = dailyResponse.data.filter((day: any) => {
        const dayDate = new Date(day.date);
        return dayDate >= fromDate && dayDate <= toDate;
      });

      // Process each day's data
      filteredData.forEach((day: any) => {
        const dayCost = day.totalCost || 0;
        const dayTraces = day.countTraces || 0;

        totalCost += dayCost;
        totalTraces += dayTraces;

        // Calculate tokens from usage breakdown
        if (day.usage && Array.isArray(day.usage)) {
          day.usage.forEach((usage: any) => {
            const usageTokens = usage.totalUsage || usage.inputUsage + usage.outputUsage || 0;
            totalTokens += usageTokens;
          });
        }
      });
    }

    const byEnvironmentArray: Array<{
      environment: string;
      cost: number;
      tokens: number;
      traces: number;
    }> = Array.from(byEnvironment.entries()).map(([env, data]) => ({
      environment: env,
      cost: data.cost,
      tokens: data.tokens,
      traces: data.traces,
    }));

    const overview: ProjectOverview = {
      projectId: client.getProjectId(),
      from: args.from,
      to: args.to,
      totalCostUsd: totalCost,
      totalTokens: totalTokens,
      totalTraces: totalTraces,
      byEnvironment: byEnvironmentArray.length > 0 ? byEnvironmentArray : undefined,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(overview, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Failed to get project overview',
            message: error instanceof Error ? error.message : 'Unknown error',
            projectId: client.getProjectId(),
            from: args.from,
            to: args.to,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}