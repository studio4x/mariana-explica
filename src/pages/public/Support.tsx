import { LifeBuoy } from "lucide-react"
import { SupportFaqExperience } from "./SupportFaqExperience"

export function Support() {
  return (
    <div className="bg-white pb-20 pt-8 text-slate-950">
      <div className="container space-y-12">
        <section className="mx-auto max-w-4xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <LifeBuoy className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-black md:text-6xl">Como podemos ajudar?</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Encontre respostas rápidas na FAQ e, se ainda precisar, abra um chamado para a equipa acompanhar o seu caso.
          </p>
        </section>

        <SupportFaqExperience />
      </div>
    </div>
  )
}
