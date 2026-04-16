import type {
  DashboardProductSummary,
  ModuleAssetSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { ProductSummary, ProductType } from "@/types/product.types"

type ProductLike = Pick<
  ProductSummary,
  "title" | "slug" | "product_type" | "short_description" | "description"
>

export interface ProductFaqItem {
  question: string
  answer: string
}

export interface ProductNarrative {
  typeLabel: string
  familyLabel: string
  eyebrow: string
  benefit: string
  cardSummary: string
  formatLabel: string
  accessLabel: string
  valueLine: string
  audience: string
  receiveItems: string[]
  accessSteps: string[]
  faqs: ProductFaqItem[]
  ctaLabel: string
  sidebarNote: string
}

const productTypeLabels: Record<ProductType, string> = {
  paid: "Pago",
  free: "Gratuito",
  hybrid: "Hibrido",
  external_service: "Servico externo",
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function inferProductProfile(product: ProductLike) {
  const haystack = normalize(`${product.title} ${product.slug} ${product.short_description} ${product.description}`)

  if (product.product_type === "external_service" || haystack.includes("explicac")) {
    return "service"
  }

  if (haystack.includes("pack") || haystack.includes("sucesso")) {
    return "pack"
  }

  if (haystack.includes("filosof")) {
    return "filosofia"
  }

  if (haystack.includes("gramatic")) {
    return "gramatica"
  }

  if (haystack.includes("organiz") || haystack.includes("planner") || haystack.includes("kit")) {
    return "organizacao"
  }

  if (haystack.includes("portugues") || haystack.includes("literatura")) {
    return "portugues"
  }

  if (product.product_type === "free") {
    return "free"
  }

  return "default"
}

export function getProductTypeLabel(productType: ProductType) {
  return productTypeLabels[productType]
}

export function getProductFamilyLabel(product: ProductLike) {
  switch (inferProductProfile(product)) {
    case "pack":
      return "Pack completo"
    case "filosofia":
      return "Sebenta de Filosofia"
    case "portugues":
      return "Sebenta de Portugues"
    case "gramatica":
      return "Material de apoio"
    case "organizacao":
      return "Kit de organizacao"
    case "service":
      return "Apoio personalizado"
    case "free":
      return "Material gratuito"
    default:
      return product.product_type === "free" ? "Material gratuito" : "Produto digital"
  }
}

export function getProductNarrative(product: ProductLike): ProductNarrative {
  const profile = inferProductProfile(product)
  const typeLabel = getProductTypeLabel(product.product_type)

  switch (profile) {
    case "pack":
      return {
        typeLabel,
        familyLabel: "Pack completo",
        eyebrow: "Preparacao mais completa",
        benefit: "Reune materiais centrais numa unica compra, com leitura mais organizada e menos dispersao.",
        cardSummary: "Ideal para quem quer concentrar num unico pack os materiais de apoio mais importantes.",
        formatLabel: "PDFs e conteudos complementares num unico acesso",
        accessLabel: "Ativacao na conta e consulta organizada na area do aluno",
        valueLine: "Uma opcao pensada para quem quer ganhar clareza e contexto logo desde o inicio.",
        audience: "Alunos que preferem uma solucao mais completa, com menos trocas entre materiais soltos.",
        receiveItems: [
          "Materiais reunidos no mesmo produto para facilitar a consulta.",
          "Estrutura organizada por modulos e acessos no painel do aluno.",
          "Acesso simples para retomar o estudo sempre que precisares.",
        ],
        accessSteps: [
          "Abres o checkout, confirmas o pack e concluis a ativacao.",
          "Depois da confirmacao, o produto aparece na tua area do aluno.",
          "Os modulos e materiais ficam organizados para continuares sem perder contexto.",
        ],
        faqs: [
          {
            question: "Este pack substitui materiais individuais?",
            answer: "Foi pensado para reduzir dispersao e juntar o essencial num unico acesso.",
          },
          {
            question: "Vou conseguir voltar mais tarde?",
            answer: "Sim. O acesso fica associado a tua conta para continuares quando quiseres.",
          },
        ],
        ctaLabel: "Avancar para o checkout",
        sidebarNote: "Boa opcao para quem quer resolver a preparacao com menos passos e mais contexto.",
      }
    case "filosofia":
      return {
        typeLabel,
        familyLabel: "Sebenta de Filosofia",
        eyebrow: "Explicacao mais clara",
        benefit: "Organiza os temas de Filosofia com uma linha de raciocinio mais simples de seguir.",
        cardSummary: "Material pensado para reduzir confusao e ajudar a estudar Filosofia com mais seguranca.",
        formatLabel: "Sebenta digital com apoio estruturado",
        accessLabel: "Disponivel na conta para consulta organizada e revisao quando precisares",
        valueLine: "Conteudo orientado para facilitar leitura, revisao e consolidacao dos temas.",
        audience: "Alunos que querem compreender melhor a materia e estudar com menos ruido.",
        receiveItems: [
          "Conteudo organizado para leitura mais direta.",
          "Apoio complementar associado ao produto, quando publicado.",
          "Consulta simples na area do aluno, em qualquer momento.",
        ],
        accessSteps: [
          "Confirmas o produto e segues para uma compra curta e objetiva.",
          "Depois da confirmacao, o acesso fica ligado a tua conta.",
          "O material passa a estar disponivel no dashboard para continuares o estudo.",
        ],
        faqs: [
          {
            question: "Este produto e indicado para revisao?",
            answer: "Sim. A estrutura foi pensada para tornar a consulta e a revisao mais praticas.",
          },
          {
            question: "O acesso fica organizado por modulos?",
            answer: "Sim. Os materiais publicados aparecem agrupados no painel do aluno.",
          },
        ],
        ctaLabel: "Comprar este material",
        sidebarNote: "Boa escolha para quem quer estudar Filosofia com mais clareza e estrutura.",
      }
    case "portugues":
      return {
        typeLabel,
        familyLabel: "Sebenta de Portugues",
        eyebrow: "Estudo mais orientado",
        benefit: "Ajuda a organizar os temas de Portugues com foco em leitura, interpretacao e revisao.",
        cardSummary: "Produto pensado para transformar materia dispersa em estudo mais direto e facil de consultar.",
        formatLabel: "Material digital de apoio para revisao e consulta",
        accessLabel: "Acesso organizado na conta para abrir os teus materiais num so lugar",
        valueLine: "Uma base clara para estudar com mais confianca e menos dispersao.",
        audience: "Alunos que querem rever conteudos de Portugues com uma estrutura mais limpa.",
        receiveItems: [
          "Materiais de apoio reunidos num unico produto.",
          "Consulta simples dentro da area do aluno.",
          "Organizacao por modulos e ficheiros sempre que aplicavel.",
        ],
        accessSteps: [
          "Escolhes o produto e concluis a compra com um fluxo direto.",
          "Apos confirmacao, o acesso fica ativo na tua conta.",
          "Abres os materiais no dashboard e retomas o estudo ao teu ritmo.",
        ],
        faqs: [
          {
            question: "Consigo usar este material para revisoes rapidas?",
            answer: "Sim. A organizacao foi pensada para facilitar consulta, revisao e retomada.",
          },
          {
            question: "O acesso fica centralizado na minha conta?",
            answer: "Sim. O produto aparece no dashboard com os respetivos modulos e materiais.",
          },
        ],
        ctaLabel: "Comprar este material",
        sidebarNote: "Pensado para ajudar a estudar Portugues de forma mais clara e organizada.",
      }
    case "gramatica":
      return {
        typeLabel,
        familyLabel: "Material de apoio",
        eyebrow: "Entrada simples na plataforma",
        benefit: "Entrega uma base de apoio clara para comecar a estudar sem friccao.",
        cardSummary: "Boa porta de entrada para conhecer a plataforma e consultar material util desde logo.",
        formatLabel: "Material de apoio digital com regras de acesso definidas por produto",
        accessLabel: "Ativacao simples na conta e consulta dentro da area do aluno",
        valueLine: "Ideal para quem quer comecar com um material acessivel e organizado.",
        audience: "Alunos que querem um ponto de partida simples, com consulta clara e rapida.",
        receiveItems: [
          "Material centralizado na tua conta para nao dependeres de ficheiros soltos.",
          "Experiencia de consulta simples na plataforma.",
          "Regras de visualizacao e download definidas pelo produto associado.",
        ],
        accessSteps: [
          "Ativas o produto e ele passa a aparecer no teu painel.",
          "Consultas o material dentro da plataforma, com o acesso associado a tua conta.",
          "Quando existirem regras adicionais de download, elas ficam refletidas no proprio produto.",
        ],
        faqs: [
          {
            question: "Este produto exige compra paga?",
            answer: "Se estiver marcado como gratuito, a ativacao e simples e o acesso fica ligado a tua conta.",
          },
          {
            question: "Posso consultar tudo na plataforma?",
            answer: "Sim. O objetivo e concentrar o acesso no dashboard com regras claras por material.",
          },
        ],
        ctaLabel: product.product_type === "free" ? "Ativar acesso gratuito" : "Abrir produto",
        sidebarNote: "Uma forma simples de experimentar a plataforma com conteudo ja organizado.",
      }
    case "organizacao":
      return {
        typeLabel,
        familyLabel: "Kit de organizacao",
        eyebrow: "Planeamento mais simples",
        benefit: "Ajuda a transformar estudo solto em rotina mais clara, com materiais de apoio praticos.",
        cardSummary: "Bom para quem quer organizar melhor o estudo e ganhar consistencia na rotina.",
        formatLabel: "Materiais de apoio prontos para consulta e, quando permitido, download",
        accessLabel: "Ativacao rapida na conta com acesso centralizado ao material",
        valueLine: "Pensado para dar mais estrutura ao dia a dia de estudo sem complicar.",
        audience: "Alunos que querem organizar melhor o tempo, as metas e os materiais.",
        receiveItems: [
          "Materiais de apoio prontos para consulta no teu painel.",
          "Estrutura simples para acompanhar rotina e progresso.",
          "Acesso concentrado num unico lugar, sem depender de envios manuais.",
        ],
        accessSteps: [
          "Ativas o produto e ele fica disponivel na tua conta.",
          "Abres os materiais no dashboard e consultas o que precisas.",
          "Quando o produto permitir download, essa informacao aparece no proprio material.",
        ],
        faqs: [
          {
            question: "Este produto serve para organizar o estudo?",
            answer: "Sim. Foi pensado para ajudar a dar mais clareza a rotina e aos proximos passos.",
          },
          {
            question: "Preciso de usar outras ferramentas?",
            answer: "Nao necessariamente. O objetivo e centralizar o acesso ao material na plataforma.",
          },
        ],
        ctaLabel: product.product_type === "free" ? "Ativar acesso gratuito" : "Abrir produto",
        sidebarNote: "Boa escolha para quem quer estudar com mais metodo e menos improviso.",
      }
    case "service":
      return {
        typeLabel,
        familyLabel: "Apoio personalizado",
        eyebrow: "Mais acompanhamento",
        benefit: "Focado em apoio mais direto, para quem precisa de orientacao personalizada e contexto rapido.",
        cardSummary: "Uma opcao para quem procura apoio mais proximo e orientado ao seu momento.",
        formatLabel: "Servico com orientacao personalizada e informacao centralizada",
        accessLabel: "Fluxo claro para perceber disponibilidade e proximos passos",
        valueLine: "Ideal para quem quer apoio mais acompanhado e menos estudo solto.",
        audience: "Alunos que precisam de mais contexto, acompanhamento ou ajuda direcionada.",
        receiveItems: [
          "Informacao clara sobre o servico e o que esperar do contacto.",
          "Centralizacao dos passos de ativacao e seguimento na plataforma.",
          "Experiencia consistente com o resto da area publica e do painel do aluno.",
        ],
        accessSteps: [
          "Confirmas os detalhes do servico e avancas para o proximo passo disponivel.",
          "A plataforma regista o teu interesse e organiza a continuacao do processo.",
          "Os detalhes posteriores ficam associados a tua conta sempre que aplicavel.",
        ],
        faqs: [
          {
            question: "Este servico funciona como um produto digital comum?",
            answer: "Nao exatamente. O objetivo e orientar o pedido e o seguimento de forma mais controlada.",
          },
          {
            question: "Vou perceber os proximos passos antes de avancar?",
            answer: "Sim. A pagina foi pensada para deixar o processo mais claro e previsivel.",
          },
        ],
        ctaLabel: "Ver disponibilidade",
        sidebarNote: "Opcao pensada para apoio mais proximo, sem perder a clareza do processo.",
      }
    case "free":
      return {
        typeLabel,
        familyLabel: "Material gratuito",
        eyebrow: "Comeca sem friccao",
        benefit: "Uma forma simples de entrar na plataforma e perceber como o acesso funciona.",
        cardSummary: "Material gratuito para quem quer comecar a estudar com uma experiencia organizada.",
        formatLabel: "Conteudo digital com ativacao simples",
        accessLabel: "Acesso associado a conta para continuares depois sem perder contexto",
        valueLine: "Ideal para conhecer a plataforma com um primeiro produto claro e util.",
        audience: "Alunos que querem experimentar a plataforma antes de avancar para outros materiais.",
        receiveItems: [
          "Acesso centralizado ao material na tua conta.",
          "Consulta organizada e experiencia igual aos restantes produtos.",
          "Mais clareza sobre como a plataforma funciona desde o primeiro acesso.",
        ],
        accessSteps: [
          "Ativas o produto com um fluxo simples e curto.",
          "O acesso fica ligado a tua conta para poderes voltar quando quiseres.",
          "Se houver regras adicionais de download, elas aparecem de forma clara no proprio produto.",
        ],
        faqs: [
          {
            question: "Preciso de criar conta?",
            answer: "Sim. O acesso fica associado a tua conta para manter tudo organizado na area do aluno.",
          },
          {
            question: "Posso voltar depois?",
            answer: "Sim. O objetivo e permitir consulta previsivel sem depender de envios externos.",
          },
        ],
        ctaLabel: "Ativar acesso gratuito",
        sidebarNote: "Boa opcao para conhecer a experiencia da plataforma antes de comprar outros materiais.",
      }
    default:
      return {
        typeLabel,
        familyLabel: product.product_type === "free" ? "Material gratuito" : "Produto digital",
        eyebrow: "Conteudo organizado",
        benefit: "Pensado para tornar o estudo mais claro, com acesso simples e menos dispersao.",
        cardSummary:
          product.short_description ??
          product.description ??
          "Produto digital pronto para ser consultado com uma experiencia organizada.",
        formatLabel: "Material digital estruturado para consulta simples",
        accessLabel: "Acesso centralizado na tua conta com organizacao por produto e modulos",
        valueLine: "Uma forma mais clara de comprar, aceder e retomar o estudo.",
        audience: "Alunos que valorizam materiais organizados e acesso previsivel.",
        receiveItems: [
          "Conteudo centralizado na tua area do aluno.",
          "Fluxo de acesso pensado para continuares sem perder contexto.",
          "Estrutura organizada por modulos e materiais quando aplicavel.",
        ],
        accessSteps: [
          "Escolhes o produto e confirmas se faz sentido para o teu momento.",
          "Segues para o passo de ativacao ou compra com um fluxo curto.",
          "Depois da confirmacao, o acesso fica associado a tua conta.",
        ],
        faqs: [
          {
            question: "Como acedo ao produto depois da ativacao?",
            answer: "O acesso fica ligado a tua conta e aparece no dashboard com os respetivos materiais.",
          },
          {
            question: "Posso continuar o estudo mais tarde?",
            answer: "Sim. A plataforma foi pensada para retomares o conteudo sem perder organizacao.",
          },
        ],
        ctaLabel: product.product_type === "free" ? "Ativar acesso gratuito" : "Avancar para o checkout",
        sidebarNote: "Conteudo organizado para compra simples e acesso confiavel.",
      }
  }
}

export function getDashboardProductNote(product: DashboardProductSummary) {
  const narrative = getProductNarrative(product)
  return `${narrative.familyLabel}. ${narrative.accessLabel}`
}

export function getModuleTypeLabel(moduleType: ProductModuleSummary["module_type"]) {
  switch (moduleType) {
    case "pdf":
      return "Leitura guiada"
    case "video":
      return "Video aula"
    case "external_link":
      return "Recurso externo"
    case "mixed":
      return "Modulo misto"
    default:
      return "Modulo"
  }
}

export function getAssetTypeLabel(assetType: ModuleAssetSummary["asset_type"]) {
  switch (assetType) {
    case "pdf":
      return "PDF"
    case "video_file":
      return "Video"
    case "video_embed":
      return "Video incorporado"
    case "external_link":
      return "Link externo"
    default:
      return "Material"
  }
}

export function getAssetActionLabel(asset: ModuleAssetSummary) {
  switch (asset.asset_type) {
    case "pdf":
      return asset.allow_download ? "Abrir PDF" : "Ler material"
    case "video_file":
    case "video_embed":
      return "Ver video"
    case "external_link":
      return "Abrir recurso"
    default:
      return "Abrir material"
  }
}

