/**
 * Replaces {{variable_name}} placeholders with provided values.
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, varName) => {
    const value = variables[varName];
    if (value === undefined || value === null) {
      return `{{${varName}}}`;
    }
    return String(value);
  });
}

/**
 * Calculates SMS segment count and character breakdown according to standard GSM-7 and UCS-2 standards.
 */
export function calculateSmsCredits(text: string): {
  charCount: number;
  segments: number;
  isUnicode: boolean;
  maxPerSegment: number;
  remainingInSegment: number;
} {
  const charCount = text.length;

  // Basic GSM-7 characters check (ASCII range + common symbols)
  // If text contains emojis or non-standard characters, it uses UCS-2 encoding
  // eslint-disable-next-line no-control-regex
  const isUnicode = /[^\u0000-\u007F]/.test(text);

  if (isUnicode) {
    // UCS-2: 70 chars for 1 segment, 67 chars per segment for multi-part
    if (charCount <= 70) {
      return {
        charCount,
        segments: charCount === 0 ? 0 : 1,
        isUnicode: true,
        maxPerSegment: 70,
        remainingInSegment: 70 - charCount,
      };
    }
    const segments = Math.ceil(charCount / 67);
    const remainingInSegment = segments * 67 - charCount;
    return {
      charCount,
      segments,
      isUnicode: true,
      maxPerSegment: 67,
      remainingInSegment,
    };
  }

  // GSM-7: 160 chars for 1 segment, 153 chars per segment for multi-part
  if (charCount <= 160) {
    return {
      charCount,
      segments: charCount === 0 ? 0 : 1,
      isUnicode: false,
      maxPerSegment: 160,
      remainingInSegment: 160 - charCount,
    };
  }

  const segments = Math.ceil(charCount / 153);
  const remainingInSegment = segments * 153 - charCount;
  return {
    charCount,
    segments,
    isUnicode: false,
    maxPerSegment: 153,
    remainingInSegment,
  };
}
