'use strict';

const { createPublicKey, verify } = require('crypto');

const PUBLIC_KEY_HEX = 'cf82f4454222a908b1a477f09f4a1fc98d5875997a73c37e2e50f810804a3b52';
const PUBLIC_KEY_PREFIX_HEX = '302a300506032b6570032100';
const BASE32_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SIGNATURE_LENGTH = 64;
const LICENSE_TYPES = {
  1: 'Estándar',
  2: 'Profesional',
  3: 'Empresarial',
};

function normalizeActivationCode(code) {
  return typeof code === 'string' ? code.replace(/[\s-]/g, '').toUpperCase() : '';
}

function decodeBase32Crockford(code) {
  const normalized = normalizeActivationCode(code);
  if (!normalized || !/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+$/.test(normalized)) return null;

  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const character of normalized) {
    buffer = (buffer << 5) | BASE32_CROCKFORD.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }

  return Buffer.from(bytes);
}

function encodeBase32Crockford(bytes) {
  let result = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_CROCKFORD[(buffer >> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) result += BASE32_CROCKFORD[(buffer << (5 - bits)) & 31];
  return result;
}

function getPublicKey(publicKeyBytes) {
  const rawKey = publicKeyBytes
    ? Buffer.from(publicKeyBytes)
    : Buffer.from(PUBLIC_KEY_HEX, 'hex');
  if (rawKey.length !== 32) return null;

  const spki = Buffer.concat([
    Buffer.from(PUBLIC_KEY_PREFIX_HEX, 'hex'),
    rawKey,
  ]);
  return createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

function dateToEpochDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return null;
  const time = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return null;
  return Math.floor(time / 86_400_000);
}

function epochDayToDate(epochDay) {
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const startDay = dateToEpochDay(start);
  const endDay = dateToEpochDay(end);
  return startDay === null || endDay === null ? 0 : endDay - startDay;
}

function validatePayload(payload, signature, installationId, today, publicKeyBytes) {
  if (!Buffer.isBuffer(payload) || payload.length < 7 || !Buffer.isBuffer(signature) || signature.length !== SIGNATURE_LENGTH) {
    return { ok: false, code: 'INVALID_SIGNATURE' };
  }

  let publicKey;
  try {
    publicKey = getPublicKey(publicKeyBytes);
  } catch {
    return { ok: false, code: 'INVALID_SIGNATURE' };
  }
  if (!publicKey || !verify(null, payload, publicKey, signature)) {
    return { ok: false, code: 'INVALID_SIGNATURE' };
  }

  const version = payload[0];
  const licenseType = payload[1];
  const issueEpochDay = payload.readUInt16BE(2);
  const validityDays = payload.readUInt16BE(4);
  const installationIdLength = payload[6];
  if (
    version !== 1 ||
    payload.length !== 7 + installationIdLength ||
    installationIdLength === 0
  ) {
    return { ok: false, code: 'INVALID_CODE' };
  }

  const idBytes = payload.subarray(7);
  const payloadInstallationId = idBytes.toString('utf8');
  if (!Buffer.from(payloadInstallationId, 'utf8').equals(idBytes)) {
    return { ok: false, code: 'INVALID_CODE' };
  }
  if (payloadInstallationId.toUpperCase() !== String(installationId).toUpperCase()) {
    return { ok: false, code: 'INSTALLATION_MISMATCH' };
  }

  const expiryEpochDay = issueEpochDay + validityDays;
  const issueDate = epochDayToDate(issueEpochDay);
  const expiryDate = epochDayToDate(expiryEpochDay);
  const todayEpochDay = dateToEpochDay(today);
  if (todayEpochDay === null) return { ok: false, code: 'INVALID_CODE' };

  const details = {
    payloadInstallationId,
    issueDate,
    validityDays,
    expiryDate,
    daysRemaining: Math.max(0, expiryEpochDay - todayEpochDay),
    licenseType,
    licenseTypeName: LICENSE_TYPES[licenseType] || `Licencia ${licenseType}`,
  };
  if (todayEpochDay >= expiryEpochDay) {
    return { ok: false, code: 'LICENSE_EXPIRED', ...details };
  }

  return { ok: true, ...details };
}

function validateActivationCode(code, installationId, today, publicKeyBytes) {
  const decoded = decodeBase32Crockford(code);
  if (!decoded || decoded.length < SIGNATURE_LENGTH + 7) {
    return { ok: false, code: 'INVALID_SIGNATURE' };
  }

  const payloadLength = decoded.length - SIGNATURE_LENGTH;
  const payload = decoded.subarray(0, payloadLength);
  const signature = decoded.subarray(payloadLength);
  const result = validatePayload(payload, signature, installationId, today, publicKeyBytes);
  return result.ok ? { ...result, payload, signature } : result;
}

function activationCodeFromPayload(payload, signature) {
  return encodeBase32Crockford(Buffer.concat([Buffer.from(payload), Buffer.from(signature)]));
}

module.exports = {
  LICENSE_TYPES,
  PUBLIC_KEY_HEX,
  activationCodeFromPayload,
  daysBetween,
  decodeBase32: decodeBase32Crockford,
  normalizeActivationCode,
  validateActivationCode,
  validatePayload,
};
