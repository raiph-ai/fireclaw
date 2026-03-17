#!/usr/bin/env node

// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

/**
 * FireClaw Dashboard Server
 * Local network-only web UI for FireClaw proxy management
 */

import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
// nodemailer removed — OTP delivered via OpenClaw messaging or HTTP webhook
import { readFileSync, existsSync, writeFileSync, createReadStream, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import { parse as parseYAML } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { Store } from 'express-session';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration
const configPath = join(__dirname, 'config.yaml');
const config = parseYAML(readFileSync(configPath, 'utf8'));

const app = express();
const PORT = config.server.port || 8420;
const BIND_ADDRESS = config.server.bindAddress || '0.0.0.0';

// In-memory OTP storage (would use Redis in production)
const otpStore = new Map();

// Middleware: IP restriction
function restrictToLocalNetwork(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const allowedNetworks = config.server.allowedNetworks || [];
  
  // Simple check - in production, use proper CIDR matching library
  const isLocal = 
    clientIP === '::1' || 
    clientIP === '127.0.0.1' || 
    clientIP.startsWith('192.168.') || 
    clientIP.startsWith('10.') || 
    clientIP.startsWith('172.16.') ||
    clientIP.startsWith('172.17.') ||
    clientIP.startsWith('172.18.') ||
    clientIP.startsWith('172.19.') ||
    clientIP.startsWith('172.20.') ||
    clientIP.startsWith('172.21.') ||
    clientIP.startsWith('172.22.') ||
    clientIP.startsWith('172.23.') ||
    clientIP.startsWith('172.24.') ||
    clientIP.startsWith('172.25.') ||
    clientIP.startsWith('172.26.') ||
    clientIP.startsWith('172.27.') ||
    clientIP.startsWith('172.28.') ||
    clientIP.startsWith('172.29.') ||
    clientIP.startsWith('172.30.') ||
    clientIP.startsWith('172.31.') ||
    clientIP.startsWith('::ffff:127.') ||
    clientIP.startsWith('::ffff:192.168.') ||
    clientIP.startsWith('::ffff:10.');

  if (!isLocal) {
    console.warn(`⚠️  Blocked non-local IP: ${clientIP}`);
    return res.status(403).json({ error: 'Access denied: local network only' });
  }
  
  next();
}

// Apply IP restriction to all routes
app.use(restrictToLocalNetwork);

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// File-based session store — survives server restarts
class FileSessionStore extends Store {
  constructor(filePath) {
    super();
    this._path = filePath;
    this._sessions = {};
    try {
      if (existsSync(this._path)) {
        this._sessions = JSON.parse(readFileSync(this._path, 'utf8'));
        // Prune expired sessions on load
        const now = Date.now();
        for (const [sid, data] of Object.entries(this._sessions)) {
          const sess = typeof data === 'string' ? JSON.parse(data) : data;
          if (sess?.cookie?.expires && new Date(sess.cookie.expires).getTime() < now) {
            delete this._sessions[sid];
          }
        }
        this._persist();
      }
    } catch { this._sessions = {}; }
  }
  _persist() {
    try { writeFileSync(this._path, JSON.stringify(this._sessions, null, 2)); } catch {}
  }
  get(sid, cb) {
    const data = this._sessions[sid];
    if (!data) return cb(null, null);
    try {
      const sess = typeof data === 'string' ? JSON.parse(data) : data;
      if (sess?.cookie?.expires && new Date(sess.cookie.expires).getTime() < Date.now()) {
        delete this._sessions[sid];
        this._persist();
        return cb(null, null);
      }
      cb(null, sess);
    } catch { cb(null, null); }
  }
  set(sid, sess, cb) {
    this._sessions[sid] = sess;
    this._persist();
    cb?.();
  }
  destroy(sid, cb) {
    delete this._sessions[sid];
    this._persist();
    cb?.();
  }
}

const sessionStorePath = join(__dirname, 'data', 'sessions.json');

// Session management — file-backed so sessions survive restarts
app.use(session({
  store: new FileSessionStore(sessionStorePath),
  secret: process.env.SESSION_SECRET || config.auth.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Set to true if using HTTPS
    maxAge: config.auth.sessionMaxAge || 86400000 // 24 hours
  }
}));

// OTP delivery via OpenClaw messaging
// The dashboard sends OTP to the user's configured messaging platform
// (Slack, WhatsApp, Telegram, etc.) via the OpenClaw gateway API
function getOpenClawCreds() {
  // Dynamic: check settings file first, then env, then config
  try {
    const s = JSON.parse(readFileSync(join(__dirname, 'data', 'settings.json'), 'utf8'));
    if (s.openclawUrl && s.openclawToken) return { url: s.openclawUrl, token: s.openclawToken };
  } catch {}
  const url = process.env.OPENCLAW_URL || config.auth.openclawUrl || null;
  const token = process.env.OPENCLAW_TOKEN || config.auth.openclawToken || null;
  return { url, token };
}

