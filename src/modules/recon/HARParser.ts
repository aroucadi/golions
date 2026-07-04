import * as fs from 'fs';
import * as crypto from 'crypto';
import { Endpoint, EndpointCatalog, AuthFlow } from './types';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class HARParser {
  /**
   * Parses a HAR file and returns an EndpointCatalog along with discovered details.
   */
  public static parse(harPath: string): { catalog: EndpointCatalog; authFlow?: AuthFlow } {
    try {
      const fileContent = fs.readFileSync(harPath, 'utf8');
      const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
      const harData = JSON.parse(fileContent);

      if (!harData.log || !Array.isArray(harData.log.entries)) {
        throw new Error('Invalid HAR file: log.entries is missing');
      }

      const endpointsMap = new Map<string, Endpoint>();
      let authFlow: AuthFlow | undefined;

      for (const entry of harData.log.entries) {
        const { request, response } = entry;
        if (!request || !request.url) continue;

        try {
          const parsedUrl = new URL(request.url);
          const path = parsedUrl.pathname;
          const method = request.method as Endpoint['method'];

          // Skip asset files (css, js, images, fonts, html entry points)
          if (
            path.endsWith('.css') ||
            path.endsWith('.js') ||
            path.endsWith('.png') ||
            path.endsWith('.jpg') ||
            path.endsWith('.jpeg') ||
            path.endsWith('.gif') ||
            path.endsWith('.svg') ||
            path.endsWith('.woff') ||
            path.endsWith('.woff2') ||
            path.endsWith('.ttf') ||
            path.endsWith('.ico') ||
            path.endsWith('.html') ||
            parsedUrl.hostname.includes('static.queue-it.net') ||
            parsedUrl.hostname.includes('assets.queue-it.net')
          ) {
            continue;
          }

          // Build clean headers object (redacting tokens/keys/cookies)
          const headers: Record<string, string> = {};
          let authentication: Endpoint['authentication'] = 'NONE';

          if (request.headers && Array.isArray(request.headers)) {
            for (const header of request.headers) {
              const name = header.name.toLowerCase();
              const value = header.value;

              if (name === 'authorization') {
                headers[header.name] = 'Bearer [REDACTED]';
                authentication = 'OAUTH';
              } else if (name === 'cookie') {
                headers[header.name] = '[REDACTED]';
                if (authentication === 'NONE') {
                  authentication = 'COOKIE';
                }
              } else if (
                name.includes('key') ||
                name.includes('secret') ||
                name.includes('token')
              ) {
                headers[header.name] = '[REDACTED]';
              } else {
                headers[header.name] = value;
              }
            }
          }

          // Extract request schema/sample
          let requestSchema: object | undefined;
          if (request.postData && request.postData.text) {
            try {
              requestSchema = JSON.parse(request.postData.text);
            } catch {
              requestSchema = { rawText: request.postData.text };
            }
          }

          // Extract response schema/sample
          let responseSchema: object | undefined;
          if (response.content && response.content.text) {
            try {
              responseSchema = JSON.parse(response.content.text);
            } catch {
              // Not JSON or empty
            }
          }

          // Generate a unique key for the path and method
          const key = `${method}:${path}`;

          if (!endpointsMap.has(key)) {
            endpointsMap.set(key, {
              path,
              method,
              headers,
              authentication,
              requestSchema,
              responseSchema
            });
          }

          // Check if this is the OAuth token endpoint
          if (path.includes('/oauth2/token') && method === 'POST') {
            authFlow = {
              tokenUrl: request.url,
              method: 'POST',
              requestBodyPattern: requestSchema,
              tokenType: 'Client Credentials / Resource Owner',
              headersObserved: headers
            };
          }
        } catch (err) {
          logger.debug(`[HARParser] Failed to parse request URL: ${request.url}`, err);
        }
      }

      const catalog: EndpointCatalog = {
        endpoints: Array.from(endpointsMap.values()),
        lastUpdated: new Date().toISOString(),
        harFileHash: hash
      };

      return { catalog, authFlow };
    } catch (error) {
      logger.error('[HARParser] Error parsing HAR file:', error);
      throw error;
    }
  }
}
