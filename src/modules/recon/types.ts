export interface Endpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requestSchema?: object;
  responseSchema?: object;
  headers: Record<string, string>;
  authentication: 'OAUTH' | 'NONE' | 'COOKIE' | 'UNKNOWN';
}

export interface EndpointCatalog {
  endpoints: Endpoint[];
  lastUpdated: string;
  harFileHash?: string;
}

export interface AuthFlow {
  tokenUrl: string;
  method: string;
  requestBodyPattern?: object;
  tokenType?: string;
  headersObserved: Record<string, string>;
}
