import { useState, type FormEvent } from "react"
import { MessageCircleHeart, Send } from "lucide-react"
import { OperationFeedbackModal } from "@/components/common"
import { Button } from "@/components/ui"
import {
  EditableText,
  SiteContentScope,
  VisualEditorProvider,
  useVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  EXPLICACOES_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type ExplicacoesVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"
import { submitPublicForm } from "@/services"

interface ExplicacoesFormState {
  nome: string
  email: string
  assunto: string
  mensagem: string
}

const initialFormState: ExplicacoesFormState = {
  nome: "",
  email: "",
  assunto: "",
  mensagem: "",
}

function ExplicacoesPageContent() {
  const [form, setForm] = useState<ExplicacoesFormState>(initialFormState)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { document } = useVisualEditorPage()
  const visualDocument =
    (document as ExplicacoesVisualEditorDocument | undefined) ?? EXPLICACOES_VISUAL_EDITOR_DEFAULT_DOCUMENT

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      await submitPublicForm({
        formType: "explicacoes",
        sourcePage: "/explicacoes",
        fullName: form.nome,
        email: form.email,
        subject: form.assunto,
        message: form.mensagem,
      })

      setIsSuccessModalOpen(true)
      setForm(initialFormState)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível enviar o formulário.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-[#f6fafc] py-10 text-slate-900 md:py-14">
      <div className="container mx-auto max-w-5xl space-y-8">
        <SiteContentScope title="Hero" description="Mensagem inicial e contexto do pedido">
          <header className="rounded-3xl border border-[#dbe8ef] bg-white p-6 shadow-sm md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e7f3fb] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#114866]">
              <MessageCircleHeart className="h-4 w-4" />
              <EditableText
                fieldKey="hero.eyebrow"
                as="span"
                fallback={visualDocument.hero.eyebrow}
              />
            </div>

            <EditableText
              fieldKey="hero.title"
              as="h1"
              fallback={visualDocument.hero.title}
              className="mt-5 text-3xl font-black leading-tight text-[#102c40] md:text-5xl"
            />

            <EditableText
              fieldKey="hero.lead"
              as="p"
              fallback={visualDocument.hero.lead}
              className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg"
            />
          </header>
        </SiteContentScope>

        <SiteContentScope title="Notas" description="Condições e avisos importantes">
          <section className="rounded-3xl border border-[#dbe8ef] bg-[#0f2f45] p-6 text-white shadow-sm md:p-10">
            <EditableText
              fieldKey="notes.title"
              as="h2"
              fallback={visualDocument.notes.title}
              className="text-2xl font-black md:text-3xl"
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-white/90 md:text-base">
              <EditableText
                fieldKey="notes.paragraph1"
                as="p"
                fallback={visualDocument.notes.paragraph1}
              />
              <EditableText
                fieldKey="notes.paragraph2"
                as="p"
                fallback={visualDocument.notes.paragraph2}
              />
            </div>
          </section>
        </SiteContentScope>

        <SiteContentScope title="Formulario" description="Campos e mensagem de orientação">
          <section className="rounded-3xl border border-[#dbe8ef] bg-white p-6 shadow-sm md:p-10">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Nome
                  <input
                    required
                    value={form.nome}
                    onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                    className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Email
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Assunto
                <input
                  required
                  value={form.assunto}
                  onChange={(event) => setForm((current) => ({ ...current, assunto: event.target.value }))}
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Mensagem
                <textarea
                  required
                  rows={7}
                  value={form.mensagem}
                  onChange={(event) => setForm((current) => ({ ...current, mensagem: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
                />
              </label>

              <div className="rounded-2xl border border-[#bee0ef] bg-[#eef8fd] p-4 text-sm leading-7 text-[#144d6b]">
                <EditableText
                  fieldKey="formNote.title"
                  as="p"
                  fallback={visualDocument.formNote.title}
                  className="font-black"
                />
                <EditableText
                  fieldKey="formNote.line1"
                  as="p"
                  fallback={visualDocument.formNote.line1}
                  className="mt-1"
                />
                <EditableText
                  fieldKey="formNote.line2"
                  as="p"
                  fallback={visualDocument.formNote.line2}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="submit" className="rounded-full bg-[#123f59] px-6 hover:bg-[#0f3247]" disabled={isSubmitting}>
                  {isSubmitting ? (
                    "A enviar..."
                  ) : (
                    <EditableText
                      fieldKey="submitCta.label"
                      as="span"
                      fallback={visualDocument.submitCta.label}
                      className="inline-flex items-center"
                    />
                  )}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {submitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  {submitError}
                </div>
              ) : null}
            </form>
          </section>
        </SiteContentScope>
      </div>

      <OperationFeedbackModal
        open={isSuccessModalOpen}
        tone="success"
        title="Pedido enviado"
        confirmLabel="Fechar"
        message="Obrigada pelo teu contacto! Recebi o teu pedido com sucesso. Em breve, receberás uma resposta da minha parte! Fica atento/a. Beijinho, Mariana."
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </div>
  )
}

export function Explicacoes() {
  return (
    <VisualEditorProvider pageKey="explicacoes">
      <ExplicacoesPageContent />
    </VisualEditorProvider>
  )
}
