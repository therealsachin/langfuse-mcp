import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const listDatasetsSchema = z.object({
  page: z.number().min(1).optional().describe('Page number for pagination (starts at 1)'),
  limit: z.number().min(1).max(100).optional().describe('Maximum number of datasets to return (default: 50)'),
});

export type ListDatasetsArgs = z.infer<typeof listDatasetsSchema>;

export async function listDatasets(
  client: LangfuseAnalyticsClient,
  args: ListDatasetsArgs = {}
) {
  try {
    const data = await client.listDatasets(args);
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