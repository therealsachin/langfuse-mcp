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
  try {
    // Use the working getDailyMetrics API directly (same approach as cost_analysis)
    const dailyResponse = await client.getDailyMetrics({
      tags: args.environment ? [`environment:${args.environment}`] : undefined,
    });

    const dailyData: any[] = [];

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
        // Calculate total tokens from usage breakdown
        let totalTokens = 0;
        let totalObservations = 0;
        if (day.usage && Array.isArray(day.usage)) {
          totalTokens = day.usage.reduce((sum: number, usage: any) => {
            return sum + (usage.totalUsage || usage.inputUsage + usage.outputUsage || 0);
          }, 0);
          totalObservations = day.usage.reduce((sum: number, usage: any) => {
            return sum + (usage.countObservations || 0);
          }, 0);
        }

        dailyData.push({
          date: day.date,
          totalCost: day.totalCost || 0,
          totalTokens: totalTokens,
          totalTraces: day.countTraces || 0,
          totalObservations: totalObservations || day.countObservations || 0,
          avgCostPerTrace: (day.countTraces || 0) > 0
            ? Math.round(((day.totalCost || 0) / (day.countTraces || 0)) * 10000) / 10000
            : 0,
          avgTokensPerTrace: (day.countTraces || 0) > 0
            ? Math.round((totalTokens / (day.countTraces || 0)) * 100) / 100
            : 0,
        });
      });

      // Fill in missing days if requested
      if (args.fillMissingDays) {
        const startDate = new Date(args.from);
        const endDate = new Date(args.to);
        const dataMap = new Map(dailyData.map(d => [d.date, d]));

        dailyData.length = 0; // Clear array

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const dateStr = date.toISOString().split('T')[0];
          const existingData = dataMap.get(dateStr);

          if (existingData) {
            dailyData.push(existingData);
          } else {
            // Fill missing day with zeros
            dailyData.push({
              date: dateStr,
              totalCost: 0,
              totalTokens: 0,
              totalTraces: 0,
              totalObservations: 0,
              avgCostPerTrace: 0,
              avgTokensPerTrace: 0,
            });
          }
        }
      }

      // Sort by date
      dailyData.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Return the successful result
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
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Failed to get daily metrics',
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