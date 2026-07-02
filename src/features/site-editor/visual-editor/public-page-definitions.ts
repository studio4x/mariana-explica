import { ROUTES } from "@/lib/constants"
import type { VisualEditorFieldDefinition, VisualEditorPageDefinition } from "./types"

export interface HomeVisualEditorDocument extends Record<string, unknown> {
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    lead: string
    primaryCta: {
      label: string
      href: string
    }
  }
  objective: {
    eyebrow: string
    text: string
  }
  featureBlocks: {
    block1: {
      eyebrow: string
      text: string
    }
    block2: {
      eyebrow: string
      text: string
    }
    block3: {
      eyebrow: string
      text: string
    }
    block4: {
      eyebrow: string
      text: string
    }
  }
  steps: {
    step1: {
      eyebrow: string
      text: string
    }
    step2: {
      eyebrow: string
      text: string
    }
    step3: {
      eyebrow: string
      text: string
    }
  }
  trust: {
    leftTitle: string
    leftPoint1: {
      title: string
      text: string
    }
    leftPoint2: {
      title: string
      text: string
    }
    leftPoint3: {
      title: string
      text: string
    }
    rightTitle: string
    rightPoint1: string
    rightPoint2: string
    rightPoint3: string
    primaryCta: {
      label: string
      href: string
    }
    secondaryCta: {
      label: string
      href: string
    }
  }
  reviews: {
    eyebrow: string
    title: string
    lead: string
  }
}

export interface AboutVisualEditorDocument extends Record<string, unknown> {
  hero: {
    title: string
    subtitle: string
  }
  portrait: {
    src: string
    alt: string
  }
  intro: {
    title: string
    text1: string
    text2: string
  }
  project: {
    title: string
    card1: string
    card2: string
  }
  pillars: {
    title: string
    pillar1Label: string
    pillar1Text: string
    pillar2Label: string
    pillar2Text: string
    pillar3Label: string
    pillar3Text: string
  }
}

export interface ExplicacoesVisualEditorDocument extends Record<string, unknown> {
  hero: {
    eyebrow: string
    title: string
    lead: string
  }
  notes: {
    title: string
    paragraph1: string
    paragraph2: string
  }
  formNote: {
    title: string
    line1: string
    line2: string
  }
  submitCta: {
    label: string
  }
}

export interface LegalVisualEditorDocument extends Record<string, unknown> {
  hero: {
    eyebrow: string
    title: string
    intro: string
    updatedAt: string
  }
  support: {
    eyebrow: string
    title: string
    lead: string
    primaryCta: {
      label: string
      href: string
    }
    secondaryCta: {
      label: string
      href: string
    }
  }
}

export interface CheckoutVisualEditorDocument extends Record<string, unknown> {
  hero: {
    eyebrow: string
    title: string
    lead: string
  }
  productCard: {
    badge: string
    accessLabel: string
    secureLabel: string
    buttonHint: string
  }
  authPanel: {
    eyebrow: string
    titleLogin: string
    titleRegister: string
  }
  termsModal: {
    title: string
    line1: string
    line2: string
    line3: string
    primaryCtaLabel: string
    secondaryCtaLabel: string
  }
}

export interface CheckoutSuccessVisualEditorDocument extends Record<string, unknown> {
  hero: {
    eyebrow: string
    title: string
    lead: string
  }
  nextStep: {
    title: string
    lead: string
  }
  benefits: {
    firstTitle: string
    firstLead: string
    secondTitle: string
    secondLead: string
  }
  access: {
    eyebrow: string
    primaryCtaLabel: string
    secondaryCtaLabel: string
    note: string
  }
}

const ABOUT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 960 960'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='#e7f3fb'/><stop offset='100%' stop-color='#c9dff0'/></linearGradient></defs><rect width='960' height='960' rx='80' fill='url(#g)'/><rect x='120' y='120' width='720' height='720' rx='56' fill='#ffffff' opacity='0.88'/><circle cx='340' cy='330' r='118' fill='#0f172a' opacity='0.09'/><path d='M326 542c46-62 104-93 174-93s128 31 174 93' fill='none' stroke='#1d4ed8' stroke-width='20' stroke-linecap='round'/><path d='M405 356c0 28-22 50-50 50s-50-22-50-50 22-50 50-50 50 22 50 50Zm290 0c0 28-22 50-50 50s-50-22-50-50 22-50 50-50 50 22 50 50Z' fill='#1d4ed8' opacity='0.35'/></svg>"

