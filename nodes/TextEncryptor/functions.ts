import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

export type Algorithm = 'aes-256-gcm' | 'aes-256-cbc';

export function encryptString(plainText: string, secretKey = '', algorithm: Algorithm) {
    const key32bytes = forceTo32bytes(secretKey);
    
    if (algorithm === 'aes-256-cbc') {
        const iv = randomBytes(16);
        const cipher = createCipheriv(algorithm, key32bytes, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + encrypted;
    }

    // Default to aes-256-gcm
    const iv = randomBytes(12); // GCM recommends a 12-byte (96-bit) IV for security and performance
    const cipher = createCipheriv(algorithm, key32bytes, iv);
    let ciphertext = cipher.update(plainText, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, ciphertext, authTag]);
    return combined.toString('hex');
}

export function decryptString(encryptedText: string, secretKey = '', algorithm: Algorithm) {
    const key32bytes = forceTo32bytes(secretKey);
    const combined = Buffer.from(encryptedText, 'hex');

    if (algorithm === 'aes-256-cbc') {
        const iv = combined.subarray(0, 16);
        const encryptedTextBuffer = combined.subarray(16);
        const decipher = createDecipheriv(algorithm, key32bytes, iv);
        const decryptedBuffer = Buffer.concat([
            decipher.update(encryptedTextBuffer),
            decipher.final()
        ]);
        return decryptedBuffer.toString('utf8');
    }

    // Default to aes-256-gcm
    // Define lengths
    const ivLength = 12; // 12 bytes for IV
    const authTagLength = 16; // GCM auth tag is typically 16 bytes (128 bits)

    // Slice the buffer to get IV, ciphertext, and auth tag
    const iv = combined.subarray(0, ivLength);
    const ciphertext = combined.subarray(ivLength, combined.length - authTagLength);
    const authTag = combined.subarray(combined.length - authTagLength);

    const decipher = createDecipheriv(algorithm, key32bytes, iv);
    // Set the authentication tag before decryption
    decipher.setAuthTag(authTag);

    // Decrypt the ciphertext
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString('utf8');
}

// Force the key to be 32 bytes regardless of user input
function forceTo32bytes(key: string) {
    return createHash('sha256').update(key).digest();
}