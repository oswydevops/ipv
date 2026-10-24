const crypto = require('crypto');
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function unb32(s) {
  let bits = 0, val = 0; const out = [];
  for (const c of s) {
    const i = ALPHA.indexOf(c);
    if (i < 0) throw new Error('Carácter inválido: ' + c);
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; }
  }
  return Buffer.from(out);
}
const [, , codigoRaw, pubHex] = process.argv;
const buf = unb32(codigoRaw.replace(/[\s-]/g, '').toUpperCase());
const payload = buf.subarray(0, buf.length - 64);
const firma = buf.subarray(buf.length - 64);
const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pubHex.trim(), 'hex')]);
const pub = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
console.log('Bytes totales:', buf.length, '(esperado: 71 + largo del ID)');
console.log('Firma válida:', crypto.verify(null, payload, pub, firma));