const SUPPORT_LINK = "/suporte"

function buildFields(keys: Array<Pick<VisualEditorFieldDefinition, "key" | "label" | "kind" | "styleGroup">>) {
  return keys
}

const PAGE_FRAME_FIELD: VisualEditorFieldDefinition = {
  key: "layout.pageFrame",
  label: "Espaço da página",
  kind: "container",
  styleGroup: "container",
  description: "Ajusta o espaço entre o header e o início do conteúdo.",
}

export const HOME_VISUAL_EDITOR_DEFAULT_DOCUMENT: HomeVisualEditorDocument = {
  hero: {
    eyebrow: "Estudo claro e direto",
    title: "Tens dificuldades a Portugu\u00eas ou Filosofia?",
    subtitle: "Nunca tiveste a disciplina e vais fazer exame?",
    lead: "Ent\u00e3o fica aqui que este local \u00e9 para ti!",
    primaryCta: {
      label: "Explorar materiais",
      href: ROUTES.COURSES,
    },
  },
  objective: {
    eyebrow: "Objetivo principal",
    text:
      "Criei este espa\u00e7o para te dar o apoio que os manuais n\u00e3o d\u00e3o: leveza, clareza e uma estrat\u00e9gia real para brilhares nos exames de Filosofia e Portugu\u00eas. Vamo-nos simplificar?",
  },
  featureBlocks: {
    block1: {
      eyebrow: "EM BREVE - AULAS GRAVADAS",
      text: "Domina temas complexos ao teu ritmo, com aulas organizadas e flex\u00edveis, prontas quando tu estiveres.",
    },
    block2: {
      eyebrow: "EXPLICA\u00c7\u00d5ES",
      text: "Acompanhamento personalizado e focado nas tuas d\u00favidas espec\u00edficas para garantires resultados.",
    },
    block3: {
      eyebrow: "MATERIAIS DIGITAIS",
      text: "Resumos visuais e esquemas claros para simplificar o teu estudo e garantires a nota m\u00e1xima sem complica\u00e7\u00f5es.",
    },
    block4: {
      eyebrow: "MATERIAIS DIGITAIS - GRATUITOS",
      text: "Dicas flash e recursos r\u00e1pidos para descarregar e dares um boost imediato no teu estudo.",
    },
  },
  steps: {
    step1: {
      eyebrow: "ENCONTRA O TEU APOIO",
      text:
        "Explora as sebentas e materiais dispon\u00edveis. Cada material foi criado para resolver uma dor espec\u00edfica, por isso vais perceber logo qual \u00e9 o ideal para o teu momento.",
    },
    step2: {
      eyebrow: "ACESSO R\u00c1PIDO E SEGURO",
      text:
        "O processo \u00e9 direto e transparente. Sem taxas escondidas ou passos desnecess\u00e1rios. Pagas de forma segura e o material \u00e9 teu no segundo seguinte.",
    },
    step3: {
      eyebrow: "FOCA-TE NO QUE IMPORTA",
      text:
        "Tudo fica organizado na tua \u00e1rea do aluno. Podes aceder aos PDFs e aulas sempre que quiseres, ao teu ritmo, e retomar o estudo exatamente onde paraste.",
    },
  },
  trust: {
    leftTitle: "Vantagens de trabalhares comigo",
    leftPoint1: {
      title: "Linguagem Direta:",
      text: "Falamos a mesma l\u00edngua. Esquece os termos imposs\u00edveis dos manuais e entende a mat\u00e9ria \u00e0 primeira.",
    },
    leftPoint2: {
      title: "Foco no Exame:",
      text: "Materiais desenhados apenas com o que realmente sai. Sem distra\u00e7\u00f5es.",
    },
    leftPoint3: {
      title: "Resumos Visuais:",
      text: "Esquemas e cores pensados para quem precisa de organizar ideias rapidamente.",
    },
    rightTitle: "Leveza e Confian\u00e7a em cada passo",
    rightPoint1: "Suporte Real: N\u00e3o recebes s\u00f3 um PDF. Tens uma \"amiga\" (eu!) nas DMs para te apoiar sempre que precisares.",
    rightPoint2: "Tudo Organizado: Esquece o caos do WhatsApp. Os teus materiais ficam sempre guardados na tua \u00e1rea do aluno.",
    rightPoint3: "P\u00e9s na Terra: Filosofia e Portugu\u00eas deixam de ser abstratos e passam a ser ferramentas que dominas com seguran\u00e7a.",
    primaryCta: {
      label: "Explorar materiais",
      href: ROUTES.COURSES,
    },
    secondaryCta: {
      label: "Criar Conta",
      href: ROUTES.REGISTER,
    },
  },
  reviews: {
    eyebrow: "Reviews",
    title: "E o que dizem os nossos alunos?",
    lead: "Avalia\u00e7\u00f5es reais publicadas no m\u00f3dulo de Reviews.",
  },
}

