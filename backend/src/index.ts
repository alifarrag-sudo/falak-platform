import express from 'express';
import cors from 'cors';
import path from 'path';
import fileUpload from 'express-fileupload';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './db/schema';
import influencersRouter from './routes/influencers';
import campaignsRouter from './routes/campaigns';
import pdfRouter from './routes/pdf';
import settingsRouter from './routes/settings';
import enrichmentRouter from './routes/enrichment';
import discoverRouter from './routes/discover';
import portalRouter from './routes/portal';
import offersRouter from './routes/offers';
import authRouter from './routes/auth';
import notificationsRouter from './routes/notifications';
import oauthRouter from './routes/oauth';
import analyticsRouter from './routes/analytics';
import agenciesRouter from './routes/agencies';
import brandsRouter from './routes/brands';
import paymentsRouter from './routes/payments';
import offerTemplatesRouter from './routes/offerTemplates';
import billingRouter from './routes/billing';
import fanRouter from './routes/fan';
import revenueRouter from './routes/revenue';
import loyaltyRouter from './routes/loyalty';
import messagesRouter from './routes/messages';
import ratingsRouter from './routes/ratings';
import intelligenceRouter from './routes/intelligence';
import agentRouter from './routes/agent';
import adnetworkRouter from './routes/adnetwork';
import outreachRouter from './routes/outreach';
import liveRouter from './routes/live';
import webhooksRouter from './routes/webhooks';
import { initSyncJobs } from './jobs/syncJobs';
import { startKeepAlive } from './keepalive';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',  // portal dev server
  ],
  credentials: true
}));
// Rate limiting — 200 req/15min per IP on all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
});
app.use('/api/', apiLimiter);

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/portal/auth/login', authLimiter);
app.use('/api/fan/auth/login', authLimiter);

// Stripe webhook needs raw body — MUST come before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  useTempFiles: false
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Routes
app.use('/api/influencers', influencersRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/enrichment', enrichmentRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/portal', portalRouter);
app.use('/api/offers', offersRouter);
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/agencies', agenciesRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/offer-templates', offerTemplatesRouter);
app.use('/api/billing', billingRouter);
app.use('/api/fan', fanRouter);
app.use('/api/revenue', revenueRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/agent', agentRouter);
app.use('/api/adnetwork', adnetworkRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/live', liveRouter);
app.use('/api/webhooks', webhooksRouter);

// Health check (both paths for compatibility with Railway/Render/ELB)
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV || 'development', build: '2026-04-12-d' });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Meta / OAuth required policy pages
app.get('/privacy', (_req, res) => {
  res.send('<html><body><h1>Privacy Policy</h1><p>This platform collects social media analytics data (followers, engagement, posts) with the account owner\'s explicit consent via OAuth. Data is used solely for campaign management and is never sold to third parties. You may revoke access at any time from your account settings.</p></body></html>');
});
app.get('/terms', (_req, res) => {
  res.send('<html><body><h1>Terms of Service</h1><p>By connecting your social media accounts, you grant this platform read-only access to your public analytics data for the purpose of influencer campaign management. You may disconnect at any time.</p></body></html>');
});
app.get('/data-deletion', (_req, res) => {
  res.send('<html><body><h1>Data Deletion Instructions</h1><p>To delete your data, disconnect your account from the Connections page in your portal, or contact the platform admin. All associated tokens and analytics data will be permanently removed within 30 days.</p></body></html>');
});
// Meta data deletion callback (POST — required for some app types)
app.post('/data-deletion', (_req, res) => {
  res.json({ url: '', confirmation_code: 'deleted' });
});

// Serve built React frontend
// Production (Railway/Render): frontend is copied to dist/public during build
// Development: frontend lives at ../../frontend/dist relative to dist/index.js
const fs = require('fs');
const frontendDist = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')                    // production
  : path.join(__dirname, '../../frontend/dist');       // local dev

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA catch-all — must come after all API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize DB and start server
initializeDatabase();
initSyncJobs();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startKeepAlive();
});

export default app;