// Keep for backward compat
const OPENCLAW_URL = process.env.OPENCLAW_URL || config.auth.openclawUrl || null;
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || config.auth.openclawToken || null;

async function sendOTPviaOpenClaw(otp, customMessage) {
  let { url, token } = getOpenClawCreds();
  if (!url || !token) {
    console.log(`Message (no OpenClaw configured, logging to console): ${customMessage || otp}`);
    return true;
  }
  token = token.replace(/[^\x00-\x7F]/g, '').trim();
  url = url.replace(/[^\x00-\x7F]/g, '').trim();
  
  const message = customMessage || `FireClaw Dashboard OTP\n\nYour login code is: ${otp}\n\nExpires in 5 minutes. If you didn't request this, ignore it.`;
  
  try {
    const response = await fetch(`${url}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });
    
    if (response.ok) {
      console.log('✉️  Message sent via OpenClaw messaging');
      return true;
    } else {
      console.error(`Failed to send via OpenClaw: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Failed to send via OpenClaw:', error.message);
    return false;
  }
}

// Fallback: Also support a generic webhook for custom integrations
async function sendOTPviaWebhook(otp) {
  const webhookUrl = process.env.OTP_WEBHOOK_URL || config.auth.otpWebhookUrl || null;
  if (!webhookUrl) return false;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: `🔥 FireClaw Dashboard OTP: ${otp} (expires in 5 min)`,
        otp 
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Middleware: Check authentication
function requireAuth(req, res, next) {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// === Health Check (no auth required — used by client skill) ===

app.get('/api/health', (req, res) => {
  const settings = loadSettings();
  const health = {
    status: 'ok',
    version: settings.version || '1.0.0',
    uptime: process.uptime(),
    costExceeded: false,  // Future: check actual cost tracking against rateLimits.dailyCostCapCents
    rateLimited: false,   // Future: check actual rate limiting against rateLimits.maxFetchesPerHour
    llmConfigured: !!(settings.llm && settings.llm.apiKey),
    timestamp: new Date().toISOString()
  };
  res.json(health);
});

// === Proxy API (no auth — IP-restricted to local network already) ===

let fireclawProxy = null;

async function getProxy() {
  if (!fireclawProxy) {
    try {
      const { fireclaw_fetch, fireclaw_search, fireclaw_status } = await import('../fireclaw.mjs');
      fireclawProxy = { fireclaw_fetch, fireclaw_search, fireclaw_status };
      console.log('🔥 FireClaw proxy module loaded');
    } catch (err) {
      console.error('Failed to load FireClaw proxy module:', err.message);
      throw err;
    }
  }
  return fireclawProxy;
}

app.post('/api/proxy', async (req, res) => {
  const action = req.headers['x-fireclaw-action'] || req.body.action;
  const params = req.body;

  try {
    const proxy = await getProxy();
    let result;

    if (action === 'fetch') {
      result = await proxy.fireclaw_fetch(params.url, params.intent);
    } else if (action === 'search') {
      result = await proxy.fireclaw_search(params.query, params.count || 5);
    } else if (action === 'status') {
      result = await proxy.fireclaw_status();
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.json(result);
  } catch (err) {
    console.error(`[FireClaw Proxy] Error handling ${action}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Authentication Routes ===

// Request OTP
app.post('/api/auth/request-otp', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  // Verify email matches admin email (check settings file first, then config)
  let adminEmail = config.auth.adminEmail;
  try {
    const s = JSON.parse(readFileSync(join(__dirname, 'data', 'settings.json'), 'utf8'));
    if (s.adminEmail) adminEmail = s.adminEmail;
  } catch {}
  if (email.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized email address' });
  }
  
  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiry = Date.now() + (config.auth.otpExpiry || 300000);
  
  // Store OTP
  otpStore.set(email.toLowerCase(), { otp, expiry });
  
  // Send OTP via OpenClaw messaging (Slack, WhatsApp, etc.)
  const sent = await sendOTPviaOpenClaw(otp) || await sendOTPviaWebhook(otp);
  
  if (!sent && !OPENCLAW_URL) {
    // Console fallback — for dev/testing
    console.log(`🔐 OTP for ${email}: ${otp}`);
  }
  
  res.json({ success: true, message: 'OTP sent to your messaging platform' });
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }
  
  const stored = otpStore.get(email.toLowerCase());
  
  if (!stored) {
    return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
  }
  
  if (Date.now() > stored.expiry) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }
  
  if (stored.otp !== otp) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }
  
  // OTP is valid - create session
  otpStore.delete(email.toLowerCase());
  req.session.authenticated = true;
  req.session.email = email;
  
  res.json({ success: true, message: 'Authentication successful' });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.authenticated,
    email: req.session.email || null
  });
});

// === Dashboard API Routes ===

// Overview stats
app.get('/api/stats/overview', requireAuth, async (req, res) => {
  try {
    const stats = await getOverviewStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Audit log
app.get('/api/audit-log', requireAuth, async (req, res) => {
  try {
    const { limit = 100, offset = 0, severity, domain, search } = req.query;
    const logs = await getAuditLogs(parseInt(limit), parseInt(offset), { severity, domain, search });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Domain management
app.get('/api/domains', requireAuth, async (req, res) => {
  try {
    const domains = await getDomainTiers();
    res.json(domains);
  } catch (error) {
    console.error('Error fetching domains:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

app.post('/api/domains', requireAuth, async (req, res) => {
  try {
    const { domain, tier } = req.body;
    await setDomainTier(domain, tier);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating domain:', error);
    res.status(500).json({ error: 'Failed to update domain' });
  }
});

// Configuration
app.get('/api/config', requireAuth, async (req, res) => {
  try {
    const fireclawConfig = await getFireClawConfig();
    res.json(fireclawConfig);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

app.post('/api/config', requireAuth, async (req, res) => {
  try {
    await updateFireClawConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Threat feed
app.get('/api/threat-feed', requireAuth, async (req, res) => {
  try {
    const feed = await getThreatFeed();
    res.json(feed);
  } catch (error) {
    console.error('Error fetching threat feed:', error);
    res.status(500).json({ error: 'Failed to fetch threat feed' });
  }
});

// Alerts
app.get('/api/alerts', requireAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = await getRecentAlerts(parseInt(limit));
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Settings
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    await saveSettings(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Usage stats
app.get('/api/usage-stats', requireAuth, async (req, res) => {
  try {
    const stats = await getUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

// Export audit log
app.get('/api/export/audit-log', requireAuth, async (req, res) => {
  try {
    const auditLogPath = join(__dirname, config.fireclaw.auditLogPath);
    
    if (!existsSync(auditLogPath)) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    
    res.download(auditLogPath, `fireclaw-audit-log-${new Date().toISOString().split('T')[0]}.json`);
  } catch (error) {
    console.error('Error exporting audit log:', error);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

// Export domains
app.get('/api/export/domains', requireAuth, async (req, res) => {
  try {
    const domains = await getDomainTiers();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="fireclaw-domains-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(domains, null, 2));
  } catch (error) {
    console.error('Error exporting domains:', error);
    res.status(500).json({ error: 'Failed to export domains' });
  }
});

// Check for updates (with daily caching)
let updateCache = { checkedAt: 0, result: null };

app.get('/api/check-updates', async (req, res) => {
  try {
    const settings = await getSettings();
    const currentVersion = settings.version || '1.0.0';
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Use cache if checked within last day
    if (updateCache.result && (Date.now() - updateCache.checkedAt) < oneDay) {
      return res.json({ ...updateCache.result, currentVersion });
    }
    
    // Try to check fireclaw.app for latest version
    let latestVersion = currentVersion;
    let updateAvailable = false;
    try {
      const resp = await fetch('https://api.fireclaw.app/v1/version', { 
        signal: AbortSignal.timeout(5000) 
      });
      if (resp.ok) {
        const data = await resp.json();
        latestVersion = data.version || currentVersion;
        updateAvailable = latestVersion !== currentVersion;
      }
    } catch {}
    
    const result = { currentVersion, latestVersion, updateAvailable };
    updateCache = { checkedAt: Date.now(), result: { latestVersion, updateAvailable } };
    
    res.json(result);
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

// Supabase sharing data endpoint (task 3)

/**
 * Read Supabase config from settings.json (or env vars as fallback).
 * Returns { url, key } or null if not configured.
 */
function getSupabaseConfig() {
  // Environment variable fallback takes highest priority
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };

  try {
    const settings = loadSettings();
    const supabase = settings.supabase || {};
    if (supabase.url && supabase.key) return { url: supabase.url, key: supabase.key };
  } catch { /* ignore */ }
  return null;
}

// UUID validation helper
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

app.post('/api/sharing', requireAuth, async (req, res) => {
  try {
    const { shareData } = req.body;
    
    // Save to local settings
    const settings = loadSettings();
    if (!settings.privacy) settings.privacy = {};
    settings.privacy.shareData = !!shareData;
    saveSettingsFile(settings);
    
    // Write preference to Supabase (only if configured)
    const supabaseConfig = getSupabaseConfig();
    if (supabaseConfig) {
      try {
        const instanceId = settings.instanceId || crypto.randomUUID();
        if (!settings.instanceId) {
          settings.instanceId = instanceId;
          saveSettingsFile(settings);
        }

        // Validate instance_id is a valid UUID before writing to Supabase
        if (!isValidUUID(instanceId)) {
          console.warn('[Dashboard] Invalid instance_id format — skipping Supabase write');
        } else {
          await fetch(`${supabaseConfig.url}/rest/v1/sharing_preferences`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseConfig.key,
              'Authorization': `Bearer ${supabaseConfig.key}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              instance_id: instanceId,
              share_data: !!shareData,
              updated_at: new Date().toISOString()
            })
          });
        }
      } catch (e) {
        console.error('Supabase write failed (non-fatal):', e.message);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving sharing preference:', error);
    res.status(500).json({ error: 'Failed to save sharing preference' });
  }
});

