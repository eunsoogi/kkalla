import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function listTypeScriptFilesRecursively(dir: string): string[] {
  const entries = readdirSync(dir).map((entry) => join(dir, entry));
  const files: string[] = [];

  for (const entryPath of entries) {
    const stat = statSync(entryPath);
    if (stat.isDirectory()) {
      files.push(...listTypeScriptFilesRecursively(entryPath));
      continue;
    }

    if (entryPath.endsWith('.ts') && !entryPath.endsWith('.spec.ts')) {
      files.push(entryPath);
    }
  }

  return files;
}

describe('utils boundary', () => {
  it('should not import module-layer code from src/utils', () => {
    const utilsDir = __dirname;
    const files = listTypeScriptFilesRecursively(utilsDir);

    const violations = files
      .map((filePath) => {
        const content = readFileSync(filePath, 'utf8');
        const importsModuleLayer =
          content.includes("from '@/modules/") ||
          content.includes('from "@/modules/') ||
          content.includes("from '../modules/") ||
          content.includes('from "../modules/');

        return importsModuleLayer ? filePath : null;
      })
      .filter((value): value is string => value !== null);

    expect(violations).toEqual([]);
  });
});
