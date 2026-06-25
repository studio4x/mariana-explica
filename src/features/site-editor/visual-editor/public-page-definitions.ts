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

export const HOME_VISUAL_EDITOR_DEFAULT_DOCUMENT: HomeVisualEditorDocument = {
  hero: {
    eyebrow: "Estudo claro e direto",
    title: "Tens dificuldades a Portugu�s ou Filosofia?",
    subtitle: "Nunca tiveste a disciplina e vais fazer exame?",
    lead: "Ent�o fica aqui que este local � para ti!",
    primaryCta: {
      label: "Explorar materiais",
      href: ROUTES.COURSES,
    },
  },
  objective: {
    eyebrow: "Objetivo principal",
    text:
      "Criei este espa�o para te dar o apoio que os manuais n�o d�o: leveza, clareza e uma estrat�gia real para brilhares nos exames de Filosofia e Portugu�s. Vamo-nos simplificar?",
  },
  featureBlocks: {
    block1: {
      eyebrow: "EM BREVE - AULAS GRAVADAS",
      text: "Domina temas complexos ao teu ritmo, com aulas organizadas e flex�veis, prontas quando tu estiveres.",
    },
    block2: {
      eyebrow: "EXPLICA��ES",
      text: "Acompanhamento personalizado e focado nas tuas d�vidas espec�ficas para garantires resultados.",
    },
    block3: {
      eyebrow: "MATERIAIS DIGITAIS",
      text: "Resumos visuais e esquemas claros para simplificar o teu estudo e garantires a nota m�xima sem complica��es.",
    },
    block4: {
      eyebrow: "MATERIAIS DIGITAIS - GRATUITOS",
      text: "Dicas flash e recursos r�pidos para descarregar e dares um boost imediato no teu estudo.",
    },
  },
  steps: {
    step1: {
      eyebrow: "ENCONTRA O TEU APOIO",
      text:
        "Explora as sebentas e materiais dispon�veis. Cada material foi criado para resolver uma dor espec�fica, por isso vais perceber logo qual � o ideal para o teu momento.",
    },
    step2: {
      eyebrow: "ACESSO R�PIDO E SEGURO",
      text:
        "O processo � direto e transparente. Sem taxas escondidas ou passos desnecess�rios. Pagas de forma segura e o material � teu no segundo seguinte.",
    },
    step3: {
      eyebrow: "FOCA-TE NO QUE IMPORTA",
      text:
        "Tudo fica organizado na tua �rea do aluno. Podes aceder aos PDFs e aulas sempre que quiseres, ao teu ritmo, e retomar o estudo exatamente onde paraste.",
    },
  },
  trust: {
    leftTitle: "Vantagens de trabalhares comigo",
    leftPoint1: {
      title: "Linguagem Direta:",
      text: "Falamos a mesma l�ngua. Esquece os termos imposs�veis dos manuais e entende a mat�ria � primeira.",
    },
    leftPoint2: {
      title: "Foco no Exame:",
      text: "Materiais desenhados apenas com o que realmente sai. Sem distra��es.",
    },
    leftPoint3: {
      title: "Resumos Visuais:",
      text: "Esquemas e cores pensados para quem precisa de organizar ideias rapidamente.",
    },
    rightTitle: "Leveza e Confian�a em cada passo",
    rightPoint1: "Suporte Real: N�o recebes s� um PDF. Tens uma \"amiga\" (eu!) nas DMs para te apoiar sempre que precisares.",
    rightPoint2: "Tudo Organizado: Esquece o caos do WhatsApp. Os teus materiais ficam sempre guardados na tua �rea do aluno.",
    rightPoint3: "P�s na Terra: Filosofia e Portugu�s deixam de ser abstratos e passam a ser ferramentas que dominas com seguran�a.",
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
    lead: "Avalia��es reais publicadas no m�dulo de Reviews.",
  },
}

export const ABOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT: AboutVisualEditorDocument = {
  hero: {
    title: "Muito mais do que uma explicadora:\nQuem � a Mariana?",
    subtitle: "Conhece a pessoa por tr�s da marca Mariana Explica.",
  },
  portrait: {
    src: ABOUT_IMAGE_PLACEHOLDER,
    alt: "Retrato ilustrado da Mariana",
  },
  intro: {
    title: "Ol�! Eu sou a Mariana, fundadora do Mariana Explica e, atualmente, estudante de Filosofia na FLUP.",
    text1:
      "Se chegaste at� aqui, � muito prov�vel que estejas a sentir o peso dos manuais gigantes de Portugu�s, o n� cego da L�gica em Filosofia ou o p�nico silencioso da aproxima��o dos Exames Nacionais.",
    text2:
      "Deixa-me dizer-te uma coisa: eu percebo-te perfeitamente, porque eu ainda estou a�.",
  },
  project: {
    title: "De estudante para estudante: porqu� este projeto?",
    card1:
      "Durante o meu percurso, percebi que a maior barreira entre um aluno e uma nota excelente n�o � a falta de intelig�ncia, mas sim a forma como a mat�ria � ensinada. Estive cansada de manuais densos, linguagem excessivamente formal e calhama�os cheios de 'palha' que s� servem para causar ansiedade.",
    card2:
      "Este projeto nasceu exatamente para ser a ponte. Eu transformo a mat�ria mais complexa em esquemas visuais, resumos diretos e explica��es descontra�das. Eu explico-te a mat�ria da forma que eu pr�pria gostava que me tivessem explicado quando estava no teu lugar. � isso que faz toda a diferen�a.",
  },
  pillars: {
    title: "Os 3 Pilares do Meu M�todo",
    pillar1Label: "Rigor Acad�mico",
    pillar1Text:
      "Estar ainda a estudar d�-me as ferramentas di�rias para dominar a fundo a Filosofia e a Escrita. O meu m�todo une a leveza que tu precisas ao rigor t�cnico que os corretores de exame exigem.",
    pillar2Label: "Foco Visual e Estrat�gia",
    pillar2Text:
      "O nosso c�rebro funciona melhor com cores, conex�es e l�gica direta. Quer compres as minhas sebentas ou venhas para as explica��es, vais aprender a estruturar respostas perfeitas sem perder tempo.",
    pillar3Label: "Apoio e Empatia Total",
    pillar3Text:
      "Aqui n�o h� perguntas est�pidas. Isto � um safe space! Quero que entres na sala de exame e de aula a saber exatamente o que vais fazer.",
  },
}

