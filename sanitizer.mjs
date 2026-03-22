// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

/**
 * FireClaw Sanitizer — Production v2.0
 * Rule-based sanitization engine for Stage 2 (input) and Stage 4 (output)
 * 
 * Features:
 * - Comprehensive pattern matching across all categories
 * - Canary token injection and detection
 * - Domain trust tier integration
 * - Advanced Unicode normalization
 * - HTML DOM-level analysis
 * - Severity scoring and classification
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate a unique canary token
 */
function generateCanary() {
  return 'CANARY_' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Pattern Matcher — Compiles and scans regex patterns
 */
export class PatternMatcher {
  constructor(patterns) {
    this.patterns = patterns;
    this.compiled = {
      structural: {},
      injection_signatures: {},
      output_signatures: {},
      exfiltration: {},
      canary_patterns: {}
    };
    
    // Compile all patterns to RegExp objects
    for (const [category, patternMap] of Object.entries(patterns)) {
      if (['severity_weights', 'metadata'].includes(category)) continue;
      if (typeof patternMap !== 'object') continue;
      
      for (const [name, pattern] of Object.entries(patternMap)) {
        try {
          this.compiled[category][name] = new RegExp(pattern, 'gim');
        } catch (err) {
          console.error(`[Sanitizer] Failed to compile pattern ${category}.${name}: ${err.message}`);
        }
      }
    }
  }
  
  /**
   * Scan text for pattern matches
   * @param {string} text - Text to scan
   * @param {string[]} categories - Pattern categories to check
   * @returns {Array<{category, name, match, position, severity}>}
   */
  scan(text, categories = ['structural', 'injection_signatures']) {
    const matches = [];
    const weights = this.patterns.severity_weights || {};
    
    for (const category of categories) {
      const categoryPatterns = this.compiled[category] || {};
      const severity = weights[category] || 1;
      
      for (const [name, regex] of Object.entries(categoryPatterns)) {
        // Reset regex state
        regex.lastIndex = 0;
        
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            category,
            name,
            match: match[0],
            position: match.index,
            severity
          });
          
          // Prevent infinite loops on zero-width matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Calculate total severity score
   */
  calculateSeverity(matches) {
    return matches.reduce((sum, m) => sum + m.severity, 0);
  }
}

/**
 * Unicode Normalizer — Advanced unicode cleaning
 */
export class UnicodeNormalizer {
  constructor() {
    // Mappings for common homoglyphs
    this.homoglyphs = {
      // Cyrillic to Latin
      'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
      'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 
      'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X',
      // Greek to Latin
      'α': 'a', 'β': 'b', 'γ': 'y', 'ε': 'e', 'ι': 'i', 'ο': 'o', 'υ': 'u',
      'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N',
      'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Ζ': 'Z'
    };
  }
  
  /**
   * Normalize Unicode text
   */
  normalize(text) {
    let normalized = text;
    
    // 1. NFD normalization (canonical decomposition)
    normalized = normalized.normalize('NFD');
    
    // 2. Remove combining characters (excessive accents/diacritics used for obfuscation)
    normalized = normalized.replace(/[\u0300-\u036F]/g, '');
    
    // 3. NFC normalization (canonical composition)
    normalized = normalized.normalize('NFC');
    
    // 4. Remove zero-width and invisible characters
    normalized = normalized.replace(/[\u200B\u200C\u200D\uFEFF\u2060\u2062\u2063\u2064]/g, '');
    
    // 5. Remove directional overrides (RTL/LTR tricks)
    normalized = normalized.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');
    
    // 6. Remove soft hyphens and other formatting
    normalized = normalized.replace(/[\u00AD\u00A0]/g, ' ');
    
    // 7. Replace homoglyphs with ASCII equivalents
    normalized = normalized.split('').map(char => {
      return this.homoglyphs[char] || char;
    }).join('');
    
    // 8. Remove control characters (except newline, tab, CR)
    normalized = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    
    // 9. Replace replacement character
    normalized = normalized.replace(/\uFFFD/g, '');
    
    return normalized;
  }
}

/**
 * HTML Analyzer — DOM-level analysis for hidden content
 */
export class HTMLAnalyzer {
  constructor() {
    this.hiddenPatterns = {
      display: /display:\s*none/gi,
      visibility: /visibility:\s*hidden/gi,
      opacity: /opacity:\s*0/gi,
      fontSize: /font-size:\s*0(px|pt|em|rem)?/gi,
      color: /color:\s*rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/gi,
      positionLeft: /left:\s*-\d+/gi,
      positionTop: /top:\s*-\d+/gi,
      overflow: /overflow:\s*hidden/gi,
      clip: /clip:\s*rect\(0,?\s*0,?\s*0,?\s*0\)/gi
    };
  }
  
  /**
   * Extract hidden content indicators from HTML
   */
  analyzeHidden(html) {
    const findings = [];
    
    for (const [name, pattern] of Object.entries(this.hiddenPatterns)) {
      const matches = html.match(pattern);
      if (matches) {
        findings.push({
          type: 'hidden_css',
          technique: name,
          count: matches.length,
          severity: 2
        });
      }
    }
    
    // Check for hidden text in comments
    const commentMatch = html.match(/<!--(.*?)-->/gs);
    if (commentMatch) {
      const suspiciousComments = commentMatch.filter(comment => {
        const lower = comment.toLowerCase();
        return lower.includes('instruction') || 
               lower.includes('system') || 
               lower.includes('command') ||
               lower.includes('prompt');
      });
      
      if (suspiciousComments.length > 0) {
        findings.push({
          type: 'hidden_comment',
          technique: 'suspicious_html_comments',
          count: suspiciousComments.length,
          severity: 3
        });
      }
    }
    
    // Check for data URIs (can contain hidden instructions)
    const dataUriMatch = html.match(/data:[^,]+,/g);
    if (dataUriMatch && dataUriMatch.length > 3) {
      findings.push({
        type: 'data_uri',
        technique: 'excessive_data_uris',
        count: dataUriMatch.length,
        severity: 2
      });
    }
    
    return findings;
  }
  
  /**
   * Strip all HTML tags (simple approach, not full parser)
   */
  stripHTML(html) {
    let text = html;
    
    // Remove script and style tags with their content
    text = text.replace(/<script[^>]*>.*?<\/script>/gis, '');
    text = text.replace(/<style[^>]*>.*?<\/style>/gis, '');
    
    // Remove all other tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');
    
    // Decode numeric entities (basic)
    text = text.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num));
    });
    
    return text;
  }
}

