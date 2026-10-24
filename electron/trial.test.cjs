'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTrialStatus, TRIAL_DURATION_MS } = require('./trial.cjs');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipv-trial-'));
const stateFile = path.join(directory, 'trial.json');

try {
  const firstDay = Date.UTC(2026, 0, 1);
  assert.deepStrictEqual(getTrialStatus(stateFile, firstDay), { isActive: true, daysRemaining: 7 });
  assert.deepStrictEqual(
    getTrialStatus(stateFile, firstDay + 6 * 24 * 60 * 60 * 1000),
    { isActive: true, daysRemaining: 1 }
  );
  assert.deepStrictEqual(
    getTrialStatus(stateFile, firstDay + 2 * 24 * 60 * 60 * 1000),
    { isActive: true, daysRemaining: 1 }
  );
  assert.deepStrictEqual(
    getTrialStatus(stateFile, firstDay + TRIAL_DURATION_MS),
    { isActive: false, daysRemaining: 0 }
  );
  assert.deepStrictEqual(
    getTrialStatus(stateFile, firstDay + 2 * 24 * 60 * 60 * 1000),
    { isActive: false, daysRemaining: 0 }
  );
  assert.throws(() => {
    fs.writeFileSync(stateFile, '{malformed');
    getTrialStatus(stateFile, firstDay);
  });
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log('Prueba de período de prueba: OK');
