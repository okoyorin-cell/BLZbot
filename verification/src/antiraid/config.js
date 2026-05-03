'use strict';

/**
 * Anti-raid — config du bot Protect.
 * Surcharge via .env : ANTI_RAID_ROLE_ID, ANTI_RAID_LOG_CHANNEL_ID, ANTI_RAID_ALL_LOG_CHANNEL_ID,
 * ANTI_RAID_PROTECTED_ROLES (IDs séparés par virgules).
 */
const path = require('node:path');

function envId(name, fallback) {
  const v = String(process.env[name] || '').trim();
  return /^\d{17,22}$/.test(v) ? v : fallback;
}

function parseIds(raw, fallbacks) {
  const fromEnv = String(raw || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{17,22}$/.test(s));
  if (fromEnv.length > 0) return fromEnv;
  return fallbacks;
}

module.exports = {
  RAID_ROLE_ID: envId('ANTI_RAID_ROLE_ID', '1400457540386422916'),
  RAID_LOG_CHANNEL_ID: envId('ANTI_RAID_LOG_CHANNEL_ID', '1454490890297933944'),
  ALL_LOG_CHANNEL_ID: envId('ANTI_RAID_ALL_LOG_CHANNEL_ID', '1454505747080548372'),

  RAID_DETECTION: {
    ACTION_THRESHOLD: parseInt(process.env.ANTI_RAID_ACTION_THRESHOLD || '50', 10) || 50,
    CRITICAL_THRESHOLD: parseInt(process.env.ANTI_RAID_CRITICAL_THRESHOLD || '100', 10) || 100,
    DECAY_RATE: parseInt(process.env.ANTI_RAID_DECAY_RATE || '1', 10) || 1,
    DECAY_INTERVAL: parseInt(process.env.ANTI_RAID_DECAY_INTERVAL_MS || '60000', 10) || 60000,
    JOIN_WINDOW: parseInt(process.env.ANTI_RAID_JOIN_WINDOW_MS || '10000', 10) || 10000,
    JOIN_THRESHOLD: parseInt(process.env.ANTI_RAID_JOIN_THRESHOLD || '10', 10) || 10,
    JOIN_SCORE_MULTIPLIER: parseInt(process.env.ANTI_RAID_JOIN_SCORE_MULT || '25', 10) || 25,
    NEW_ACCOUNT_DAYS: parseInt(process.env.ANTI_RAID_NEW_ACCOUNT_DAYS || '7', 10) || 7,
    NEW_ACCOUNT_SCORE: parseInt(process.env.ANTI_RAID_NEW_ACCOUNT_SCORE || '10', 10) || 10,
    SIMILAR_NAME_THRESHOLD: parseInt(process.env.ANTI_RAID_SIMILAR_NAME_THRESHOLD || '3', 10) || 3,
    SIMILAR_NAME_SCORE: parseInt(process.env.ANTI_RAID_SIMILAR_NAME_SCORE || '20', 10) || 20,
    SPAM_CHANNEL_THRESHOLD: parseInt(process.env.ANTI_RAID_SPAM_CH_THRESHOLD || '3', 10) || 3,
    SPAM_CHANNEL_WINDOW: parseInt(process.env.ANTI_RAID_SPAM_CH_WINDOW_MS || '10000', 10) || 10000,
    SPAM_CHANNEL_SCORE: parseInt(process.env.ANTI_RAID_SPAM_CH_SCORE || '50', 10) || 50,
    REPEAT_MESSAGE_THRESHOLD: parseInt(process.env.ANTI_RAID_REPEAT_THRESHOLD || '10', 10) || 10,
    REPEAT_MESSAGE_SCORE: parseInt(process.env.ANTI_RAID_REPEAT_SCORE || '30', 10) || 30,
    PROTECTED_ROLES: parseIds(process.env.ANTI_RAID_PROTECTED_ROLES, ['1172237685763608579']),
  },
};
