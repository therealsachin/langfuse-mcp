import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const getDatasetSchema = z.object({
  datasetName: z.string().min(1).describe('Name of the dataset to retrieve'),
});

export type GetDatasetArgs = z.infer<typeof getDatasetSchema>;

export async function getDataset(
  client: LangfuseAnalyticsClient,
  args: GetDatasetArgs
) {
  try {
    const data = await client.getDataset(args.datasetName);
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