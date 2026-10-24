'use strict';

const { spawnSync } = require('child_process');
const electronPath = require('electron');

const result = spawnSync(electronPath, ['electron/db.test.cjs'], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
