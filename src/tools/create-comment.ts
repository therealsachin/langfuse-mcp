import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const createCommentSchema = z.object({
  objectType: z.enum(['trace', 'observation', 'session', 'prompt'], {
    description: 'The type of object to comment on'
  }),
  objectId: z.string({
    description: 'The unique identifier of the object to comment on'
  }),
  content: z.string({
    description: 'The content/text of the comment'
  }),
  authorUserId: z.string({
    description: 'The user ID of the comment author (optional, may be inferred from authentication)'
  }).optional(),
});

export type CreateCommentArgs = z.infer<typeof createCommentSchema>;

export async function createComment(
  client: LangfuseAnalyticsClient,
  args: CreateCommentArgs
) {
  try {
    const data = await client.createComment(args);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text' as const, text: `Error creating comment: ${error.message}` }],
      isError: true,
    };
  }
}