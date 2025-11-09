export interface LangfuseProjectConfig {
  id: string;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
}

export interface ProjectOverview {
  projectId: string;
  from: string;
  to: string;
  totalCostUsd: number;
  totalTokens: number;
  totalTraces: number;
  byEnvironment?: Array<{
    environment: string;
    cost: number;
    tokens: number;
    traces: number;
  }>;
}

export interface ModelUsage {
  model: string;
  totalCost: number;
  totalTokens: number;
  observationCount: number;
}

export interface ServiceUsage {
  service: string;
  totalCost: number;
  totalTokens: number;
  traceCount: number;
}

export interface ExpensiveTrace {
  traceId: string;
  name: string;
  totalCost: number;
  totalTokens: number;
  timestamp: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface TraceDetail {
  traceId: string;
  name: string;
  totalCost: number;
  totalTokens: number;
  timestamp: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  observations: Array<{
    id: string;
    type: string;
    name: string;
    startTime: string;
    endTime?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: number;
  }>;
}

export interface MetricsResponse {
  projectId: string;
  from: string;
  to: string;
  view: 'traces' | 'observations';
  metrics: Array<{
    measure: string;
    aggregation: string;
    value: number;
  }>;
  dimensions?: Array<{
    field: string;
    value: string;
  }>;
}

export interface TracesResponse {
  projectId: string;
  traces: Array<{
    id: string;
    name: string;
    timestamp: string;
    totalCost?: number;
    totalTokens?: number;
    userId?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ObservationsResponse {
  projectId: string;
  observations: Array<{
    id: string;
    traceId: string;
    type: 'GENERATION' | 'SPAN' | 'EVENT';
    name: string;
    startTime: string;
    endTime?: string;
    model?: string;
    modelParameters?: Record<string, any>;
    input?: any;
    output?: any;
    usage?: {
      input?: number;
      output?: number;
      total?: number;
    };
    cost?: number;
    level: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface CostAnalysis {
  projectId: string;
  from: string;
  to: string;
  totalCost: number;
  breakdown: {
    byModel?: Array<{
      model: string;
      cost: number;
      tokens: number;
      observations: number;
      percentage: number;
    }>;
    byUser?: Array<{
      userId: string;
      cost: number;
      tokens: number;
      traces: number;
      percentage: number;
    }>;
    byDay?: Array<{
      date: string;
      cost: number;
      tokens: number;
      traces: number;
    }>;
  };
}

export interface DailyMetrics {
  projectId: string;
  from: string;
  to: string;
  dailyData: Array<{
    date: string;
    totalCost: number;
    totalTokens: number;
    totalTraces: number;
    totalObservations: number;
    avgCostPerTrace: number;
    avgTokensPerTrace: number;
  }>;
}

// Mode System Types for Read-Only/Read-Write MCP Server
export type ServerMode = 'readonly' | 'readwrite';

export interface ServerModeConfig {
  mode: ServerMode;
  allowedTools: Set<string>;
}

export interface WriteOperationRequest {
  confirmed?: boolean; // Optional confirmation for destructive operations
}

export interface AuditLogEntry {
  timestamp: string;
  toolName: string;
  args: Record<string, any>;
  userId?: string;
  result: 'success' | 'error';
  error?: string;
}