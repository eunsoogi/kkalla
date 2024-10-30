import { readFileSync } from 'fs';

export const readKey = (keyPath: string): string => {
  return Buffer.from(readFileSync(keyPath, 'utf8'), 'base64').toString('hex');
};
