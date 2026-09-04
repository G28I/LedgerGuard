/**
 * Normalization & Text Matching Utilities
 * Pure functions for cleaning strings, stripping corporate noise, extracting reference tokens,
 * and calculating vendor similarity scores.
 */

const CORPORATE_SUFFIXES = [
  'corporation',
  'limited',
  'incorporated',
  'company',
  'corp',
  'ltd',
  'inc',
  'llc',
  'co',
  'gmbh',
  'plc',
  'sa',
  'nv',
];

/**
 * Clean reference strings by converting to uppercase and stripping non-alphanumeric chars.
 */
export function cleanRef(ref: string | null | undefined): string {
  if (!ref) return '';
  return ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalize vendor names or descriptions:
 * Lowercases, strips punctuation, and removes common corporate suffixes.
 */
export function normalizeVendorName(rawName: string | null | undefined): string {
  if (!rawName) return '';

  let normalized = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .trim();

  // Strip corporate suffixes from individual tokens or end of string
  for (const suffix of CORPORATE_SUFFIXES) {
    const suffixRegex = new RegExp(`\\b${suffix}\\b`, 'gi');
    normalized = normalized.replace(suffixRegex, '').trim();
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Extract embedded reference tokens (e.g. "INV-2026-001", "PO-9901") from bank descriptions.
 */
export function extractReferenceToken(description: string | null | undefined): string | null {
  if (!description) return null;

  // Regex patterns for common reference structures
  const refPatterns = [
    /\b(INV[-_\s]?\d+[-_\s]?\d*)\b/i,
    /\b(PO[-_\s]?\d+[-_\s]?\d*)\b/i,
    /\b(LEG[-_\s]?\d+[-_\s]?\d*)\b/i,
    /\b(BILL[-_\s]?\d+[-_\s]?\d*)\b/i,
  ];

  for (const pattern of refPatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return cleanRef(match[1]);
    }
  }

  return null;
}

/**
 * Calculate Jaro-Winkler string similarity score between two normalized strings (0.0 to 1.0).
 */
export function calculateVendorSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeVendorName(s1);
  const norm2 = normalizeVendorName(s2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // Exact token set overlap check
  const tokens1 = new Set(norm1.split(' ').filter(Boolean));
  const tokens2 = new Set(norm2.split(' ').filter(Boolean));

  let matchTokens = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) matchTokens++;
  });

  const totalTokens = Math.max(tokens1.size, tokens2.size);
  const jaccardScore = totalTokens > 0 ? matchTokens / totalTokens : 0;

  // Jaro-Winkler base implementation for token similarity
  const jaroScore = jaroDistance(norm1, norm2);

  // Blend Jaccard token overlap and character Jaro distance
  return Math.max(jaccardScore, jaroScore);
}

function jaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const m = matches;
  return (m / len1 + m / len2 + (m - transpositions / 2) / m) / 3;
}

/**
 * Calculate date difference in calendar days between two Date objects.
 * Normalizes both timestamps to UTC calendar days to avoid partial-day drift.
 */
export function calculateDateDeltaDays(date1: Date, date2: Date): number {
  const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
  const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((utc1 - utc2) / msPerDay);
}
