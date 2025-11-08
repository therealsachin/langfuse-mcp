import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const createDatasetSchema = z.object({
  name: z.string().min(1).describe('Name of the dataset (required)'),
  description: z.string().optional().describe('Optional description of the dataset'),
  metadata: z.any().optional().describe('Optional metadata object for the dataset'),
});

export type CreateDatasetArgs = z.infer<typeof createDatasetSchema>;

export async function createDataset(
  client: LangfuseAnalyticsClient,
  args: CreateDatasetArgs
) {
  try {
    const data = await client.createDataset(args);
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