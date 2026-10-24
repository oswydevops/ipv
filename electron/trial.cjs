'use strict';

const fs = require('fs');

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getTrialStatus(filePath, now = Date.now()) {
  let state;
  if (fs.existsSync(filePath)) {
    state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (
      !state ||
      !Number.isFinite(state.startedAt) ||
      !Number.isFinite(state.lastSeenAt) ||
      state.startedAt <= 0 ||
      state.lastSeenAt < state.startedAt
    ) {
      throw new Error('El estado local de la prueba gratuita no es válido.');
    }
  } else {
    state = { startedAt: now, lastSeenAt: now };
  }

  const effectiveNow = Math.max(now, state.lastSeenAt);
  if (effectiveNow !== state.lastSeenAt || !fs.existsSync(filePath)) {
    state.lastSeenAt = effectiveNow;
    fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
  }

  const expiresAt = state.startedAt + TRIAL_DURATION_MS;
  return {
    isActive: effectiveNow < expiresAt,
    daysRemaining: Math.max(0, Math.ceil((expiresAt - effectiveNow) / (24 * 60 * 60 * 1000))),
  };
}

module.exports = { getTrialStatus, TRIAL_DURATION_MS };
