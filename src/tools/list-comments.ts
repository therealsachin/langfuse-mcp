import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const listCommentsSchema = z.object({
  page: z.number().int().positive().optional().describe('Page number for pagination (starts at 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of comments to return (max 100)'),
  objectType: z.enum(['trace', 'observation', 'session', 'prompt']).optional().describe('Filter comments by object type'),
  objectId: z.string().optional().describe('Filter comments by specific object ID'),
  authorUserId: z.string().optional().describe('Filter comments by author user ID'),
});

export type ListCommentsArgs = z.infer<typeof listCommentsSchema>;

export async function listComments(
  client: LangfuseAnalyticsClient,
  args: ListCommentsArgs
) {
  try {
    const data = await client.listComments(args);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text' as const, text: `Error listing comments: ${error.message}` }],
      isError: true,
    };
  }
}