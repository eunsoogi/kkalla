import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Retrieves prompt markdown for the backend service flow.
 * @param directory - Input value for directory.
 * @param filename - Input value for filename.
 * @returns Formatted string output for the operation.
 */
export const loadPromptMarkdown = (directory: string, filename: string): string => {
  const path = join(directory, filename);
  return readFileSync(path, 'utf8');
};
