export const COOKIE_CONSENT_STORAGE_KEY = "mariana-explica:cookie-consent"
export const COOKIE_CONSENT_VERSION = "2026-04-23"
export const COOKIE_CONSENT_EVENT = "mariana-explica:cookie-consent-changed"

export type CookieConsentPreferences = {
  essential: true
  analytics: boolean
  marketing: boolean
}

export type CookieConsentValue = {
  version: string
  preferences: CookieConsentPreferences
  updatedAt: string
}

export const DEFAULT_COOKIE_CONSENT_PREFERENCES: CookieConsentPreferences = {
  essential: true,
  analytics: false,
  marketing: false,
}

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as CookieConsentValue
    if (
      !parsed?.version ||
      !parsed?.preferences ||
      typeof parsed.preferences.analytics !== "boolean" ||
      typeof parsed.preferences.marketing !== "boolean"
    ) {
      return null
    }

    return {
      version: parsed.version,
      preferences: {
        essential: true,
        analytics: parsed.preferences.analytics,
        marketing: parsed.preferences.marketing,
      },
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function persistCookieConsent(
  preferences: Partial<Omit<CookieConsentPreferences, "essential">> = {},
): CookieConsentValue {
  const payload: CookieConsentValue = {
    version: COOKIE_CONSENT_VERSION,
    preferences: {
      essential: true,
      analytics: preferences.analytics ?? false,
      marketing: preferences.marketing ?? false,
    },
    updatedAt: new Date().toISOString(),
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload))
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, {
        detail: payload,
      }),
    )
  }

  return payload
}
