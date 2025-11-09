import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const getCommentSchema = z.object({
  commentId: z.string({
    description: 'The unique identifier of the comment to retrieve'
  }),
});

export type GetCommentArgs = z.infer<typeof getCommentSchema>;

export async function getComment(
  client: LangfuseAnalyticsClient,
  args: GetCommentArgs
) {
  try {
    const data = await client.getComment(args.commentId);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text' as const, text: `Error getting comment: ${error.message}` }],
      isError: true,
    };
  }
}