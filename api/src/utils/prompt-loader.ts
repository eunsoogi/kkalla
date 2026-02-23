import { readFileSync } from 'fs';
import { join } from 'path';

export const loadPromptMarkdown = (directory: string, filename: string): string => {
  const path = join(directory, filename);
  return readFileSync(path, 'utf8');
};
