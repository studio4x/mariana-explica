import { useState, type FormEvent } from "react"
import { Send } from "lucide-react"
import { OperationFeedbackModal } from "@/components/common"
import { Button } from "@/components/ui"
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

export function ExplicacoesFormExperience() {
  const [form, setForm] = useState<ExplicacoesFormState>(initialFormState)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel enviar o formulario.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
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
            <p className="font-black">Se o teu pedido for para Explicacoes, indica obrigatoriamente nesta caixa:</p>
            <p className="mt-1">O Ano Escolar do Aluno (ex: 10.o, 11.o ou 12.o ano)</p>
            <p>A Disciplina pretendida (Filosofia ou Portugues)</p>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="submit"
              className="rounded-full bg-[#123f59] px-6 hover:bg-[#0f3247]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "A enviar..." : "Enviar formulario"}
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

      <OperationFeedbackModal
        open={isSuccessModalOpen}
        tone="success"
        title="Pedido enviado"
        confirmLabel="Fechar"
        message="Obrigada pelo teu contacto! Recebi o teu pedido com sucesso. Em breve, receberas uma resposta da minha parte. Fica atento/a. Beijinho, Mariana."
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </>
  )
}
