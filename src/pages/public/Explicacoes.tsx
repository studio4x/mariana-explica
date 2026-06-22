import { useState, type FormEvent } from "react"
import { MessageCircleHeart, Send } from "lucide-react"
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

export function Explicacoes() {
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
      setSubmitError(error instanceof Error ? error.message : "Não foi possível enviar o formulário.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-[#f6fafc] py-10 text-slate-900 md:py-14">
      <div className="container mx-auto max-w-5xl space-y-8">
        <header className="rounded-3xl border border-[#dbe8ef] bg-white p-6 shadow-sm md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#e7f3fb] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#114866]">
            <MessageCircleHeart className="h-4 w-4" />
            Explicações
          </div>

          <h1 className="mt-5 text-3xl font-black leading-tight text-[#102c40] md:text-5xl">
            Vamos descomplicar o teu ano letivo juntos?
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
            Não tens Instagram ou preferes o contacto formal por e-mail? Sem problema, estás no sítio certo! Este
            espaço foi pensado tanto para estudantes como para encarregados de educação que queiram esclarecer dúvidas
            sobre os meus materiais ou solicitar apoio individual.
          </p>
        </header>

        <section className="rounded-3xl border border-[#dbe8ef] bg-[#0f2f45] p-6 text-white shadow-sm md:p-10">
          <h2 className="text-2xl font-black md:text-3xl">Notas importantes antes de enviares o teu formulário:</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-white/90 md:text-base">
            <p>
              <span className="font-black text-white">Planeamento Prévio:</span> Devido à agenda preenchida, todos os
              pedidos para explicações devem ser efetuados com um mínimo de 3 semanas de antecedência.
            </p>
            <p>
              <span className="font-black text-white">Não Garante Reserva:</span> O envio e submissão deste formulário
              funciona estritamente como um pedido de informações e consulta de disponibilidade. Não constitui, de
              forma alguma, uma marcação automática ou garantia de vaga.
            </p>
          </div>
        </section>

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
              <p className="font-black">Se o teu pedido for para Explicações, indica obrigatoriamente nesta caixa:</p>
              <p className="mt-1">O Ano Escolar do Aluno (ex: 10.º, 11.º ou 12.º ano)</p>
              <p>A Disciplina pretendida (Filosofia ou Português)</p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="submit"
                className="rounded-full bg-[#123f59] px-6 hover:bg-[#0f3247]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "A enviar..." : "Enviar formulário"}
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
      </div>

      <OperationFeedbackModal
        open={isSuccessModalOpen}
        tone="success"
        title="Pedido enviado"
        confirmLabel="Fechar"
        message="Obrigada pelo teu contacto! Recebi o teu pedido com sucesso.Em breve, receberás uma resposta da minha parte! Fica atento/a. Beijinho, Mariana."
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </div>
  )
}
