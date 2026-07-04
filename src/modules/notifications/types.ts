export type NotificationChannel = 'desktop' | 'discord' | 'slack' | 'email' | 'webhook';

export interface Alert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  timestamp: string;
  route?: string;
  action?: string;
}
