import { ProductsCatalogExperience } from "./ProductsCatalogExperience"

export function Products() {
  return (
    <div className="relative overflow-hidden bg-[#dff0f7] text-[#14384d]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-7rem] top-[-7rem] h-64 w-64 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute right-[-5rem] top-40 h-80 w-80 rounded-full bg-[#b9d9ea]/45 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-[#4e6880]">Materiais</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-[#1b2644] md:text-6xl">
            Tudo o que precisas para brilhares
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#41586c] md:text-lg">
            Encontra aqui os teus melhores amigos de estudo: resumos leves, esquemas práticos e o apoio certo para
            dominares o português e a filosofia sem stress.
          </p>
        </header>

        <section className="mx-auto mt-12 max-w-6xl">
          <ProductsCatalogExperience />
        </section>
      </main>
    </div>
  )
}
