import type {
  DashboardProductSummary,
  ModuleAssetSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { ProductSummary, ProductType } from "@/types/product.types"
import { richTextToPlainText } from "@/lib/rich-text"

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
  hybrid: "Híbrido",
  external_service: "Serviço externo",
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function inferProductProfile(product: ProductLike) {
  const haystack = normalize(
    `${product.title} ${product.slug} ${richTextToPlainText(product.short_description)} ${richTextToPlainText(product.description)}`,
  )

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
      return "Sebenta de Português"
    case "gramatica":
      return "Material de apoio"
    case "organizacao":
      return "Kit de organização"
    case "service":
      return "Apoio personalizado"
    case "free":
      return "Material gratuito"
    default:
      return product.product_type === "free" ? "Material gratuito" : "Material digital"
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
        eyebrow: "Preparação mais completa",
        benefit: "Reúne materiais centrais numa única compra, com leitura mais organizada e menos dispersão.",
        cardSummary: "Ideal para quem quer concentrar num único pack os materiais de apoio mais importantes.",
        formatLabel: "PDFs e conteúdos complementares num único acesso",
        accessLabel: "Ativação na conta e consulta organizada na Área do aluno",
        valueLine: "Uma opção pensada para quem quer ganhar clareza e contexto logo desde o início.",
        audience: "Alunos que preferem uma solução mais completa, com menos trocas entre materiais soltos.",
        receiveItems: [
          "Materiais reunidos no mesmo material para facilitar a consulta.",
          "Estrutura organizada por módulos e acessos no painel do aluno.",
          "Acesso simples para retomar o estudo sempre que precisares.",
        ],
        accessSteps: [
          "Abres o checkout, confirmas o pack e concluis a ativação.",
          "Depois da confirmação, o material aparece na tua Área do aluno.",
          "Os módulos e materiais ficam organizados para continuares sem perder contexto.",
        ],
        faqs: [
          {
            question: "Este pack substitui materiais individuais?",
            answer: "Foi pensado para reduzir dispersão e juntar o essencial num único acesso.",
          },
          {
            question: "Vou conseguir voltar mais tarde?",
            answer: "Sim. O acesso fica associado à tua conta para continuares quando quiseres.",
          },
        ],
        ctaLabel: "Avançar para o checkout",
        sidebarNote: "Boa opção para quem quer resolver a preparação com menos passos e mais contexto.",
      }
    case "filosofia":
      return {
        typeLabel,
        familyLabel: "Sebenta de Filosofia",
        eyebrow: "Explicação mais clara",
        benefit: "Organiza os temas de Filosofia com uma linha de raciocínio mais simples de seguir.",
        cardSummary: "Material pensado para reduzir confusão e ajudar a estudar Filosofia com mais segurança.",
        formatLabel: "Sebenta digital com apoio estruturado",
        accessLabel: "Disponível na conta para consulta organizada e revisão quando precisares",
        valueLine: "Conteúdo orientado para facilitar leitura, revisão e consolidação dos temas.",
        audience: "Alunos que querem compreender melhor a matéria e estudar com menos ruído.",
        receiveItems: [
          "Conteúdo organizado para leitura mais direta.",
          "Apoio complementar associado ao material, quando publicado.",
          "Consulta simples na Área do aluno, em qualquer momento.",
        ],
        accessSteps: [
          "Confirmas o material e segues para uma compra curta e objetiva.",
          "Depois da confirmação, o acesso fica ligado à tua conta.",
          "O material passa a estar disponível no dashboard para continuares o estudo.",
        ],
        faqs: [
          {
            question: "Este material é indicado para revisão?",
            answer: "Sim. A estrutura foi pensada para tornar a consulta e a revisão mais práticas.",
          },
          {
            question: "O acesso fica organizado por módulos?",
            answer: "Sim. Os materiais publicados aparecem agrupados no painel do aluno.",
          },
        ],
        ctaLabel: "Comprar este material",
        sidebarNote: "Boa escolha para quem quer estudar Filosofia com mais clareza e estrutura.",
      }
    case "portugues":
      return {
        typeLabel,
        familyLabel: "Sebenta de Português",
        eyebrow: "Estudo mais orientado",
        benefit: "Ajuda a organizar os temas de Português com foco em leitura, interpretação e revisão.",
        cardSummary: "Material pensado para transformar matéria dispersa em estudo mais direto e fácil de consultar.",
        formatLabel: "Material digital de apoio para revisão e consulta",
        accessLabel: "Acesso organizado na conta para abrir os teus materiais num só lugar",
        valueLine: "Uma base clara para estudar com mais confiança e menos dispersão.",
        audience: "Alunos que querem rever conteúdos de Português com uma estrutura mais limpa.",
        receiveItems: [
          "Materiais de apoio reunidos num único material.",
          "Consulta simples dentro da Área do aluno.",
          "Organização por módulos e ficheiros sempre que aplicável.",
        ],
        accessSteps: [
          "Escolhes o material e concluis a compra com um fluxo direto.",
          "Após confirmação, o acesso fica ativo na tua conta.",
          "Abres os materiais no dashboard e retomas o estudo ao teu ritmo.",
        ],
        faqs: [
          {
            question: "Consigo usar este material para revisões rápidas?",
            answer: "Sim. A organização foi pensada para facilitar consulta, revisão e retomada.",
          },
          {
            question: "O acesso fica centralizado na minha conta?",
            answer: "Sim. O material aparece no dashboard com os respetivos módulos e materiais.",
          },
        ],
        ctaLabel: "Comprar este material",
        sidebarNote: "Pensado para ajudar a estudar Português de forma mais clara e organizada.",
      }
    case "gramatica":
      return {
        typeLabel,
        familyLabel: "Material de apoio",
        eyebrow: "Entrada simples na plataforma",
        benefit: "Entrega uma base de apoio clara para começar a estudar sem fricção.",
        cardSummary: "Boa porta de entrada para conhecer a plataforma e consultar material útil desde logo.",
        formatLabel: "Material de apoio digital com regras de acesso definidas por material",
        accessLabel: "Ativação simples na conta e consulta dentro da Área do aluno",
        valueLine: "Ideal para quem quer começar com um material acessível e organizado.",
        audience: "Alunos que querem um ponto de partida simples, com consulta clara e rápida.",
        receiveItems: [
          "Material centralizado na tua conta para não dependeres de ficheiros soltos.",
          "Experiência de consulta simples na plataforma.",
          "Regras de visualização e download definidas pelo material associado.",
        ],
        accessSteps: [
          "Ativas o material e ele passa a aparecer no teu painel.",
          "Consultas o material dentro da plataforma, com o acesso associado à tua conta.",
          "Quando existirem regras adicionais de download, elas ficam refletidas no próprio material.",
        ],
        faqs: [
          {
            question: "Este material exige compra paga?",
            answer: "Se estiver marcado como gratuito, a ativação é simples e o acesso fica ligado à tua conta.",
          },
          {
            question: "Posso consultar tudo na plataforma?",
            answer: "Sim. O objetivo é concentrar o acesso no dashboard com regras claras por material.",
          },
        ],
        ctaLabel: product.product_type === "free" ? "Ativar acesso gratuito" : "Abrir material",
        sidebarNote: "Uma forma simples de experimentar a plataforma com conteúdo já organizado.",
      }
    case "organizacao":
      return {
        typeLabel,
        familyLabel: "Kit de organização",
        eyebrow: "Planeamento mais simples",
        benefit: "Ajuda a transformar estudo solto em rotina mais clara, com materiais de apoio práticos.",
        cardSummary: "Bom para quem quer organizar melhor o estudo e ganhar consistência na rotina.",
        formatLabel: "Materiais de apoio prontos para consulta e, quando permitido, download",
        accessLabel: "Ativação rápida na conta com acesso centralizado ao material",
        valueLine: "Pensado para dar mais estrutura ao dia a dia de estudo sem complicar.",
        audience: "Alunos que querem organizar melhor o tempo, as metas e os materiais.",
        receiveItems: [
          "Materiais de apoio prontos para consulta no teu painel.",
          "Estrutura simples para acompanhar rotina e progresso.",
          "Acesso concentrado num único lugar, sem depender de envios manuais.",
        ],
        accessSteps: [
          "Ativas o material e ele fica disponível na tua conta.",
          "Abres os materiais no dashboard e consultas o que precisas.",
          "Quando o material permitir download, essa informação aparece no próprio material.",
        ],
        faqs: [
          {
            question: "Este material serve para organizar o estudo?",
            answer: "Sim. Foi pensado para ajudar a dar mais clareza à rotina e aos próximos passos.",
          },
          {
            question: "Preciso de usar outras ferramentas?",
            answer: "Não necessariamente. O objetivo é centralizar o acesso ao material na plataforma.",
          },
        ],
        ctaLabel: product.product_type === "free" ? "Ativar acesso gratuito" : "Abrir material",
        sidebarNote: "Boa escolha para quem quer estudar com mais método e menos improviso.",
      }
    case "service":
      return {
        typeLabel,
        familyLabel: "Apoio personalizado",
        eyebrow: "Mais acompanhamento",
        benefit: "Focado em apoio mais direto, para quem precisa de orientação personalizada e contexto rápido.",
        cardSummary: "Uma opção para quem procura apoio mais próximo e orientado ao seu momento.",
        formatLabel: "Serviço com orientação personalizada e informação centralizada",
        accessLabel: "Fluxo claro para perceber disponibilidade e próximos passos",
        valueLine: "Ideal para quem quer apoio mais acompanhado e menos estudo solto.",
        audience: "Alunos que precisam de mais contexto, acompanhamento ou ajuda direcionada.",
        receiveItems: [
          "Informação clara sobre o serviço e o que esperar do contacto.",
          "Centralização dos passos de ativação e seguimento na plataforma.",
          "Experiência consistente com o resto da Área pública e do painel do aluno.",
        ],
        accessSteps: [
          "Confirmas os detalhes do serviço e avanças para o próximo passo disponível.",
          "A plataforma regista o teu interesse e organiza a continuação do processo.",
          "Os detalhes posteriores ficam associados à tua conta sempre que aplicável.",
        ],
        faqs: [
          {
            question: "Este serviço funciona como um material digital comum?",
            answer: "Não exatamente. O objetivo é orientar o pedido e o seguimento de forma mais controlada.",
          },
          {
            question: "Vou perceber os próximos passos antes de avançar?",
            answer: "Sim. A página foi pensada para deixar o processo mais claro e previsível.",
          },
        ],
        ctaLabel: "Ver disponibilidade",
        sidebarNote: "Opção pensada para apoio mais próximo, sem perder a clareza do processo.",
      }
    case "free":
      return {
        typeLabel,
        familyLabel: "Material gratuito",
        eyebrow: "Começa sem fricção",
        benefit: "Uma forma simples de entrar na plataforma e perceber como o acesso funciona.",
        cardSummary: "Material gratuito para quem quer começar a estudar com uma experiência organizada.",
        formatLabel: "Conteúdo digital com ativação simples",
        accessLabel: "Acesso associado à conta para continuares depois sem perder contexto",
        valueLine: "Ideal para conhecer a plataforma com um primeiro material claro e útil.",
        audience: "Alunos que querem experimentar a plataforma antes de avançar para outros materiais.",
        receiveItems: [
          "Acesso centralizado ao material na tua conta.",
          "Consulta organizada e experiência igual aos restantes materiais.",
          "Mais clareza sobre como a plataforma funciona desde o primeiro acesso.",
        ],
        accessSteps: [
          "Ativas o material com um fluxo simples e curto.",
          "O acesso fica ligado à tua conta para poderes voltar quando quiseres.",
          "Se houver regras adicionais de download, elas aparecem de forma clara no próprio material.",
        ],
        faqs: [
          {
            question: "Preciso de criar conta?",
            answer: "Sim. O acesso fica associado à tua conta para manter tudo organizado na Área do aluno.",
          },
          {
            question: "Posso voltar depois?",
            answer: "Sim. O objetivo é permitir consulta previsível sem depender de envios externos.",
          },
        ],
        ctaLabel: "Ativar acesso gratuito",
        sidebarNote: "Boa opção para conhecer a experiência da plataforma antes de comprar outros materiais.",
      }
    default:
      return {
        typeLabel,
        familyLabel: product.product_type === "free" ? "Material gratuito" : "Material digital",
        eyebrow: "Conteúdo organizado",
        benefit: "Pensado para tornar o estudo mais claro, com acesso simples e menos dispersão.",
        cardSummary:
          richTextToPlainText(product.short_description) ||
          richTextToPlainText(product.description) ||
          "Material digital pronto para ser consultado com uma experiência organizada.",
        formatLabel: "Material digital estruturado para consulta simples",
        accessLabel: "Acesso centralizado na tua conta com organização por material e módulos",
        valueLine: "Uma forma mais clara de comprar, aceder e retomar o estudo.",
        audience: "Alunos que valorizam materiais organizados e acesso previsível.",
        receiveItems: [
          "Conteúdo centralizado na tua Área do aluno.",
          "Fluxo de acesso pensado para continuares sem perder contexto.",
          "Estrutura organizada por módulos e materiais quando aplicável.",
        ],
        accessSteps: [
          "Escolhes o material e confirmas se faz sentido para o teu momento.",
          "Segues para o passo de ativação ou compra com um fluxo curto.",
          "Depois da confirmação, o acesso fica associado à tua conta.",
        ],
        faqs: [
          {
            question: "Como acedo ao material depois da ativação?",
            answer: "O acesso fica ligado à tua conta e aparece no dashboard com os respetivos materiais.",
          },
          {
            question: "Posso continuar o estudo mais tarde?",
            answer: "Sim. A plataforma foi pensada para retomares o conteúdo sem perder organização.",
          },
        ],
        ctaLabel: product.product_type === "free" ? "Ativar acesso gratuito" : "Avançar para o checkout",
        sidebarNote: "Conteúdo organizado para compra simples e acesso confiável.",
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
      return "Vídeo aula"
    case "external_link":
      return "Recurso externo"
    case "mixed":
      return "Módulo misto"
    default:
      return "Módulo"
  }
}

export function getLessonTypeLabel(lessonType: ProductLessonSummary["lesson_type"]) {
  switch (lessonType) {
    case "video":
      return "Vídeo"
    case "text":
      return "Texto"
    case "hybrid":
      return "Híbrida"
    case "file":
      return "Ficheiro"
    default:
      return "Aula"
  }
}

export function getAssetTypeLabel(assetType: ModuleAssetSummary["asset_type"]) {
  switch (assetType) {
    case "image":
      return "Imagem"
    case "pdf":
      return "PDF"
    case "video_file":
      return "Vídeo"
    case "video_embed":
      return "Vídeo incorporado"
    case "external_link":
      return "Link externo"
    default:
      return "Material"
  }
}

export function getAssetActionLabel(asset: ModuleAssetSummary) {
  switch (asset.asset_type) {
    case "image":
      return "Ver imagem"
    case "pdf":
      return asset.allow_download ? "Abrir PDF" : "Ler material"
    case "video_file":
    case "video_embed":
      return "Ver vídeo"
    case "external_link":
      return "Abrir recurso"
    default:
      return "Abrir material"
  }
}
