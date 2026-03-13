// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import Joi from 'joi';
import {
  initDatabase,
  recordReport,
  getBlocklist,
  getPatterns,
  getDomainReputation,
  getStats
} from './db.mjs';

// Load configuration
const config = parseYaml(readFileSync('./config.yaml', 'utf8'));

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
if (config.security.cors.enabled) {
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      const allowed = config.security.cors.origins.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(origin);
        }
        return pattern === origin;
      });
      
      callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
    },
    credentials: true
  };
  app.use(cors(corsOptions));
}

// Body parser
app.use(express.json({ limit: '10kb' })); // Limit payload size

// Trust proxy if configured (for rate limiting by IP behind reverse proxy)
if (config.server.trustProxy) {
  app.set('trust proxy', 1);
}

// Initialize database
initDatabase(config.database.path);

// ============================================================================
// Middleware
// ============================================================================

/**
 * API Key authentication middleware
 */
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  if (!config.security.apiKeys.includes(apiKey)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
}

/**
 * Request validation middleware factory
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }
    next();
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: config.rateLimits.global.windowMs,
  max: config.rateLimits.global.maxRequests,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Report endpoint rate limiter (per instance ID)
const reportLimiter = rateLimit({
  windowMs: config.rateLimits.report.windowMs,
  max: config.rateLimits.report.maxRequests,
  keyGenerator: (req) => req.body.instanceId || req.ip,
  message: { error: 'Report rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Reputation lookup rate limiter
const reputationLimiter = rateLimit({
  windowMs: config.rateLimits.reputation.windowMs,
  max: config.rateLimits.reputation.maxRequests,
  message: { error: 'Reputation lookup rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// ============================================================================
// Validation Schemas
// ============================================================================

const reportSchema = Joi.object({
  instanceId: Joi.string()
    .alphanum()
    .min(16)
    .max(128)
    .required()
    .description('Anonymous instance identifier (hash)'),
  
  domain: Joi.string()
    .hostname()
    .max(253)
    .required()
    .description('Domain name that triggered detection'),
  
  patternType: Joi.string()
    .valid('prompt_injection', 'data_exfiltration', 'jailbreak', 'command_injection', 'other')
    .required()
    .description('Type of threat pattern detected'),
  
  severity: Joi.string()
    .valid('low', 'medium', 'high', 'critical')
    .required()
    .description('Severity level of the threat'),
  
  timestamp: Joi.number()
    .integer()
    .min(1000000000)
    .max(9999999999)
    .required()
    .description('Unix timestamp of detection')
});

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * POST /api/report
 * Accept threat reports from FireClaw instances
 */
app.post('/api/report', 
  requireApiKey,
  reportLimiter,
  validate(reportSchema),
  (req, res) => {
    try {
      const { instanceId, domain, patternType, severity, timestamp } = req.body;
      
      // Additional validation: timestamp not in future
      const now = Math.floor(Date.now() / 1000);
      if (timestamp > now + 300) { // Allow 5min clock skew
        return res.status(400).json({ 
          error: 'Invalid timestamp: cannot be in the future' 
        });
      }
      
      // Record the report
      const result = recordReport(instanceId, domain, patternType, severity, timestamp);
      
      res.status(201).json({
        success: true,
        message: 'Report recorded successfully',
        timestamp: now
      });
      
    } catch (error) {
      console.error('Error recording report:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to record report'
      });
    }
  }
);

/**
 * GET /api/blocklist
 * Return current blocklist of flagged domains
 */
app.get('/api/blocklist', (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since) : null;
    
    if (since && (isNaN(since) || since < 0)) {
      return res.status(400).json({ 
        error: 'Invalid since parameter: must be Unix timestamp' 
      });
    }
    
    const blocklist = getBlocklist(since);
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.set('Last-Modified', new Date().toUTCString());
    
    // Simple ETag based on count and timestamp
    const etag = `"${blocklist.length}-${Date.now()}"`;
    res.set('ETag', etag);
    
    // Check if client has cached version
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    
    res.json({
      count: blocklist.length,
      since: since || null,
      blocklist,
      generated_at: Math.floor(Date.now() / 1000)
    });
    
  } catch (error) {
    console.error('Error fetching blocklist:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch blocklist'
    });
  }
});

/**
 * GET /api/patterns
 * Return latest threat pattern signatures
 */
app.get('/api/patterns', (req, res) => {
  try {
    const clientVersion = req.query.version ? parseInt(req.query.version) : null;
    
    if (clientVersion !== null && (isNaN(clientVersion) || clientVersion < 0)) {
      return res.status(400).json({ 
        error: 'Invalid version parameter: must be integer' 
      });
    }
    
    const patterns = getPatterns(clientVersion);
    const currentVersion = config.patterns.currentVersion;
    
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
    
    res.json({
      current_version: currentVersion,
      client_version: clientVersion,
      patterns,
      has_updates: patterns.length > 0,
      generated_at: Math.floor(Date.now() / 1000)
    });
    
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch patterns'
    });
  }
});

/**
 * GET /api/stats
 * Public dashboard statistics
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    
    // Cache for 5 minutes
    res.set('Cache-Control', 'public, max-age=300');
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * GET /api/reputation/:domain
 * Domain reputation lookup
 */
app.get('/api/reputation/:domain', 
  reputationLimiter,
  (req, res) => {
    try {
      const domain = req.params.domain.toLowerCase();
      
      // Basic domain validation
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
        return res.status(400).json({ 
          error: 'Invalid domain format' 
        });
      }
      
      const reputation = getDomainReputation(domain);
      
      // Cache for 10 minutes
      res.set('Cache-Control', 'public, max-age=600');
      
      res.json(reputation);
      
    } catch (error) {
      console.error('Error fetching reputation:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to fetch domain reputation'
      });
    }
  }
);

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: Math.floor(Date.now() / 1000),
    version: '1.0.0'
  });
});

/**
 * GET /
 * API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'FireClaw Threat Feed API',
    version: '1.0.0',
    endpoints: {
      'POST /api/report': 'Submit threat report (requires API key)',
      'GET /api/blocklist': 'Get flagged domains blocklist',
      'GET /api/patterns': 'Get threat pattern signatures',
      'GET /api/stats': 'Get public statistics',
      'GET /api/reputation/:domain': 'Lookup domain reputation',
      'GET /health': 'Health check'
    },
    documentation: 'https://fireclaw.app/docs'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const PORT = process.env.PORT || config.server.port;
const HOST = process.env.HOST || config.server.host;

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🔥 FireClaw Threat Feed API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Database: ${config.database.path}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST /api/report           - Submit threat report');
  console.log('  GET  /api/blocklist        - Get blocklist');
  console.log('  GET  /api/patterns         - Get patterns');
  console.log('  GET  /api/stats            - Get statistics');
  console.log('  GET  /api/reputation/:domain - Domain lookup');
  console.log('  GET  /health               - Health check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
