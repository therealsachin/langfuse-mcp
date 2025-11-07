import { Langfuse } from 'langfuse';
import { LangfuseProjectConfig } from './types.js';

export class LangfuseAnalyticsClient {
  private client: Langfuse;
  private config: LangfuseProjectConfig;

  constructor(config: LangfuseProjectConfig) {
    this.config = config;
    this.client = new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
    });
  }

  getProjectId(): string {
    return this.config.id;
  }

  getConfig(): LangfuseProjectConfig {
    return { ...this.config }; // Return a copy to maintain encapsulation
  }

  async getMetrics(params: {
    view: 'traces' | 'observations';
    from: string;
    to: string;
    metrics: Array<{ measure: string; aggregation: string }>;
    dimensions?: Array<{ field: string }>;
    filters?: Array<any>;
  }): Promise<any> {
    // Use the actual Langfuse metrics API with GET method and query parameter
    const query = {
      view: params.view,
      fromTimestamp: params.from,
      toTimestamp: params.to,
      metrics: params.metrics,
      dimensions: params.dimensions || [],
      filters: params.filters || [],
    };

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const queryParam = encodeURIComponent(JSON.stringify(query));
    const response = await fetch(`${this.config.baseUrl}/api/public/metrics?query=${queryParam}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Metrics API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async listTraces(params: {
    page?: number;
    limit?: number;
    name?: string;
    userId?: string;
    tags?: string[];
    filter?: string; // JSON-encoded filter object for advanced filtering
    orderBy?: string;
    fromTimestamp?: string;
    toTimestamp?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.name) queryParams.append('name', params.name);
    if (params.userId) queryParams.append('userId', params.userId);

    // Only include orderBy if it's a supported value
    if (params.orderBy) {
      // Langfuse API might expect different orderBy format
      const supportedOrderBy = ['timestamp', 'name', 'totalCost'];
      if (supportedOrderBy.includes(params.orderBy)) {
        queryParams.append('orderBy', params.orderBy);
      }
    }

    if (params.fromTimestamp) queryParams.append('fromTimestamp', params.fromTimestamp);
    if (params.toTimestamp) queryParams.append('toTimestamp', params.toTimestamp);
    if (params.tags) {
      params.tags.forEach(tag => queryParams.append('tags', tag));
    }
    if (params.filter) {
      queryParams.append('filter', params.filter);
    }

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    // Add error logging to debug the issue
    const url = `${this.config.baseUrl}/api/public/traces?${queryParams}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      // Include more debugging information
      const errorText = await response.text();
      throw new Error(`Traces API error: ${response.status} ${response.statusText}. URL: ${url}. Response: ${errorText.substring(0, 200)}`);
    }

    return await response.json();
  }

  async getTrace(traceId: string): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/traces/${traceId}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Trace API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async listObservations(params: {
    fromStartTime?: string;
    toStartTime?: string;
    limit?: number;
    page?: number;
    name?: string;
    userId?: string;
    type?: string;
    traceId?: string;
    level?: string;
    environment?: string[];
  }): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.fromStartTime) queryParams.append('fromStartTime', params.fromStartTime);
    if (params.toStartTime) queryParams.append('toStartTime', params.toStartTime);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.name) queryParams.append('name', params.name);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.type) queryParams.append('type', params.type);
    if (params.traceId) queryParams.append('traceId', params.traceId);
    if (params.level) queryParams.append('level', params.level);
    if (params.environment) {
      params.environment.forEach(env => queryParams.append('environment', env));
    }

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/observations?${queryParams}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Observations API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getDailyMetrics(params: {
    traceName?: string;
    userId?: string;
    tags?: string[];
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.traceName) queryParams.append('traceName', params.traceName);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.tags) {
      params.tags.forEach(tag => queryParams.append('tags', tag));
    }

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/metrics/daily?${queryParams}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Daily Metrics API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getObservation(observationId: string): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/observations/${observationId}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Observation API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async shutdown(): Promise<void> {
    await this.client.shutdownAsync();
  }
}