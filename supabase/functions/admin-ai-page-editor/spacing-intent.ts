function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function includesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

const SPACING_PATTERNS = [
  /\bespaco\b/,
  /\bespaco em branco\b/,
  /\bespaco vazio\b/,
  /\bespacamento\b/,
  /\bfaixa branca\b/,
  /\bdistancia\b/,
  /\brespiro\b/,
  /\bintervalo visual\b/,
  /\bpadding\b/,
  /\bmargin\b/,
  /\bmargem\b/,
  /\bgap\b/,
]

const PAGE_START_PATTERNS = [
  /\btopo da pagina\b/,
  /\binicio da pagina\b/,
  /\bcomeco da pagina\b/,
  /\bespaco no inicio\b/,
  /\bespaco em branco no topo\b/,
  /\bantes do conteudo\b/,
  /\bantes do conteudo principal\b/,
  /\bantes do conteudo comecar\b/,
  /\bantes do conteudo principal comecar\b/,
]

const WRAPPER_ONLY_PATTERNS = [
  /\bwrapper global\b/,
  /\bwrapper da pagina\b/,
  /\bpage root\b/,
  /\bpage wrapper\b/,
  /\bme-managed-page-root\b/,
  /\bentre o (?:cabecalho|header|menu|navbar) e a primeira secao\b/,
  /\bentre o (?:cabecalho|header|menu|navbar) e o conteudo\b/,
  /\bfaixa branca entre o (?:cabecalho|header|menu|navbar) e a primeira secao\b/,
  /\bespaco (?:em branco )?entre o (?:cabecalho|header|menu|navbar) e a primeira secao\b/,
  /\bdistancia entre o (?:cabecalho|header|menu|navbar) e a primeira secao\b/,
  /\brespiro entre o (?:cabecalho|header|menu|navbar) e a primeira secao\b/,
  /\bantes de iniciar a primeira secao\b/,
  /\bantes da primeira secao\b/,
  /\bacima da primeira secao\b/,
  /\bfora da primeira secao\b/,
  /\bfora da area azul\b/,
  /\bfora da primeira area\b/,
  /\bespaco branco antes da area\b/,
]

const FIRST_SECTION_ONLY_PATTERNS = [
  /\bprimeira secao\b/,
  /\btopo da primeira secao\b/,
  /\bno topo da primeira secao\b/,
  /\binicio da primeira secao\b/,
  /\bentrada da primeira secao\b/,
  /\btopo da area azul\b/,
  /\bsubir a faixa azul\b/,
  /\bsubir a area azul\b/,
  /\bme-about-page\b/,
  /\bme-home-section\b/,
  /\bme-legal-page\b/,
]

const SECTION_INTERNAL_PATTERNS = [
  /\bdentro da primeira secao\b/,
  /\binterno da primeira secao\b/,
  /\bdentro da area azul\b/,
  /\bpadding interno\b/,
  /\bespaco interno\b/,
  /\bespacamento interno\b/,
]

const PROTECT_SECTION_INTERNAL_PATTERNS = [
  /\bmanter o (?:padding|espaco|espacamento) interno(?: da (?:primeira )?secao)?\b/,
  /\bsem mexer no (?:padding|espaco|espacamento) interno(?: da (?:primeira )?secao)?\b/,
  /\bsem tocar no (?:padding|espaco|espacamento) interno(?: da (?:primeira )?secao)?\b/,
  /\bnao mexer no (?:padding|espaco|espacamento) interno(?: da (?:primeira )?secao)?\b/,
  /\bnao tocar no (?:padding|espaco|espacamento) interno(?: da (?:primeira )?secao)?\b/,
  /\bpreservar o (?:padding|espaco|espacamento) interno(?: da (?:primeira )?secao)?\b/,
]

const HEADER_REFERENCE_PATTERNS = [
  /\bcabecalho\b/,
  /\bheader\b/,
  /\bmenu\b/,
  /\bnavbar\b/,
  /\btopo do site\b/,
  /\banuncio do topo\b/,
]

