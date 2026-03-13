#!/usr/bin/env node

// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

/**
 * FireClaw Threat Feed - Setup Validation Script
 * Checks that everything is configured correctly before deployment
 */

import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';

console.log('🔥 FireClaw Threat Feed - Setup Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let hasErrors = false;
let hasWarnings = false;

function error(message) {
  console.log(`❌ ERROR: ${message}`);
  hasErrors = true;
}

function warning(message) {
  console.log(`⚠️  WARNING: ${message}`);
  hasWarnings = true;
}

function success(message) {
  console.log(`✓ ${message}`);
}

function section(title) {
  console.log(`\n${title}`);
  console.log('─'.repeat(title.length));
}

// Check 1: Node.js version
section('Node.js Version');
const nodeVersion = process.version.match(/^v(\d+)/)[1];
if (parseInt(nodeVersion) >= 18) {
  success(`Node.js ${process.version}`);
} else {
  error(`Node.js ${process.version} is too old. Required: 18+`);
}

// Check 2: Dependencies
section('Dependencies');
try {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  success(`package.json found (version ${pkg.version})`);
  
  // Check if node_modules exists
  if (existsSync('./node_modules')) {
    success('node_modules/ exists');
    
    // Check key dependencies
    const deps = ['express', 'better-sqlite3', 'helmet', 'express-rate-limit', 'cors', 'yaml', 'joi'];
    deps.forEach(dep => {
      if (existsSync(`./node_modules/${dep}`)) {
        success(`${dep} installed`);
      } else {
        error(`${dep} not installed - run: npm install`);
      }
    });
  } else {
    error('node_modules/ not found - run: npm install');
  }
} catch (err) {
  error('package.json not found or invalid');
}

// Check 3: Configuration
section('Configuration');
try {
  const configRaw = readFileSync('./config.yaml', 'utf8');
  const config = parseYaml(configRaw);
  success('config.yaml loaded successfully');
  
  // Check server config
  if (config.server?.port) {
    success(`Server port: ${config.server.port}`);
  } else {
    warning('Server port not configured, will use default');
  }
  
  // Check API keys
  if (config.security?.apiKeys?.length > 0) {
    const placeholderKey = 'GENERATE_AND_REPLACE_WITH_SECURE_KEY';
    const hasPlaceholder = config.security.apiKeys.some(key => key.includes(placeholderKey));
    
    if (hasPlaceholder) {
      error('API keys still contain placeholder values!');
      console.log('   Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      console.log('   Then update config.yaml with real keys');
    } else {
      success(`${config.security.apiKeys.length} API key(s) configured`);
      
      // Validate key strength
      config.security.apiKeys.forEach((key, i) => {
        if (key.length < 32) {
          warning(`API key ${i + 1} is short (${key.length} chars) - recommend 64+ chars`);
        } else {
          success(`API key ${i + 1} length: ${key.length} chars`);
        }
      });
    }
  } else {
    error('No API keys configured - clients won\'t be able to submit reports');
  }
  
  // Check CORS
  if (config.security?.cors?.enabled) {
    success(`CORS enabled with ${config.security.cors.origins?.length || 0} origin(s)`);
    if (config.security.cors.origins?.includes('http://localhost:*')) {
      warning('CORS includes localhost - safe for dev, but remove for production');
    }
  }
  
  // Check rate limits
  if (config.rateLimits) {
    success('Rate limits configured');
  } else {
    warning('Rate limits not configured - will use defaults');
  }
  
} catch (err) {
  error(`config.yaml error: ${err.message}`);
}

// Check 4: Database
section('Database');
try {
  const config = parseYaml(readFileSync('./config.yaml', 'utf8'));
  const dbPath = config.database?.path || './data/fireclaw.db';
  
  if (existsSync(dbPath)) {
    success(`Database exists: ${dbPath}`);
    
    // Try to open it
    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath, { readonly: true });
      
      // Check tables
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const requiredTables = ['instances', 'reports', 'domains', 'patterns'];
      
      requiredTables.forEach(table => {
        if (tables.some(t => t.name === table)) {
          success(`Table '${table}' exists`);
        } else {
          error(`Table '${table}' missing - run: npm run init-db`);
        }
      });
      
      // Check if patterns are populated
      const patternCount = db.prepare('SELECT COUNT(*) as count FROM patterns').get();
      if (patternCount.count > 0) {
        success(`${patternCount.count} default pattern(s) loaded`);
      } else {
        warning('No patterns in database - run: npm run init-db');
      }
      
      db.close();
    } catch (err) {
      error(`Cannot open database: ${err.message}`);
    }
  } else {
    warning(`Database not initialized: ${dbPath}`);
    console.log('   Run: npm run init-db');
  }
} catch (err) {
  error(`Database check failed: ${err.message}`);
}

// Check 5: File permissions
section('File Permissions');
try {
  const dataDir = './data';
  if (existsSync(dataDir)) {
    success('data/ directory exists');
  } else {
    warning('data/ directory does not exist - will be created on first run');
  }
} catch (err) {
  error(`Permission check failed: ${err.message}`);
}

// Check 6: Test files
section('Test Files');
if (existsSync('./test-client.mjs')) {
  success('test-client.mjs found');
} else {
  warning('test-client.mjs not found');
}

if (existsSync('./server.mjs')) {
  success('server.mjs found');
} else {
  error('server.mjs not found - main server file is missing!');
}

if (existsSync('./db.mjs')) {
  success('db.mjs found');
} else {
  error('db.mjs not found - database module is missing!');
}

// Check 7: Environment
section('Environment');
if (process.env.NODE_ENV) {
  success(`NODE_ENV: ${process.env.NODE_ENV}`);
  if (process.env.NODE_ENV !== 'production') {
    warning('NODE_ENV is not "production" - set for production deployment');
  }
} else {
  warning('NODE_ENV not set - will default to production');
}

if (process.env.PORT) {
  success(`PORT override: ${process.env.PORT}`);
}

// Summary
section('Summary');
if (hasErrors) {
  console.log('\n❌ Setup validation FAILED - fix errors above before running');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  Setup validation passed with warnings');
  console.log('Review warnings above - they may be okay for development');
  process.exit(0);
} else {
  console.log('\n✅ Setup validation PASSED - ready to run!');
  console.log('\nStart the server with: npm start');
  console.log('Test the API with: node test-client.mjs');
  process.exit(0);
}