export const EXPLICACOES_VISUAL_EDITOR_DEFAULT_DOCUMENT: ExplicacoesVisualEditorDocument = {
  hero: {
    eyebrow: "Explica��es",
    title: "Vamos descomplicar o teu ano letivo juntos?",
    lead:
      "N�o tens Instagram ou preferes o contacto formal por e-mail? Sem problema, est�s no s�tio certo! Este espa�o foi pensado tanto para estudantes como para encarregados de educa��o que queiram esclarecer d�vidas sobre os meus materiais ou solicitar apoio individual.",
  },
  notes: {
    title: "Notas importantes antes de enviares o teu formul�rio:",
    paragraph1:
      "Planeamento Pr�vio: Devido � agenda preenchida, todos os pedidos para explica��es devem ser efetuados com um m�nimo de 3 semanas de anteced�ncia.",
    paragraph2:
      "N�o Garante Reserva: O envio e submiss�o deste formul�rio funciona estritamente como um pedido de informa��es e consulta de disponibilidade. N�o constitui, de forma alguma, uma marca��o autom�tica ou garantia de vaga.",
  },
  formNote: {
    title: "Se o teu pedido for para Explica��es, indica obrigatoriamente nesta caixa:",
    line1: "O Ano Escolar do Aluno (ex: 10.�, 11.� ou 12.� ano)",
    line2: "A Disciplina pretendida (Filosofia ou Portugu�s)",
  },
  submitCta: {
    label: "Enviar formul�rio",
  },
}

export const LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT: LegalVisualEditorDocument = {
  hero: {
    eyebrow: "Privacidade",
    title: "Pol�tica de Privacidade",
    intro:
      "Esta p�gina explica como a Mariana Explica recolhe, utiliza, protege e conserva dados pessoais no contexto do site p�blico, da �rea autenticada, do checkout, do suporte e da entrega de conte�dos digitais. O texto foi estruturado para refletir os princ�pios do RGPD e a legisla��o aplic�vel em Portugal e na Uni�o Europeia.",
    updatedAt: "23/04/2026",
  },
  support: {
    eyebrow: "Apoio",
    title: "Precisa de esclarecimentos?",
    lead:
      "Se precisar de ajuda adicional sobre privacidade, cookies, condi��es de utiliza��o ou exerc�cio de direitos, utilize os canais de apoio dispon�veis na plataforma.",
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
    eyebrow: "Confirma��o de pedido",
    title: "Quase l�! Vamos finalizar a tua inscri��o.",
    lead: "Preenche os dados de checkout e segue para o pagamento com seguran�a.",
  },
  productCard: {
    badge: "CURSO COMPLETO",
    accessLabel: "Acesso na conta",
    secureLabel: "Ambiente seguro",
    buttonHint: "Segue para o pagamento",
  },
  authPanel: {
    eyebrow: "Acesso e pagamento",
    titleLogin: "J� tenho conta",
    titleRegister: "Quero me cadastrar",
  },
  termsModal: {
    title: "Antes de avan�ar",
    line1:
      "Ao continuar, confirmas que leste e aceitas os termos de uso, a pol�tica de privacidade e as condi��es comerciais apresentadas para este material.",
    line2: "O pagamento � processado pela Stripe e validado no backend.",
    line3:
      "O acesso ao conte�do depende da confirma��o do pagamento e os teus dados s�o tratados para operacionalizar a compra e o acesso.",
    primaryCtaLabel: "Ler termos completos",
    secondaryCtaLabel: "Fechar",
  },
}

export const CHECKOUT_SUCCESS_VISUAL_EDITOR_DEFAULT_DOCUMENT: CheckoutSuccessVisualEditorDocument = {
  hero: {
    eyebrow: "Checkout conclu�do",
    title: "A tua inscri��o foi recebida com sucesso.",
    lead:
      "O acesso ao material ser� apresentado na �rea do aluno assim que a confirma��o de pagamento estiver refletida na plataforma.",
  },
  nextStep: {
    title: "Pr�ximo passo",
    lead:
      "Entra diretamente no material para verificar o acesso e continuar a tua jornada de estudo.",
  },
  benefits: {
    firstTitle: "Material organizado",
    firstLead: "Aulas e materiais ficam reunidos na �rea do aluno.",
    secondTitle: "Acesso protegido",
    secondLead: "A liberta��o � validada pelo backend e pelo Stripe.",
  },
  access: {
    eyebrow: "Acesso r�pido",
    primaryCtaLabel: "Ir para o material",
    secondaryCtaLabel: "Abrir �rea do aluno",
    note:
      "Se o material ainda n�o aparecer, aguarda alguns segundos e atualiza a �rea do aluno. A confirma��o depende do retorno do Stripe.",
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
