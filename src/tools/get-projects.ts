import { z } from 'zod';
import { LangfuseAnalyticsClient } from '../langfuse-client.js';

// This is an alias for list_projects to match the requested tool name
export const getProjectsSchema = z.object({});

export async function getProjects(client: LangfuseAnalyticsClient) {
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