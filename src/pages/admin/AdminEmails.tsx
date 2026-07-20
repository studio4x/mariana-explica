import { useEffect, useMemo, useRef, useState } from "react"
import { Mail, RefreshCw, RotateCcw, Save } from "lucide-react"
import { ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminEmailTemplates,
  usePreviewAdminEmailTemplate,
  useResetAdminEmailTemplate,
  useUpdateAdminEmailTemplate,
} from "@/hooks/useAdmin"
import type {
  AdminPlatformEmailTemplateContent,
  AdminPlatformEmailTemplateKey,
  AdminPlatformEmailTemplatePreview,
} from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

function bulletsToTextarea(bullets: string[]) {
  return bullets.join("\n")
}

function textareaToBullets(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function cloneTemplateContent(content: AdminPlatformEmailTemplateContent): AdminPlatformEmailTemplateContent {
  return {
    ...content,
    bullets: [...content.bullets],
  }
}

export function AdminEmails() {
  const templatesQuery = useAdminEmailTemplates()
  const previewMutation = usePreviewAdminEmailTemplate()
  const updateMutation = useUpdateAdminEmailTemplate()
  const resetMutation = useResetAdminEmailTemplate()
  const [selectedKey, setSelectedKey] = useState<AdminPlatformEmailTemplateKey | null>(null)
  const [drafts, setDrafts] = useState<Partial<Record<AdminPlatformEmailTemplateKey, AdminPlatformEmailTemplateContent>>>({})
  const [previews, setPreviews] = useState<Partial<Record<AdminPlatformEmailTemplateKey, AdminPlatformEmailTemplatePreview>>>({})
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const previewRequestRef = useRef<string | null>(null)

  const templates = templatesQuery.data?.templates ?? []
  const customizedCount = useMemo(
    () => templates.filter((template) => template.isCustomized).length,
    [templates],
  )

  useEffect(() => {
    if (!selectedKey && templates.length > 0) {
      setSelectedKey(templates[0].key)
    }
  }, [selectedKey, templates])

  useEffect(() => {
    if (!selectedKey) return
    const selectedTemplate = templates.find((template) => template.key === selectedKey)
    if (!selectedTemplate) return

    setDrafts((current) =>
      current[selectedKey]
        ? current
        : {
            ...current,
            [selectedKey]: cloneTemplateContent(selectedTemplate.content),
          },
    )
  }, [selectedKey, templates])

  const selectedTemplate = selectedKey ? templates.find((template) => template.key === selectedKey) ?? null : null
  const selectedDraft = selectedKey ? drafts[selectedKey] ?? selectedTemplate?.content ?? null : null
  const selectedPreview = selectedKey ? previews[selectedKey] ?? null : null

  useEffect(() => {
    if (!selectedKey || !selectedDraft || previews[selectedKey]) return
    const requestKey = `${selectedKey}:${JSON.stringify(selectedDraft)}`
    if (previewRequestRef.current === requestKey) return

    previewRequestRef.current = requestKey

    void previewMutation
      .mutateAsync({
        templateKey: selectedKey,
        content: selectedDraft,
      })
      .then((preview) => {
        setPreviews((current) => ({ ...current, [preview.templateKey]: preview }))
      })
      .catch(() => {
        // preview errors are surfaced on explicit refresh/save interactions
      })
      .finally(() => {
        if (previewRequestRef.current === requestKey) {
          previewRequestRef.current = null
        }
      })
  }, [selectedDraft, selectedKey, previews])

  const handleDraftChange = <TKey extends keyof AdminPlatformEmailTemplateContent>(
    key: TKey,
    value: AdminPlatformEmailTemplateContent[TKey],
  ) => {
    if (!selectedKey || !selectedDraft) return

    setFeedback(null)
    setDrafts((current) => ({
      ...current,
      [selectedKey]: {
        ...selectedDraft,
        [key]: value,
      },
    }))
  }

  const refreshPreview = async () => {
    if (!selectedKey || !selectedDraft) return

    setFeedback(null)

    try {
      const preview = await previewMutation.mutateAsync({
        templateKey: selectedKey,
        content: selectedDraft,
      })
      setPreviews((current) => ({ ...current, [preview.templateKey]: preview }))
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel gerar o preview do email.",
      })
    }
  }

  const saveTemplate = async () => {
    if (!selectedKey || !selectedDraft) return

    setFeedback(null)

    try {
      const config = await updateMutation.mutateAsync({
        templateKey: selectedKey,
        content: selectedDraft,
      })
      const persistedTemplate = config.templates.find((template) => template.key === selectedKey)

      if (persistedTemplate) {
        setDrafts((current) => ({
          ...current,
          [selectedKey]: cloneTemplateContent(persistedTemplate.content),
        }))
      }

      const preview = await previewMutation.mutateAsync({
        templateKey: selectedKey,
        content: selectedDraft,
      })
      setPreviews((current) => ({ ...current, [preview.templateKey]: preview }))
      setFeedback({ tone: "success", message: "Template guardado com sucesso." })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel guardar o template.",
      })
    }
  }

  const resetTemplate = async () => {
    if (!selectedKey) return

    setFeedback(null)

    try {
      const config = await resetMutation.mutateAsync(selectedKey)
      const persistedTemplate = config.templates.find((template) => template.key === selectedKey)

      if (persistedTemplate) {
        setDrafts((current) => ({
          ...current,
          [selectedKey]: cloneTemplateContent(persistedTemplate.content),
        }))

        const preview = await previewMutation.mutateAsync({
          templateKey: selectedKey,
          content: persistedTemplate.content,
        })
        setPreviews((current) => ({ ...current, [preview.templateKey]: preview }))
      }

      setFeedback({ tone: "success", message: "Template reposto para a versao base." })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel repor o template.",
      })
    }
  }

  if (templatesQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Emails da plataforma"
          description="Gestao central da copy dos emails transacionais enviados pelo backend da plataforma."
        />
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[1.5rem] border bg-slate-100" />
            ))}
          </div>
          <div className="h-[560px] animate-pulse rounded-[1.75rem] border bg-slate-100" />
        </div>
      </div>
    )
  }

  if (templatesQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os templates"
        message={templatesQuery.error instanceof Error ? templatesQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void templatesQuery.refetch()}
      />
    )
  }

  if (!selectedTemplate || !selectedDraft) {
    return (
      <ErrorState
        title="Nenhum template disponivel"
        message="Ainda nao existem templates configurados para o painel admin."
        onRetry={() => void templatesQuery.refetch()}
      />
    )
  }

  const isSaving = updateMutation.isPending || resetMutation.isPending
  const isPreviewing = previewMutation.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emails da plataforma"
        description="Personaliza aqui o conteudo dos emails enviados pelo backend da plataforma. Os emails do Supabase Auth ficam fora desta area."
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void templatesQuery.refetch()}
            disabled={templatesQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {templatesQuery.isFetching ? "A atualizar..." : "Atualizar"}
          </Button>
        }
      />

      {feedback ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm font-medium",
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Templates</p>
          <p className="mt-4 text-3xl font-bold text-slate-950">{templates.length}</p>
          <p className="mt-2 text-sm text-slate-600">Emails transacionais e operacionais sob controlo do backend.</p>
        </div>
        <div className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Personalizados</p>
          <p className="mt-4 text-3xl font-bold text-slate-950">{customizedCount}</p>
          <p className="mt-2 text-sm text-slate-600">Templates com override guardado em `site_config`.</p>
        </div>
        <div className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Auth Supabase</p>
          <p className="mt-4 text-3xl font-bold text-slate-950">Fora</p>
          <p className="mt-2 text-sm text-slate-600">Templates de confirmacao, recovery e afins continuam fora desta pagina.</p>
        </div>
        <div className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Ultima atualizacao</p>
          <p className="mt-4 text-lg font-bold text-slate-950">
            {templatesQuery.data?.updated_at ? formatDateTime(templatesQuery.data.updated_at) : "A guardar no primeiro ajuste"}
          </p>
          <p className="mt-2 text-sm text-slate-600">Referencia do ultimo save conhecido para este conjunto de templates.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {templates.map((template) => {
            const active = template.key === selectedKey

            return (
              <button
                key={template.key}
                type="button"
                onClick={() => setSelectedKey(template.key)}
                className={[
                  "w-full rounded-[1.5rem] border p-4 text-left transition",
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_35px_rgba(15,23,42,0.18)]"
                    : "border-slate-200 bg-white text-slate-950 shadow-sm hover:border-slate-300",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={["text-[11px] font-black uppercase tracking-[0.24em]", active ? "text-white/70" : "text-slate-500"].join(" ")}>
                      {template.category}
                    </p>
                    <p className="mt-2 text-base font-black">{template.label}</p>
                  </div>
                  <StatusBadge
                    label={template.isCustomized ? "Personalizado" : "Base"}
                    tone={template.isCustomized ? "success" : "neutral"}
                  />
                </div>
                <p className={["mt-3 text-sm leading-6", active ? "text-white/80" : "text-slate-600"].join(" ")}>
                  {template.description}
                </p>
              </button>
            )
          })}
        </aside>

        <div className="space-y-4">
          <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl font-bold text-slate-950">{selectedTemplate.label}</h2>
                  <StatusBadge label={selectedTemplate.category} tone="info" />
                  <StatusBadge label={selectedTemplate.isCustomized ? "Com override" : "Versao base"} tone={selectedTemplate.isCustomized ? "success" : "neutral"} />
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{selectedTemplate.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => void refreshPreview()} disabled={isSaving || isPreviewing}>
                  <Mail className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => void resetTemplate()} disabled={isSaving || isPreviewing}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Repor base
                </Button>
                <Button type="button" className="rounded-full" onClick={() => void saveTemplate()} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar template
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f4f9fb] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Variaveis disponiveis</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedTemplate.availableVariables.map((variable) => (
                  <span key={variable} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(selectedTemplate.sampleData).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs">
                    <p className="font-black uppercase tracking-[0.18em] text-slate-500">{key}</p>
                    <p className="mt-1 break-all font-medium text-slate-700">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Assunto</span>
                <input
                  value={selectedDraft.subject}
                  onChange={(event) => handleDraftChange("subject", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Eyebrow</span>
                <input
                  value={selectedDraft.eyebrow}
                  onChange={(event) => handleDraftChange("eyebrow", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Titulo</span>
                <input
                  value={selectedDraft.title}
                  onChange={(event) => handleDraftChange("title", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Saudacao</span>
                <input
                  value={selectedDraft.greeting}
                  onChange={(event) => handleDraftChange("greeting", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Texto principal</span>
                <textarea
                  value={selectedDraft.intro}
                  onChange={(event) => handleDraftChange("intro", event.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Bullets do bloco de destaque</span>
                <textarea
                  value={bulletsToTextarea(selectedDraft.bullets)}
                  onChange={(event) => handleDraftChange("bullets", textareaToBullets(event.target.value))}
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">Usa uma linha por bullet. Linhas vazias sao ignoradas.</p>
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">CTA label</span>
                <input
                  value={selectedDraft.ctaLabel}
                  onChange={(event) => handleDraftChange("ctaLabel", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">CTA URL</span>
                <input
                  value={selectedDraft.ctaUrl}
                  onChange={(event) => handleDraftChange("ctaUrl", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Rodape</span>
              <textarea
                value={selectedDraft.footer}
                onChange={(event) => handleDraftChange("footer", event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
              />
            </label>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-bold text-slate-950">Preview HTML</h3>
                  <p className="mt-1 text-sm text-slate-600">Renderizacao real do template com dados de exemplo.</p>
                </div>
                <StatusBadge label={selectedPreview ? "Pronto" : "Pendente"} tone={selectedPreview ? "success" : "warning"} />
              </div>
              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
                {selectedPreview ? (
                  <iframe
                    title={`preview-${selectedTemplate.key}`}
                    srcDoc={selectedPreview.html}
                    className="h-[640px] w-full bg-white"
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center px-6 text-sm text-slate-500">
                    Gera o preview para visualizar o HTML final deste email.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm sm:p-6">
                <h3 className="font-display text-2xl font-bold text-slate-950">Assunto renderizado</h3>
                <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {selectedPreview?.subject ?? "Sem preview gerado ainda."}
                </p>
              </div>

              <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm sm:p-6">
                <h3 className="font-display text-2xl font-bold text-slate-950">Texto puro</h3>
                <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {selectedPreview?.text ?? "Sem preview gerado ainda."}
                </pre>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
