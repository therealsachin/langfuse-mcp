import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const deleteDatasetItemSchema = z.object({
  itemId: z.string().min(1).describe('ID of the dataset item to delete'),
  confirmed: z.boolean().optional().describe('Set to true to confirm you want to permanently delete this item'),
});

export type DeleteDatasetItemArgs = z.infer<typeof deleteDatasetItemSchema>;

export async function deleteDatasetItem(
  client: LangfuseAnalyticsClient,
  args: DeleteDatasetItemArgs
) {
  try {
    const data = await client.deleteDatasetItem(args.itemId);
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