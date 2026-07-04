import { FastifyInstance } from 'fastify';
import { eventBus } from './EventBus';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export function setupWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    logger.info('[WebSocket] Client dashboard connected');

    const onAvailabilityChanged = (data: any) => {
      try {
        connection.socket.send(JSON.stringify({ type: 'AVAILABILITY_CHANGE', ...data }));
      } catch (err) {
        logger.error('[WebSocket] Error sending availability change:', err);
      }
    };

    const onQueueUpdated = (data: any) => {
      try {
        connection.socket.send(JSON.stringify({ type: 'QUEUE_UPDATE', ...data }));
      } catch (err) {
        logger.error('[WebSocket] Error sending queue update:', err);
      }
    };

    // Register listeners
    eventBus.on('availability-changed', onAvailabilityChanged);
    eventBus.on('queue-updated', onQueueUpdated);

    connection.socket.on('close', () => {
      logger.info('[WebSocket] Client dashboard disconnected');
      // Cleanup listeners to prevent memory leak
      eventBus.off('availability-changed', onAvailabilityChanged);
      eventBus.off('queue-updated', onQueueUpdated);
    });
  });
}
