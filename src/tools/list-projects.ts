import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

export const listProjectsSchema = z.object({});

export async function listProjects(client: LangfuseAnalyticsClient) {
  const projectId = client.getProjectId();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ projects: [projectId] }, null, 2),
      },
    ],
  };
}