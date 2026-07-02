import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
  const raw = process.env.FISCAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('FISCAL_ENCRYPTION_KEY não configurada no ambiente');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('FISCAL_ENCRYPTION_KEY deve ser uma string hex de 32 bytes (64 caracteres)');
  }
  return key;
}

// Criptografa um segredo (ex: token da Focus NFe) para armazenamento em repouso.
// Retorna "iv:authTag:cipherText" em hex, tudo em um único campo de texto.
export function encryptSecret(plainText) {
  if (plainText === null || plainText === undefined) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload) {
  if (!payload) return null;
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Formato inválido para segredo criptografado');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