export const ABOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT: AboutVisualEditorDocument = {
  hero: {
    title: "Muito mais do que uma explicadora:\nQuem \u00e9 a Mariana?",
    subtitle: "Conhece a pessoa por tr\u00e1s da marca Mariana Explica.",
  },
  portrait: {
    src: ABOUT_IMAGE_PLACEHOLDER,
    alt: "Retrato ilustrado da Mariana",
  },
  intro: {
    title: "Ol\u00e1! Eu sou a Mariana, fundadora do Mariana Explica e, atualmente, estudante de Filosofia na FLUP.",
    text1:
      "Se chegaste at\u00e9 aqui, \u00e9 muito prov\u00e1vel que estejas a sentir o peso dos manuais gigantes de Portugu\u00eas, o n\u00f3 cego da L\u00f3gica em Filosofia ou o p\u00e2nico silencioso da aproxima\u00e7\u00e3o dos Exames Nacionais.",
    text2:
      "Deixa-me dizer-te uma coisa: eu percebo-te perfeitamente, porque eu ainda estou a\u00ed.",
  },
  project: {
    title: "De estudante para estudante: porqu\u00ea este projeto?",
    card1:
      "Durante o meu percurso, percebi que a maior barreira entre um aluno e uma nota excelente n\u00e3o \u00e9 a falta de intelig\u00eancia, mas sim a forma como a mat\u00e9ria \u00e9 ensinada. Estive cansada de manuais densos, linguagem excessivamente formal e calhama\u00e7os cheios de 'palha' que s\u00f3 servem para causar ansiedade.",
    card2:
      "Este projeto nasceu exatamente para ser a ponte. Eu transformo a mat\u00e9ria mais complexa em esquemas visuais, resumos diretos e explica\u00e7\u00f5es descontra\u00eddas. Eu explico-te a mat\u00e9ria da forma que eu pr\u00f3pria gostava que me tivessem explicado quando estava no teu lugar. \u00c9 isso que faz toda a diferen\u00e7a.",
  },
  pillars: {
    title: "Os 3 Pilares do Meu M\u00e9todo",
    pillar1Label: "Rigor Acad\u00e9mico",
    pillar1Text:
      "Estar ainda a estudar d\u00e1-me as ferramentas di\u00e1rias para dominar a fundo a Filosofia e a Escrita. O meu m\u00e9todo une a leveza que tu precisas ao rigor t\u00e9cnico que os corretores de exame exigem.",
    pillar2Label: "Foco Visual e Estrat\u00e9gia",
    pillar2Text:
      "O nosso c\u00e9rebro funciona melhor com cores, conex\u00f5es e l\u00f3gica direta. Quer compres as minhas sebentas ou venhas para as explica\u00e7\u00f5es, vais aprender a estruturar respostas perfeitas sem perder tempo.",
    pillar3Label: "Apoio e Empatia Total",
    pillar3Text:
      "Aqui n\u00e3o h\u00e1 perguntas est\u00fapidas. Isto \u00e9 um safe space! Quero que entres na sala de exame e de aula a saber exatamente o que vais fazer.",
  },
}

