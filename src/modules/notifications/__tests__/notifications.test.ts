import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NotificationEngine } from '../NotificationEngine';
import { Alert } from '../types';

describe('NotificationEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should dispatch alerts successfully', async () => {
    const engine = new NotificationEngine();
    const alert: Alert = {
      id: 'alert-id',
      severity: 'CRITICAL',
      title: 'Flights Available!',
      message: 'New flights discovered CMN-IAH',
      timestamp: new Date().toISOString()
    };

    // Spy on console or check that it executes without throwing when webhooks are not configured
    await expect(engine.sendAlert(alert, ['desktop', 'discord', 'slack'])).resolves.not.toThrow();
  });
});
