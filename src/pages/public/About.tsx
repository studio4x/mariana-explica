export function About() {
  return (
    <section className="bg-[#d8e8ef] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mx-auto max-w-[860px] text-center">
          <h1 className="font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl">
            Muito mais do que uma explicadora:
            <br />
            Quem é a Mariana?
          </h1>
        </div>

        <div className="mt-12 grid items-center gap-8 md:mt-14 md:grid-cols-2 md:gap-12">
          <div className="flex min-h-[260px] items-center justify-center rounded bg-[#e8f0f4] p-8 md:min-h-[430px]">
            <p className="font-display text-2xl font-bold text-[#1f2237] md:text-4xl">(foto)</p>
          </div>

          <div className="space-y-7 text-center md:text-left">
            <p className="font-display text-xl font-bold leading-[1.4] text-[#0f122c] md:text-2xl">
              Olá! Eu sou a Mariana, fundadora do Mariana Explica e, atualmente, estudante de Filosofia na FLUP.
            </p>

            <p className="text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9">
              Se chegaste até aqui, é muito provável que estejas a sentir o peso dos manuais gigantes de Português, o
              nó cego da Lógica em Filosofia ou o pânico silencioso da aproximação dos Exames Nacionais.
              <br />
              Deixa-me dizer-te uma coisa:
              <span className="text-[#1a4da8]"> eu percebo-te perfeitamente, porque eu ainda estou aí.</span>
            </p>
          </div>
        </div>

        <div className="mt-16 md:mt-24">
          <div className="mx-auto max-w-[980px] text-center">
            <h2 className="font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl">
              De estudante para estudante: porquê este projeto?
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
            <article className="rounded bg-[#e8f0f4] px-8 py-9 md:px-10 md:py-11">
              <p className="text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9">
                Durante o meu percurso, percebi que a maior barreira entre um aluno e uma nota excelente não é a falta
                de inteligência, mas sim a forma como a matéria é ensinada. Estive cansada de manuais densos,
                linguagem excessivamente formal e calhamaços cheios de &apos;palha&apos; que só servem para causar ansiedade.
              </p>
            </article>

            <article className="rounded bg-[#e8f0f4] px-8 py-9 md:px-10 md:py-11">
              <p className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9">
                Este projeto nasceu exatamente para ser a ponte. Eu transformo a matéria mais complexa em esquemas
                visuais, resumos diretos e explicações descontraídas. Eu explico-te a matéria da forma que eu própria
                gostava que me tivessem explicado quando estava no teu lugar. É isso que faz toda a diferença.
              </p>
            </article>
          </div>
        </div>

        <div className="mt-16 md:mt-24">
          <div className="mx-auto max-w-[980px] text-center">
            <h2 className="font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl">
              Os 3 Pilares do Meu Método
            </h2>
          </div>

          <div className="mt-10 space-y-8 md:mt-12 md:space-y-10">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
              <article className="rounded bg-[#e8f0f4] px-6 py-6 md:px-10 md:py-7">
                <p className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9">
                  Estar ainda a estudar dá-me as ferramentas diárias para dominar a fundo a Filosofia e a Escrita. O
                  meu método une a leveza que tu precisas ao rigor técnico que os corretores de exame exigem.
                </p>
              </article>
              <div className="mx-auto flex w-full max-w-[220px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                <p className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl">
                  Rigor Académico
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
              <div className="mx-auto flex w-full max-w-[220px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                <p className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl">
                  Foco Visual e Estratégia
                </p>
              </div>
              <article className="rounded bg-[#e8f0f4] px-6 py-6 md:px-10 md:py-7">
                <p className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9">
                  O nosso cérebro funciona melhor com cores, conexões e lógica direta. Quer compres as minhas sebentas
                  ou venhas para as explicações, vais aprender a estruturar respostas perfeitas sem perder tempo.
                </p>
              </article>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
              <article className="rounded bg-[#e8f0f4] px-6 py-6 md:px-10 md:py-7">
                <p className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9">
                  Aqui não há perguntas estúpidas. Isto é um safe space! Quero que entres na sala de exame e de aula a
                  saber exatamente o que vais fazer.
                </p>
              </article>
              <div className="mx-auto flex w-full max-w-[240px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                <p className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl">
                  Apoio e Empatia Total
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