export const EXPLICACOES_VISUAL_EDITOR_DEFAULT_DOCUMENT: ExplicacoesVisualEditorDocument = {
  hero: {
    eyebrow: "Explica\u00e7\u00f5es",
    title: "Vamos descomplicar o teu ano letivo juntos?",
    lead:
      "N\u00e3o tens Instagram ou preferes o contacto formal por e-mail? Sem problema, est\u00e1s no s\u00edtio certo! Este espa\u00e7o foi pensado tanto para estudantes como para encarregados de educa\u00e7\u00e3o que queiram esclarecer d\u00favidas sobre os meus materiais ou solicitar apoio individual.",
  },
  notes: {
    title: "Notas importantes antes de enviares o teu formul\u00e1rio:",
    paragraph1:
      "Planeamento Pr\u00e9vio: Devido \u00e0 agenda preenchida, todos os pedidos para explica\u00e7\u00f5es devem ser efetuados com um m\u00ednimo de 3 semanas de anteced\u00eancia.",
    paragraph2:
      "N\u00e3o Garante Reserva: O envio e submiss\u00e3o deste formul\u00e1rio funciona estritamente como um pedido de informa\u00e7\u00f5es e consulta de disponibilidade. N\u00e3o constitui, de forma alguma, uma marca\u00e7\u00e3o autom\u00e1tica ou garantia de vaga.",
  },
  formNote: {
    title: "Se o teu pedido for para Explica\u00e7\u00f5es, indica obrigatoriamente nesta caixa:",
    line1: "O Ano Escolar do Aluno (ex: 10.\u00ba, 11.\u00ba ou 12.\u00ba ano)",
    line2: "A Disciplina pretendida (Filosofia ou Portugu\u00eas)",
  },
  submitCta: {
    label: "Enviar formul\u00e1rio",
  },
}

export const LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT: LegalVisualEditorDocument = {
  hero: {
    eyebrow: "Privacidade",
    title: "Pol\u00edtica de Privacidade",
    intro:
      "Esta p\u00e1gina explica como a Mariana Explica recolhe, utiliza, protege e conserva dados pessoais no contexto do site p\u00fablico, da \u00e1rea autenticada, do checkout, do suporte e da entrega de conte\u00fados digitais. O texto foi estruturado para refletir os princ\u00edpios do RGPD e a legisla\u00e7\u00e3o aplic\u00e1vel em Portugal e na Uni\u00e3o Europeia.",
    updatedAt: "23/04/2026",
  },
  support: {
    eyebrow: "Apoio",
    title: "Precisa de esclarecimentos?",
    lead:
      "Se precisar de ajuda adicional sobre privacidade, cookies, condi\u00e7\u00f5es de utiliza\u00e7\u00e3o ou exerc\u00edcio de direitos, utilize os canais de apoio dispon\u00edveis na plataforma.",
    primaryCta: {
      label: "Contactar suporte",
      href: SUPPORT_LINK,
    },
    secondaryCta: {
      label: "Aceder a Mariana Explica",
      href: ROUTES.LOGIN,
    },
  },
}

export const CHECKOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT: CheckoutVisualEditorDocument = {
  hero: {
    eyebrow: "Confirma\u00e7\u00e3o de pedido",
    title: "Quase l\u00e1! Vamos finalizar a tua inscri\u00e7\u00e3o.",
    lead: "Preenche os dados de checkout e segue para o pagamento com seguran\u00e7a.",
  },
  productCard: {
    badge: "CURSO COMPLETO",
    accessLabel: "Acesso na conta",
    secureLabel: "Ambiente seguro",
    buttonHint: "Segue para o pagamento",
  },
  authPanel: {
    eyebrow: "Acesso e pagamento",
    titleLogin: "J\u00e1 tenho conta",
    titleRegister: "Quero me cadastrar",
  },
  termsModal: {
    title: "Antes de avan\u00e7ar",
    line1:
      "Ao continuar, confirmas que leste e aceitas os termos de uso, a pol\u00edtica de privacidade e as condi\u00e7\u00f5es comerciais apresentadas para este material.",
    line2: "O pagamento \u00e9 processado pela Stripe e validado no backend.",
    line3:
      "O acesso ao conte\u00fado depende da confirma\u00e7\u00e3o do pagamento e os teus dados s\u00e3o tratados para operacionalizar a compra e o acesso.",
    primaryCtaLabel: "Ler termos completos",
    secondaryCtaLabel: "Fechar",
  },
}

