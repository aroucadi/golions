import * as fs from 'fs';
import * as path from 'path';
import { HARParser } from './HARParser';
import { Endpoint, EndpointCatalog, AuthFlow } from './types';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class ReconEngine {
  private catalogPath: string;
  private catalog: EndpointCatalog | null = null;
  private authFlow: AuthFlow | null = null;

  constructor(customCatalogPath?: string) {
    this.catalogPath =
      customCatalogPath || path.join(__dirname, '..', '..', 'data', 'endpoints-catalog.json');
  }

  /**
   * Loads a HAR file, parses it, updates the catalog, and saves it to disk.
   */
  public async loadFromHAR(harPath: string): Promise<EndpointCatalog> {
    logger.info(`[ReconEngine] Loading and parsing HAR file from ${harPath}`);
    const { catalog, authFlow } = HARParser.parse(harPath);
    
    this.catalog = catalog;
    if (authFlow) {
      this.authFlow = authFlow;
    }

    // Ensure the data directory exists
    const dir = path.dirname(this.catalogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save to disk
    fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
    logger.info(`[ReconEngine] Successfully generated catalog at ${this.catalogPath}`);
    
    return catalog;
  }

  /**
   * Retrieves the current catalog, loading it from disk if not already cached in memory.
   */
  public getCatalog(): EndpointCatalog {
    if (this.catalog) return this.catalog;

    if (fs.existsSync(this.catalogPath)) {
      try {
        const content = fs.readFileSync(this.catalogPath, 'utf8');
        this.catalog = JSON.parse(content);
        return this.catalog!;
      } catch (error) {
        logger.error('[ReconEngine] Error reading catalog from disk:', error);
      }
    }

    return {
      endpoints: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Gets all search-related endpoints (like air-calendars, air-bounds, availability).
   */
  public getSearchEndpoints(): Endpoint[] {
    const cat = this.getCatalog();
    return cat.endpoints.filter(
      (ep) => ep.path.includes('search') || ep.path.includes('availability') || ep.path.includes('calendar')
    );
  }

  /**
   * Returns details on the observed authentication flow.
   */
  public getAuthFlow(): AuthFlow | null {
    if (this.authFlow) return this.authFlow;
    
    // Attempt to reconstruct it from the catalog POST /oauth2/token
    const cat = this.getCatalog();
    const tokenEp = cat.endpoints.find((ep) => ep.path.includes('/oauth2/token') && ep.method === 'POST');
    
    if (tokenEp) {
      return {
        tokenUrl: `https://api-des.royalairmaroc.com${tokenEp.path}`,
        method: 'POST',
        requestBodyPattern: tokenEp.requestSchema,
        tokenType: 'Client Credentials',
        headersObserved: tokenEp.headers
      };
    }

    return null;
  }
}
