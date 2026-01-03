import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// In a real app, this should be a long, random string in process.env.ENCRYPTION_KEY
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
    ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'voseknows_salt', KEY_LENGTH)
    : Buffer.alloc(KEY_LENGTH, 'default_dev_key_change_me_in_prod');

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a string in the format: iv.encryptedData.authTag
 */
export const encrypt = (text: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}.${encrypted}.${authTag}`;
};

/**
 * Decrypts a string encrypted with the above encrypt function.
 */
export const decrypt = (encryptedText: string): string => {
    const [ivHex, encryptedHex, authTagHex] = encryptedText.split(".");

    if (!ivHex || !encryptedHex || !authTagHex) {
        throw new Error("Invalid encrypted text format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};
