import { LangfuseProjectConfig, ServerMode, ServerModeConfig } from './types.js';
import { getServerMode, getModeConfig } from './mode-config.js';

export function getProjectConfig(): LangfuseProjectConfig {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    throw new Error(
      'Missing required environment variables: LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY'
    );
  }

  // Extract project name from public key prefix or use a default
  const projectId = publicKey.split('-')[2]?.substring(0, 8) || 'default';

  return {
    id: projectId,
    baseUrl,
    publicKey,
    secretKey,
  };
}

/**
 * Get the current server mode configuration.
 * This is the primary function for initializing mode-aware MCP server behavior.
 */
export function getServerModeConfig(): ServerModeConfig {
  const mode = getServerMode();
  return getModeConfig(mode);
}

/**
 * Get just the server mode (for convenience).
 */
export function getCurrentServerMode(): ServerMode {
  return getServerMode();
}