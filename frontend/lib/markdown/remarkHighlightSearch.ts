/**
 * Escape HTML entities to prevent XSS when injecting into HTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Normalize text by removing diacritics (for PT-BR search matching)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Find all matches of searchQuery in text, considering diacritic normalization.
 * Uses a sliding window approach to find matches in normalized text and map back to original.
 */
function findMatches(text: string, searchQuery: string): Array<{ start: number; end: number }> {
  const normalizedText = normalizeText(text)
  const normalizedQuery = normalizeText(searchQuery.trim())
  
  if (!normalizedQuery || normalizedQuery.length === 0 || !normalizedText.includes(normalizedQuery)) {
    return []
  }

  const matches: Array<{ start: number; end: number }> = []
  let searchIndex = 0

  while (true) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, searchIndex)
    if (matchIndex === -1) break

    // Map normalized index back to original text
    // Count characters in original text until we reach the normalized position
    let originalIndex = 0
    let normalizedCount = 0
    
    for (let i = 0; i < text.length; i++) {
      if (normalizedCount >= matchIndex) {
        originalIndex = i
        break
      }
      const char = text[i]
      const normalizedChar = normalizeText(char)
      normalizedCount += normalizedChar.length
    }

    // Find end position
    let originalEnd = originalIndex
    let normalizedEndCount = normalizedCount
    
    for (let i = originalIndex; i < text.length && normalizedEndCount < matchIndex + normalizedQuery.length; i++) {
      const char = text[i]
      const normalizedChar = normalizeText(char)
      normalizedEndCount += normalizedChar.length
      originalEnd = i + 1
    }

    matches.push({ start: originalIndex, end: originalEnd })
    searchIndex = matchIndex + 1
  }

  return matches
}

/**
 * Simple function to highlight search terms in text by wrapping them in HTML mark tags.
 * This is used before passing content to react-markdown, which will render the HTML safely.
 * 
 * Note: This approach preserves markdown formatting while adding highlights.
 * The HTML is escaped properly by react-markdown's HTML rendering.
 * 
 * Handles diacritic normalization: "cafe" will match and highlight "café".
 */
export function highlightSearchTerms(text: string, searchQuery: string): string {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return text
  }

  const matches = findMatches(text, searchQuery)
  
  if (matches.length === 0) {
    return text
  }

  // Build highlighted string by replacing matches (process from end to start to preserve indices)
  const parts: Array<{ start: number; end: number; isMatch: boolean }> = []
  
  // Add all matches and gaps
  let lastIndex = 0
  matches.forEach((match) => {
    if (match.start > lastIndex) {
      parts.push({ start: lastIndex, end: match.start, isMatch: false })
    }
    parts.push({ start: match.start, end: match.end, isMatch: true })
    lastIndex = match.end
  })
  
  if (lastIndex < text.length) {
    parts.push({ start: lastIndex, end: text.length, isMatch: false })
  }

  return parts
    .map((part) => {
      const substring = text.slice(part.start, part.end)
      return part.isMatch
        ? `<mark data-search-highlight="true">${escapeHtml(substring)}</mark>`
        : substring
    })
    .join("")
}