export const CHECKOUT_SUCCESS_VISUAL_EDITOR_DEFAULT_DOCUMENT: CheckoutSuccessVisualEditorDocument = {
  hero: {
    eyebrow: "Checkout conclu\u00eddo",
    title: "A tua inscri\u00e7\u00e3o foi recebida com sucesso.",
    lead:
      "O acesso ao material ser\u00e1 apresentado na \u00e1rea do aluno assim que a confirma\u00e7\u00e3o de pagamento estiver refletida na plataforma.",
  },
  nextStep: {
    title: "Pr\u00f3ximo passo",
    lead:
      "Entra diretamente no material para verificar o acesso e continuar a tua jornada de estudo.",
  },
  benefits: {
    firstTitle: "Material organizado",
    firstLead: "Aulas e materiais ficam reunidos na \u00e1rea do aluno.",
    secondTitle: "Acesso protegido",
    secondLead: "A liberta\u00e7\u00e3o \u00e9 validada pelo backend e pelo Stripe.",
  },
  access: {
    eyebrow: "Acesso r\u00e1pido",
    primaryCtaLabel: "Ir para o material",
    secondaryCtaLabel: "Abrir \u00e1rea do aluno",
    note:
      "Se o material ainda n\u00e3o aparecer, aguarda alguns segundos e atualiza a \u00e1rea do aluno. A confirma\u00e7\u00e3o depende do retorno do Stripe.",
  },
}