// Test LLM connectivity
app.post('/api/test-llm', requireAuth, async (req, res) => {
  try {
    const settings = loadSettings();
    const llm = settings.llm || {};
    const provider = (llm.provider || 'anthropic').toLowerCase();
    const modelRaw = llm.model || '';
    const apiKey = llm.apiKey || '';

    if (!apiKey) {
      return res.json({ success: false, error: 'No API key configured' });
    }

    // Strip provider prefix (e.g. "google/gemini-2.5-flash" → "gemini-2.5-flash")
    const model = modelRaw.includes('/') ? modelRaw.split('/').slice(1).join('/') : modelRaw;

    const start = Date.now();
    let response;

    try {
      if (provider === 'google' || provider === 'gemini') {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] }),
            signal: AbortSignal.timeout(10000)
          }
        );
      } else if (provider === 'anthropic') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          }),
          signal: AbortSignal.timeout(10000)
        });
      } else if (provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          }),
          signal: AbortSignal.timeout(10000)
        });
      } else if (provider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelRaw,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          }),
          signal: AbortSignal.timeout(10000)
        });
      } else {
        return res.json({ success: false, error: `Unknown provider: ${provider}` });
      }
    } catch (fetchErr) {
      return res.json({ success: false, error: 'Cannot connect' });
    }

    const latencyMs = Date.now() - start;

    if (response.ok) {
      return res.json({ success: true, latencyMs });
    }

    // Map status codes to friendly messages
    if (response.status === 401 || response.status === 403) {
      return res.json({ success: false, error: 'Invalid API key' });
    }
    if (response.status === 429) {
      return res.json({ success: false, error: 'Rate limit exceeded' });
    }

    const errBody = await response.text().catch(() => '');
    return res.json({ success: false, error: `HTTP ${response.status}` });

  } catch (error) {
    console.error('Error testing LLM:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Alerts: send spending/limit alerts via OpenClaw messaging (task 6)
app.post('/api/alerts/send', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    
    const sent = await sendOTPviaOpenClaw(null, message);
    res.json({ success: sent });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

// === Helper Functions ===

async function getOverviewStats() {
  const auditLogPath = join(__dirname, config.fireclaw.auditLogPath);
  
  if (!existsSync(auditLogPath)) {
    return {
      totalFetches: 0,
      injectionsDetected: 0,
      blockRate: 0,
      topOffenders: [],
      trendData: []
    };
  }
  
  const logs = [];
  const fileStream = createReadStream(auditLogPath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (line.trim()) {
      try {
        logs.push(JSON.parse(line));
      } catch (e) {
        console.error('Failed to parse log line:', e);
      }
    }
  }
  
  // Calculate stats — filter to operation entries only (each fetch/search produces one)
  const fetchLogs = logs.filter(l => l.operation === 'fetch' || l.operation === 'search');
  const totalFetches = fetchLogs.length;
  const injectionsDetected = fetchLogs.filter(l => (l.detections || 0) > 0).length;
  const blocked = fetchLogs.filter(l => l.blocked === true).length;
  const blockRate = totalFetches > 0 ? (blocked / totalFetches * 100).toFixed(2) : 0;
  
  // Top offending domains
  const domainCounts = {};
  fetchLogs.forEach(log => {
    if ((log.detections || 0) > 0 && log.flagged) {
      try {
        const url = new URL(log.url);
        const domain = url.hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch (e) {
        // Invalid URL
      }
    }
  });
  
  const topOffenders = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));
  
  // Trend data (last 7 days)
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const trendData = [];
  
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i * 24 * 60 * 60 * 1000);
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);
    const dayLogs = logs.filter(l => {
      const timestamp = new Date(l.timestamp).getTime();
      return timestamp >= dayStart && timestamp < dayEnd;
    });
    
    const dayFetches = dayLogs.filter(l => l.operation === 'fetch' || l.operation === 'search');
    trendData.push({
      date: new Date(dayStart).toISOString().split('T')[0],
      fetches: dayFetches.length,
      injections: dayFetches.filter(l => (l.detections || 0) > 0).length
    });
  }
  
  return {
    totalFetches,
    injectionsDetected,
    blockRate: parseFloat(blockRate),
    topOffenders,
    trendData
  };
}

