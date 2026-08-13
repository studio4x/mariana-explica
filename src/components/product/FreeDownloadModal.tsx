import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { LoaderCircle, X } from "lucide-react"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { requestFreeDownload } from "@/services/free-download.service"

type TurnstileRenderOptions = {
  sitekey: string
  theme: "light"
  action: string
  callback: (token: string) => void
  "expired-callback": () => void
  "error-callback": () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script"
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? ""

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  return new Promise<TurnstileApi>((resolve, reject) => {
    const onLoad = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile indisponível"))
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", onLoad, { once: true })
      existing.addEventListener("error", () => reject(new Error("Turnstile indisponível")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = TURNSTILE_SCRIPT_ID
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.defer = true
    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", () => reject(new Error("Turnstile indisponível")), { once: true })
    document.head.appendChild(script)
  })
}

export function FreeDownloadModal({ productId, productTitle, open, onOpenChange }: { productId: string; productTitle: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const nameRef = useRef<HTMLInputElement>(null)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetRef = useRef<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileLoading, setTurnstileLoading] = useState(Boolean(TURNSTILE_SITE_KEY))
  const [turnstileError, setTurnstileError] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => nameRef.current?.focus(), 0)
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && status !== "submitting") onOpenChange(false) }
    window.addEventListener("keydown", onKeyDown)
    return () => { window.clearTimeout(timeout); window.removeEventListener("keydown", onKeyDown) }
  }, [onOpenChange, open, status])

  useEffect(() => {
    if (!open) return
    setTurnstileToken(null)
    setTurnstileError(null)

    if (!TURNSTILE_SITE_KEY) {
      setTurnstileLoading(false)
      setTurnstileError("A verificação de segurança não está disponível. Tenta novamente mais tarde.")
      return
    }

    let disposed = false
    let widgetId: string | null = null
    setTurnstileLoading(true)

    void loadTurnstile()
      .then((turnstile) => {
        if (disposed || !turnstileContainerRef.current) return
        widgetId = turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
          action: "free_download",
          callback: (token) => {
            if (!disposed) {
              setTurnstileToken(token)
              setTurnstileError(null)
            }
          },
          "expired-callback": () => {
            if (!disposed) setTurnstileToken(null)
          },
          "error-callback": () => {
            if (!disposed) setTurnstileError("Não foi possível validar a segurança. Atualiza a página e tenta novamente.")
          },
        })
        turnstileWidgetRef.current = widgetId
        setTurnstileLoading(false)
      })
      .catch(() => {
        if (!disposed) {
          setTurnstileLoading(false)
          setTurnstileError("A verificação de segurança não está disponível. Tenta novamente mais tarde.")
        }
      })

    return () => {
      disposed = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
      turnstileWidgetRef.current = null
    }
  }, [open])

  if (!open) return null
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedName = name.trim().replace(/\s+/g, " ")
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedName.length < 2 || normalizedName.length > 120) { setError("Indica o teu nome completo."); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 320) { setError("Indica um e-mail válido."); return }
    if (!turnstileToken) { setError("Confirma a verificação de segurança antes de continuar."); return }
    setStatus("submitting"); setError(null)
    try { await requestFreeDownload({ productId, name: normalizedName, email: normalizedEmail, website, turnstileToken }); setStatus("success") }
    catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar o material agora.")
      setTurnstileToken(null)
      if (turnstileWidgetRef.current && window.turnstile) window.turnstile.reset(turnstileWidgetRef.current)
    }
    finally { setStatus((current) => current === "success" ? current : "idle") }
  }
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={() => status !== "submitting" && onOpenChange(false)}>
    <section role="dialog" aria-modal="true" aria-labelledby="free-download-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-sky-700">Material gratuito</p><h2 id="free-download-title" className="mt-2 font-display text-2xl font-black text-slate-950">Recebe {productTitle}</h2></div><button type="button" aria-label="Fechar" onClick={() => onOpenChange(false)} disabled={status === "submitting"} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      {status === "success" ? <div className="mt-6 space-y-5"><p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">Sucesso! Enviámos o acesso ao material para o seu e-mail. Verifique também a pasta de spam.</p><Button type="button" className="w-full" onClick={() => onOpenChange(false)}>Fechar</Button></div> : <form className="mt-6 space-y-4" onSubmit={submit}><div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label>Website<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" name="website" /></label></div><label className="grid gap-2 text-sm font-semibold text-slate-800">Nome<input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} className="h-11 rounded-xl border border-slate-300 px-3 outline-none focus:border-sky-600" required /></label><label className="grid gap-2 text-sm font-semibold text-slate-800">E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" maxLength={320} className="h-11 rounded-xl border border-slate-300 px-3 outline-none focus:border-sky-600" required /></label><div ref={turnstileContainerRef} className="min-h-[65px]" aria-label="Verificação de segurança" />{turnstileLoading ? <p className="text-xs text-slate-500">A preparar verificação de segurança…</p> : null}{turnstileError ? <p role="alert" className="text-sm text-rose-700">{turnstileError}</p> : null}{error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}<Button type="submit" className="w-full" disabled={status === "submitting" || turnstileLoading || !turnstileToken}>{status === "submitting" ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />A enviar...</> : "Receber material por e-mail"}</Button><p className="text-xs leading-5 text-slate-500">Ao pedir o material, concordas com o tratamento do e-mail para esta entrega. Consulta a <Link to={ROUTES.PRIVACY} className="underline">Política de Privacidade</Link>.</p></form>}
    </section>
  </div>
}
