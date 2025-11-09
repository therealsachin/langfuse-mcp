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

  /**
   * Handles API errors securely by logging details server-side and returning generic client-side errors
   */
  private async handleApiError(response: Response, operation: string, url?: string): Promise<never> {
    const errorText = await response.text().catch(() => 'Unable to read error response');
    // Log detailed error information server-side for debugging
    console.error(`${operation} API error: ${response.status} ${response.statusText}${url ? `. URL: ${url}` : ''}. Response: ${errorText.substring(0, 200)}`);
    // Return generic error message to client to prevent information disclosure
    throw new Error(`Failed to ${operation.toLowerCase()}: API returned status ${response.status}`);
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
      await this.handleApiError(response, 'Metrics');
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
    orderDirection?: 'asc' | 'desc';
    fromTimestamp?: string;
    toTimestamp?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.name) queryParams.append('name', params.name);
    if (params.userId) queryParams.append('userId', params.userId);

    // Try using order_by parameter (snake_case) as seen in Python SDK examples
    if (params.orderBy) {
      const supportedOrderBy = ['timestamp', 'name', 'totalCost'];
      if (supportedOrderBy.includes(params.orderBy)) {
        // Try order_by with direction suffix (e.g., "totalCost DESC")
        const direction = params.orderDirection === 'asc' ? 'ASC' : 'DESC';
        const orderByValue = `${params.orderBy} ${direction}`;
        queryParams.append('order_by', orderByValue);
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
      await this.handleApiError(response, 'Traces', url);
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
      await this.handleApiError(response, 'Get Trace');
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
      await this.handleApiError(response, 'Observations');
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
      await this.handleApiError(response, 'Daily Metrics');
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
      await this.handleApiError(response, 'Get Observation');
    }

    return await response.json();
  }

  async getHealthStatus(): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/public/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Health Check');
    }

    return await response.json();
  }

  async listModels(params: {
    limit?: number;
    page?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.page) queryParams.append('page', params.page.toString());

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/models?${queryParams}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'List Models');
    }

    return await response.json();
  }

  async getModel(modelId: string): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/models/${modelId}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Get Model');
    }

    return await response.json();
  }

  async listPrompts(params: {
    limit?: number;
    page?: number;
    name?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.name) queryParams.append('name', params.name);

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/v2/prompts?${queryParams}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'List Prompts');
    }

    return await response.json();
  }

  async getPrompt(promptName: string, version?: number, label?: string): Promise<any> {
    const queryParams = new URLSearchParams();

    if (version !== undefined) queryParams.append('version', version.toString());
    if (label) queryParams.append('label', label);

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const url = `${this.config.baseUrl}/api/public/v2/prompts/${encodeURIComponent(promptName)}?${queryParams}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Get Prompt');
    }

    return await response.json();
  }

  // Dataset management methods
  async createDataset(params: {
    name: string;
    description?: string;
    metadata?: any;
  }): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/v2/datasets`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Create Dataset');
    }

    return await response.json();
  }

  async listDatasets(params: {
    page?: number;
    limit?: number;
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/v2/datasets?${queryParams}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'List Datasets');
    }

    return await response.json();
  }

  async getDataset(datasetName: string): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/v2/datasets/${encodeURIComponent(datasetName)}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Get Dataset');
    }

    return await response.json();
  }

  // Dataset item management methods
  async createDatasetItem(params: {
    datasetName: string;
    input?: any;
    expectedOutput?: any;
    metadata?: any;
    sourceTraceId?: string;
    sourceObservationId?: string;
    status?: 'ACTIVE' | 'ARCHIVED';
  }): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/dataset-items`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Create Dataset Item');
    }

    return await response.json();
  }

  async listDatasetItems(params: {
    datasetName?: string;
    sourceTraceId?: string;
    sourceObservationId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.datasetName) queryParams.append('datasetName', params.datasetName);
    if (params.sourceTraceId) queryParams.append('sourceTraceId', params.sourceTraceId);
    if (params.sourceObservationId) queryParams.append('sourceObservationId', params.sourceObservationId);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/dataset-items?${queryParams}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'List Dataset Items');
    }

    return await response.json();
  }

  async getDatasetItem(itemId: string): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/dataset-items/${encodeURIComponent(itemId)}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Get Dataset Item');
    }

    return await response.json();
  }

  async deleteDatasetItem(itemId: string): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/dataset-items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Delete Dataset Item');
    }

    return await response.json();
  }

  // Comment management methods
  async createComment(params: {
    objectType: 'trace' | 'observation' | 'session' | 'prompt';
    objectId: string;
    content: string;
    authorUserId?: string;
  }): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const requestBody = {
      ...params,
      projectId: this.config.id, // Add projectId to the request
    };

    const response = await fetch(`${this.config.baseUrl}/api/public/comments`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Create Comment');
    }

    return await response.json();
  }

  async listComments(params: {
    page?: number;
    limit?: number;
    objectType?: 'trace' | 'observation' | 'session' | 'prompt';
    objectId?: string;
    authorUserId?: string;
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.objectType) queryParams.append('objectType', params.objectType);
    if (params.objectId) queryParams.append('objectId', params.objectId);
    if (params.authorUserId) queryParams.append('authorUserId', params.authorUserId);

    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/comments?${queryParams}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'List Comments');
    }

    return await response.json();
  }

  async getComment(commentId: string): Promise<any> {
    const authHeader = 'Basic ' + Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/api/public/comments/${encodeURIComponent(commentId)}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Get Comment');
    }

    return await response.json();
  }

  async shutdown(): Promise<void> {
    await this.client.shutdownAsync();
  }
}