/**
 * Canary Token System
 */
export class CanaryTokenSystem {
  constructor() {
    this.activeCanaries = new Map(); // token -> {url, timestamp, metadata}
  }
  
  /**
   * Inject canary tokens into text
   */
  inject(text, url, count = 3) {
    const canaries = [];
    let injected = text;
    
    for (let i = 0; i < count; i++) {
      const token = generateCanary();
      canaries.push(token);
      
      // Store in active tracking
      this.activeCanaries.set(token, {
        url,
        timestamp: Date.now(),
        position: i
      });
      
      // Inject at strategic positions
      const positions = [
        Math.floor(text.length * 0.25),
        Math.floor(text.length * 0.5),
        Math.floor(text.length * 0.75)
      ];
      
      const pos = positions[i] || Math.floor(text.length * (i / count));
      
      // Inject as HTML comment (invisible but detectable)
      const marker = `<!-- ${token} -->`;
      injected = injected.slice(0, pos) + marker + injected.slice(pos);
    }
    
    return { injected, canaries };
  }
  
  /**
   * Detect canary tokens in text
   */
  detect(text) {
    const found = [];
    
    for (const [token, metadata] of this.activeCanaries.entries()) {
      if (text.includes(token)) {
        found.push({
          token,
          metadata,
          age: Date.now() - metadata.timestamp
        });
      }
    }
    
    return found;
  }
  
  /**
   * Clean up old canaries (older than 1 hour)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [token, metadata] of this.activeCanaries.entries()) {
      if (now - metadata.timestamp > maxAge) {
        this.activeCanaries.delete(token);
      }
    }
  }
}

/**
 * Stage 2: Structural Sanitization (Input)
 */
export class InputSanitizer {
  constructor(patternMatcher, trustTier = 'neutral') {
    this.patterns = patternMatcher;
    this.trustTier = trustTier;
    this.normalizer = new UnicodeNormalizer();
    this.htmlAnalyzer = new HTMLAnalyzer();
  }
  
