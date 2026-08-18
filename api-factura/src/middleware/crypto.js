const crypto = require('crypto');
require('dotenv').config();

const RAW_KEY = process.env.ENCRYPTION_KEY;

if (!RAW_KEY || RAW_KEY.length !== 64) {
  console.warn(
    '[crypto] ENCRYPTION_KEY no está definida o no mide 64 caracteres hex (32 bytes). ' +
    'Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

const KEY = Buffer.from(RAW_KEY || '0'.repeat(64), 'hex');
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(plainText) {
  if (plainText === null || plainText === undefined) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decrypt(buffer) {
  if (!buffer) return null;
  const iv = buffer.subarray(0, IV_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };