import { createHash } from 'node:crypto';

// Match Git's CRLF checkout conversion, preserving every other character.
// Artifact and security scans must still verify the actual deployed bytes.
export const normalizeCheckoutNewlines = (content) => content.replace(/\r\n/g, '\n');
export const sourceTextHash = (content) => createHash('sha256').update(normalizeCheckoutNewlines(content)).digest('hex');