  /**
   * Sanitize raw input text
   */
  sanitize(text, maxChars = 8000, options = {}) {
    if (!text || typeof text !== 'string') {
      return { sanitized: '', detections: [], severity: 0, metadata: {} };
    }
    
    let sanitized = text;
    const detections = [];
    const metadata = {
      originalLength: text.length,
      trustTier: this.trustTier,
      techniques: []
    };
    
    // Adjust sanitization intensity based on trust tier
    const intensity = {
      trusted: 0.3,
      neutral: 1.0,
      suspicious: 1.5,
      blocked: 2.0
    }[this.trustTier] || 1.0;
    
    // 1. HTML analysis (before stripping)
    if (text.includes('<')) {
      const hiddenFindings = this.htmlAnalyzer.analyzeHidden(text);
      metadata.hiddenElements = hiddenFindings;
      
      if (hiddenFindings.length > 0) {
        detections.push({
          category: 'structural',
          name: 'hidden_html_techniques',
          match: `Found ${hiddenFindings.length} hidden content techniques`,
          severity: hiddenFindings.reduce((sum, f) => sum + f.severity, 0)
        });
      }
    }
    
    // 2. Detect patterns BEFORE stripping (for logging)
    const categories = intensity > 1.0 
      ? ['structural', 'injection_signatures', 'exfiltration']
      : ['structural', 'injection_signatures'];
    
    const structuralMatches = this.patterns.scan(sanitized, categories);
    detections.push(...structuralMatches);
    
    // 3. Unicode normalization (more aggressive for suspicious domains)
    if (intensity >= 1.0) {
      sanitized = this.normalizer.normalize(sanitized);
      metadata.techniques.push('unicode_normalization');
    }
    
    // 4. Strip HTML
    if (text.includes('<')) {
      sanitized = this.htmlAnalyzer.stripHTML(sanitized);
      metadata.techniques.push('html_stripping');
    }
    
    // 5. Remove suspicious structural elements
    // HTML comments
    sanitized = sanitized.replace(/<!--.*?-->/gs, '');
    
    // Data URIs and base64 blobs
    sanitized = sanitized.replace(/data:[^,]+;base64,[A-Za-z0-9+/=]+/g, '[BASE64_REMOVED]');
    sanitized = sanitized.replace(/[A-Za-z0-9+/]{100,}={0,2}/g, match => {
      // Keep short base64, remove long blobs
      return '[LONG_BASE64_REMOVED]';
    });
    
    // 6. Control characters (except newline, tab, carriage return)
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    
    // 7. Collapse excessive whitespace (more aggressive for suspicious)
    const wsThreshold = intensity > 1.0 ? 2 : 3;
    sanitized = sanitized.replace(new RegExp(`[ \\t]{${wsThreshold},}`, 'g'), '  ');
    sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
    
    // 8. Remove encoding tricks
    if (intensity > 1.0) {
      // Remove URL encoding attempts
      sanitized = sanitized.replace(/%[0-9a-fA-F]{2}/g, '');
      metadata.techniques.push('encoding_removal');
    }
    
    // 9. Truncate to max length
    if (sanitized.length > maxChars) {
      sanitized = sanitized.substring(0, maxChars) + '\n\n[... truncated ...]';
      detections.push({
        category: 'structural',
        name: 'truncation',
        match: `Content truncated from ${text.length} to ${maxChars} chars`,
        severity: 0
      });
    }
    
    // 10. Apply aggressive filtering for suspicious/blocked domains
    if (intensity > 1.5) {
      // Remove anything that looks like code
      sanitized = sanitized.replace(/\b(function|lambda|eval|exec)\s*\(/g, '[CODE_REMOVED]');
      metadata.techniques.push('aggressive_code_filtering');
    }
    
    // Calculate total severity
    const severity = this.patterns.calculateSeverity(detections);
    
    metadata.finalLength = sanitized.length;
    metadata.detectionCount = detections.length;
    
    return { sanitized, detections, severity, metadata };
  }
}

/**
 * Stage 4: Output Sanitization (Summary Scan)
 */
export class OutputSanitizer {
  constructor(patternMatcher, canarySystem = null) {
    this.patterns = patternMatcher;
    this.canarySystem = canarySystem;
  }
  
