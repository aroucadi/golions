import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import * as dotenv from 'dotenv';
import pino from 'pino';

// Load environment variables
dotenv.config();

import { setupWebSocket } from './websocket';
import { availabilityMonitor } from '../modules/monitor/AvailabilityMonitor';
import { searchExecutor } from '../modules/monitor/SearchExecutor';
import { queueObserver } from '../modules/queue/QueueObserver';
import { profileManager } from '../modules/profile/ProfileManager';
import { notificationEngine } from '../modules/notifications/NotificationEngine';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

const server = fastify({ logger: false });

async function main() {
  // Setup CORS
  await server.register(fastifyCors, {
    origin: true // Enable dev access
  });

  // Setup WebSockets
  await server.register(fastifyWebsocket);

  // Setup WebSocket routes
  setupWebSocket(server);

  // --- API Routes ---

  // Health check
  server.get('/api/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Start a monitor job
  server.post('/api/monitor/start', async (req, reply) => {
    const { route, date, interval } = req.body as { route: string; date: string; interval?: number };
    
    if (!route || !date) {
      reply.status(400);
      return { error: 'Route (e.g. CMN-IAH) and travel date (e.g. 2026-07-04) are required.' };
    }

    const intervalMs = interval || 60000; // Default 1 minute
    await availabilityMonitor.startMonitoring({
      route,
      date,
      interval: intervalMs,
      enabled: true
    });

    return { success: true, message: `Monitor successfully started for ${route} on ${date}` };
  });

  // Stop a monitor job
  server.post('/api/monitor/stop', async (req, reply) => {
    const { route, date } = req.body as { route: string; date: string };
    
    if (!route || !date) {
      reply.status(400);
      return { error: 'Route and Date are required to identify the monitor.' };
    }

    const routeKey = `${route}_${date}`;
    await availabilityMonitor.stopMonitoring(routeKey);
    return { success: true, message: `Monitor stopped for key ${routeKey}` };
  });

  // Get active monitors list and status
  server.get('/api/monitor/status', async () => {
    const active = availabilityMonitor.getActiveConfigs();
    const monitors = active.map((m) => {
      const history = availabilityMonitor.getHistory(m.route);
      const latest = history[history.length - 1];
      return {
        route: m.route,
        date: m.date,
        interval: m.interval,
        enabled: m.enabled,
        status: latest ? latest.status : 'PENDING',
        flightsFound: latest ? latest.flightsFound : 0,
        lastChecked: latest ? latest.timestamp : null
      };
    });

    return {
      activeCount: active.length,
      monitors
    };
  });

  // Get history logs
  server.get('/api/monitor/history', async (req) => {
    const { route } = req.query as { route?: string };
    return availabilityMonitor.getHistory(route);
  });

  // Post raw session headers copied from the browser
  server.post('/api/session/headers', async (req, reply) => {
    const { rawHeaders } = req.body as { rawHeaders: string };
    
    if (!rawHeaders) {
      reply.status(400);
      return { error: 'rawHeaders text field is required' };
    }

    // Pass custom headers block to SearchExecutor
    searchExecutor.setRawHeaders(rawHeaders);
    logger.info('[API] Raw session headers updated successfully.');

    // Pass the headers to QueueObserver to passively check Queue-It status immediately
    const queueState = await queueObserver.analyzeSession(rawHeaders);

    return {
      success: true,
      message: 'Session headers registered and waiting room status analyzed',
      queueState
    };
  });

  // Get queue status
  server.get('/api/queue/status', async () => {
    return queueObserver.getQueueStatus();
  });

  // CRUD Passenger Profiles
  server.get('/api/profiles', async (req) => {
    const { decrypt } = req.query as { decrypt?: string };
    const shouldDecrypt = decrypt === 'true';
    return profileManager.getAllProfiles(shouldDecrypt);
  });

  server.post('/api/profiles', async (req, reply) => {
    const body = req.body as any;
    try {
      const profileId = await profileManager.storeProfile({
        name: body.name,
        passportNumber: body.passportNumber,
        nationality: body.nationality,
        dateOfBirth: body.dateOfBirth,
        email: body.email,
        phone: body.phone,
        emergencyContact: body.emergencyContact,
        loyaltyNumber: body.loyaltyNumber
      });

      return { success: true, id: profileId, message: 'Profile saved and encrypted securely.' };
    } catch (err: any) {
      reply.status(400);
      return { error: err.message || 'Failed to save profile' };
    }
  });

  server.delete('/api/profiles/:id', async (req) => {
    const { id } = req.params as { id: string };
    await profileManager.deleteProfile(id);
    return { success: true, message: 'Profile deleted.' };
  });

  // Trigger test alerts manually
  server.post('/api/alerts/test', async (req) => {
    const { severity, message } = req.body as { severity?: string; message?: string };
    
    const alertSeverity = (severity || 'HIGH') as any;
    const alertMessage = message || 'This is a test notification from GO LIONS Booking Toolkit.';

    await notificationEngine.sendAlert(
      {
        id: crypto.randomUUID(),
        severity: alertSeverity,
        title: 'Test Notification Alert',
        message: alertMessage,
        timestamp: new Date().toISOString()
      },
      ['desktop', 'discord', 'slack']
    );

    return { success: true, message: 'Test notification queued successfully.' };
  });

  // Listen on port
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      logger.error('Error starting Fastify server:', err);
      process.exit(1);
    }
    logger.info(`[Fastify Server] Running at ${address}`);
  });
}

main().catch((err) => {
  logger.error('Error initializing server app:', err);
});
