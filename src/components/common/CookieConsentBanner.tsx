import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import {
  COOKIE_CONSENT_VERSION,
  DEFAULT_COOKIE_CONSENT_PREFERENCES,
  persistCookieConsent,
  readCookieConsent,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent"

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const storedConsent = useMemo(() => readCookieConsent(), [])
  const [preferences, setPreferences] = useState<CookieConsentPreferences>(
    storedConsent?.preferences ?? DEFAULT_COOKIE_CONSENT_PREFERENCES,
  )

  useEffect(() => {
    if (!storedConsent || storedConsent.version !== COOKIE_CONSENT_VERSION) {
      setIsVisible(true)
      setPreferences(storedConsent?.preferences ?? DEFAULT_COOKIE_CONSENT_PREFERENCES)
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
          <h2 className="mt-2 font-display text-2xl text-slate-950">
            Usamos cookies essenciais e, com a tua autorizacao, cookies opcionais.
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Os cookies essenciais suportam autenticacao, seguranca e funcionamento da plataforma. Os opcionais ajudam
            a medir desempenho e campanhas. Podes aceitar tudo, manter apenas os essenciais ou personalizar por
            categoria.
          </p>
          <Link
            to={ROUTES.COOKIES}
            className="mt-3 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
          >
            Ler a Politica de Cookies
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-300 bg-white px-5 text-slate-700"
            onClick={() => {
              persistCookieConsent({
                analytics: false,
                marketing: false,
              })
              setIsVisible(false)
            }}
          >
            Manter apenas essenciais
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-300 bg-white px-5 text-slate-700"
            onClick={() => setIsCustomizing((current) => !current)}
          >
            {isCustomizing ? "Fechar preferencias" : "Personalizar"}
          </Button>
          <Button
            type="button"
            className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
            onClick={() => {
              persistCookieConsent({
                analytics: true,
                marketing: true,
              })
              setIsVisible(false)
            }}
          >
            Aceitar cookies
          </Button>
        </div>
      </div>

      {isCustomizing ? (
        <div className="mx-auto mt-3 w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Essenciais</p>
              <p className="mt-2 text-sm font-bold text-slate-950">Sempre ativos</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Necessarios para login, seguranca, navegacao e funcionamento basico da plataforma.
              </p>
            </div>

            <label className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Analiticos</p>
                  <p className="mt-2 text-sm font-bold text-slate-950">Medicao e desempenho</p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={preferences.analytics}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      analytics: event.target.checked,
                    }))
                  }
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Permitem medir visitas, desempenho das paginas e funis de navegacao.
              </p>
            </label>

            <label className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Marketing</p>
                  <p className="mt-2 text-sm font-bold text-slate-950">Conversoes e campanhas</p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={preferences.marketing}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      marketing: event.target.checked,
                    }))
                  }
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Preparam a plataforma para Google Ads, Meta Pixel e futuras campanhas consentidas.
              </p>
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-slate-300 bg-white px-5 text-slate-700"
              onClick={() => {
                setPreferences(DEFAULT_COOKIE_CONSENT_PREFERENCES)
                setIsCustomizing(false)
              }}
            >
              Repor
            </Button>
            <Button
              type="button"
              className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
              onClick={() => {
                persistCookieConsent({
                  analytics: preferences.analytics,
                  marketing: preferences.marketing,
                })
                setIsVisible(false)
                setIsCustomizing(false)
              }}
            >
              Guardar preferencias
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
