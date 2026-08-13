import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Download, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { redeemFreeDownload } from "@/services/free-download.service"

export function FreeMaterialDownload() {
  const { token = "" } = useParams<{ token: string }>()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const redeem = useCallback(async () => { setLoading(true); setError(null); try { const result = await redeemFreeDownload(token); setUrl(result.url); window.location.assign(result.url) } catch { setError("Este link é inválido, expirou ou já não está disponível.") } finally { setLoading(false) } }, [token])
  useEffect(() => { void redeem() }, [redeem])
  return <main className="container flex min-h-[60vh] items-center justify-center py-16"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><Download className="mx-auto h-10 w-10 text-sky-700" /><h1 className="mt-5 font-display text-3xl font-black text-slate-950">{error ? "Link indisponível" : "A preparar o download"}</h1>{loading ? <p className="mt-4 inline-flex items-center gap-2 text-slate-600"><LoaderCircle className="h-4 w-4 animate-spin" />A validar o acesso seguro ao material…</p> : error ? <><p className="mt-4 text-slate-600">{error}</p><Button asChild className="mt-6"><Link to={ROUTES.COURSES}>Ver materiais</Link></Button></> : <><p className="mt-4 text-slate-600">Se o download não começou, usa o botão abaixo.</p><Button className="mt-6" onClick={() => url && window.location.assign(url)}><Download className="mr-2 h-4 w-4" />Descarregar novamente</Button></>}</section></main>
}
