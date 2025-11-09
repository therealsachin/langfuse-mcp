import { AuditLogEntry } from './types.js';

/**
 * Audit logger for tracking write operations in the MCP server.
 * Logs all write operations to stderr for security and compliance.
 */
export class AuditLogger {
  private static instance: AuditLogger | null = null;

  /**
   * Get singleton instance of audit logger.
   */
  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log a write operation with structured format.
   */
  public logWriteOperation(
    toolName: string,
    args: Record<string, any>,
    result: 'success' | 'error',
    options: {
      userId?: string;
      error?: string;
      duration?: number;
    } = {}
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      toolName,
      args: this.sanitizeArgs(args),
      userId: options.userId,
      result,
      error: options.error,
    };

    // Format log entry for stderr
    const logMessage = this.formatLogEntry(entry, options.duration);

    // Write to stderr (not stdout to avoid interfering with MCP protocol)
    process.stderr.write(logMessage + '\n');
  }

  /**
   * Log the start of a write operation.
   */
  public logOperationStart(toolName: string, args: Record<string, any>): void {
    const logMessage = `[AUDIT] ${new Date().toISOString()} STARTING ${toolName} args=${JSON.stringify(this.sanitizeArgs(args))}`;
    process.stderr.write(logMessage + '\n');
  }

  /**
   * Log a successful write operation.
   */
  public logOperationSuccess(
    toolName: string,
    args: Record<string, any>,
    result?: any,
    duration?: number
  ): void {
    this.logWriteOperation(toolName, args, 'success', {
      duration,
    });

    // Log result summary if available
    if (result && typeof result === 'object') {
      const summary = this.extractResultSummary(toolName, result);
      if (summary) {
        process.stderr.write(`[AUDIT] ${new Date().toISOString()} RESULT ${toolName} ${summary}\n`);
      }
    }
  }

  /**
   * Log a failed write operation.
   */
  public logOperationError(
    toolName: string,
    args: Record<string, any>,
    error: Error | string,
    duration?: number
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    this.logWriteOperation(toolName, args, 'error', {
      error: errorMessage,
      duration,
    });
  }

  /**
   * Remove sensitive data from arguments before logging.
   */
  private sanitizeArgs(args: Record<string, any>): Record<string, any> {
    const sanitized = { ...args };

    // Remove sensitive fields
    const sensitiveFields = ['secretKey', 'password', 'token', 'apiKey'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Truncate large objects/strings
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];
      if (typeof value === 'string' && value.length > 200) {
        sanitized[key] = value.substring(0, 200) + '...[truncated]';
      } else if (typeof value === 'object' && value !== null) {
        const jsonStr = JSON.stringify(value);
        if (jsonStr.length > 300) {
          sanitized[key] = '[large object]';
        }
      }
    });

    return sanitized;
  }

  /**
   * Format audit log entry for structured logging.
   */
  private formatLogEntry(entry: AuditLogEntry, duration?: number): string {
    const parts = [
      '[AUDIT]',
      entry.timestamp,
      entry.result.toUpperCase(),
      entry.toolName,
    ];

    // Add key information
    if (entry.userId) {
      parts.push(`user=${entry.userId}`);
    }

    // Add args (concise format)
    const argsStr = JSON.stringify(entry.args);
    if (argsStr.length <= 100) {
      parts.push(`args=${argsStr}`);
    } else {
      const keys = Object.keys(entry.args);
      parts.push(`args={${keys.join(', ')}}`);
    }

    // Add duration if available
    if (duration !== undefined) {
      parts.push(`duration=${duration}ms`);
    }

    // Add error if present
    if (entry.error) {
      parts.push(`error="${entry.error}"`);
    }

    return parts.join(' ');
  }

  /**
   * Extract useful summary information from operation results.
   */
  private extractResultSummary(toolName: string, result: any): string | null {
    try {
      switch (toolName) {
        case 'write_create_dataset':
        case 'create_dataset':
          return result.id ? `created_id=${result.id}` : null;

        case 'write_create_dataset_item':
        case 'create_dataset_item':
          return result.id ? `created_item_id=${result.id}` : null;

        case 'write_delete_dataset_item':
        case 'delete_dataset_item':
          return 'deleted=true';

        case 'write_create_comment':
        case 'create_comment':
          return result.id ? `comment_id=${result.id}` : null;

        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Log server mode initialization.
   */
  public logModeInitialization(mode: string, toolCount: number): void {
    const logMessage = `[AUDIT] ${new Date().toISOString()} MODE_INIT mode=${mode} tools_exposed=${toolCount}`;
    process.stderr.write(logMessage + '\n');
  }

  /**
   * Log mode validation failures.
   */
  public logPermissionDenied(toolName: string, currentMode: string): void {
    const logMessage = `[AUDIT] ${new Date().toISOString()} PERMISSION_DENIED tool=${toolName} mode=${currentMode}`;
    process.stderr.write(logMessage + '\n');
  }

  /**
   * Log confirmation validation failures.
   */
  public logConfirmationRequired(toolName: string): void {
    const logMessage = `[AUDIT] ${new Date().toISOString()} CONFIRMATION_REQUIRED tool=${toolName}`;
    process.stderr.write(logMessage + '\n');
  }
}