async function getAuditLogs(limit, offset, filters) {
  const auditLogPath = join(__dirname, config.fireclaw.auditLogPath);
  
  if (!existsSync(auditLogPath)) {
    return { logs: [], total: 0 };
  }
  
  const logs = [];
  const fileStream = createReadStream(auditLogPath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (line.trim()) {
      try {
        logs.push(JSON.parse(line));
      } catch (e) {
        console.error('Failed to parse log line:', e);
      }
    }
  }
  
  // Apply filters
  let filtered = logs;
  
  if (filters.severity) {
    filtered = filtered.filter(l => l.severity === filters.severity);
  }
  
  if (filters.domain) {
    filtered = filtered.filter(l => {
      try {
        const url = new URL(l.url);
        return url.hostname.includes(filters.domain);
      } catch (e) {
        return false;
      }
    });
  }
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(l => 
      (l.url || '').toLowerCase().includes(searchLower) ||
      (l.stage || '').toLowerCase().includes(searchLower) ||
      (l.operation || '').toLowerCase().includes(searchLower)
    );
  }
  
  // Sort by timestamp (newest first)
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);
  
  return { logs: paginated, total };
}

async function getDomainTiers() {
  const tiersPath = join(__dirname, config.fireclaw.domainTiersPath);
  
  if (!existsSync(tiersPath)) {
    return { trusted: [], neutral: [], suspicious: [], blocked: [] };
  }
  
  const data = readFileSync(tiersPath, 'utf8');
  return JSON.parse(data);
}

