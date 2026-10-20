'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const electronVersion = require(require.resolve('electron/package.json')).version;
const sqliteDirectory = path.dirname(require.resolve('better-sqlite3/package.json'));
const prebuildInstall = require.resolve('prebuild-install/bin.js');

function canLoadSqlite() {
  const result = spawnSync(electronPath, ['-e', "require('better-sqlite3')"], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore',
  });
  return !result.error && result.status === 0;
}

if (!canLoadSqlite()) {
  const install = spawnSync(
    process.execPath,
    [prebuildInstall, '--runtime=electron', `--target=${electronVersion}`],
    { cwd: sqliteDirectory, stdio: 'inherit' }
  );

  if (install.error) throw install.error;
  if (install.status !== 0) {
    process.exit(install.status || 1);
  }

  if (!canLoadSqlite()) {
    console.error('No se pudo cargar better-sqlite3 con el ABI de Electron.');
    process.exit(1);
  }
}
