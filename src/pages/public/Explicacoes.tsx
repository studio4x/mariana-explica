import { MessageCircleHeart } from "lucide-react"
import { ExplicacoesFormExperience } from "./ExplicacoesFormExperience"

export function Explicacoes() {
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

        <ExplicacoesFormExperience />
      </div>
    </div>
  )
}
