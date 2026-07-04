export interface QueueState {
  detected: boolean;
  provider: 'QUEUE_IT' | 'NONE' | 'UNKNOWN';
  queueId?: string;
  cookies?: Record<string, string>;
  estimatedWaitSeconds?: number;
  position?: number;
  totalWaiting?: number;
  lastUpdated: string;
}