async function setDomainTier(domain, tier) {
  const tiers = await getDomainTiers();
  
  // Remove from all tiers
  ['trusted', 'neutral', 'suspicious', 'blocked'].forEach(t => {
    if (tiers[t]) {
      tiers[t] = tiers[t].filter(d => d !== domain);
    }
  });
  
  // Add to new tier
  if (!tiers[tier]) tiers[tier] = [];
  tiers[tier].push(domain);
  
  const tiersPath = join(__dirname, config.fireclaw.domainTiersPath);
  writeFileSync(tiersPath, JSON.stringify(tiers, null, 2));
}

async function getFireClawConfig() {
  const configPath = join(__dirname, config.fireclaw.configPath);
  
  if (!existsSync(configPath)) {
    return {};
  }
  
  const data = readFileSync(configPath, 'utf8');
  return parseYAML(data);
}

async function updateFireClawConfig(updates) {
  const currentConfig = await getFireClawConfig();
  const merged = { ...currentConfig, ...updates };
  
  const configPath = join(__dirname, config.fireclaw.configPath);
  writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

async function getThreatFeed() {
  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    // Supabase not configured — return empty feed gracefully
    return {
      networkStats: { totalInstances: 0, injectionsBlockedThisWeek: 0, topThreats: [] },
      recentPatterns: [],
      blockedDomains: []
    };
  }

  try {
    const headers = { 'apikey': supabaseConfig.key, 'Authorization': `Bearer ${supabaseConfig.key}` };
    
    // Recent flagged detections (last 7 days)
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const detectionsResp = await fetch(
      `${supabaseConfig.url}/rest/v1/detections?select=domain,severity,severity_level,flagged,created_at&flagged=eq.true&created_at=gte.${oneWeekAgo}&order=created_at.desc&limit=50`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    
    // Community blocklist
    const blocklistResp = await fetch(
      `${supabaseConfig.url}/rest/v1/community_blocklist?select=*&order=total_flags.desc&limit=20`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    
    const recentDetections = detectionsResp.ok ? await detectionsResp.json() : [];
    const blocklist = blocklistResp.ok ? await blocklistResp.json() : [];
    
    // Aggregate top threats by domain
    const topThreats = {};
    recentDetections.forEach(d => {
      topThreats[d.domain] = (topThreats[d.domain] || 0) + 1;
    });
    
    return {
      networkStats: {
        totalInstances: 0,
        injectionsBlockedThisWeek: recentDetections.length,
        topThreats: Object.entries(topThreats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([pattern, count]) => ({ pattern, count }))
      },
      recentPatterns: recentDetections.slice(0, 10).map(d => ({
        pattern: d.domain,
        firstSeen: d.created_at,
        severity: d.severity_level || 'medium',
        detections: 1
      })),
      blockedDomains: blocklist.map(b => ({
        domain: b.domain,
        reason: `${b.total_flags} flags from ${b.reporters} instances`,
        addedAt: b.last_seen
      }))
    };
  } catch (err) {
    console.warn('[Dashboard] Supabase threat feed failed:', err.message);
    return {
      networkStats: { totalInstances: 0, injectionsBlockedThisWeek: 0, topThreats: [] },
      recentPatterns: [],
      blockedDomains: []
    };
  }
}

async function getRecentAlerts(limit) {
  // Extract alerts from audit log
  const auditLogPath = join(__dirname, config.fireclaw.auditLogPath);
  
  if (!existsSync(auditLogPath)) {
    return [];
  }
  
  const logs = [];
  const fileStream = createReadStream(auditLogPath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (line.trim()) {
      try {
        const log = JSON.parse(line);
        if (log.flagged || log.alert) {
          logs.push(log);
        }
      } catch (e) {
        console.error('Failed to parse log line:', e);
      }
    }
  }
  
  // Sort by timestamp (newest first) and limit
  return logs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

async function getSettings() {
  const settingsPath = join(__dirname, 'data', 'settings.json');
  
  // Create default settings if file doesn't exist
  if (!existsSync(settingsPath)) {
    const defaultSettings = {
      version: '1.0.0',
      privacy: {
        shareData: false
      },
      alerts: {
        severityThreshold: 'low',
        digestMode: false,
        quietHours: {
          start: '22:00',
          end: '08:00'
        }
      },
      rateLimits: {
        maxFetchesPerHour: 1000,
        maxFetchesPerDay: 10000,
        dailyCostCapCents: 500
      },
      domains: {
        defaultTrust: 'neutral',
        autoBlockThreshold: 0
      },
      dashboard: {
        refreshInterval: 5000,
        timezone: 'local'
      },
      maintenance: {
        logRetentionDays: 90
      },
      llm: {
        provider: 'anthropic',
        model: 'anthropic/claude-haiku-4',
        apiKey: null
      },
      supabase: {
        url: '',
        key: ''
      }
    };
    
    // Ensure data directory exists
    const { mkdirSync } = await import('fs');
    const dataDir = join(__dirname, 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
  
  const data = readFileSync(settingsPath, 'utf8');
  const settings = JSON.parse(data);
  
  // Mask LLM API key — never send it back to the frontend
  if (settings.llm && settings.llm.apiKey) {
    settings.llm.apiKeySet = true;
    delete settings.llm.apiKey;
  } else {
    if (!settings.llm) settings.llm = { provider: 'anthropic', model: 'anthropic/claude-haiku-4' };
    settings.llm.apiKeySet = false;
  }

  // Ensure supabase defaults exist
  if (!settings.supabase) settings.supabase = { url: '', key: '' };

  // Mask Supabase key — never send it back to the frontend
  if (settings.supabase.key) {
    settings.supabase.supabaseKeySet = true;
    delete settings.supabase.key;
  } else {
    settings.supabase.supabaseKeySet = false;
  }
  
  return settings;
}

async function saveSettings(settings) {
  const settingsPath = join(__dirname, 'data', 'settings.json');
  
  // Ensure data directory exists
  const { mkdirSync } = await import('fs');
  const dataDir = join(__dirname, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  
  // Read raw file to get unmasked settings (getSettings masks API key)
  let existing = {};
  if (existsSync(settingsPath)) {
    existing = JSON.parse(readFileSync(settingsPath, 'utf8'));
  }
  
  // Merge with existing settings to preserve version and other fields
  const merged = {
    ...existing,
    ...settings,
    version: existing.version // Preserve version
  };
  
  // Handle LLM settings — preserve existing API key if not provided
  if (settings.llm) {
    merged.llm = { ...(existing.llm || {}), ...settings.llm };
    if (!settings.llm.apiKey && existing.llm && existing.llm.apiKey) {
      merged.llm.apiKey = existing.llm.apiKey;
    }
  }
  
  // Clean up — don't persist the apiKeySet flag
  if (merged.llm) delete merged.llm.apiKeySet;

  // Handle Supabase settings — preserve existing key if not provided in update
  if (settings.supabase) {
    merged.supabase = { ...(existing.supabase || {}), ...settings.supabase };
    if (!settings.supabase.key && existing.supabase && existing.supabase.key) {
      merged.supabase.key = existing.supabase.key;
    }
  }

  // Clean up — don't persist the supabaseKeySet flag
  if (merged.supabase) delete merged.supabase.supabaseKeySet;
  
  // Persist openclawUrl/openclawToken if provided (from onboarding)
  if (settings.openclawUrl !== undefined) merged.openclawUrl = settings.openclawUrl;
  if (settings.openclawToken !== undefined) merged.openclawToken = settings.openclawToken;
  
  // ALWAYS preserve auth fields from existing — never let a settings update wipe credentials
  if (existing.passwordHash) merged.passwordHash = existing.passwordHash;
  if (existing.authConfigured !== undefined) merged.authConfigured = existing.authConfigured;
  if (existing.authMethod) merged.authMethod = existing.authMethod;
  if (existing.recoveryKeyHash) merged.recoveryKeyHash = existing.recoveryKeyHash;
  
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
}

async function getUsageStats() {
  const auditLogPath = join(__dirname, config.fireclaw.auditLogPath);
  
  if (!existsSync(auditLogPath)) {
    return {
      today: 0,
      thisHour: 0,
      estimatedCostCents: 0
    };
  }
  
  const logs = [];
  const fileStream = createReadStream(auditLogPath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (line.trim()) {
      try {
        logs.push(JSON.parse(line));
      } catch (e) {
        console.error('Failed to parse log line:', e);
      }
    }
  }
  
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const oneHourAgo = now - (60 * 60 * 1000);
  
  const todayLogs = logs.filter(l => new Date(l.timestamp).getTime() >= oneDayAgo);
  const hourLogs = logs.filter(l => new Date(l.timestamp).getTime() >= oneHourAgo);
  
  // Estimate cost (rough estimate: $0.01 per fetch for analysis)
  const estimatedCostCents = todayLogs.length * 1;
  
  return {
    today: todayLogs.length,
    thisHour: hourLogs.length,
    estimatedCostCents
  };
}

// === Setup & Auth Configuration ===

const settingsPath = join(__dirname, 'data', 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch { return {}; }
}

function saveSettingsFile(settings) {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

// Check if first-time setup is needed
app.get('/api/setup/status', (req, res) => {
  const settings = loadSettings();
  res.json({
    setupComplete: !!settings.authConfigured,
    authMethod: settings.authMethod || null
  });
});

// Complete first-time setup
app.post('/api/setup/complete', (req, res) => {
  const settings = loadSettings();
  if (settings.authConfigured) {
    return res.status(400).json({ error: 'Setup already completed. Use Settings to change auth.' });
  }

  const { method, email, openclawUrl, openclawToken, password } = req.body;

  if (method === 'otp') {
    if (!email) return res.status(400).json({ error: 'Email is required for OTP' });
    settings.authMethod = 'otp';
    settings.adminEmail = email;
    settings.openclawUrl = openclawUrl || '';
    settings.openclawToken = openclawToken || '';
  } else if (method === 'password') {
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    settings.authMethod = 'password';
    settings.passwordHash = hashPassword(password);
  } else {
    return res.status(400).json({ error: 'Invalid auth method' });
  }

  settings.authConfigured = true;

  // Generate recovery key
  const recoveryKey = crypto.randomBytes(16).toString('hex');
  settings.recoveryKeyHash = hashPassword(recoveryKey);
  
  saveSettingsFile(settings);

  // Save recovery key to file on disk (readable only via SSH)
  const recoveryPath = join(__dirname, 'recovery-key.txt');
  writeFileSync(recoveryPath, 
    `FireClaw Dashboard Recovery Key\n` +
    `================================\n\n` +
    `Recovery Key: ${recoveryKey}\n\n` +
    `Use this key to reset your password if you get locked out.\n` +
    `You can also delete data/settings.json and restart the service to re-run setup.\n\n` +
    `Generated: ${new Date().toISOString()}\n`
  );
  console.log(`Recovery key saved to ${recoveryPath}`);
  
  // Create session immediately after setup
  req.session.authenticated = true;
  req.session.email = email || 'admin';

  res.json({ success: true, recoveryKey });
});

// Test OTP delivery (for setup wizard)
app.post('/api/setup/test-otp', async (req, res) => {
  let { openclawUrl, openclawToken } = req.body;
  if (!openclawUrl || !openclawToken) {
    return res.status(400).json({ error: 'OpenClaw URL and token are required' });
  }
  // Strip any non-ASCII characters (smart quotes, invisible unicode, etc.)
  openclawToken = openclawToken.replace(/[^\x00-\x7F]/g, '').trim();
  openclawUrl = openclawUrl.replace(/[^\x00-\x7F]/g, '').trim();
  try {
    const response = await fetch(`${openclawUrl}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${openclawToken}`
      },
      body: JSON.stringify({
        message: 'FireClaw OTP Test - If you see this, OTP delivery is working!'
      })
    });
    if (response.ok) {
      res.json({ success: true });
    } else {
      const body = await response.text().catch(() => '');
      res.status(400).json({ error: `OpenClaw returned ${response.status}: ${body}` });
    }
  } catch (err) {
    res.status(400).json({ error: `Connection failed: ${err.message}` });
  }
});

// Password recovery via recovery key
app.post('/api/auth/recover', (req, res) => {
  const { recoveryKey, newPassword } = req.body;
  if (!recoveryKey || !newPassword) {
    return res.status(400).json({ error: 'Recovery key and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const settings = loadSettings();
  if (!settings.recoveryKeyHash) {
    return res.status(400).json({ error: 'No recovery key configured. Delete data/settings.json and restart to reset.' });
  }

  try {
    if (!verifyPassword(recoveryKey, settings.recoveryKeyHash)) {
      return res.status(401).json({ error: 'Invalid recovery key' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid recovery key' });
  }

  // Reset password and generate new recovery key
  settings.authMethod = 'password';
  settings.passwordHash = hashPassword(newPassword);
  
  const newRecoveryKey = crypto.randomBytes(16).toString('hex');
  settings.recoveryKeyHash = hashPassword(newRecoveryKey);
  saveSettingsFile(settings);

  // Update recovery file
  const recoveryPath = join(__dirname, 'recovery-key.txt');
  writeFileSync(recoveryPath,
    `FireClaw Dashboard Recovery Key\n` +
    `================================\n\n` +
    `Recovery Key: ${newRecoveryKey}\n\n` +
    `Use this key to reset your password if you get locked out.\n` +
    `You can also delete data/settings.json and restart the service to re-run setup.\n\n` +
    `Generated: ${new Date().toISOString()}\n`
  );

  req.session.authenticated = true;
  req.session.email = settings.adminEmail || 'admin';
  res.json({ success: true, message: 'Password reset. New recovery key saved to recovery-key.txt on the server.' });
});

// Password-based login
app.post('/api/auth/login', (req, res) => {
  const settings = loadSettings();
  if (settings.authMethod !== 'password') {
    return res.status(400).json({ error: 'Password login is not enabled' });
  }
  const { password } = req.body;
  if (!password || !settings.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  try {
    if (verifyPassword(password, settings.passwordHash)) {
      req.session.authenticated = true;
      req.session.email = 'admin';
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Update auth settings (from Settings page, requires auth)
app.post('/api/auth/settings', requireAuth, (req, res) => {
  const settings = loadSettings();
  const { method, email, openclawUrl, openclawToken, password } = req.body;

  if (method === 'otp') {
    if (!email) return res.status(400).json({ error: 'Email required' });
    settings.authMethod = 'otp';
    settings.adminEmail = email;
    settings.openclawUrl = openclawUrl || settings.openclawUrl || '';
    settings.openclawToken = openclawToken || settings.openclawToken || '';
    delete settings.passwordHash;
  } else if (method === 'password') {
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });
      settings.passwordHash = hashPassword(password);
    }
    settings.authMethod = 'password';
    delete settings.adminEmail;
    delete settings.openclawUrl;
    delete settings.openclawToken;
  }

  saveSettingsFile(settings);
  res.json({ success: true });
});

// Get auth settings (for Settings page, requires auth)
app.get('/api/auth/settings', requireAuth, (req, res) => {
  const settings = loadSettings();
  res.json({
    method: settings.authMethod || 'otp',
    email: settings.adminEmail || '',
    openclawUrl: settings.openclawUrl || '',
    hasOpenclawToken: !!settings.openclawToken,
    hasPassword: !!settings.passwordHash
  });
});

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, BIND_ADDRESS, () => {
  console.log(`🔥 FireClaw Dashboard running on http://${BIND_ADDRESS}:${PORT}`);
  console.log(`🔒 Access restricted to local network only`);
  console.log(`📧 Admin email: ${config.auth.adminEmail}`);
  if (OPENCLAW_URL) {
    console.log(`📱 OTP delivery: OpenClaw messaging`);
  } else {
    console.log(`⚠️  OTP will be logged to console (OpenClaw URL not configured)`);
  }
});
