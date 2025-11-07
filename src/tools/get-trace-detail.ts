import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { TraceDetail } from '../types.js';

export const getTraceDetailSchema = z.object({
  traceId: z.string(),
});

export async function getTraceDetail(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof getTraceDetailSchema>
) {
  try {
    const [traceResponse, observationsResponse] = await Promise.all([
      client.getTrace(args.traceId),
      client.listObservations({ traceId: args.traceId }),
    ]);

    const trace = traceResponse;
    const observations = observationsResponse.data || [];

    const detail: TraceDetail = {
      traceId: trace.id,
      name: trace.name || 'Unnamed trace',
      totalCost: trace.totalCost || 0,
      totalTokens: trace.totalTokens || 0,
      timestamp: trace.timestamp,
      userId: trace.userId,
      tags: trace.tags,
      metadata: trace.metadata,
      observations: observations.map((obs: any) => ({
        id: obs.id,
        type: obs.type,
        name: obs.name,
        startTime: obs.startTime,
        endTime: obs.endTime,
        model: obs.model,
        inputTokens: obs.usage?.input,
        outputTokens: obs.usage?.output,
        totalTokens: obs.usage?.total,
        cost: obs.calculatedTotalCost,
      })),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(detail, null, 2),
        },
      ],
    };
  } catch (error) {
    // Handle case where trace doesn't exist or API error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: `Failed to retrieve trace ${args.traceId}: ${errorMessage}`,
            traceId: args.traceId,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}