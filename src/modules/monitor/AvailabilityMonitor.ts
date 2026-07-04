import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { MonitorConfig, FlightSearchResult } from './types';
import { searchExecutor } from './SearchExecutor';
import { DiffEngine } from './DiffEngine';
import { eventBus } from '../../server/EventBus';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class AvailabilityMonitor {
  private stateFilePath: string;
  private activeMonitors = new Map<string, { config: MonitorConfig; intervalId: NodeJS.Timeout }>();
  private history: FlightSearchResult[] = [];

  constructor(customStatePath?: string) {
    this.stateFilePath =
      customStatePath || path.join(__dirname, '..', '..', 'data', 'monitor-state.json');
    this.loadState();
  }

  /**
   * Loads persisted monitoring configuration and history from disk.
   */
  private loadState(): void {
    if (fs.existsSync(this.stateFilePath)) {
      try {
        const content = fs.readFileSync(this.stateFilePath, 'utf8');
        const parsed = JSON.parse(content);
        this.history = parsed.history || [];

        // Restart previously configured monitors that are enabled
        const activeConfigs: MonitorConfig[] = parsed.activeMonitors || [];
        for (const config of activeConfigs) {
          if (config.enabled) {
            this.startMonitoring(config).catch((err) =>
              logger.error(`[AvailabilityMonitor] Failed to auto-resume monitor for ${config.route}:`, err)
            );
          }
        }
      } catch (err) {
        logger.error('[AvailabilityMonitor] Error parsing monitor-state.json:', err);
      }
    }
  }

  /**
   * Persists active monitors configurations and history to disk.
   */
  private saveState(): void {
    try {
      const activeConfigs = Array.from(this.activeMonitors.values()).map((val) => val.config);
      const data = {
        activeMonitors: activeConfigs,
        history: this.history.slice(-100) // Keep the last 100 entries
      };

      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      logger.error('[AvailabilityMonitor] Error saving monitor state to disk:', err);
    }
  }

  /**
   * Starts a periodic search monitor for the given configuration.
   */
  public async startMonitoring(config: MonitorConfig): Promise<void> {
    const routeKey = `${config.route}_${config.date}`;
    
    if (this.activeMonitors.has(routeKey)) {
      logger.warn(`[AvailabilityMonitor] Monitor already running for ${routeKey}. Stopping old job first.`);
      await this.stopMonitoring(routeKey);
    }

    // Immediately execute a search on start
    await this.executeSingleSearch(config);

    // Schedule subsequent polls
    const intervalId = setInterval(async () => {
      await this.executeSingleSearch(config);
    }, Math.max(config.interval, 10000)); // Minimum 10 seconds boundary

    this.activeMonitors.set(routeKey, { config: { ...config, enabled: true }, intervalId });
    this.saveState();
    logger.info(`[AvailabilityMonitor] Started monitoring ${config.route} on ${config.date} every ${config.interval}ms`);
  }

  /**
   * Stops a running search monitor.
   */
  public async stopMonitoring(routeKey: string): Promise<void> {
    const active = this.activeMonitors.get(routeKey);
    if (active) {
      clearInterval(active.intervalId);
      this.activeMonitors.delete(routeKey);
      this.saveState();
      logger.info(`[AvailabilityMonitor] Stopped monitoring for key: ${routeKey}`);
    }
  }

  /**
   * Executes a single search and does change detection.
   */
  private async executeSingleSearch(config: MonitorConfig): Promise<FlightSearchResult> {
    const previousResult = this.getLatestResultForRoute(config.route, config.date);
    const result = await searchExecutor.executeSearch(config);

    // Run DiffEngine comparison
    const change = DiffEngine.detectChange(result, previousResult);
    result.changeDetected = change.changed;
    result.previousStatus = previousResult?.status;

    // Log result
    logger.info(
      `[AvailabilityMonitor] Checked ${config.route} on ${config.date} | Status: ${result.status} | Found: ${result.flightsFound} | Change: ${change.changed} (${change.severity})`
    );

    // Save history
    this.history.push(result);
    this.saveState();

    // Fire EventBus if changed
    if (change.changed) {
      eventBus.emit('availability-changed', {
        result,
        changeType: change.type,
        severity: change.severity
      });
    }

    return result;
  }

  /**
   * Returns the latest recorded search result for a specific route and date.
   */
  private getLatestResultForRoute(route: string, date: string): FlightSearchResult | undefined {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].route === route && this.history[i].date === date) {
        return this.history[i];
      }
    }
    return undefined;
  }

  /**
   * Gets list of all currently active configurations.
   */
  public getActiveConfigs(): MonitorConfig[] {
    return Array.from(this.activeMonitors.values()).map((m) => m.config);
  }

  /**
   * Gets history filtered by route.
   */
  public getHistory(route?: string): FlightSearchResult[] {
    if (!route) return this.history;
    return this.history.filter((h) => h.route === route);
  }

  /**
   * Shuts down all active monitor jobs.
   */
  public shutdown(): void {
    for (const key of this.activeMonitors.keys()) {
      this.stopMonitoring(key);
    }
  }
}

export const availabilityMonitor = new AvailabilityMonitor();
export default availabilityMonitor;