  /**
   * Scan output text for residual injection
   */
  scan(text, maxChars = 2000, options = {}) {
    if (!text || typeof text !== 'string') {
      return { clean: '', detections: [], severity: 0, flagged: false, metadata: {} };
    }
    
    let clean = text;
    const detections = [];
    const metadata = {};
    
    // 1. Truncate output if too long
    if (clean.length > maxChars) {
      clean = clean.substring(0, maxChars) + '\n[... truncated ...]';
      metadata.truncated = true;
    }
    
    // 2. Scan for output-specific patterns (tool calls, code execution markers)
    const outputMatches = this.patterns.scan(clean, ['output_signatures']);
    detections.push(...outputMatches);
    
    // 3. Scan for injection signatures that survived summarization
    const injectionMatches = this.patterns.scan(clean, ['injection_signatures']);
    detections.push(...injectionMatches);
    
    // NOTE: Exfiltration patterns are NOT scanned on output.
    // The LLM summary legitimately mentions URLs, emails, and IPs from the
    // source content. Flagging those in the *summary* causes false positives.
    // Exfiltration scanning remains active on INPUT (Stage 2) where it
    // catches actual exfil attempts embedded in raw web content.
    
    // 5. Check for canary tokens (CRITICAL: indicates bypass)
    if (this.canarySystem) {
      const canariesFound = this.canarySystem.detect(clean);
      
      if (canariesFound.length > 0) {
        detections.push({
          category: 'canary_patterns',
          name: 'canary_survived_summarization',
          match: `${canariesFound.length} canary tokens found in output`,
          severity: 10,
          canaries: canariesFound
        });
        
        metadata.canarySurvival = {
          count: canariesFound.length,
          tokens: canariesFound.map(c => c.token)
        };
      }
    }
    
    // Calculate total severity
    const severity = this.patterns.calculateSeverity(detections);
    const flagged = detections.length > 0;
    
    metadata.detectionCount = detections.length;
    metadata.severity = severity;
    
    // 6. Prepend warning if flagged with high severity
    if (flagged && severity >= 5) {
      clean = `⚠️  **FireClaw Warning:** Potential injection residue detected in summary (severity: ${severity})\n\n${clean}`;
    }
    
    // 7. For CRITICAL severity, strip suspicious content
    if (severity >= 15 && options.stripSuspicious !== false) {
      clean = this.stripSuspicious(clean, detections);
      metadata.stripped = true;
    }
    
    return { clean, detections, severity, flagged, metadata };
  }
  
  /**
   * Strip suspicious sections from output
   */
  stripSuspicious(text, detections) {
    let stripped = text;
    
    // Sort detections by position (descending) to avoid index shifting
    const sorted = [...detections]
      .filter(d => d.position !== undefined && d.match)
      .sort((a, b) => b.position - a.position);
    
    for (const detection of sorted) {
      const start = detection.position;
      const end = start + detection.match.length;
      
      // Replace match with sanitized placeholder
      stripped = stripped.substring(0, start) + '[REMOVED]' + stripped.substring(end);
    }
    
    return stripped;
  }
}

/**
 * Load patterns from patterns.json
 */
export async function loadPatterns(patternsPath) {
  try {
    const raw = await fs.readFile(patternsPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Sanitizer] Failed to load patterns from ${patternsPath}: ${err.message}`);
    throw err;
  }
}

/**
 * Create sanitizer instances
 */
export async function createSanitizers(patternsPath = null, trustTier = 'neutral') {
  const defaultPath = path.join(__dirname, 'patterns.json');
  const patterns = await loadPatterns(patternsPath || defaultPath);
  
  const matcher = new PatternMatcher(patterns);
  const canarySystem = new CanaryTokenSystem();
  const inputSanitizer = new InputSanitizer(matcher, trustTier);
  const outputSanitizer = new OutputSanitizer(matcher, canarySystem);
  
  return { inputSanitizer, outputSanitizer, patterns, canarySystem };
}

/**
 * Classify severity level
 */
export function classifySeverity(score, thresholds = { low: 1, medium: 6, high: 16 }) {
  if (score >= thresholds.high) return 'high';
  if (score >= thresholds.medium) return 'medium';
  if (score >= thresholds.low) return 'low';
  return 'none';
}

// Export for testing and external use
export default {
  PatternMatcher,
  InputSanitizer,
  OutputSanitizer,
  UnicodeNormalizer,
  HTMLAnalyzer,
  CanaryTokenSystem,
  loadPatterns,
  createSanitizers,
  classifySeverity
};
