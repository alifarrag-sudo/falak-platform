/**
 * Keep-alive self-ping — prevents Render Starter from sleeping.
 *
 * Starter plan services still sleep after ~30 min of inactivity on some
 * account configurations. This pings /health every 10 minutes so the
 * process stays warm between real requests.
 *
 * Only runs in production when BACKEND_URL is set.
 * Uses Node.js built-in http/https — no extra dependencies.
 */

import https from 'https';
import http from 'http';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function startKeepAlive(): void {
  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl || process.env.NODE_ENV !== 'production') {
    return; // skip in local dev
  }

  const healthUrl = `${backendUrl}/health`;
  const client = healthUrl.startsWith('https') ? https : http;

  const ping = () => {
    const req = client.get(healthUrl, (res) => {
      res.resume(); // drain response body so socket is released
    });
    req.setTimeout(10_000, () => req.destroy());
    req.on('error', () => {}); // silently discard network errors
  };

  setInterval(ping, INTERVAL_MS);
  console.log(`[keep-alive] pinging ${healthUrl} every 10 min`);
}
