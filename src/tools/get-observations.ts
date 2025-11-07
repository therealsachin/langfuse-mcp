import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';
import { ObservationsResponse } from '../types.js';

export const getObservationsSchema = z.object({
  traceId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().min(1).max(50).default(10), // Reduced default limit
  page: z.number().min(1).default(1),
  type: z.enum(['GENERATION', 'SPAN', 'EVENT']).optional(),
  model: z.string().optional(),
  name: z.string().optional(),
  userId: z.string().optional(),
  level: z.enum(['DEBUG', 'DEFAULT', 'WARNING', 'ERROR']).optional(),
  minCost: z.number().optional(),
  maxCost: z.number().optional(),
  includeInputOutput: z.boolean().default(false), // New option to include full content
  truncateContent: z.number().min(100).max(2000).default(500), // Max chars for input/output
});

export async function getObservations(
  client: LangfuseAnalyticsClient,
  args: z.infer<typeof getObservationsSchema>
) {
  const response = await client.listObservations({
    fromStartTime: args.from,
    toStartTime: args.to,
    limit: args.limit,
    page: args.page,
    name: args.name,
    userId: args.userId,
    type: args.type,
    traceId: args.traceId,
    level: args.level,
  });

  let observations = response.data || [];

  // Helper function to truncate content
  const truncateContent = (content: any, maxLength: number): any => {
    if (!content) return content;
    if (typeof content === 'string') {
      return content.length > maxLength
        ? content.substring(0, maxLength) + '...[truncated]'
        : content;
    }
    if (typeof content === 'object') {
      const jsonStr = JSON.stringify(content);
      return jsonStr.length > maxLength
        ? jsonStr.substring(0, maxLength) + '...[truncated]'
        : content;
    }
    return content;
  };

  // Process and filter observations with content size control
  let processedObservations = observations.map((obs: any) => {
    const baseObs: any = {
      id: obs.id,
      traceId: obs.traceId,
      type: obs.type || 'SPAN',
      name: obs.name || 'Unnamed observation',
      startTime: obs.startTime,
      endTime: obs.endTime,
      model: obs.model,
      usage: {
        input: obs.usage?.input || obs.inputTokens,
        output: obs.usage?.output || obs.outputTokens,
        total: obs.usage?.total || obs.totalTokens,
      },
      cost: obs.calculatedTotalCost || obs.cost,
      level: obs.level || 'DEFAULT',
    };

    // Only include input/output if requested, and truncate if necessary
    if (args.includeInputOutput) {
      baseObs.input = truncateContent(obs.input, args.truncateContent);
      baseObs.output = truncateContent(obs.output, args.truncateContent);
      baseObs.modelParameters = obs.modelParameters;
    }

    return baseObs;
  });

  // Apply filters
  if (args.type) {
    processedObservations = processedObservations.filter((obs: any) => obs.type === args.type);
  }
  if (args.model) {
    processedObservations = processedObservations.filter((obs: any) =>
      obs.model && obs.model.toLowerCase().includes(args.model!.toLowerCase())
    );
  }
  if (args.name) {
    processedObservations = processedObservations.filter((obs: any) =>
      obs.name.toLowerCase().includes(args.name!.toLowerCase())
    );
  }
  if (args.level) {
    processedObservations = processedObservations.filter((obs: any) => obs.level === args.level);
  }
  if (args.minCost !== undefined) {
    processedObservations = processedObservations.filter((obs: any) =>
      (obs.cost || 0) >= args.minCost!
    );
  }
  if (args.maxCost !== undefined) {
    processedObservations = processedObservations.filter((obs: any) =>
      (obs.cost || 0) <= args.maxCost!
    );
  }

  // Apply pagination
  const startIndex = (args.page - 1) * args.limit;
  const paginatedObservations = processedObservations.slice(startIndex, startIndex + args.limit);

  const result: ObservationsResponse = {
    projectId: client.getProjectId(),
    observations: paginatedObservations,
    pagination: {
      page: args.page,
      limit: args.limit,
      total: processedObservations.length,
    },
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