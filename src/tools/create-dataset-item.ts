import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const createDatasetItemSchema = z.object({
  datasetName: z.string().min(1).describe('Name of the dataset to add the item to (required)'),
  input: z.any().optional().describe('Input data for the dataset item'),
  expectedOutput: z.any().optional().describe('Expected output for the dataset item'),
  metadata: z.any().optional().describe('Optional metadata object for the dataset item'),
  sourceTraceId: z.string().optional().describe('Optional trace ID this dataset item is derived from'),
  sourceObservationId: z.string().optional().describe('Optional observation ID this dataset item is derived from'),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional().describe('Status of the dataset item (default: ACTIVE)'),
});

export type CreateDatasetItemArgs = z.infer<typeof createDatasetItemSchema>;

export async function createDatasetItem(
  client: LangfuseAnalyticsClient,
  args: CreateDatasetItemArgs
) {
  try {
    const data = await client.createDatasetItem(args);
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