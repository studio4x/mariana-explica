import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"

const COOKIE_CONSENT_STORAGE_KEY = "mariana-explica:cookie-consent"
const COOKIE_CONSENT_VERSION = "2026-04-23"

type CookieConsentValue = {
  version: string
  choice: "accepted" | "essential_only"
  updatedAt: string
}

function readStoredConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as CookieConsentValue
    if (!parsed?.version || !parsed?.choice) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function persistConsent(choice: CookieConsentValue["choice"]) {
  const payload: CookieConsentValue = {
    version: COOKIE_CONSENT_VERSION,
    choice,
    updatedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload))
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const storedConsent = useMemo(() => readStoredConsent(), [])

  useEffect(() => {
    if (!storedConsent || storedConsent.version !== COOKIE_CONSENT_VERSION) {
      setIsVisible(true)
    }
  }, [storedConsent])

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/95 p-4 text-slate-700 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">Cookies</p>
          <h2 className="mt-2 font-display text-2xl text-slate-950">Usamos cookies essenciais e, com a tua autorizacao, cookies opcionais.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Os cookies essenciais suportam autenticacao, seguranca e funcionamento da plataforma. Os opcionais ajudam
            a medir desempenho e campanhas. Podes continuar apenas com os essenciais ou aceitar os opcionais.
          </p>
          <Link to={ROUTES.COOKIES} className="mt-3 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800">
            Ler a Politica de Cookies
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-300 bg-white px-5 text-slate-700"
            onClick={() => {
              persistConsent("essential_only")
              setIsVisible(false)
            }}
          >
            Manter apenas essenciais
          </Button>
          <Button
            type="button"
            className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
            onClick={() => {
              persistConsent("accepted")
              setIsVisible(false)
            }}
          >
            Aceitar cookies
          </Button>
        </div>
      </div>
    </div>
  )
}
