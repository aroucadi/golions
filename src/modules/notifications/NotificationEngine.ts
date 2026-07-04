import pino from 'pino';
import { Alert, NotificationChannel } from './types';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class NotificationEngine {
  private discordWebhook: string | null = null;
  private slackWebhook: string | null = null;

  constructor() {
    this.discordWebhook = process.env.DISCORD_WEBHOOK_URL || null;
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL || null;
  }

  /**
   * Sends an alert to the specified channels.
   */
  public async sendAlert(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    logger.info(`[NotificationEngine] Dispatching alert: [${alert.severity}] ${alert.title} - ${alert.message}`);

    const promises = channels.map(async (channel) => {
      try {
        switch (channel) {
          case 'desktop':
            await this.sendDesktopNotification(alert);
            break;
          case 'discord':
            await this.sendDiscordWebhook(alert);
            break;
          case 'slack':
            await this.sendSlackWebhook(alert);
            break;
          default:
            break;
        }
      } catch (err) {
        logger.error(`[NotificationEngine] Failed to deliver alert to channel ${channel}:`, err);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Triggers a system-level desktop notification.
   */
  private async sendDesktopNotification(alert: Alert): Promise<void> {
    try {
      const notifier = require('node-notifier');
      notifier.notify({
        title: `GO LIONS: ${alert.title}`,
        message: alert.message,
        sound: alert.severity === 'CRITICAL' || alert.severity === 'HIGH',
        wait: true
      });
    } catch {
      logger.info(`[NotificationEngine Desktop Alert] [${alert.title}] ${alert.message}`);
    }
  }

  /**
   * Delivers the alert to Discord via Webhooks.
   */
  private async sendDiscordWebhook(alert: Alert): Promise<void> {
    if (!this.discordWebhook) {
      logger.debug('[NotificationEngine] Discord Webhook URL not configured in .env. Skipping.');
      return;
    }

    const color = alert.severity === 'CRITICAL' ? 15158332 : alert.severity === 'HIGH' ? 15105536 : 3066993;
    const body = {
      embeds: [
        {
          title: `🦁 GO LIONS: ${alert.title}`,
          description: alert.message,
          color,
          fields: [
            { name: 'Severity', value: alert.severity, inline: true },
            { name: 'Time', value: alert.timestamp, inline: true }
          ]
        }
      ]
    };

    const response = await fetch(this.discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Discord returned HTTP ${response.status}`);
    }
  }

  /**
   * Delivers the alert to Slack via Webhooks.
   */
  private async sendSlackWebhook(alert: Alert): Promise<void> {
    if (!this.slackWebhook) {
      logger.debug('[NotificationEngine] Slack Webhook URL not configured in .env. Skipping.');
      return;
    }

    const body = {
      text: `*🦁 GO LIONS Alert* [${alert.severity}]\n*${alert.title}*\n${alert.message}\n_Time: ${alert.timestamp}_`
    };

    const response = await fetch(this.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Slack returned HTTP ${response.status}`);
    }
  }
}

export const notificationEngine = new NotificationEngine();
export default notificationEngine;
