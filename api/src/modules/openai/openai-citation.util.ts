export interface CitationRef {
  startIndex?: number | null;
  endIndex?: number | null;
  type?: string | null;
  url?: string | null;
  title?: string | null;
  text?: string | null;
}

const CITATION_MARKER_PATTERNS: RegExp[] = [
  /〖[^〗]*†source〗/g,
  /\[\^\d+\]/g,
  /\[[^\]\n]+\]\s*\(\s*(https?:\/\/[^\s)]+)\s*\)/g,
  /\[(?:출처|source|sources)\s*:[^\]]+\]/gi,
  /\(\s*https?:\/\/[^\s)]+\s*\)/gi,
  /https?:\/\/[^\s)]+/gi,
];

const CITATION_LINE_PATTERNS: RegExp[] = [
  /^\s*(?:출처|sources?)\s*:\s*https?:\/\/\S+\s*$/gim,
  /^\s*(?:출처|sources?)\s*:\s*$/gim,
  /^\s*(?:\[\d+\]|[-*]|\d+\.)\s*https?:\/\/\S+\s*$/gim,
];

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function stripByCitationRanges(raw: string, annotations?: CitationRef[]): string {
  if (!Array.isArray(annotations) || annotations.length < 1) {
    return raw;
  }

  const ranges = annotations
    .map((annotation) => {
      const start = toFiniteNumber(annotation?.startIndex);
      const end = toFiniteNumber(annotation?.endIndex);
      if (start == null || end == null) {
        return null;
      }
      if (start < 0 || end <= start || end > raw.length) {
        return null;
      }
      return { start, end };
    })
    .filter((range): range is { start: number; end: number } => range != null)
    .sort((a, b) => b.start - a.start);

  if (ranges.length < 1) {
    return raw;
  }

  let text = raw;
  for (const range of ranges) {
    text = `${text.slice(0, range.start)}${text.slice(range.end)}`;
  }
  return text;
}

function stripCitationMarkers(raw: string): string {
  let text = raw;
  for (const pattern of CITATION_MARKER_PATTERNS) {
    text = text.replace(pattern, '');
  }

  // Remove wrappers left after removing links, e.g. "([source](...))" -> "()".
  text = text.replace(/\(\s*[,;:]*\s*\)/g, '');
  text = text.replace(/\[\s*\]/g, '');

  // Remove plain numeric footnotes only when they look like citation markers.
  text = text.replace(/(^|[\s(,.;:!?])\[\d+\](?=(?:[\s,.;:!?)]|$))/gm, '$1');
  text = text.replace(/([가-힣])\[\d+\](?=(?:[\s,.;:!?)]|$))/g, '$1');

  for (const pattern of CITATION_LINE_PATTERNS) {
    text = text.replace(pattern, '');
  }
  return text;
}

function normalizeWhitespace(raw: string): string {
  return raw
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;!?%])/g, '$1')
    .trim();
}

export function toUserFacingText(raw: string | null | undefined, annotations?: CitationRef[]): string {
  const source = typeof raw === 'string' ? raw : '';
  if (!source) {
    return '';
  }

  const annotationStripped = stripByCitationRanges(source, annotations);
  const citationStripped = stripCitationMarkers(annotationStripped);
  return normalizeWhitespace(citationStripped);
}