export const PUBLIC_VISUAL_EDITOR_PAGE_DEFINITIONS: VisualEditorPageDefinition[] = [
  {
    pageKey: "home",
    title: "Home",
    publicPath: ROUTES.HOME,
    description: "Hero, objetivo, blocos de oferta, passos, confianca e reviews da home publica.",
    defaultDocument: HOME_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda do topo", kind: "text", styleGroup: "text" },
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.subtitle", label: "Subtitulo", kind: "text", styleGroup: "text" },
      { key: "hero.lead", label: "Texto de apoio", kind: "textarea", styleGroup: "text" },
      { key: "hero.primaryCta", label: "Botao principal", kind: "link", styleGroup: "interactive" },
      { key: "objective.eyebrow", label: "Legenda do objetivo", kind: "text", styleGroup: "text" },
      { key: "objective.text", label: "Texto do objetivo", kind: "textarea", styleGroup: "text" },
      { key: "featureBlocks.block1.eyebrow", label: "Bloco 1 - legenda", kind: "text", styleGroup: "text" },
      { key: "featureBlocks.block1.text", label: "Bloco 1 - texto", kind: "textarea", styleGroup: "text" },
      { key: "featureBlocks.block2.eyebrow", label: "Bloco 2 - legenda", kind: "text", styleGroup: "text" },
      { key: "featureBlocks.block2.text", label: "Bloco 2 - texto", kind: "textarea", styleGroup: "text" },
      { key: "featureBlocks.block3.eyebrow", label: "Bloco 3 - legenda", kind: "text", styleGroup: "text" },
      { key: "featureBlocks.block3.text", label: "Bloco 3 - texto", kind: "textarea", styleGroup: "text" },
      { key: "featureBlocks.block4.eyebrow", label: "Bloco 4 - legenda", kind: "text", styleGroup: "text" },
      { key: "featureBlocks.block4.text", label: "Bloco 4 - texto", kind: "textarea", styleGroup: "text" },
      { key: "steps.step1.eyebrow", label: "Passo 1 - legenda", kind: "text", styleGroup: "text" },
      { key: "steps.step1.text", label: "Passo 1 - texto", kind: "textarea", styleGroup: "text" },
      { key: "steps.step2.eyebrow", label: "Passo 2 - legenda", kind: "text", styleGroup: "text" },
      { key: "steps.step2.text", label: "Passo 2 - texto", kind: "textarea", styleGroup: "text" },
      { key: "steps.step3.eyebrow", label: "Passo 3 - legenda", kind: "text", styleGroup: "text" },
      { key: "steps.step3.text", label: "Passo 3 - texto", kind: "textarea", styleGroup: "text" },
      { key: "trust.leftTitle", label: "Titulo da coluna esquerda", kind: "text", styleGroup: "heading" },
      { key: "trust.leftPoint1.title", label: "Ponto esquerdo 1 - titulo", kind: "text", styleGroup: "text" },
      { key: "trust.leftPoint1.text", label: "Ponto esquerdo 1 - texto", kind: "textarea", styleGroup: "text" },
      { key: "trust.leftPoint2.title", label: "Ponto esquerdo 2 - titulo", kind: "text", styleGroup: "text" },
      { key: "trust.leftPoint2.text", label: "Ponto esquerdo 2 - texto", kind: "textarea", styleGroup: "text" },
      { key: "trust.leftPoint3.title", label: "Ponto esquerdo 3 - titulo", kind: "text", styleGroup: "text" },
      { key: "trust.leftPoint3.text", label: "Ponto esquerdo 3 - texto", kind: "textarea", styleGroup: "text" },
      { key: "trust.rightTitle", label: "Titulo da coluna direita", kind: "text", styleGroup: "heading" },
      { key: "trust.rightPoint1", label: "Ponto direito 1", kind: "textarea", styleGroup: "text" },
      { key: "trust.rightPoint2", label: "Ponto direito 2", kind: "textarea", styleGroup: "text" },
      { key: "trust.rightPoint3", label: "Ponto direito 3", kind: "textarea", styleGroup: "text" },
      { key: "trust.primaryCta", label: "Botao da coluna direita", kind: "link", styleGroup: "interactive" },
      { key: "trust.secondaryCta", label: "Botao secundario", kind: "link", styleGroup: "interactive" },
      { key: "reviews.eyebrow", label: "Legenda das reviews", kind: "text", styleGroup: "text" },
      { key: "reviews.title", label: "Titulo das reviews", kind: "text", styleGroup: "heading" },
      { key: "reviews.lead", label: "Texto das reviews", kind: "textarea", styleGroup: "text" },
    ]),
  },
  {
    pageKey: "about",
    title: "Sobre",
    publicPath: ROUTES.ABOUT,
    description: "Hero, retrato, introducao e pilares da pagina Sobre.",
    defaultDocument: ABOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.subtitle", label: "Subtitulo", kind: "text", styleGroup: "text" },
      { key: "portrait.src", label: "Imagem", kind: "image", styleGroup: "image" },
      { key: "portrait.alt", label: "Texto alternativo", kind: "text", styleGroup: "text" },
      { key: "intro.title", label: "Introducao", kind: "textarea", styleGroup: "text" },
      { key: "intro.text1", label: "Intro - paragrafo 1", kind: "textarea", styleGroup: "text" },
      { key: "intro.text2", label: "Intro - paragrafo 2", kind: "textarea", styleGroup: "text" },
      { key: "project.title", label: "Titulo do projeto", kind: "text", styleGroup: "heading" },
      { key: "project.card1", label: "Cartao 1", kind: "textarea", styleGroup: "text" },
      { key: "project.card2", label: "Cartao 2", kind: "textarea", styleGroup: "text" },
      { key: "pillars.title", label: "Titulo dos pilares", kind: "text", styleGroup: "heading" },
      { key: "pillars.pillar1Label", label: "Pilar 1 - titulo", kind: "text", styleGroup: "text" },
      { key: "pillars.pillar1Text", label: "Pilar 1 - texto", kind: "textarea", styleGroup: "text" },
      { key: "pillars.pillar2Label", label: "Pilar 2 - titulo", kind: "text", styleGroup: "text" },
      { key: "pillars.pillar2Text", label: "Pilar 2 - texto", kind: "textarea", styleGroup: "text" },
      { key: "pillars.pillar3Label", label: "Pilar 3 - titulo", kind: "text", styleGroup: "text" },
      { key: "pillars.pillar3Text", label: "Pilar 3 - texto", kind: "textarea", styleGroup: "text" },
    ]),
  },
  {
    pageKey: "explicacoes",
    title: "Explicacoes",
    publicPath: ROUTES.EXPLANATIONS,
    description: "Hero, notas e destaque do formulario de explicacoes.",
    defaultDocument: EXPLICACOES_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda do topo", kind: "text", styleGroup: "text" },
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.lead", label: "Texto introdutorio", kind: "textarea", styleGroup: "text" },
      { key: "notes.title", label: "Titulo das notas", kind: "text", styleGroup: "heading" },
      { key: "notes.paragraph1", label: "Nota 1", kind: "textarea", styleGroup: "text" },
      { key: "notes.paragraph2", label: "Nota 2", kind: "textarea", styleGroup: "text" },
      { key: "formNote.title", label: "Titulo do destaque do formulario", kind: "text", styleGroup: "heading" },
      { key: "formNote.line1", label: "Linha do destaque 1", kind: "text", styleGroup: "text" },
      { key: "formNote.line2", label: "Linha do destaque 2", kind: "text", styleGroup: "text" },
      { key: "submitCta.label", label: "Texto do botao", kind: "text", styleGroup: "interactive" },
    ]),
  },
  {
    pageKey: "privacy",
    title: "Privacidade",
    publicPath: ROUTES.PRIVACY,
    description: "Cabecalho e bloco de apoio da politica de privacidade.",
    defaultDocument: LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda", kind: "text", styleGroup: "text" },
      { key: "hero.title", label: "Titulo", kind: "text", styleGroup: "heading" },
      { key: "hero.intro", label: "Introducao", kind: "textarea", styleGroup: "text" },
      { key: "hero.updatedAt", label: "Data de atualizacao", kind: "text", styleGroup: "text" },
      { key: "support.eyebrow", label: "Legenda do apoio", kind: "text", styleGroup: "text" },
      { key: "support.title", label: "Titulo do apoio", kind: "text", styleGroup: "heading" },
      { key: "support.lead", label: "Texto do apoio", kind: "textarea", styleGroup: "text" },
      { key: "support.primaryCta", label: "CTA principal", kind: "link", styleGroup: "interactive" },
      { key: "support.secondaryCta", label: "CTA secundario", kind: "link", styleGroup: "interactive" },
    ]),
  },
  {
    pageKey: "cookies",
    title: "Cookies",
    publicPath: ROUTES.COOKIES,
    description: "Cabecalho e bloco de apoio da politica de cookies.",
    defaultDocument: {
      ...LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT,
      hero: {
        eyebrow: "Cookies",
        title: "Politica de Cookies",
        intro:
          "Esta Politica de Cookies descreve de forma transparente que tipos de cookies e tecnologias semelhantes podem ser utilizados na Mariana Explica, em que circunstâncias sao necessarios, quando dependem de consentimento e como podem ser geridos pelo utilizador, em conformidade com as regras aplicaveis em Portugal e na Uniao Europeia.",
        updatedAt: "23/04/2026",
      },
    },
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda", kind: "text", styleGroup: "text" },
      { key: "hero.title", label: "Titulo", kind: "text", styleGroup: "heading" },
      { key: "hero.intro", label: "Introducao", kind: "textarea", styleGroup: "text" },
      { key: "hero.updatedAt", label: "Data de atualizacao", kind: "text", styleGroup: "text" },
      { key: "support.eyebrow", label: "Legenda do apoio", kind: "text", styleGroup: "text" },
      { key: "support.title", label: "Titulo do apoio", kind: "text", styleGroup: "heading" },
      { key: "support.lead", label: "Texto do apoio", kind: "textarea", styleGroup: "text" },
      { key: "support.primaryCta", label: "CTA principal", kind: "link", styleGroup: "interactive" },
      { key: "support.secondaryCta", label: "CTA secundario", kind: "link", styleGroup: "interactive" },
    ]),
  },
  {
    pageKey: "terms",
    title: "Termos",
    publicPath: ROUTES.TERMS,
    description: "Cabecalho e bloco de apoio dos termos de uso.",
    defaultDocument: {
      ...LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT,
      hero: {
        eyebrow: "Termos",
        title: "Termos de Uso",
        intro:
          "Estes Termos de Uso definem as regras aplicaveis ao acesso ao site, criacao de conta, compra de conteudos digitais e utilizacao da plataforma Mariana Explica. O texto foi preparado para um servico operado em Portugal e deve ser lido em conjunto com a Politica de Privacidade, a Politica de Cookies e as informacoes comerciais apresentadas nas paginas de produto e checkout.",
        updatedAt: "23/04/2026",
      },
    },
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda", kind: "text", styleGroup: "text" },
      { key: "hero.title", label: "Titulo", kind: "text", styleGroup: "heading" },
      { key: "hero.intro", label: "Introducao", kind: "textarea", styleGroup: "text" },
      { key: "hero.updatedAt", label: "Data de atualizacao", kind: "text", styleGroup: "text" },
      { key: "support.eyebrow", label: "Legenda do apoio", kind: "text", styleGroup: "text" },
      { key: "support.title", label: "Titulo do apoio", kind: "text", styleGroup: "heading" },
      { key: "support.lead", label: "Texto do apoio", kind: "textarea", styleGroup: "text" },
      { key: "support.primaryCta", label: "CTA principal", kind: "link", styleGroup: "interactive" },
      { key: "support.secondaryCta", label: "CTA secundario", kind: "link", styleGroup: "interactive" },
    ]),
  },
  {
    pageKey: "checkout",
    title: "Checkout",
    publicPath: ROUTES.CHECKOUT,
    description: "Mensagem principal, badge e textos de apoio do checkout.",
    defaultDocument: CHECKOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda", kind: "text", styleGroup: "text" },
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.lead", label: "Texto de apoio", kind: "textarea", styleGroup: "text" },
      { key: "productCard.badge", label: "Badge do produto", kind: "text", styleGroup: "interactive" },
      { key: "productCard.accessLabel", label: "Etiqueta de acesso", kind: "text", styleGroup: "text" },
      { key: "productCard.secureLabel", label: "Etiqueta de seguranca", kind: "text", styleGroup: "text" },
      { key: "productCard.buttonHint", label: "Texto auxiliar do botao", kind: "text", styleGroup: "interactive" },
      { key: "authPanel.eyebrow", label: "Legenda do painel", kind: "text", styleGroup: "text" },
      { key: "authPanel.titleLogin", label: "Titulo login", kind: "text", styleGroup: "heading" },
      { key: "authPanel.titleRegister", label: "Titulo registo", kind: "text", styleGroup: "heading" },
      { key: "termsModal.title", label: "Titulo do modal", kind: "text", styleGroup: "heading" },
      { key: "termsModal.line1", label: "Linha do modal 1", kind: "textarea", styleGroup: "text" },
      { key: "termsModal.line2", label: "Linha do modal 2", kind: "textarea", styleGroup: "text" },
      { key: "termsModal.line3", label: "Linha do modal 3", kind: "textarea", styleGroup: "text" },
      { key: "termsModal.primaryCtaLabel", label: "Botao principal", kind: "text", styleGroup: "interactive" },
      { key: "termsModal.secondaryCtaLabel", label: "Botao secundario", kind: "text", styleGroup: "interactive" },
    ]),
  },
  {
    pageKey: "checkout-success",
    title: "Checkout concluido",
    publicPath: ROUTES.CHECKOUT_SUCCESS,
    description: "Hero, proximos passos e botoes de acesso apos o checkout.",
    defaultDocument: CHECKOUT_SUCCESS_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: buildFields([
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda", kind: "text", styleGroup: "text" },
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.lead", label: "Texto de apoio", kind: "textarea", styleGroup: "text" },
      { key: "nextStep.title", label: "Titulo do proximo passo", kind: "text", styleGroup: "heading" },
      { key: "nextStep.lead", label: "Texto do proximo passo", kind: "textarea", styleGroup: "text" },
      { key: "benefits.firstTitle", label: "Beneficio 1 - titulo", kind: "text", styleGroup: "text" },
      { key: "benefits.firstLead", label: "Beneficio 1 - texto", kind: "textarea", styleGroup: "text" },
      { key: "benefits.secondTitle", label: "Beneficio 2 - titulo", kind: "text", styleGroup: "text" },
      { key: "benefits.secondLead", label: "Beneficio 2 - texto", kind: "textarea", styleGroup: "text" },
      { key: "access.eyebrow", label: "Legenda do acesso", kind: "text", styleGroup: "text" },
      { key: "access.primaryCtaLabel", label: "Botao principal", kind: "text", styleGroup: "interactive" },
      { key: "access.secondaryCtaLabel", label: "Botao secundario", kind: "text", styleGroup: "interactive" },
      { key: "access.note", label: "Nota de apoio", kind: "textarea", styleGroup: "text" },
    ]),
  },
]
