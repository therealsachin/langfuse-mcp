import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const listDatasetItemsSchema = z.object({
  datasetName: z.string().optional().describe('Filter by dataset name'),
  sourceTraceId: z.string().optional().describe('Filter by source trace ID'),
  sourceObservationId: z.string().optional().describe('Filter by source observation ID'),
  page: z.number().min(1).optional().describe('Page number for pagination (starts at 1)'),
  limit: z.number().min(1).max(100).optional().describe('Maximum number of items to return (default: 50)'),
});

export type ListDatasetItemsArgs = z.infer<typeof listDatasetItemsSchema>;

export async function listDatasetItems(
  client: LangfuseAnalyticsClient,
  args: ListDatasetItemsArgs = {}
) {
  try {
    const data = await client.listDatasetItems(args);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}