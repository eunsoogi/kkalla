import fs from 'fs';
import path from 'path';

type MessageTree = Record<string, unknown>;

export interface TestI18nOptions {
  args?: Record<string, unknown>;
  defaultValue?: string;
  [key: string]: unknown;
}

const KO_LOCALE_DIR = path.resolve(__dirname, '../i18n/ko');
const PLACEHOLDER_PATTERN = /{([^{}]+)}/g;

const KO_MESSAGES = loadKoMessages();

export function translateKoMessage(key: string, options?: TestI18nOptions): string {
  const resolved = getByPath(KO_MESSAGES, key);
  if (typeof resolved !== 'string') {
    return options?.defaultValue ?? key;
  }

  return interpolateTemplate(resolved, options?.args ?? {});
}

function loadKoMessages(): MessageTree {
  const merged: MessageTree = {};
  const localeFiles = getLocaleFiles(KO_LOCALE_DIR);

  for (const filename of localeFiles) {
    const filePath = path.join(KO_LOCALE_DIR, filename);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const namespace = filename.replace(/\.json$/i, '');

    if (!isRecord(parsed)) {
      continue;
    }

    const existing = merged[namespace];
    if (isRecord(existing)) {
      mergeDeep(existing, parsed);
      continue;
    }

    const scoped: MessageTree = {};
    mergeDeep(scoped, parsed);
    merged[namespace] = scoped;
  }

  return merged;
}

function getLocaleFiles(localeDir: string): string[] {
  return fs
    .readdirSync(localeDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function interpolateTemplate(template: string, args: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match: string, token: string) => {
    const value = getByPath(args, token);
    if (value == null) {
      return `{${token}}`;
    }
    return String(value);
  });
}

function getByPath(root: MessageTree, dottedPath: string): unknown {
  const segments = dottedPath.split('.');
  let current: unknown = root;

  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function mergeDeep(target: MessageTree, source: MessageTree): void {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value)) {
      const existing = target[key];
      if (isRecord(existing)) {
        mergeDeep(existing, value);
        continue;
      }

      const nested: MessageTree = {};
      mergeDeep(nested, value);
      target[key] = nested;
      continue;
    }

    target[key] = value;
  }
}

function isRecord(value: unknown): value is MessageTree {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}
