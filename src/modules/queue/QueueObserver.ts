import pino from 'pino';
import { QueueState } from './types';
import { eventBus } from '../../server/EventBus';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class QueueObserver {
  private currentState: QueueState = {
    detected: false,
    provider: 'NONE',
    lastUpdated: new Date().toISOString()
  };

  /**
   * Analyzes session cookies and optionally queries the waiting room passively.
   */
  public async analyzeSession(cookiesText: string): Promise<QueueState> {
    const isQueueItDetected = cookiesText.includes('queueit') || cookiesText.includes('QueueIT');
    
    let position: number | undefined;
    let estimatedWaitSeconds: number | undefined;
    let queueId: string | undefined;

    // Parse simple queue-it cookie patterns
    const cookiePairs = cookiesText.split(';');
    for (const pair of cookiePairs) {
      const parts = pair.trim().split('=');
      const key = parts[0]?.trim();
      const val = parts[1]?.trim();
      if (key && key.toLowerCase().includes('queueittoken')) {
        queueId = val;
      }
    }

    try {
      // Passive check to fetch the queue page source using the user's cookies.
      // This mimics the browser checking the queue status endpoint.
      const response = await fetch('https://waitingroom.royalairmaroc.com/', {
        method: 'GET',
        headers: {
          'Cookie': cookiesText,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const html = await response.text();

      // Scrape standard Queue-It layout variables
      const waitTimeRegex = /"expectedServiceTime":\s*"([^"]+)"|estimatedWTime\s*=\s*(\d+)/i;
      const aheadRegex = /"usersInLineAheadOfYou":\s*(\d+)|usersInLineAheadOfYou\s*=\s*(\d+)/i;
      const qIdRegex = /"queueId":\s*"([^"]+)"|queueId\s*=\s*"([^"]+)"/i;

      const waitMatch = html.match(waitTimeRegex);
      const aheadMatch = html.match(aheadRegex);
      const qIdMatch = html.match(qIdRegex);

      if (aheadMatch) {
        position = parseInt(aheadMatch[1] || aheadMatch[2], 10);
      }
      if (waitMatch) {
        estimatedWaitSeconds = parseInt(waitMatch[1] || waitMatch[2], 10);
      }
      if (qIdMatch) {
        queueId = qIdMatch[1] || qIdMatch[2];
      }

      const detected = isQueueItDetected || html.includes('queue-it') || html.includes('queueit');

      this.currentState = {
        detected,
        provider: detected ? 'QUEUE_IT' : 'NONE',
        queueId,
        position,
        estimatedWaitSeconds,
        lastUpdated: new Date().toISOString()
      };

      // Notify the server so it pushes to the dashboard via WebSocket
      eventBus.emit('queue-updated', this.currentState);

    } catch (err) {
      logger.debug('[QueueObserver] Could not connect to waiting room endpoint (likely no active campaign page):', err);
      
      const detected = isQueueItDetected;
      this.currentState = {
        detected,
        provider: detected ? 'QUEUE_IT' : 'NONE',
        queueId,
        lastUpdated: new Date().toISOString()
      };
    }

    return this.currentState;
  }

  /**
   * Returns the last recorded queue status.
   */
  public getQueueStatus(): QueueState {
    return this.currentState;
  }
}

export const queueObserver = new QueueObserver();
export default queueObserver;
