import { ServerMode, ServerModeConfig } from './types.js';

/**
 * Detects the server mode from environment variables.
 * Defaults to 'readonly' for security - users must explicitly opt into write mode.
 */
export function getServerMode(): ServerMode {
  const mode = process.env.LANGFUSE_MCP_MODE?.toLowerCase()?.trim();

  // Explicit readwrite modes
  if (mode === 'readwrite' || mode === 'rw' || mode === 'write') {
    return 'readwrite';
  }

  // Default to readonly for safety
  return 'readonly';
}

/**
 * Gets the configuration for the specified server mode.
 * Defines which tools are available in each mode.
 */
export function getModeConfig(mode: ServerMode): ServerModeConfig {
  // Read-only tools that never mutate data (21 tools)
  const readOnlyTools = new Set([
    // Core Analytics Tools (6)
    'list_projects',
    'project_overview',
    'usage_by_model',
    'usage_by_service',
    'top_expensive_traces',
    'get_trace_detail',

    // Extended Analytics Tools (6)
    'get_projects',
    'get_metrics',
    'get_traces',
    'get_observations',
    'get_cost_analysis',
    'get_daily_metrics',

    // System & Management Tools (6)
    'get_observation_detail',
    'get_health_status',
    'list_models',
    'get_model_detail',
    'list_prompts',
    'get_prompt_detail',

    // Dataset Read Operations (3)
    'list_datasets',
    'get_dataset',
    'list_dataset_items',
    'get_dataset_item',

    // Comment Read Operations (2)
    'list_comments',
    'get_comment',
  ]);

  // Write tools that can mutate data (7 tools with write_ prefix)
  const writeTools = new Set([
    // Dataset Write Operations (3)
    'write_create_dataset',
    'write_create_dataset_item',
    'write_delete_dataset_item', // destructive

    // Comment Write Operations (1)
    'write_create_comment',

    // Legacy tool names (for backward compatibility during transition)
    'create_dataset',
    'create_dataset_item',
    'delete_dataset_item',
    'create_comment',
  ]);

  // Start with read-only tools
  const allowedTools = new Set(readOnlyTools);

  // Add write tools in readwrite mode
  if (mode === 'readwrite') {
    writeTools.forEach(tool => allowedTools.add(tool));
  }

  return {
    mode,
    allowedTools,
  };
}

/**
 * Checks if a tool is allowed in the current mode.
 */
export function isToolAllowed(toolName: string, modeConfig: ServerModeConfig): boolean {
  return modeConfig.allowedTools.has(toolName);
}

/**
 * Checks if a tool is a write operation (for security validation).
 */
export function isWriteTool(toolName: string): boolean {
  // Tools with write_ prefix or legacy write tool names
  return toolName.startsWith('write_') ||
         ['create_dataset', 'create_dataset_item', 'delete_dataset_item', 'create_comment'].includes(toolName);
}

/**
 * Checks if a tool is destructive (requires confirmation).
 */
export function isDestructiveTool(toolName: string): boolean {
  return toolName === 'write_delete_dataset_item' || toolName === 'delete_dataset_item';
}

/**
 * Gets the prefixed tool name for write operations.
 */
export function getWriteToolName(legacyName: string): string {
  const writeMapping: Record<string, string> = {
    'create_dataset': 'write_create_dataset',
    'create_dataset_item': 'write_create_dataset_item',
    'delete_dataset_item': 'write_delete_dataset_item',
    'create_comment': 'write_create_comment',
  };

  return writeMapping[legacyName] || legacyName;
}

/**
 * Validates that write operations are allowed in the current mode.
 * Throws a descriptive error if the operation is not permitted.
 */
export function assertWriteEnabled(toolName: string, mode: ServerMode): void {
  if (isWriteTool(toolName) && mode === 'readonly') {
    throw new Error(
      `Permission denied: "${toolName}" requires read-write mode. ` +
      `This server is running in ${mode} mode. ` +
      `Set LANGFUSE_MCP_MODE=readwrite to enable write operations.`
    );
  }
}

/**
 * Validates confirmation for destructive operations.
 */
export function validateConfirmation(toolName: string, confirmed?: boolean): void {
  if (isDestructiveTool(toolName) && !confirmed) {
    throw new Error(
      `Confirmation required: "${toolName}" is a destructive operation. ` +
      `Add "confirmed": true to your request to proceed.`
    );
  }
}