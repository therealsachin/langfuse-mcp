import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const getDatasetItemSchema = z.object({
  itemId: z.string().min(1).describe('ID of the dataset item to retrieve'),
});

export type GetDatasetItemArgs = z.infer<typeof getDatasetItemSchema>;

export async function getDatasetItem(
  client: LangfuseAnalyticsClient,
  args: GetDatasetItemArgs
) {
  try {
    const data = await client.getDatasetItem(args.itemId);
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