const HEADER_TEXT_PATTERNS = [
  /\btexto do (?:cabecalho|header|menu|navbar)\b/,
  /\bcopy do (?:cabecalho|header|menu|navbar)\b/,
  /\bmensagem do topo\b/,
  /\banuncio do topo\b/,
  /\bheadline do (?:cabecalho|header)\b/,
  /\btitulo do (?:cabecalho|header)\b/,
  /\bsubtitulo do (?:cabecalho|header)\b/,
  /\bcta do (?:cabecalho|header)\b/,
  /\bchamada do (?:cabecalho|header)\b/,
]

const TEXT_EDIT_ACTION_PATTERNS = [
  /\bmudar\b/,
  /\balterar\b/,
  /\batualizar\b/,
  /\btrocar\b/,
  /\bsubstituir\b/,
  /\breescrever\b/,
  /\bajustar\b/,
  /\bencurtar\b/,
]

const IMPLICIT_VISUAL_SPACING_PATTERNS = [
  ...PAGE_START_PATTERNS,
  ...WRAPPER_ONLY_PATTERNS,
  ...FIRST_SECTION_ONLY_PATTERNS,
  ...SECTION_INTERNAL_PATTERNS,
]

function hasHeaderReference(value: string) {
  return includesAny(value, HEADER_REFERENCE_PATTERNS)
}

function hasSpacingSignal(value: string) {
  return includesAny(value, SPACING_PATTERNS) || includesAny(value, IMPLICIT_VISUAL_SPACING_PATTERNS)
}

export function isVisualSpacingIntent(message: string) {
  return hasSpacingSignal(normalizeText(message))
}

export function isHeaderAdjacentSpacingRequest(message: string) {
  const normalized = normalizeText(message)
  return includesAny(normalized, WRAPPER_ONLY_PATTERNS) && hasHeaderReference(normalized)
}

export function isHeaderVisualSpacingRequest(message: string) {
  const normalized = normalizeText(message)
  return hasHeaderReference(normalized) && hasSpacingSignal(normalized)
}

export function isExplicitHeaderTextEditRequest(message: string) {
  const normalized = normalizeText(message)
  if (!hasHeaderReference(normalized) || isHeaderVisualSpacingRequest(normalized)) {
    return false
  }

  return (
    includesAny(normalized, HEADER_TEXT_PATTERNS) ||
    (includesAny(normalized, TEXT_EDIT_ACTION_PATTERNS) &&
      (/\b(?:texto|copy|frase|headline|titulo|subtitulo|mensagem|anuncio|cta|chamada)\b/.test(normalized) ||
        /["']/.test(normalized)))
  )
}

export function isPageStartSpacingRequest(message: string) {
  const normalized = normalizeText(message)
  return (
    hasSpacingSignal(normalized) &&
    (includesAny(normalized, PAGE_START_PATTERNS) ||
      includesAny(normalized, WRAPPER_ONLY_PATTERNS) ||
      includesAny(normalized, FIRST_SECTION_ONLY_PATTERNS) ||
      includesAny(normalized, SECTION_INTERNAL_PATTERNS))
  )
}

export function protectsSectionInternalSpacing(message: string) {
  return includesAny(normalizeText(message), PROTECT_SECTION_INTERNAL_PATTERNS)
}

export function wantsOnlyPageWrapperSpacing(message: string) {
  const normalized = normalizeText(message)
  if (includesAny(normalized, WRAPPER_ONLY_PATTERNS)) return true

  return (
    includesAny(normalized, PAGE_START_PATTERNS) &&
    !includesAny(normalized, FIRST_SECTION_ONLY_PATTERNS) &&
    !includesAny(normalized, SECTION_INTERNAL_PATTERNS)
  )
}

export function wantsOnlyFirstSectionSpacing(message: string) {
  const normalized = normalizeText(message)
  return (
    !includesAny(normalized, WRAPPER_ONLY_PATTERNS) &&
    !includesAny(normalized, SECTION_INTERNAL_PATTERNS) &&
    !protectsSectionInternalSpacing(normalized) &&
    includesAny(normalized, FIRST_SECTION_ONLY_PATTERNS)
  )
}

export function wantsOnlySectionInternalSpacing(message: string) {
  const normalized = normalizeText(message)
  return (
    !includesAny(normalized, WRAPPER_ONLY_PATTERNS) &&
    !protectsSectionInternalSpacing(normalized) &&
    includesAny(normalized, SECTION_INTERNAL_PATTERNS)
  )
}
