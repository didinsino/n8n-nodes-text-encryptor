import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-cbc';

// Force the key to be 32 bytes regardless of user input
function forceTo32bytes(key: string) {
    return createHash('sha256').update(key).digest(); 
}

export function encryptString(text: string, secretKey = '') {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, forceTo32bytes(secretKey), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

export function decryptString(encryptedText: string, secretKey = '') {
    const textParts = encryptedText.split(':');
    const ivHex = textParts.shift();
    const iv = Buffer.from(ivHex as string, 'hex');
    const encryptedData = Buffer.from(textParts.join(':'), 'hex');
    const decipher = createDecipheriv(ALGORITHM, forceTo32bytes(secretKey), iv);
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decryptedBuffer.toString('utf8');
}