// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

let db = null;

/**
 * Initialize the SQLite database
 * Creates tables if they don't exist
 */
export function initDatabase(dbPath = './data/fireclaw.db') {
  try {
    // Ensure data directory exists
    const dir = dirname(dbPath);
    mkdir(dir, { recursive: true }).catch(() => {});

    db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    createTables();
    
    console.log(`✓ Database initialized: ${dbPath}`);
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Create database schema
 */
function createTables() {
  // Instances table - tracks registered FireClaw instances (anonymized)
  db.exec(`
    CREATE TABLE IF NOT EXISTS instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT UNIQUE NOT NULL,
      first_seen INTEGER NOT NULL,
      last_report INTEGER NOT NULL,
      report_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Reports table - individual detection reports
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      pattern_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (instance_id) REFERENCES instances(instance_id)
    )
  `);

  // Domains table - aggregated domain threat intelligence
  db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      report_count INTEGER DEFAULT 1,
      severity TEXT NOT NULL,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      pattern_types TEXT NOT NULL, -- JSON array of pattern types seen
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Patterns table - threat pattern signatures
  db.exec(`
    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL,
      pattern_type TEXT NOT NULL,
      signature TEXT NOT NULL, -- JSON pattern definition
      description TEXT,
      severity TEXT NOT NULL,
      detection_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(domain);
    CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp);
    CREATE INDEX IF NOT EXISTS idx_reports_instance ON reports(instance_id);
    CREATE INDEX IF NOT EXISTS idx_domains_severity ON domains(severity);
    CREATE INDEX IF NOT EXISTS idx_domains_last_seen ON domains(last_seen);
    CREATE INDEX IF NOT EXISTS idx_patterns_version ON patterns(version);
  `);

  // Insert default patterns if none exist
  const patternCount = db.prepare('SELECT COUNT(*) as count FROM patterns').get();
  if (patternCount.count === 0) {
    insertDefaultPatterns();
  }
}

/**
 * Insert default threat patterns
 */
function insertDefaultPatterns() {
  const defaultPatterns = [
    {
      version: 1,
      pattern_type: 'prompt_injection',
      signature: JSON.stringify({
        keywords: ['ignore previous', 'disregard', 'new instructions', 'system prompt'],
        severity_threshold: 0.7
      }),
      description: 'Classic prompt injection attempts',
      severity: 'high'
    },
    {
      version: 1,
      pattern_type: 'data_exfiltration',
      signature: JSON.stringify({
        keywords: ['send to', 'post to', 'webhook', 'external api'],
        severity_threshold: 0.8
      }),
      description: 'Data exfiltration attempts',
      severity: 'critical'
    },
    {
      version: 1,
      pattern_type: 'jailbreak',
      signature: JSON.stringify({
        keywords: ['DAN', 'developer mode', 'jailbreak', 'unrestricted'],
        severity_threshold: 0.75
      }),
      description: 'Jailbreak/role-playing attacks',
      severity: 'high'
    },
    {
      version: 1,
      pattern_type: 'command_injection',
      signature: JSON.stringify({
        patterns: ['<script>', 'javascript:', 'onerror=', 'onclick='],
        severity_threshold: 0.9
      }),
      description: 'Script/command injection patterns',
      severity: 'critical'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO patterns (version, pattern_type, signature, description, severity)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((patterns) => {
    for (const pattern of patterns) {
      insert.run(
        pattern.version,
        pattern.pattern_type,
        pattern.signature,
        pattern.description,
        pattern.severity
      );
    }
  });

  insertMany(defaultPatterns);
  console.log('✓ Default patterns inserted');
}

/**
 * Record a new threat report
 */
export function recordReport(instanceId, domain, patternType, severity, timestamp) {
  // Upsert instance
  const upsertInstance = db.prepare(`
    INSERT INTO instances (instance_id, first_seen, last_report, report_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(instance_id) DO UPDATE SET
      last_report = excluded.last_report,
      report_count = report_count + 1
  `);
  
  upsertInstance.run(instanceId, timestamp, timestamp);

  // Insert report
  const insertReport = db.prepare(`
    INSERT INTO reports (instance_id, domain, pattern_type, severity, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  insertReport.run(instanceId, domain, patternType, severity, timestamp);

  // Update or insert domain aggregate
  const domainExists = db.prepare('SELECT * FROM domains WHERE domain = ?').get(domain);
  
  if (domainExists) {
    // Update existing domain
    const patternTypes = JSON.parse(domainExists.pattern_types);
    if (!patternTypes.includes(patternType)) {
      patternTypes.push(patternType);
    }
    
    // Update severity to highest seen
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const newSeverity = severityLevels[severity] > severityLevels[domainExists.severity] 
      ? severity 
      : domainExists.severity;
    
    db.prepare(`
      UPDATE domains 
      SET report_count = report_count + 1,
          last_seen = ?,
          severity = ?,
          pattern_types = ?,
          updated_at = unixepoch()
      WHERE domain = ?
    `).run(timestamp, newSeverity, JSON.stringify(patternTypes), domain);
  } else {
    // Insert new domain
    db.prepare(`
      INSERT INTO domains (domain, severity, first_seen, last_seen, pattern_types)
      VALUES (?, ?, ?, ?, ?)
    `).run(domain, severity, timestamp, timestamp, JSON.stringify([patternType]));
  }

  // Update pattern detection count
  db.prepare(`
    UPDATE patterns 
    SET detection_count = detection_count + 1,
        updated_at = unixepoch()
    WHERE pattern_type = ?
  `).run(patternType);

  return { success: true };
}

/**
 * Get blocklist (optionally since a timestamp)
 */
export function getBlocklist(since = null) {
  let query = `
    SELECT 
      domain,
      severity,
      report_count,
      first_seen,
      last_seen,
      pattern_types
    FROM domains
  `;
  
  const params = [];
  if (since) {
    query += ' WHERE last_seen > ?';
    params.push(since);
  }
  
  query += ' ORDER BY report_count DESC, last_seen DESC';
  
  const results = db.prepare(query).all(...params);
  
  // Parse pattern_types JSON
  return results.map(row => ({
    ...row,
    pattern_types: JSON.parse(row.pattern_types)
  }));
}

/**
 * Get patterns (optionally filtered by version)
 */
export function getPatterns(clientVersion = null) {
  let query = 'SELECT * FROM patterns';
  const params = [];
  
  if (clientVersion !== null) {
    query += ' WHERE version > ?';
    params.push(clientVersion);
  }
  
  query += ' ORDER BY version DESC, severity DESC';
  
  const results = db.prepare(query).all(...params);
  
  // Parse signature JSON
  return results.map(row => ({
    ...row,
    signature: JSON.parse(row.signature)
  }));
}

/**
 * Get domain reputation
 */
export function getDomainReputation(domain) {
  const domainData = db.prepare(`
    SELECT 
      domain,
      report_count,
      severity,
      first_seen,
      last_seen,
      pattern_types
    FROM domains
    WHERE domain = ?
  `).get(domain);
  
  if (!domainData) {
    return {
      domain,
      score: 100, // Clean domain
      report_count: 0,
      pattern_types: [],
      first_seen: null,
      last_seen: null
    };
  }
  
  // Calculate reputation score (0-100, lower is worse)
  const severityPenalty = {
    low: 5,
    medium: 15,
    high: 30,
    critical: 50
  };
  
  const basePenalty = severityPenalty[domainData.severity] || 0;
  const countPenalty = Math.min(domainData.report_count * 5, 50);
  const score = Math.max(0, 100 - basePenalty - countPenalty);
  
  return {
    domain: domainData.domain,
    score,
    report_count: domainData.report_count,
    pattern_types: JSON.parse(domainData.pattern_types),
    first_seen: domainData.first_seen,
    last_seen: domainData.last_seen,
    severity: domainData.severity
  };
}

/**
 * Get public statistics
 */
export function getStats() {
  const totalReports = db.prepare('SELECT COUNT(*) as count FROM reports').get();
  const uniqueDomains = db.prepare('SELECT COUNT(*) as count FROM domains').get();
  const activeInstances = db.prepare(`
    SELECT COUNT(*) as count FROM instances 
    WHERE last_report > unixepoch() - (30 * 24 * 60 * 60)
  `).get();
  
  // Top patterns
  const topPatterns = db.prepare(`
    SELECT pattern_type, detection_count, severity
    FROM patterns
    ORDER BY detection_count DESC
    LIMIT 5
  `).all();
  
  // Reports per day (last 30 days)
  const reportsPerDay = db.prepare(`
    SELECT 
      DATE(timestamp, 'unixepoch') as date,
      COUNT(*) as count
    FROM reports
    WHERE timestamp > unixepoch() - (30 * 24 * 60 * 60)
    GROUP BY date
    ORDER BY date DESC
  `).all();
  
  return {
    total_reports: totalReports.count,
    unique_domains_flagged: uniqueDomains.count,
    active_instances: activeInstances.count,
    top_patterns: topPatterns,
    reports_per_day: reportsPerDay,
    generated_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Get database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// If run directly, initialize the database
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
  console.log('Database initialized successfully');
  process.exit(0);
}
