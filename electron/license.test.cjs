'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const nacl = require('tweetnacl');
const { openDatabase } = require('./db.cjs');
const {
  activationCodeFromPayload,
  decodeBase32,
  validateActivationCode,
} = require('./license.cjs');

function makeLicense(keyPair, installationId, issueDate, validityDays, type = 1) {
  const idBytes = Buffer.from(installationId, 'utf8');
  const payload = Buffer.alloc(7 + idBytes.length);
  payload[0] = 1;
  payload[1] = type;
  payload.writeUInt16BE(Date.parse(`${issueDate}T00:00:00.000Z`) / 86_400_000, 2);
  payload.writeUInt16BE(validityDays, 4);
  payload[6] = idBytes.length;
  idBytes.copy(payload, 7);
  const signature = Buffer.from(nacl.sign.detached(new Uint8Array(payload), keyPair.secretKey));
  return { payload, signature, code: activationCodeFromPayload(payload, signature) };
}

function run() {
  const keyPair = nacl.sign.keyPair();
  const installationId = 'ABC234';
  const license = makeLicense(keyPair, installationId, '2026-10-20', 10, 2);
  assert.strictEqual(license.code.length, 124);
  assert.strictEqual(decodeBase32(license.code).length, license.payload.length + 64);

  const valid = validateActivationCode(license.code, installationId, '2026-10-23', keyPair.publicKey);
  assert.strictEqual(valid.ok, true);
  assert.strictEqual(valid.issueDate, '2026-10-20');
  assert.strictEqual(valid.expiryDate, '2026-10-30');
  assert.strictEqual(valid.daysRemaining, 7);
  assert.strictEqual(valid.licenseTypeName, 'Profesional');

  const grouped = license.code.match(/.{1,5}/g).join(' - ');
  assert.strictEqual(
    validateActivationCode(
      `  ${grouped.slice(0, 70)}\n${grouped.slice(70).toLowerCase()}  `,
      installationId,
      '2026-10-23',
      keyPair.publicKey
    ).ok,
    true
  );
  assert.strictEqual(
    validateActivationCode(license.code, installationId.toLowerCase(), '2026-10-23', keyPair.publicKey).ok,
    true
  );
  assert.strictEqual(decodeBase32('O1'), null);
  assert.strictEqual(decodeBase32('ILU'), null);
  assert.strictEqual(
    validateActivationCode(license.code, 'XYZ789', '2026-10-23', keyPair.publicKey).code,
    'INSTALLATION_MISMATCH'
  );
  assert.strictEqual(
    validateActivationCode(license.code, installationId, '2026-10-30', keyPair.publicKey).code,
    'LICENSE_EXPIRED'
  );
  const invalidCode = `${license.code[0] === '0' ? '1' : '0'}${license.code.slice(1)}`;
  assert.strictEqual(
    validateActivationCode(invalidCode, installationId, '2026-10-23', keyPair.publicKey).code,
    'INVALID_SIGNATURE'
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ferrestock-license-test-'));
  const dbFile = path.join(tempDir, 'license.sqlite');
  const fallbackDbFile = path.join(tempDir, 'fallback.sqlite');
  const fallbackGuidPath = path.join(tempDir, 'fallback-guid');
  let currentTime = new Date('2026-10-22T12:00:00');
  let store;
  try {
    store = openDatabase(dbFile, {
      clock: () => currentTime,
      machineGuidReader: () => '123e4567-e89b-12d3-a456-426614174000',
    });
    const record = store.repo.getLicenseRecord();
    assert.strictEqual(record.installation_id, '0Z94WM');
    const storedLicense = makeLicense(keyPair, record.installation_id, '2026-10-20', 10);
    store.repo.saveLicense(storedLicense.payload, storedLicense.signature, '2026-10-20');
    assert.deepStrictEqual(Buffer.from(store.repo.getLicenseRecord().payload), storedLicense.payload);
    assert.deepStrictEqual(Buffer.from(store.repo.getLicenseRecord().signature), storedLicense.signature);
    assert.strictEqual(store.repo.getLicenseRecord().ultima_fecha_vista, '2026-10-22');

    currentTime = new Date('2026-10-23T12:00:00');
    assert.deepStrictEqual(store.repo.observeLicenseDate(), {
      clockRollback: false,
      currentDate: '2026-10-23',
      lastSeenDate: '2026-10-23',
    });

    store.db.prepare('UPDATE license_state SET ultima_fecha_vista = ? WHERE id = 1').run('2026-10-22');
    const product = store.repo.createProduct({ name: 'Producto de prueba', price: 10, stock: 2 });
    store.repo.recordSale({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'efectivo',
    });
    assert.strictEqual(store.repo.getLicenseRecord().ultima_fecha_vista, '2026-10-23');

    store.db.prepare('UPDATE license_state SET ultima_fecha_vista = ? WHERE id = 1').run('2026-10-24');
    assert.strictEqual(store.repo.observeLicenseDate().clockRollback, true);
    assert.throws(
      () => store.repo.recordSale({
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'efectivo',
      }),
      (error) => error.code === 'CLOCK_ROLLBACK'
    );

    store.close();
    store = openDatabase(dbFile, {
      machineGuidReader: () => { throw new Error('No debe recalcular el ID existente.'); },
    });
    assert.strictEqual(store.repo.getLicenseRecord().installation_id, '0Z94WM');

    store.close();
    store = openDatabase(fallbackDbFile, {
      fallbackGuidPath,
      machineGuidReader: () => { throw new Error('MachineGuid no disponible.'); },
    });
    const fallbackId = store.repo.getLicenseRecord().installation_id;
    const fallbackGuid = fs.readFileSync(fallbackGuidPath, 'utf8');
    assert.match(fallbackGuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.match(fallbackId, /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    store.close();
    fs.rmSync(fallbackDbFile, { force: true });

    store = openDatabase(fallbackDbFile, {
      fallbackGuidPath,
      machineGuidReader: () => null,
    });
    assert.strictEqual(store.repo.getLicenseRecord().installation_id, fallbackId);
  } finally {
    if (store) store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run();
console.log('license tests passed');
