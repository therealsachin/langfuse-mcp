import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { CostAnalysis } from '../types.js';

export const getCostAnalysisSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  environment: z.string().optional(),
  includeModelBreakdown: z.boolean().default(true),
  includeUserBreakdown: z.boolean().default(true),
  includeDailyBreakdown: z.boolean().default(true),
  limit: z.number().min(5).max(100).default(20),
});

export async function getCostAnalysis(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof getCostAnalysisSchema>
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

  // Calculate total cost from daily data (which works correctly)
  let totalCost = 0;
  let dailyData: any[] = [];

  // Get daily data first since it's working correctly
  try {
    const dailyResponse = await client.getDailyMetrics({
      tags: args.environment ? [`environment:${args.environment}`] : undefined,
    });

    if (dailyResponse.data && Array.isArray(dailyResponse.data)) {
      // Filter by date range and calculate total
      const fromDate = new Date(args.from);
      const toDate = new Date(args.to);

      dailyData = dailyResponse.data.filter((day: any) => {
        const dayDate = new Date(day.date);
        return dayDate >= fromDate && dayDate <= toDate;
      });

      // Calculate total cost from working daily data
      totalCost = dailyData.reduce((sum: number, day: any) => {
        return sum + (day.totalCost || 0);
      }, 0);
    }
  } catch (error) {
    console.error('Error getting daily data for total calculation:', error);
  }

  const result: CostAnalysis = {
    projectId: client.getProjectId(),
    from: args.from,
    to: args.to,
    totalCost,
    breakdown: {},
  };

  // Model breakdown - extract from working daily data
  if (args.includeModelBreakdown) {
    try {
      const modelMap = new Map<string, {
        cost: number;
        tokens: number;
        observations: number;
      }>();

      // Aggregate model data from daily breakdown (which works correctly)
      dailyData.forEach((day: any) => {
        if (day.usage && Array.isArray(day.usage)) {
          day.usage.forEach((usage: any) => {
            const modelName = usage.model || 'unknown';
            const existing = modelMap.get(modelName) || { cost: 0, tokens: 0, observations: 0 };

            modelMap.set(modelName, {
              cost: existing.cost + (usage.totalCost || 0),
              tokens: existing.tokens + (usage.totalUsage || usage.inputUsage + usage.outputUsage || 0),
              observations: existing.observations + (usage.countObservations || 0),
            });
          });
        }
      });

      const modelBreakdown = Array.from(modelMap.entries()).map(([model, data]) => ({
        model,
        cost: data.cost,
        tokens: data.tokens,
        observations: data.observations,
        percentage: totalCost > 0 ? Math.round((data.cost / totalCost) * 100 * 100) / 100 : 0,
      }));

      result.breakdown.byModel = modelBreakdown
        .sort((a, b) => b.cost - a.cost)
        .slice(0, args.limit);
    } catch (error) {
      console.error('Error building model breakdown from daily data:', error);
      result.breakdown.byModel = [];
    }
  }

  // User breakdown
  if (args.includeUserBreakdown) {
    try {
      const userResponse = await client.getMetrics({
        view: 'traces',
        from: args.from,
        to: args.to,
        metrics: [
          { measure: 'totalCost', aggregation: 'sum' },
          { measure: 'totalTokens', aggregation: 'sum' },
          { measure: 'count', aggregation: 'count' },
        ],
        dimensions: [{ field: 'userId' }],
        filters,
      });

      // DEBUG: Log the user response structure
      console.log('DEBUG - User Response:', JSON.stringify(userResponse, null, 2));

      const userBreakdown: Array<{
        userId: string;
        cost: number;
        tokens: number;
        traces: number;
        percentage: number;
      }> = [];
      if (userResponse.data && Array.isArray(userResponse.data)) {
        console.log('DEBUG - User response data length:', userResponse.data.length);
        userResponse.data.forEach((row: any, index: number) => {
          console.log(`DEBUG - User row ${index}:`, JSON.stringify(row, null, 2));
          if (row.userId) {
            // Use correct field names from metrics API response
            const cost = row.totalCost_sum || 0;
            console.log(`DEBUG - User ${row.userId} cost: ${cost} (from totalCost_sum: ${row.totalCost_sum})`);
            userBreakdown.push({
              userId: row.userId,
              cost,
              tokens: row.totalTokens_sum || 0,
              traces: row.count_count || 0,
              percentage: totalCost > 0 ? Math.round((cost / totalCost) * 100 * 100) / 100 : 0,
            });
          }
        });
      } else {
        console.log('DEBUG - No user data or not an array:', userResponse.data);
      }

      result.breakdown.byUser = userBreakdown
        .sort((a, b) => b.cost - a.cost)
        .slice(0, args.limit);
    } catch (error) {
      console.error('Error fetching user breakdown:', error);
      result.breakdown.byUser = [];
    }
  }

  // Daily breakdown - reuse the daily data we already fetched
  if (args.includeDailyBreakdown) {
    try {
      const dailyBreakdown = dailyData.map((day: any) => {
        // Calculate total tokens from usage breakdown
        let totalTokens = 0;
        if (day.usage && Array.isArray(day.usage)) {
          totalTokens = day.usage.reduce((sum: number, usage: any) => {
            return sum + (usage.totalUsage || usage.inputUsage + usage.outputUsage || 0);
          }, 0);
        }

        return {
          date: day.date,
          cost: day.totalCost || 0,
          tokens: totalTokens,
          traces: day.countTraces || 0,
        };
      });

      result.breakdown.byDay = dailyBreakdown.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      console.error('Error building daily breakdown:', error);
      result.breakdown.byDay = [];
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}