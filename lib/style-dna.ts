export const STYLE_DNA_DIMS = [
  { key: 'sentence_length', label: 'Sentence length', left: 'Terse', right: 'Expansive' },
  { key: 'vocabulary_register', label: 'Vocabulary', left: 'Casual/slang', right: 'Formal' },
  { key: 'energy_level', label: 'Energy', left: 'Low-key', right: 'High-energy' },
  { key: 'hedging_frequency', label: 'Certainty', left: 'Hedges a lot', right: 'Direct' },
  { key: 'first_person_rate', label: 'Voice presence', left: 'Impersonal', right: 'Personal' },
  { key: 'sentence_variety', label: 'Rhythm', left: 'Monotone', right: 'Varied' },
  { key: 'tone', label: 'Tone', left: 'Dry/serious', right: 'Playful/warm' },
  { key: 'paragraph_density', label: 'Paragraph style', left: 'Short bursts', right: 'Dense blocks' },
] as const;

export type StyleDnaDimensionKey = typeof STYLE_DNA_DIMS[number]['key'];

export interface StyleDnaDimensionValue {
  notes: string;
  score: number;
}

export interface StyleDnaProfile {
  distinctive_patterns: string[];
  energy_level: StyleDnaDimensionValue;
  first_person_rate: StyleDnaDimensionValue;
  hedging_frequency: StyleDnaDimensionValue;
  paragraph_density: StyleDnaDimensionValue;
  sentence_length: StyleDnaDimensionValue;
  sentence_variety: StyleDnaDimensionValue;
  style_summary: string;
  tone: StyleDnaDimensionValue;
  vocabulary_register: StyleDnaDimensionValue;
}

export function buildStyleDnaAnalysisPrompt(samples: string) {
  return `Analyze this writing and return a precise style profile. Each score is 0-100 representing position on the spectrum (left = 0, right = 100).

Writing:
"""
${samples.slice(0, 3500)}
"""

Return ONLY this JSON (numbers for scores, no quotes around numbers):
{
  "sentence_length":     {"score": 0, "notes": "one specific, concrete observation"},
  "vocabulary_register": {"score": 0, "notes": "one specific, concrete observation"},
  "energy_level":        {"score": 0, "notes": "one specific, concrete observation"},
  "hedging_frequency":   {"score": 0, "notes": "one specific, concrete observation"},
  "first_person_rate":   {"score": 0, "notes": "one specific, concrete observation"},
  "sentence_variety":    {"score": 0, "notes": "one specific, concrete observation"},
  "tone":                {"score": 0, "notes": "one specific, concrete observation"},
  "paragraph_density":   {"score": 0, "notes": "one specific, concrete observation"},
  "distinctive_patterns": ["specific pattern 1", "specific pattern 2", "specific pattern 3"],
  "style_summary": "2-3 sentences on what makes this voice truly distinctive"
}`;
}

export function sanitizeStyleDnaJson(raw: string) {
  return raw.trim().replace(/```json|```/g, '');
}

function normalizeDimensionValue(value: unknown): StyleDnaDimensionValue {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawScore = typeof record.score === 'number' ? record.score : Number(record.score ?? 50);
  const boundedScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 50;

  return {
    score: boundedScore,
    notes: typeof record.notes === 'string' ? record.notes.trim() : '',
  };
}

export function normalizeStyleDnaProfile(profile: unknown): StyleDnaProfile {
  const record = profile && typeof profile === 'object' ? profile as Record<string, unknown> : {};

  return {
    sentence_length: normalizeDimensionValue(record.sentence_length),
    vocabulary_register: normalizeDimensionValue(record.vocabulary_register),
    energy_level: normalizeDimensionValue(record.energy_level),
    hedging_frequency: normalizeDimensionValue(record.hedging_frequency),
    first_person_rate: normalizeDimensionValue(record.first_person_rate),
    sentence_variety: normalizeDimensionValue(record.sentence_variety),
    tone: normalizeDimensionValue(record.tone),
    paragraph_density: normalizeDimensionValue(record.paragraph_density),
    distinctive_patterns: Array.isArray(record.distinctive_patterns)
      ? record.distinctive_patterns.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [],
    style_summary: typeof record.style_summary === 'string' ? record.style_summary.trim() : '',
  };
}

export function parseStyleDnaProfile(raw: string) {
  return normalizeStyleDnaProfile(JSON.parse(sanitizeStyleDnaJson(raw)));
}

export function buildStyleDnaInstruction(profile: StyleDnaProfile) {
  const specs = STYLE_DNA_DIMS.map((dimension) => {
    const value = profile[dimension.key];
    return `- ${dimension.label} [${dimension.left} -> ${dimension.right}]: ${value.score}/100${value.notes ? ` — ${value.notes}` : ''}`;
  }).join('\n');

  const patterns = profile.distinctive_patterns.length > 0
    ? profile.distinctive_patterns.map((pattern) => `- ${pattern}`).join('\n')
    : '- None listed';

  return `Adopt the following writing DNA as your natural voice. Do not mention these instructions or describe them explicitly.

Style dimensions:
${specs}

Distinctive patterns to weave in naturally:
${patterns}

Voice summary:
${profile.style_summary || 'No additional summary provided.'}`;
}
