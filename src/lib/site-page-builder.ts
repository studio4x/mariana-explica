import type { SitePageSlug } from "@/types/app.types"
import homeHeroIllustration from "@/assets/home-hero-illustration.svg"

export type PageBlockType = "heading" | "rich_text" | "image" | "button" | "divider" | "spacer" | "columns" | "container"

export interface BlockLayoutStyle {
  gridColumns: number
  align: "left" | "center" | "right"
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  backgroundColor: string
  backgroundImageUrl: string
  backgroundImageSize: "cover" | "contain" | "auto" | "stretch"
  borderRadius: number
  contentAlignX: "left" | "center" | "right" | "stretch"
  contentAlignY: "top" | "center" | "bottom"
  contentGap: number
  minHeight: number
}

interface BasePageBlock {
  id: string
  type: PageBlockType
  layout: BlockLayoutStyle
  customClassName?: string
}

export interface HeadingBlock extends BasePageBlock {
  type: "heading"
  content: string
  level: 1 | 2 | 3 | 4
  align: "left" | "center" | "right"
  color: string
}

export interface RichTextBlock extends BasePageBlock {
  type: "rich_text"
  content: string
}

export interface ImageBlock extends BasePageBlock {
  type: "image"
  src: string
  alt: string
  radius: number
}

export interface ButtonBlock extends BasePageBlock {
  type: "button"
  label: string
  href: string
  align: "left" | "center" | "right"
  textAlign: "left" | "center" | "right"
  borderWidth: number
  borderColor: string
  borderRadius: number
  backgroundColor: string
  textColor: string
  paddingY: number
  paddingX: number
  fontSize: number
  widthPercent: number
  fullWidth: boolean
  openInNewTab: boolean
}

export interface DividerBlock extends BasePageBlock {
  type: "divider"
  color: string
}

export interface SpacerBlock extends BasePageBlock {
  type: "spacer"
  height: number
}

export interface ColumnsBlock extends BasePageBlock {
  type: "columns"
  columns: 2 | 3 | 4
  gap: number
  rowGap: number
  alignItems: "start" | "center" | "end" | "stretch"
  justifyItems: "start" | "center" | "end" | "stretch"
  itemContentAlignX: "left" | "center" | "right" | "stretch"
  itemContentAlignY: "top" | "center" | "bottom"
  itemPaddingY: number
  itemPaddingX: number
  items: string[]
}

export interface ContainerBlock extends BasePageBlock {
  type: "container"
  columns: 1 | 2 | 3 | 4
  gap: number
  rowGap: number
  alignItems: "start" | "center" | "end" | "stretch"
  justifyItems: "start" | "center" | "end" | "stretch"
  columnContentAlignX: "left" | "center" | "right" | "stretch"
  columnContentAlignY: "top" | "center" | "bottom"
  columnContentGap: number
  children: PageBlock[][]
  columnLayouts: BlockLayoutStyle[]
  backgroundColor: string
  borderColor: string
  borderWidth: number
  borderRadius: number
  paddingY: number
  paddingX: number
}

export type PageBlock =
  | HeadingBlock
  | RichTextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | ContainerBlock

export interface SitePageBuilderDocument {
  blocks: PageBlock[]
}

const HOME_CANONICAL_MARKER = "data-me-home-canonical"
const PAGE_CANONICAL_MARKER = "data-me-page-canonical"

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function normalizeCustomClassName(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return normalized
}

function buildClassAttribute(...values: Array<string | null | undefined>) {
  const className = values
    .flatMap((value) => String(value ?? "").split(/\s+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ")

  return className ? ` class="${escapeHtml(className)}"` : ""
}

function sanitizeRichText(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])javascript:.*?\2/gi, ` $1="#"`)
}

export function getBlockLayoutDefaults(): BlockLayoutStyle {
  return {
    gridColumns: 12,
    align: "center",
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    marginTop: 0,
    marginBottom: 4,
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: "transparent",
    backgroundImageUrl: "",
    backgroundImageSize: "cover",
    borderRadius: 0,
    contentAlignX: "stretch",
    contentAlignY: "top",
    contentGap: 0,
    minHeight: 0,
  }
}

export function normalizeLayoutStyle(raw: unknown): BlockLayoutStyle {
  const defaults = getBlockLayoutDefaults()
  if (!raw || typeof raw !== "object") return defaults
  const record = raw as Record<string, unknown>

  return {
    gridColumns: clamp(Number(record.gridColumns ?? defaults.gridColumns), 1, 12),
    align: (["left", "center", "right"].includes(String(record.align)) ? String(record.align) : defaults.align) as
      | "left"
      | "center"
      | "right",
    paddingTop: clamp(Number(record.paddingTop ?? defaults.paddingTop), 0, 240),
    paddingRight: clamp(Number(record.paddingRight ?? defaults.paddingRight), 0, 240),
    paddingBottom: clamp(Number(record.paddingBottom ?? defaults.paddingBottom), 0, 240),
    paddingLeft: clamp(Number(record.paddingLeft ?? defaults.paddingLeft), 0, 240),
    marginTop: clamp(Number(record.marginTop ?? defaults.marginTop), 0, 240),
    marginBottom: clamp(Number(record.marginBottom ?? defaults.marginBottom), 0, 240),
    marginLeft: clamp(Number(record.marginLeft ?? defaults.marginLeft), 0, 240),
    marginRight: clamp(Number(record.marginRight ?? defaults.marginRight), 0, 240),
    backgroundColor: String(record.backgroundColor ?? defaults.backgroundColor),
    backgroundImageUrl: String(record.backgroundImageUrl ?? defaults.backgroundImageUrl),
    backgroundImageSize: (
      ["cover", "contain", "auto", "stretch"].includes(String(record.backgroundImageSize))
        ? String(record.backgroundImageSize)
        : defaults.backgroundImageSize
    ) as "cover" | "contain" | "auto" | "stretch",
    borderRadius: clamp(Number(record.borderRadius ?? defaults.borderRadius), 0, 120),
    contentAlignX: (
      ["left", "center", "right", "stretch"].includes(String(record.contentAlignX))
        ? String(record.contentAlignX)
        : defaults.contentAlignX
    ) as "left" | "center" | "right" | "stretch",
    contentAlignY: (
      ["top", "center", "bottom"].includes(String(record.contentAlignY))
        ? String(record.contentAlignY)
        : defaults.contentAlignY
    ) as "top" | "center" | "bottom",
    contentGap: clamp(Number(record.contentGap ?? defaults.contentGap), 0, 120),
    minHeight: clamp(Number(record.minHeight ?? defaults.minHeight), 0, 1200),
  }
}

function getContainerColumnLayoutDefaults(
  partial?: Partial<Pick<BlockLayoutStyle, "contentAlignX" | "contentAlignY">>,
): BlockLayoutStyle {
  return {
    ...getBlockLayoutDefaults(),
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: "transparent",
    backgroundImageUrl: "",
    backgroundImageSize: "cover",
    borderRadius: 0,
    contentAlignX: partial?.contentAlignX ?? "stretch",
    contentAlignY: partial?.contentAlignY ?? "top",
    contentGap: 0,
    minHeight: 0,
  }
}

export function createDefaultBlock(type: PageBlockType): PageBlock {
  const layout = getBlockLayoutDefaults()
  const createDefaultContainerColumnBlock = (columnIndex: number): RichTextBlock => ({
    ...(createDefaultBlock("rich_text") as RichTextBlock),
    id: uid(`container-col-${columnIndex + 1}`),
    content: `<p><strong>Coluna ${columnIndex + 1}</strong><br/>Conteúdo do container.</p>`,
  })
  switch (type) {
    case "heading":
      return {
        id: uid("heading"),
        type: "heading",
        content: "Novo título",
        level: 2,
        align: "left",
        color: "#0f122c",
        layout,
      }
    case "rich_text":
      return {
        id: uid("text"),
        type: "rich_text",
        content: "<p>Escreve aqui o conteúdo da página.</p>",
        layout,
      }
    case "image":
      return {
        id: uid("image"),
        type: "image",
        src: "",
        alt: "Imagem",
        radius: 18,
        layout,
      }
    case "button":
      return {
        id: uid("button"),
        type: "button",
        label: "Call to action",
        href: "/materiais",
        align: "left",
        textAlign: "center",
        borderWidth: 0,
        borderColor: "#242742",
        borderRadius: 999,
        backgroundColor: "#242742",
        textColor: "#ffffff",
        paddingY: 14,
        paddingX: 24,
        fontSize: 12,
        widthPercent: 0,
        fullWidth: false,
        openInNewTab: false,
        layout,
      }
    case "divider":
      return {
        id: uid("divider"),
        type: "divider",
        color: "rgba(36,39,66,0.18)",
        layout,
      }
    case "spacer":
      return {
        id: uid("spacer"),
        type: "spacer",
        height: 48,
        layout,
      }
    case "columns":
      return {
        id: uid("columns"),
        type: "columns",
        columns: 2,
        gap: 18,
        rowGap: 18,
        alignItems: "stretch",
        justifyItems: "stretch",
        itemContentAlignX: "left",
        itemContentAlignY: "top",
        itemPaddingY: 16,
        itemPaddingX: 16,
        items: [
          "<p><strong>Coluna 1</strong><br/>Conteúdo editável da primeira coluna.</p>",
          "<p><strong>Coluna 2</strong><br/>Conteúdo editável da segunda coluna.</p>",
        ],
        layout,
      }
    case "container":
      return {
        id: uid("container"),
        type: "container",
        columns: 2,
        gap: 16,
        rowGap: 16,
        alignItems: "stretch",
        justifyItems: "stretch",
        columnContentAlignX: "left",
        columnContentAlignY: "top",
        columnContentGap: 8,
        children: [[createDefaultContainerColumnBlock(0)], [createDefaultContainerColumnBlock(1)]],
        columnLayouts: [
          getContainerColumnLayoutDefaults({ contentAlignX: "left", contentAlignY: "top" }),
          getContainerColumnLayoutDefaults({ contentAlignX: "left", contentAlignY: "top" }),
        ],
        backgroundColor: "#f8fafc",
        borderColor: "rgba(36,39,66,0.14)",
        borderWidth: 1,
        borderRadius: 18,
        paddingY: 20,
        paddingX: 20,
        layout,
      }
    default:
      return {
        id: uid("text"),
        type: "rich_text",
        content: "<p>Conteúdo.</p>",
        layout,
      }
  }
}

export function getDefaultDocumentForSlug(slug: SitePageSlug): SitePageBuilderDocument {
  if (slug === "home") {
    return createCanonicalHomeDocument()
  }

  if (slug === "sobre") {
    return createCanonicalAboutDocument()
  }

  if (slug === "privacidade") {
    return createCanonicalLegalDocument({
      slug,
      eyebrow: "Privacidade",
      title: "Política de Privacidade",
      intro:
        "Esta página explica como a Mariana Explica recolhe, utiliza, protege e conserva dados pessoais no contexto do site público, da Área autenticada, do checkout, do suporte e da entrega de conteúdos digitais. O texto foi estruturado para refletir os princípios do RGPD e a legislação aplicável em Portugal e na União Europeia.",
      updatedAt: "23/04/2026",
      sections: [
        {
          title: "1. Quem trata os seus dados",
          body: [
            "A presente Política de Privacidade aplica-se ao site e à plataforma Mariana Explica. A entidade responsável pelo tratamento é a operadora da plataforma Mariana Explica, enquanto responsável pela gestão comercial, autenticação, prestação de conteúdos digitais, apoio ao cliente e cumprimento de obrigações legais associadas ao serviço.",
            "Sempre que esta política mencionar \"Mariana Explica\", \"nós\" ou \"plataforma\", refere-se ao responsável pelo tratamento dos dados pessoais recolhidos através do site, da Área autenticada, do checkout e dos respetivos canais de apoio.",
          ],
        },
        {
          title: "2. Que dados pessoais podemos recolher",
          body: [
            "Podemos recolher dados de identificação e contacto, como nome, endereço de email, dados da conta de utilizador e informações fornecidas em formulários, tickets de suporte, pedidos de contacto ou inscrições em materiais digitais.",
            "Também podemos tratar dados de utilização da plataforma, incluindo acessos, progresso de aprendizagem, histórico de compras, histórico de pedidos, registos técnicos de segurança, notificações, interações com páginas públicas e preferências associadas ao serviço.",
            "Quando existe pagamento, os dados de faturação e de pagamento são tratados principalmente pelo prestador de pagamentos contratado. A plataforma conserva os dados estritamente necessários para reconciliação comercial, suporte, auditoria e cumprimento legal.",
          ],
        },
        {
          title: "3. Finalidades e bases legais do tratamento",
          body: [
            "Tratamos dados pessoais para criar e gerir contas, autenticar utilizadores, disponibilizar materiais, processar compras, conceder acessos, responder a pedidos de suporte, prevenir fraude, assegurar a segurança da plataforma e cumprir deveres legais e fiscais.",
            "As bases jurídicas utilizadas podem incluir a execução de diligências pré-contratuais e do contrato, o cumprimento de obrigações legais, o interesse legítimo na segurança, operação e melhoria do serviço, e o consentimento quando este for exigido, nomeadamente para determinadas categorias de cookies ou comunicações não essenciais.",
          ],
        },
        {
          title: "4. Com quem podemos partilhar dados",
          body: [
            "Os dados podem ser partilhados com subcontratantes e prestadores de serviços estritamente necessários ao funcionamento da plataforma, tais como alojamento, base de dados, autenticação, envio de email, análise operacional, suporte técnico e processamento de pagamentos.",
            "Sempre que recorremos a terceiros, procuramos garantir que estes atuam ao abrigo de instruções adequadas, com medidas de segurança apropriadas e apenas para as finalidades compatíveis com a prestação do serviço.",
          ],
        },
        {
          title: "5. Transferências internacionais de dados",
          body: [
            "Sempre que algum prestador de serviços esteja localizado fora do Espaço Económico Europeu ou realize tratamento internacional de dados, procuramos assegurar uma base jurídica adequada para a transferência, incluindo decisões de adequação, cláusulas contratuais-tipo ou outras garantias reconhecidas pela legislação aplicável.",
          ],
        },
        {
          title: "6. Durante quanto tempo conservamos os dados",
          body: [
            "Conservamos os dados pessoais apenas pelo período necessário para as finalidades que justificaram a recolha, sem prejuízo de prazos de conservação legal, fiscal, contabilística, defesa de direitos ou gestão de incidentes de segurança.",
            "Dados ligados a contas, pedidos, acessos concedidos, suporte e auditoria podem ser mantidos enquanto a relação com o utilizador subsistir e pelo período adicional exigido por lei ou necessário para demonstração de transações, resposta a reclamações ou proteção da plataforma.",
          ],
        },
        {
          title: "7. Os seus direitos ao abrigo do RGPD",
          body: [
            "Nos termos do Regulamento (UE) 2016/679, o titular dos dados pode solicitar acesso, retificação, apagamento, limitação do tratamento, portabilidade dos dados e oposição, nos casos previstos na lei. Quando o tratamento assentar em consentimento, este pode ser retirado a qualquer momento, sem comprometer a licitude do tratamento anterior.",
            "Os pedidos podem ser apresentados pelos canais de apoio disponibilizados na plataforma. O titular dos dados tem igualmente o direito de apresentar reclamação junto da autoridade de controlo competente, designadamente a CNPD em Portugal.",
          ],
        },
        {
          title: "8. Segurança e proteção dos dados",
          body: [
            "Adotamos medidas técnicas e organizativas adequadas para proteger os dados pessoais contra destruição, perda, alteração, divulgação ou acesso não autorizado, incluindo controlos de autenticação, segregação de acessos, proteção de Áreas privadas, registos operacionais e mecanismos de segurança na infraestrutura utilizada.",
            "Apesar de nenhum sistema oferecer segurança absoluta, procuramos rever continuamente as medidas de proteção aplicadas ao serviço e limitar o acesso aos dados de acordo com a necessidade operacional.",
          ],
        },
        {
          title: "9. Menores e utilização da plataforma",
          body: [
            "A utilização da plataforma deve respeitar a legislação aplicável e as condições do serviço. Quando o utilizador seja menor e a lei exija intervenção ou autorização do representante legal para determinados atos, essa responsabilidade deve ser assegurada pelo próprio utilizador e respetivo representante.",
          ],
        },
        {
          title: "10. Contactos e atualizações desta política",
          body: [
            "Esta política pode ser atualizada para refletir alterações legais, operacionais ou técnicas. A versão em vigor será sempre a que estiver publicada nesta página com a data da Última atualização.",
            "Para questões relacionadas com privacidade e exercício de direitos, utilize o canal de suporte da plataforma. Sempre que legalmente exigido, poderemos disponibilizar contacto específico adicional do responsável pelo tratamento.",
          ],
        },
      ],
    })
  }
  if (slug === "cookies") {
    return createCanonicalLegalDocument({
      slug,
      eyebrow: "Cookies",
      title: "Política de Cookies",
      intro:
        "Esta Política de Cookies descreve de forma transparente que tipos de cookies e tecnologias semelhantes podem ser utilizados na Mariana Explica, em que circunstâncias são necessários, quando dependem de consentimento e como podem ser geridos pelo utilizador, em conformidade com as regras aplicáveis em Portugal e na União Europeia.",
      updatedAt: "23/04/2026",
      sections: [
        {
          title: "1. O que são cookies",
          body: [
            "Cookies são pequenos ficheiros de texto armazenados no dispositivo do utilizador quando visita um site. Servem para memorizar preferências, suportar funcionalidades técnicas, reforçar segurança, medir desempenho e, quando aplicável, personalizar comunicações e publicidade.",
          ],
        },
        {
          title: "2. Como usamos cookies nesta plataforma",
          body: [
            "A Mariana Explica pode utilizar cookies estritamente necessários para autenticar sessões, manter a segurança da navegação, equilibrar serviços técnicos, recordar definições essenciais e garantir o funcionamento correto de Áreas privadas, checkout e formulários.",
            "Também podemos utilizar cookies de preferência, analítica ou medição, bem como tecnologias semelhantes para compreender o uso do site, melhorar a experiência, medir campanhas e suportar integrações de marketing, mas apenas quando exista fundamento jurídico adequado e, quando exigido, consentimento prévio do utilizador.",
          ],
        },
        {
          title: "3. Categorias de cookies",
          body: [
            "Cookies estritamente necessários: indispensáveis para o funcionamento técnico do site, autenticação, segurança, navegação e prestação de serviços pedidos pelo utilizador. Estes cookies não dependem de consentimento quando forem realmente essenciais.",
            "Cookies de preferência: permitem recordar escolhas como idioma, interface ou outras preferências operacionais. Podem depender de configuração do utilizador e, em certos casos, de consentimento.",
            "Cookies analíticos ou estatísticos: ajudam a medir visitas, desempenho e utilização das páginas para melhorar a plataforma. Quando não forem anonimizados de forma suficiente ou quando a lei o exigir, são ativados apenas com consentimento.",
            "Cookies de marketing ou publicidade: utilizados para medir conversões, campanhas e personalização promocional. São sempre tratados com especial cuidado e dependem de consentimento prévio quando aplicável.",
          ],
        },
        {
          title: "4. Base legal e gestão do consentimento",
          body: [
            "Nos termos das regras europeias aplicáveis a comunicações eletrónicas e da legislação de proteção de dados, o armazenamento ou acesso a informação no dispositivo do utilizador só pode ocorrer com consentimento prévio, exceto quando a tecnologia for estritamente necessária para prestar um serviço expressamente solicitado ou para assegurar a comunicação eletrónica.",
            "Sempre que adotarmos cookies não essenciais, o utilizador deve poder aceitar, recusar ou rever essas escolhas através do mecanismo de preferências disponibilizado pela plataforma. A retirada do consentimento deve ser tão simples quanto a sua concessão.",
          ],
        },
        {
          title: "5. Cookies de terceiros",
          body: [
            "Algumas funcionalidades podem recorrer a serviços de terceiros, por exemplo para pagamentos, análise de utilização, campanhas ou suporte técnico. Nesses casos, esses terceiros podem definir os seus próprios cookies ou tecnologias equivalentes, de acordo com as respetivas políticas.",
            "Sempre que esses terceiros atuem no contexto do nosso serviço, procuramos usar configurações compatíveis com os requisitos legais aplicáveis e com o nível de controlo esperado pelo utilizador.",
          ],
        },
        {
          title: "6. Como desativar ou remover cookies",
          body: [
            "O utilizador pode gerir cookies através do banner ou centro de preferências disponibilizado no site, sempre que exista, e também através das definições do próprio navegador. A desativação de cookies estritamente necessários pode comprometer funcionalidades essenciais do serviço, incluindo login, checkout ou acesso a conteúdos protegidos.",
          ],
        },
        {
          title: "7. Conservação e revisão desta política",
          body: [
            "Os prazos de conservação dos cookies variam conforme a sua finalidade, podendo existir cookies de sessão e cookies persistentes. Esta política pode ser revista sempre que houver alterações técnicas, jurídicas ou funcionais relevantes.",
            "A versão publicada nesta página é a que se considera em vigor na data indicada como Última atualização.",
          ],
        },
      ],
    })
  }
  if (slug === "termos") {
    return createCanonicalLegalDocument({
      slug,
      eyebrow: "Termos",
      title: "Termos de Uso",
      intro:
        "Estes Termos de Uso definem as regras aplicáveis ao acesso ao site, criação de conta, compra de conteúdos digitais e utilização da plataforma Mariana Explica. O texto foi preparado para um serviço operado em Portugal e deve ser lido em conjunto com a Política de Privacidade, a Política de Cookies e as informações comerciais apresentadas nas páginas de produto e checkout.",
      updatedAt: "23/04/2026",
      sections: [
        {
          title: "1. Objeto e âmbito",
          body: [
            "Os presentes Termos de Uso regulam o acesso e a utilização do site, da Área autenticada e dos conteúdos digitais disponibilizados pela Mariana Explica. Ao navegar, criar conta, adquirir um material ou utilizar qualquer funcionalidade da plataforma, o utilizador aceita estes termos na medida aplicável.",
            "Se alguma funcionalidade específica tiver condições próprias, essas condições complementam estes termos no respetivo âmbito.",
          ],
        },
        {
          title: "2. Conta de utilizador",
          body: [
            "Para aceder a determinadas funcionalidades, o utilizador pode necessitar de criar conta e manter os seus dados atualizados. O utilizador é responsável pela confidencialidade das credenciais de acesso e por todas as atividades realizadas através da sua conta, salvo prova de utilização indevida não imputável ao próprio.",
            "A plataforma pode suspender, limitar ou encerrar contas quando existam indícios de utilização abusiva, fraude, violação destes termos, incumprimento legal ou risco para a segurança do serviço.",
          ],
        },
        {
          title: "3. Produtos digitais e acesso aos conteúdos",
          body: [
            "A Mariana Explica disponibiliza materiais, materiais de apoio e outros conteúdos digitais de natureza educativa. As condições comerciais, como preço, modalidade, acesso gratuito ou pago e eventuais limitações de utilização, são apresentadas na página do produto e no checkout.",
            "O acesso efetivo ao conteúdo depende da confirmação interna do direito de acesso na plataforma. A compra ou ativação comercial pode exigir validação adicional de pagamento, concessão de acesso, verificações antifraude ou aplicação das regras operacionais do serviço.",
          ],
        },
        {
          title: "4. Preços, pagamentos e faturação",
          body: [
            "Os preços apresentados devem ser entendidos nos termos indicados no checkout e podem ser atualizados sem efeito retroativo sobre compras já concluídas. Os pagamentos podem ser processados por prestadores externos especializados, nos termos das respetivas condições e políticas.",
            "A plataforma pode manter registos internos de pedidos, pagamentos, estado comercial, reconciliação e faturação para cumprimento contratual, suporte ao utilizador, auditoria e obrigações legais.",
          ],
        },
        {
          title: "5. Direito de livre resolução e conteúdos digitais",
          body: [
            "Quando o utilizador atue na qualidade de consumidor e a lei lhe reconheça direito de livre resolução, esse direito será aplicado nos termos legalmente exigidos. Contudo, nos contratos de fornecimento de conteúdos digitais não prestados em suporte material, o direito de livre resolução pode deixar de existir depois de iniciada a execução com consentimento prévio e expresso do consumidor e reconhecimento de que perde esse direito, nos termos da legislação de defesa do consumidor aplicável.",
            "Quando existam pedidos de reembolso, cancelamento ou contestação, estes poderão estar sujeitos a verificação do estado do pedido, do acesso concedido, do consumo do conteúdo e das regras legais e comerciais aplicáveis.",
          ],
        },
        {
          title: "6. Regras de utilização da plataforma",
          body: [
            "O utilizador compromete-se a utilizar a plataforma de forma lícita, diligente e compatível com a sua finalidade educativa. É proibido contornar mecanismos de autenticação, partilhar acessos de forma indevida, copiar ou redistribuir conteúdos sem autorização, explorar vulnerabilidades, automatizar usos abusivos ou interferir com o funcionamento normal do serviço.",
            "Também não é permitido utilizar a plataforma para introduzir conteúdos ilícitos, ofensivos, fraudulentos ou que violem direitos de terceiros.",
          ],
        },
        {
          title: "7. Propriedade intelectual",
          body: [
            "Os conteúdos, marcas, textos, imagens, organização pedagógica, materiais descarregáveis, interface e demais elementos da Mariana Explica estão protegidos por direitos de propriedade intelectual e não podem ser reproduzidos, comunicados, distribuídos, alterados ou explorados fora das permissões expressamente concedidas.",
            "A aquisição de um material concede apenas um direito de utilização pessoal, limitado e não exclusivo, de acordo com as condições do serviço.",
          ],
        },
        {
          title: "8. Suporte, reclamações e resolução de litígios",
          body: [
            "A plataforma disponibiliza canais de suporte para pedidos de ajuda, questões operacionais, problemas de acesso e tratamento de reclamações. Sempre que aplicável, o utilizador consumidor pode também recorrer aos mecanismos legais de reclamação e a entidades de resolução alternativa de litígios de consumo nos termos da legislação portuguesa.",
          ],
        },
        {
          title: "9. Responsabilidade e disponibilidade do serviço",
          body: [
            "A Mariana Explica procura assegurar disponibilidade, segurança e fiabilidade do serviço, mas não garante funcionamento ininterrupto nem ausência absoluta de erros, falhas de rede, manutenções ou indisponibilidades decorrentes de terceiros.",
            "Na medida permitida por lei, a responsabilidade da plataforma fica limitada aos danos que devam ser legalmente imputados e que resultem de incumprimento demonstrado, sem prejuízo dos direitos imperativos do consumidor.",
          ],
        },
        {
          title: "10. Lei aplicável e alterações",
          body: [
            "Estes termos regem-se pela legislação portuguesa e pelo direito da União Europeia aplicável, sem prejuízo das normas imperativas de proteção do consumidor que devam prevalecer.",
            "A Mariana Explica pode atualizar os presentes termos para refletir alterações legais, operacionais ou funcionais. A versão em vigor será sempre a publicada nesta página com a respetiva data de atualização.",
          ],
        },
      ],
    })
  }
  return {
    blocks: [
      {
        ...(createDefaultBlock("heading") as HeadingBlock),
        content: "Título da página",
        level: 1,
      },
      {
        ...(createDefaultBlock("rich_text") as RichTextBlock),
        content: "<p>Começa aqui a editar o conteúdo desta página.</p>",
      },
    ],
  }
}

function createHomeRichSection(content: string) {
  const block = createDefaultBlock("rich_text")
  if (block.type !== "rich_text") {
    return createDefaultBlock("rich_text") as RichTextBlock
  }
  block.content = content
  block.layout = {
    ...block.layout,
    gridColumns: 12,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: "transparent",
    backgroundImageUrl: "",
    backgroundImageSize: "cover",
    borderRadius: 0,
  }
  return block
}

type CanonicalLegalSection = {
  title: string
  body: string[]
}

function createCanonicalSection(content: string) {
  return createHomeRichSection(content)
}

function createCanonicalAboutDocument(): SitePageBuilderDocument {
  const hero = createCanonicalSection(`
    <section ${PAGE_CANONICAL_MARKER}="sobre" class="me-about-page">
      <div class="me-about-shell">
        <div class="me-about-hero">
          <h1>Muito mais do que uma explicadora:<br />Quem é a Mariana?</h1>
        </div>
        <div class="me-about-grid">
          <div class="me-about-photo">
            <p>(foto)</p>
          </div>
          <div class="me-about-copy">
            <p class="me-about-lead">Olá! Eu sou a Mariana, fundadora do Mariana Explica e, atualmente, estudante de Filosofia na FLUP.</p>
            <p>Se chegaste até aqui, é muito provável que estejas a sentir o peso dos manuais gigantes de Português, o nó cego da Lógica em Filosofia ou o pânico silencioso da aproximação dos Exames Nacionais.<br />Deixa-me dizer-te uma coisa: <span>eu percebo-te perfeitamente, porque eu ainda estou aí.</span></p>
          </div>
        </div>
      </div>
    </section>
  `)

  const story = createCanonicalSection(`
    <section ${PAGE_CANONICAL_MARKER}="sobre" class="me-about-page me-about-page-soft">
      <div class="me-about-shell">
        <div class="me-about-section-head">
          <h2>De estudante para estudante: porquê este projeto?</h2>
        </div>
        <div class="me-about-card-grid">
          <article class="me-about-card">
            <p>Durante o meu percurso, percebi que a maior barreira entre um aluno e uma nota excelente não é a falta de inteligência, mas sim a forma como a matéria é ensinada. Estive cansada de manuais densos, linguagem excessivamente formal e calhamaços cheios de 'palha' que só servem para causar ansiedade.</p>
          </article>
          <article class="me-about-card">
            <p>Este projeto nasceu exatamente para ser a ponte. Eu transformo a matéria mais complexa em esquemas visuais, resumos diretos e explicações descontraídas. Eu explico-te a matéria da forma que eu própria gostava que me tivessem explicado quando estava no teu lugar. É isso que faz toda a diferença.</p>
          </article>
        </div>
      </div>
    </section>
  `)

  const pillars = createCanonicalSection(`
    <section ${PAGE_CANONICAL_MARKER}="sobre" class="me-about-page">
      <div class="me-about-shell">
        <div class="me-about-section-head">
          <h2>Os 3 Pilares do Meu Método</h2>
        </div>
        <div class="me-about-pillars">
          <div class="me-about-pillar me-about-pillar-right">
            <article class="me-about-card">
              <p>Estar ainda a estudar dá-me as ferramentas diárias para dominar a fundo a Filosofia e a Escrita. O meu método une a leveza que tu precisas ao rigor técnico que os corretores de exame exigem.</p>
            </article>
            <div class="me-about-pillar-tag"><p>Rigor Académico</p></div>
          </div>
          <div class="me-about-pillar me-about-pillar-left">
            <div class="me-about-pillar-tag"><p>Foco Visual e Estratégia</p></div>
            <article class="me-about-card">
              <p>O nosso cérebro funciona melhor com cores, conexões e lógica direta. Quer compres as minhas sebentas ou venhas para as explicações, vais aprender a estruturar respostas perfeitas sem perder tempo.</p>
            </article>
          </div>
          <div class="me-about-pillar me-about-pillar-right me-about-pillar-wide">
            <article class="me-about-card">
              <p>Aqui não há perguntas estúpidas. Isto é um safe space! Quero que entres na sala de exame e de aula a saber exatamente o que vais fazer.</p>
            </article>
            <div class="me-about-pillar-tag"><p>Apoio e Empatia Total</p></div>
          </div>
        </div>
      </div>
    </section>
  `)

  return { blocks: [hero, story, pillars] }
}
function createCanonicalLegalDocument(input: {
  slug: Exclude<SitePageSlug, "home" | "sobre">
  eyebrow: string
  title: string
  intro: string
  updatedAt: string
  sections: CanonicalLegalSection[]
}) {
  const hero = createCanonicalSection(`
    <section ${PAGE_CANONICAL_MARKER}="${input.slug}" class="me-legal-page">
      <div class="me-legal-shell">
        <a class="me-legal-back" href="/">Voltar ao site</a>
        <div class="me-legal-hero-card">
          <p class="me-legal-eyebrow">${escapeHtml(input.eyebrow)}</p>
          <h1>${escapeHtml(input.title)}</h1>
          <p class="me-legal-intro">${escapeHtml(input.intro)}</p>
          <div class="me-legal-updated">Última atualização: ${escapeHtml(input.updatedAt)}</div>
        </div>
      </div>
    </section>
  `)

  const contentBlocks = input.sections.map((section) =>
    createCanonicalSection(`
      <section ${PAGE_CANONICAL_MARKER}="${input.slug}" class="me-legal-page me-legal-page-soft">
        <div class="me-legal-shell">
          <article class="me-legal-article">
            <h2>${escapeHtml(section.title)}</h2>
            <div class="me-legal-article-body">
              ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
            </div>
          </article>
        </div>
      </section>
    `),
  )

  const support = createCanonicalSection(`
    <section ${PAGE_CANONICAL_MARKER}="${input.slug}" class="me-legal-page">
      <div class="me-legal-shell">
        <div class="me-legal-support">
          <p class="me-legal-eyebrow">Apoio</p>
          <h2>Precisa de esclarecimentos?</h2>
          <p>Se precisar de ajuda adicional sobre privacidade, cookies, condições de utilização ou exercício de direitos, utilize os canais de apoio disponíveis na plataforma.</p>
          <div class="me-legal-actions">
            <a class="me-legal-action-primary" href="/suporte">Contactar suporte</a>
            <a class="me-legal-action-secondary" href="/entrar">Aceder a Mariana Explica</a>
          </div>
        </div>
      </div>
    </section>
  `)

  return { blocks: [hero, ...contentBlocks, support] }
}
function createCanonicalHomeDocument(): SitePageBuilderDocument {
  const hero = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-hero">
      <div class="me-home-shell me-home-hero-grid">
        <div class="me-home-hero-art">
          <img src="${escapeHtml(homeHeroIllustration)}" alt="Ilustração de materiais de estudo para Português e Filosofia" />
        </div>
        <div class="me-home-hero-copy">
          <h1>Tens dificuldades a Português ou Filosofia?</h1>
          <h2>Nunca tiveste a disciplina e vais fazer exame?</h2>
          <p>Então fica aqui que este local é para ti!</p>
          <a class="me-home-primary-button" href="/materiais">Explorar materiais</a>
        </div>
      </div>
    </section>
  `)

  const objective = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-soft">
      <div class="me-home-shell me-home-grid-two">
        <article class="me-home-card me-home-card-centered">
          <span class="me-home-eyebrow me-home-eyebrow-dark">Objetivo Principal</span>
          <p class="me-home-display-copy">Criei este espaço para te dar o apoio que os manuais não dão: leveza, clareza e uma estratégia real para brilhares nos exames de Filosofia e Português. Vamo-nos simplificar?</p>
        </article>
        <div class="me-home-feature-grid">
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">EM BREVE - AULAS GRAVADAS</span>
            <p>Domina temas complexos ao teu ritmo, com aulas organizadas e flexíveis, prontas quando tu estiveres.</p>
          </article>
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">EXPLICAÇÕES</span>
            <p>Acompanhamento personalizado e focado nas tuas dúvidas específicas para garantires resultados.</p>
          </article>
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">MATERIAIS DIGITAIS</span>
            <p>Resumos visuais e esquemas claros para simplificar o teu estudo e garantires a nota máxima sem complicações.</p>
          </article>
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">MATERIAIS DIGITAIS - GRATUITOS</span>
            <p>Dicas flash e recursos rápidos para descarregar e dares um boost imediato no teu estudo.</p>
          </article>
        </div>
      </div>
    </section>
  `)

  const steps = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-neutral">
      <div class="me-home-shell">
        <div class="me-home-section-intro">
          <h2>O teu caminho para o sucesso é simples</h2>
          <p>Esquece as complicações burocráticas. Aqui, o foco é o teu estudo. Em três passos rápidos, tens tudo o que precisas para começar a brilhar.</p>
        </div>
        <div class="me-home-steps-grid">
          <article class="me-home-card">
            <span class="me-home-eyebrow me-home-eyebrow-dark">ENCONTRA O TEU APOIO</span>
            <p>Explora as sebentas e materiais disponíveis. Cada material foi criado para resolver uma dor específica, por isso vais perceber logo qual é o ideal para o teu momento.</p>
          </article>
          <article class="me-home-card">
            <span class="me-home-eyebrow me-home-eyebrow-dark">ACESSO RÁPIDO E SEGURO</span>
            <p>O processo é direto e transparente. Sem taxas escondidas ou passos desnecessários. Pagas de forma segura e o material é teu no segundo seguinte.</p>
          </article>
          <article class="me-home-card">
            <span class="me-home-eyebrow me-home-eyebrow-dark">FOCA-TE NO QUE IMPORTA</span>
            <p>Tudo fica organizado na tua Área do Aluno. Podes aceder aos PDFs e aulas sempre que quiseres, ao teu ritmo, e retomar o estudo exatamente onde paraste.</p>
          </article>
        </div>
      </div>
    </section>
  `)

  const trust = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-soft">
      <div class="me-home-shell me-home-grid-two">
        <article class="me-home-card me-home-trust-left">
          <h3 class="me-home-chip-title me-home-chip-blue">Vantagens de trabalhares comigo</h3>
          <ul class="me-home-list">
            <li><strong>Linguagem Direta:</strong> Falamos a mesma língua. Esquece os termos impossíveis dos manuais e entende a matéria à primeira.</li>
            <li><strong>Foco no Exame:</strong> Materiais desenhados apenas com o que realmente sai. Sem distrações.</li>
            <li><strong>Resumos Visuais:</strong> Esquemas e cores pensados para quem precisa de organizar ideias rapidamente.</li>
          </ul>
        </article>
        <article class="me-home-trust-right">
          <h3 class="me-home-chip-title me-home-chip-white">Leveza e Confiança em cada passo</h3>
          <ul class="me-home-list me-home-list-compact">
            <li>Suporte Real: Não recebes só um PDF. Tens uma "amiga" (eu!) nas DMs para te apoiar sempre que precisares.</li>
            <li>Tudo Organizado: Esquece o caos do WhatsApp. Os teus materiais ficam sempre guardados na tua Área do Aluno.</li>
            <li>Pés na Terra: Filosofia e Português deixam de ser abstratos e passam a ser ferramentas que dominas com segurança.</li>
          </ul>
          <div class="me-home-actions">
            <a class="me-home-secondary-button" href="/materiais">Explorar materiais</a>
            <a class="me-home-secondary-button" href="/registar">Criar Conta</a>
          </div>
        </article>
      </div>
    </section>
  `)

  const reviews = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-reviews">
      <div class="me-home-shell me-home-center">
        <span class="me-home-pill">Reviews</span>
        <h2>E o que dizem os nossos alunos?</h2>
        <p>Avaliações reais publicadas no módulo de Reviews.</p>
        <div class="me-home-review-placeholder">
          <p>Esta secção continua ligada ao módulo dinâmico de reviews no frontend público.</p>
        </div>
      </div>
    </section>
  `)

  return {
    blocks: [hero, objective, steps, trust, reviews],
  }
}
function hasCanonicalMarkerForSlug(document: SitePageBuilderDocument, slug: SitePageSlug) {
  return document.blocks.some((block) => {
    if (block.type !== "rich_text" || typeof block.content !== "string") return false
    return block.content.includes(`${PAGE_CANONICAL_MARKER}="${slug}"`) || (slug === "home" && block.content.includes(HOME_CANONICAL_MARKER))
  })
}

function isHomeLegacyLikeDocument(document: SitePageBuilderDocument) {
  if (document.blocks.length < 4) return false
  return document.blocks.every((block) => {
    if (block.type === "rich_text") {
      return !/<(section|article|main)\b/i.test(block.content)
    }
    return block.type === "heading" || block.type === "image" || block.type === "button"
  })
}

export function maybeCanonicalizeHomeDocument(document: SitePageBuilderDocument, slug: SitePageSlug): SitePageBuilderDocument {
  if (hasCanonicalMarkerForSlug(document, slug)) return document

  if (slug === "home") {
    if (!isHomeLegacyLikeDocument(document)) return document
    return createCanonicalHomeDocument()
  }

  if (slug === "sobre") {
    return createCanonicalAboutDocument()
  }

  if (slug === "privacidade") {
    return getDefaultDocumentForSlug("privacidade")
  }

  if (slug === "cookies") {
    return getDefaultDocumentForSlug("cookies")
  }

  if (slug === "termos") {
    return getDefaultDocumentForSlug("termos")
  }

  return document
}

export function resolveBuilderDocumentFromLayoutJson(
  slug: SitePageSlug,
  layoutJson: Record<string, unknown> | null | undefined,
): SitePageBuilderDocument {
  if (!layoutJson || typeof layoutJson !== "object") {
    return getDefaultDocumentForSlug(slug)
  }

  const record = layoutJson as Record<string, unknown>
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? (record.projectData as Record<string, unknown>)
      : null

  const hasBlocks = Array.isArray(projectData?.blocks) && projectData.blocks.length > 0
  if (hasBlocks && projectData) {
    const normalizedDocument = normalizeBuilderDocument(projectData, slug)
    if (hasCanonicalMarkerForSlug(normalizedDocument, slug)) {
      return normalizedDocument
    }
    return maybeCanonicalizeHomeDocument(expandStructuredRichTextBlocks(normalizedDocument), slug)
  }

  const htmlFromRecord = typeof record.html === "string" ? record.html : null
  const htmlFromProjectData = projectData && typeof projectData.html === "string" ? projectData.html : null
  const legacyHtml = htmlFromRecord ?? htmlFromProjectData

  if (legacyHtml) {
    return maybeCanonicalizeHomeDocument(expandStructuredRichTextBlocks(convertLegacyHtmlToBuilderDocument(legacyHtml, slug)), slug)
  }

  if (projectData) {
    const normalizedDocument = normalizeBuilderDocument(projectData, slug)
    if (hasCanonicalMarkerForSlug(normalizedDocument, slug)) {
      return normalizedDocument
    }
    return maybeCanonicalizeHomeDocument(expandStructuredRichTextBlocks(normalizedDocument), slug)
  }

  return getDefaultDocumentForSlug(slug)
}

function normalizeColumnsItems(rawItems: unknown, columns: 1 | 2 | 3 | 4) {
  const source = Array.isArray(rawItems) ? rawItems.map((item) => String(item ?? "")) : []
  const sanitized = source.slice(0, columns).map((item) =>
    sanitizeRichText(item.trim() || "<p>Coluna vazia.</p>"),
  )
  while (sanitized.length < columns) {
    sanitized.push("<p>Coluna vazia.</p>")
  }
  return sanitized
}

function normalizeContainerChildren(rawChildren: unknown, rawItems: unknown, columns: 1 | 2 | 3 | 4): PageBlock[][] {
  const fallbackItems = normalizeColumnsItems(rawItems, columns)

  if (!Array.isArray(rawChildren)) {
    return fallbackItems.map((item, index) => [
      {
        ...(createDefaultBlock("rich_text") as RichTextBlock),
        id: uid(`container-col-${index + 1}`),
        content: item,
      },
    ])
  }

  const normalizedColumns: PageBlock[][] = []
  for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
    const rawColumn = rawChildren[columnIndex]
    const rawColumnItems = Array.isArray(rawColumn) ? rawColumn : []
    const nestedBlocks = normalizeBlockList(rawColumnItems)
    if (nestedBlocks.length > 0) {
      normalizedColumns.push(nestedBlocks)
      continue
    }

    normalizedColumns.push([
      {
        ...(createDefaultBlock("rich_text") as RichTextBlock),
        id: uid(`container-col-${columnIndex + 1}`),
        content: fallbackItems[columnIndex] ?? "<p>Coluna vazia.</p>",
      },
    ])
  }

  return normalizedColumns
}

function normalizeContainerColumnLayouts(
  rawLayouts: unknown,
  columns: 1 | 2 | 3 | 4,
  fallbackAlignX: "left" | "center" | "right" | "stretch",
  fallbackAlignY: "top" | "center" | "bottom",
): BlockLayoutStyle[] {
  const source = Array.isArray(rawLayouts) ? rawLayouts : []
  const layouts: BlockLayoutStyle[] = []

  for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
    const fallback = getContainerColumnLayoutDefaults({
      contentAlignX: fallbackAlignX,
      contentAlignY: fallbackAlignY,
    })
    layouts.push({
      ...fallback,
      ...normalizeLayoutStyle(source[columnIndex] ?? fallback),
    })
  }

  return layouts
}

function normalizeBlockList(items: unknown[]): PageBlock[] {
  const blocks: PageBlock[] = []

  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const block = item as Record<string, unknown>
    const type = String(block.type ?? "").trim() as PageBlockType
    if (!type) continue
    const layout = normalizeLayoutStyle(block.layout)

    if (type === "heading") {
      blocks.push({
        id: String(block.id ?? uid("heading")),
        type,
        content: String(block.content ?? "Título"),
        level: ([1, 2, 3, 4].includes(Number(block.level)) ? Number(block.level) : 2) as 1 | 2 | 3 | 4,
        align: (["left", "center", "right"].includes(String(block.align)) ? String(block.align) : "left") as
          | "left"
          | "center"
          | "right",
        color: String(block.color ?? "#0f122c"),
        customClassName: normalizeCustomClassName(block.customClassName) || undefined,
        layout,
      })
      continue
    }

    if (type === "rich_text") {
      blocks.push({
        id: String(block.id ?? uid("text")),
        type,
        content: String(block.content ?? "<p></p>"),
        customClassName: normalizeCustomClassName(block.customClassName) || undefined,
        layout,
      })
      continue
    }

    if (type === "image") {
      blocks.push({
        id: String(block.id ?? uid("image")),
        type,
        src: String(block.src ?? ""),
        alt: String(block.alt ?? "Imagem"),
        radius: Math.max(0, Math.min(60, Number(block.radius ?? 18))),
        layout,
      })
      continue
    }

    if (type === "button") {
      blocks.push({
        id: String(block.id ?? uid("button")),
        type,
        label: String(block.label ?? "Call to action"),
        href: String(block.href ?? "#"),
        align: (["left", "center", "right"].includes(String(block.align)) ? String(block.align) : "left") as
          | "left"
          | "center"
          | "right",
        textAlign: (["left", "center", "right"].includes(String(block.textAlign)) ? String(block.textAlign) : "center") as
          | "left"
          | "center"
          | "right",
        borderWidth: clamp(Number(block.borderWidth ?? 0), 0, 12),
        borderColor: String(block.borderColor ?? "#242742"),
        borderRadius: clamp(Number(block.borderRadius ?? 999), 0, 120),
        backgroundColor: String(block.backgroundColor ?? "#242742"),
        textColor: String(block.textColor ?? "#ffffff"),
        paddingY: clamp(Number(block.paddingY ?? 14), 6, 40),
        paddingX: clamp(Number(block.paddingX ?? 24), 12, 80),
        fontSize: clamp(Number(block.fontSize ?? 12), 10, 24),
        widthPercent: clamp(Number(block.widthPercent ?? 0), 0, 100),
        fullWidth: Boolean(block.fullWidth),
        openInNewTab: Boolean(block.openInNewTab),
        customClassName: normalizeCustomClassName(block.customClassName) || undefined,
        layout,
      })
      continue
    }

    if (type === "divider") {
      blocks.push({
        id: String(block.id ?? uid("divider")),
        type,
        color: String(block.color ?? "rgba(36,39,66,0.18)"),
        layout,
      })
      continue
    }

    if (type === "spacer") {
      blocks.push({
        id: String(block.id ?? uid("spacer")),
        type,
        height: Math.max(8, Math.min(240, Number(block.height ?? 48))),
        layout,
      })
      continue
    }

    if (type === "columns") {
      const columns = clamp(Number(block.columns ?? 2), 2, 4) as 2 | 3 | 4
      const baseGap = clamp(Number(block.gap ?? 18), 8, 64)
      blocks.push({
        id: String(block.id ?? uid("columns")),
        type,
        columns,
        gap: baseGap,
        rowGap: clamp(Number(block.rowGap ?? block.gap ?? 18), 8, 64),
        alignItems: (
          ["start", "center", "end", "stretch"].includes(String(block.alignItems))
            ? String(block.alignItems)
            : "stretch"
        ) as "start" | "center" | "end" | "stretch",
        justifyItems: (
          ["start", "center", "end", "stretch"].includes(String(block.justifyItems))
            ? String(block.justifyItems)
            : "stretch"
        ) as "start" | "center" | "end" | "stretch",
        itemContentAlignX: (
          ["left", "center", "right", "stretch"].includes(String(block.itemContentAlignX))
            ? String(block.itemContentAlignX)
            : "left"
        ) as "left" | "center" | "right" | "stretch",
        itemContentAlignY: (
          ["top", "center", "bottom"].includes(String(block.itemContentAlignY))
            ? String(block.itemContentAlignY)
            : "top"
        ) as "top" | "center" | "bottom",
        itemPaddingY: clamp(Number(block.itemPaddingY ?? 16), 0, 120),
        itemPaddingX: clamp(Number(block.itemPaddingX ?? 16), 0, 120),
        items: normalizeColumnsItems(block.items, columns),
        layout,
      })
      continue
    }

    if (type === "container") {
      const columns = clamp(Number(block.columns ?? 2), 1, 4) as 1 | 2 | 3 | 4
      const baseGap = clamp(Number(block.gap ?? 16), 8, 64)
      const columnContentAlignX = (
        ["left", "center", "right", "stretch"].includes(String(block.columnContentAlignX))
          ? String(block.columnContentAlignX)
          : "left"
      ) as "left" | "center" | "right" | "stretch"
      const columnContentAlignY = (
        ["top", "center", "bottom"].includes(String(block.columnContentAlignY))
          ? String(block.columnContentAlignY)
          : "top"
      ) as "top" | "center" | "bottom"
      blocks.push({
        id: String(block.id ?? uid("container")),
        type,
        columns,
        gap: baseGap,
        rowGap: clamp(Number(block.rowGap ?? block.gap ?? 16), 8, 64),
        alignItems: (
          ["start", "center", "end", "stretch"].includes(String(block.alignItems))
            ? String(block.alignItems)
            : "stretch"
        ) as "start" | "center" | "end" | "stretch",
        justifyItems: (
          ["start", "center", "end", "stretch"].includes(String(block.justifyItems))
            ? String(block.justifyItems)
            : "stretch"
        ) as "start" | "center" | "end" | "stretch",
        columnContentAlignX,
        columnContentAlignY,
        columnContentGap: clamp(Number(block.columnContentGap ?? 8), 0, 80),
        children: normalizeContainerChildren(block.children, block.items, columns),
        columnLayouts: normalizeContainerColumnLayouts(block.columnLayouts, columns, columnContentAlignX, columnContentAlignY),
        backgroundColor: String(block.backgroundColor ?? "#f8fafc"),
        borderColor: String(block.borderColor ?? "rgba(36,39,66,0.14)"),
        borderWidth: clamp(Number(block.borderWidth ?? 1), 0, 12),
        borderRadius: clamp(Number(block.borderRadius ?? 18), 0, 120),
        paddingY: clamp(Number(block.paddingY ?? 20), 0, 120),
        paddingX: clamp(Number(block.paddingX ?? 20), 0, 120),
        layout,
      })
    }
  }

  return blocks
}

export function normalizeBuilderDocument(raw: unknown, slug: SitePageSlug): SitePageBuilderDocument {
  if (!raw || typeof raw !== "object") return getDefaultDocumentForSlug(slug)
  const record = raw as Record<string, unknown>
  const blocksRaw = Array.isArray(record.blocks) ? record.blocks : []
  const blocks = normalizeBlockList(blocksRaw)
  return blocks.length > 0 ? { blocks } : getDefaultDocumentForSlug(slug)
}

function getHeadingLevel(tagName: string): 1 | 2 | 3 | 4 {
  if (tagName === "h1") return 1
  if (tagName === "h2") return 2
  if (tagName === "h3") return 3
  return 4
}

function pushRichTextBlockFromHtml(blocks: PageBlock[], html: string) {
  const content = sanitizeRichText(html).trim()
  if (!content) return
  blocks.push({
    ...(createDefaultBlock("rich_text") as RichTextBlock),
    id: uid("text"),
    content,
  })
}

function setLegacyBlockLayout(block: PageBlock) {
  block.layout = {
    ...block.layout,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: "transparent",
    backgroundImageUrl: "",
    backgroundImageSize: "cover",
    borderRadius: 0,
  }
}

function appendLegacyNodeAsBlocks(node: Element, blocks: PageBlock[]) {
  const beforeCount = blocks.length
  extractLegacyElements(node, blocks)
  if (blocks.length > beforeCount) {
    for (let index = beforeCount; index < blocks.length; index += 1) {
      setLegacyBlockLayout(blocks[index])
    }
    return
  }

  const fallbackHtml = sanitizeRichText(node.outerHTML).trim()
  if (!fallbackHtml) return
  const fallbackBlock = createDefaultBlock("rich_text")
  if (fallbackBlock.type !== "rich_text") return
  fallbackBlock.id = uid("legacy")
  fallbackBlock.content = fallbackHtml
  setLegacyBlockLayout(fallbackBlock)
  blocks.push(fallbackBlock)
}

function shouldExpandStructuredLegacyHtml(source: string) {
  return /<(header|section|main|footer|div)\b/i.test(source)
}

export function expandStructuredRichTextBlocks(document: SitePageBuilderDocument): SitePageBuilderDocument {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return document
  }

  const nextBlocks: PageBlock[] = []
  let changed = false
  const parser = new DOMParser()

  for (const block of document.blocks) {
    if (block.type !== "rich_text" || !shouldExpandStructuredLegacyHtml(block.content)) {
      nextBlocks.push(block)
      continue
    }

    const parsed = parser.parseFromString(block.content, "text/html")
    const topLevel = Array.from(parsed.body.children).filter((child) => child.tagName.toLowerCase() !== "script")
    if (topLevel.length === 0) {
      nextBlocks.push(block)
      continue
    }

    const expandedBefore = nextBlocks.length
    topLevel.forEach((child) => appendLegacyNodeAsBlocks(child, nextBlocks))
    if (nextBlocks.length > expandedBefore) {
      changed = true
      continue
    }

    nextBlocks.push(block)
  }

  if (!changed) {
    return document
  }

  return { blocks: nextBlocks }
}

function extractLegacyElements(node: Element, blocks: PageBlock[]) {
  const children = Array.from(node.children)

  for (const child of children) {
    const tag = child.tagName.toLowerCase()

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      const text = child.textContent?.trim() ?? ""
      if (!text) continue
      const heading = createDefaultBlock("heading")
      if (heading.type !== "heading") continue
      heading.id = uid("heading")
      heading.content = text
      heading.level = getHeadingLevel(tag)
      blocks.push(heading)
      continue
    }

    if (tag === "img") {
      const image = child as HTMLImageElement
      const src = image.getAttribute("src")?.trim() ?? ""
      if (!src) continue
      const block = createDefaultBlock("image")
      if (block.type !== "image") continue
      block.id = uid("image")
      block.src = src
      block.alt = image.getAttribute("alt")?.trim() ?? "Imagem"
      blocks.push(block)
      continue
    }

    if (tag === "hr") {
      const divider = createDefaultBlock("divider")
      divider.id = uid("divider")
      blocks.push(divider)
      continue
    }

    if (tag === "a") {
      const href = child.getAttribute("href")?.trim() ?? "#"
      const label = child.textContent?.trim() ?? ""
      if (label && label.length <= 90) {
        const button = createDefaultBlock("button")
        if (button.type === "button") {
          button.id = uid("button")
          button.label = label
          button.href = href
          blocks.push(button)
        }
      } else {
        pushRichTextBlockFromHtml(blocks, child.outerHTML)
      }
      continue
    }

    if (tag === "p" || tag === "ul" || tag === "ol" || tag === "blockquote") {
      pushRichTextBlockFromHtml(blocks, child.outerHTML)
      continue
    }

    if (tag === "section" || tag === "article" || tag === "main" || tag === "div") {
      const hasStructuredChildren = child.querySelector("h1,h2,h3,h4,p,ul,ol,img,a,hr")
      if (hasStructuredChildren) {
        extractLegacyElements(child, blocks)
        continue
      }

      const text = child.textContent?.trim() ?? ""
      if (text) {
        pushRichTextBlockFromHtml(blocks, `<p>${escapeHtml(text)}</p>`)
      }
      continue
    }
  }
}

export function convertLegacyHtmlToBuilderDocument(
  html: string | null | undefined,
  slug: SitePageSlug,
): SitePageBuilderDocument {
  const source = typeof html === "string" ? html.trim() : ""
  if (!source) return getDefaultDocumentForSlug(slug)

  const richText = createDefaultBlock("rich_text")
  if (richText.type !== "rich_text") return getDefaultDocumentForSlug(slug)

  // For full legacy layouts (hero/sections/grid), split by top-level sections to keep
  // element-scoped editing in inspector instead of one huge rich text block.
  if (shouldExpandStructuredLegacyHtml(source)) {
    if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
      const parser = new DOMParser()
      const parsed = parser.parseFromString(source, "text/html")
      const topLevel = Array.from(parsed.body.children).filter((child) => child.tagName.toLowerCase() !== "script")

      if (topLevel.length > 0) {
        const blocks: PageBlock[] = []
        topLevel.forEach((child) => appendLegacyNodeAsBlocks(child, blocks))

        if (blocks.length > 0) {
          return { blocks }
        }
      }
    }

    richText.content = sanitizeRichText(source)
    setLegacyBlockLayout(richText)
    return { blocks: [richText] }
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    richText.content = sanitizeRichText(source)
    return { blocks: [richText] }
  }

  const parser = new DOMParser()
  const parsed = parser.parseFromString(source, "text/html")
  const blocks: PageBlock[] = []
  extractLegacyElements(parsed.body, blocks)

  if (blocks.length === 0) {
    richText.content = sanitizeRichText(source)
    return { blocks: [richText] }
  }

  return { blocks }
}

function getWrapperStyle(layout: BlockLayoutStyle) {
  const widthPercent = Math.round((layout.gridColumns / 12) * 10000) / 100
  const widthCss = `min(100%, ${widthPercent}%)`

  const hasExplicitHorizontalMargins = layout.marginLeft > 0 || layout.marginRight > 0
  const marginLeft = hasExplicitHorizontalMargins
    ? `${layout.marginLeft}px`
    : layout.align === "right"
      ? "auto"
      : layout.align === "center"
        ? "auto"
        : "0"
  const marginRight = hasExplicitHorizontalMargins
    ? `${layout.marginRight}px`
    : layout.align === "left"
      ? "auto"
      : layout.align === "center"
        ? "auto"
        : "0"

  const contentAlignItems =
    layout.contentAlignX === "left"
      ? "flex-start"
      : layout.contentAlignX === "center"
        ? "center"
        : layout.contentAlignX === "right"
          ? "flex-end"
          : "stretch"
  const contentJustifyContent =
    layout.contentAlignY === "top" ? "flex-start" : layout.contentAlignY === "center" ? "center" : "flex-end"
  const backgroundImage = layout.backgroundImageUrl.trim()
  const backgroundSize =
    layout.backgroundImageSize === "stretch"
      ? "100% 100%"
      : layout.backgroundImageSize === "auto"
        ? "auto"
        : layout.backgroundImageSize

  return [
    `width:${widthCss}`,
    `margin-top:${layout.marginTop}px`,
    `margin-bottom:${layout.marginBottom}px`,
    `margin-left:${marginLeft}`,
    `margin-right:${marginRight}`,
    `padding:${layout.paddingTop}px ${layout.paddingRight}px ${layout.paddingBottom}px ${layout.paddingLeft}px`,
    `background-color:${escapeHtml(layout.backgroundColor)}`,
    backgroundImage ? `background-image:url("${escapeHtml(backgroundImage)}")` : "",
    backgroundImage ? `background-size:${backgroundSize}` : "",
    backgroundImage ? "background-position:center center" : "",
    backgroundImage ? "background-repeat:no-repeat" : "",
    `border-radius:${layout.borderRadius}px`,
    "display:flex",
    "flex-direction:column",
    `align-items:${contentAlignItems}`,
    `justify-content:${contentJustifyContent}`,
    `gap:${layout.contentGap}px`,
    `min-height:${layout.minHeight}px`,
  ].join(";")
}

function renderSingleBlockToHtml(block: PageBlock): string {
      if (block.type === "heading") {
        const tag = `h${block.level}`
        const classAttribute = buildClassAttribute(block.customClassName)
        return `<${tag}${classAttribute} style="margin:0;color:${escapeHtml(block.color)};text-align:${block.align};font-weight:800;line-height:1.12;">${escapeHtml(block.content)}</${tag}>`
      }

      if (block.type === "rich_text") {
        const classAttribute = buildClassAttribute("me-managed-richtext", block.customClassName)
        return `<div${classAttribute}>${sanitizeRichText(block.content)}</div>`
      }

      if (block.type === "image") {
        if (!block.src.trim()) {
          return `<div style="border:1px dashed rgba(36,39,66,0.28);border-radius:${block.radius}px;padding:28px;text-align:center;color:#475569;background:#f8fafc;">Imagem sem URL</div>`
        }
        return `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="display:block;width:100%;max-width:100%;border-radius:${block.radius}px;" />`
      }

      if (block.type === "button") {
        const targetAttrs = block.openInNewTab ? ` target="_blank" rel="noopener noreferrer"` : ""
        const justifyContent = block.textAlign === "left" ? "flex-start" : block.textAlign === "right" ? "flex-end" : "center"
        const widthCss = block.fullWidth ? "100%" : block.widthPercent > 0 ? `${block.widthPercent}%` : "auto"
        const display = `inline-flex;width:${widthCss};justify-content:${justifyContent};`
        const textTransform = block.fontSize <= 13 ? "uppercase" : "none"
        const letterSpacing = block.fontSize <= 13 ? ".08em" : ".02em"
        const classAttribute = buildClassAttribute(block.customClassName)
        return `<div style="text-align:${block.align};"><a${classAttribute} href="${escapeHtml(block.href)}"${targetAttrs} style="${display}text-align:${block.textAlign};border-style:solid;border-width:${block.borderWidth}px;border-color:${escapeHtml(block.borderColor)};border-radius:${block.borderRadius}px;background:${escapeHtml(block.backgroundColor)};padding:${block.paddingY}px ${block.paddingX}px;color:${escapeHtml(block.textColor)};text-decoration:none;font-weight:800;letter-spacing:${letterSpacing};text-transform:${textTransform};font-size:${block.fontSize}px;">${escapeHtml(block.label)}</a></div>`
      }

      if (block.type === "divider") {
        return `<div role="separator" aria-hidden="true" style="width:100%;height:1px;background:${escapeHtml(block.color)};"></div>`
      }

      if (block.type === "spacer") {
        return `<div style="height:${block.height}px;"></div>`
      }

      if (block.type === "container") {
        const items = block.children
          .slice(0, block.columns)
          .map((columnBlocks, columnIndex) => {
            const columnLayout = block.columnLayouts[columnIndex] ?? getContainerColumnLayoutDefaults({
              contentAlignX: block.columnContentAlignX,
              contentAlignY: block.columnContentAlignY,
            })
            const alignItems =
              columnLayout.contentAlignX === "left"
                ? "flex-start"
                : columnLayout.contentAlignX === "center"
                  ? "center"
                  : columnLayout.contentAlignX === "right"
                    ? "flex-end"
                    : "stretch"
            const justifyContent =
              columnLayout.contentAlignY === "top"
                ? "flex-start"
                : columnLayout.contentAlignY === "center"
                  ? "center"
                  : "flex-end"
            return `<article class="me-managed-container-column" style="display:flex;flex-direction:column;align-items:${alignItems};justify-content:${justifyContent};gap:${block.columnContentGap}px;margin:${columnLayout.marginTop}px ${columnLayout.marginRight}px ${columnLayout.marginBottom}px ${columnLayout.marginLeft}px;padding:${columnLayout.paddingTop}px ${columnLayout.paddingRight}px ${columnLayout.paddingBottom}px ${columnLayout.paddingLeft}px;background-color:${escapeHtml(columnLayout.backgroundColor)};border-radius:${columnLayout.borderRadius}px;min-height:${columnLayout.minHeight}px;">${renderBlocksToHtml(columnBlocks)}</article>`
          })
          .join("")
        return `<section class="me-managed-container" style="display:grid;grid-template-columns:repeat(${block.columns},minmax(0,1fr));column-gap:${block.gap}px;row-gap:${block.rowGap}px;align-items:${block.alignItems};justify-items:${block.justifyItems};background-color:${escapeHtml(block.backgroundColor)};border:${block.borderWidth}px solid ${escapeHtml(block.borderColor)};border-radius:${block.borderRadius}px;padding:${block.paddingY}px ${block.paddingX}px;">${items}</section>`
      }

      const items = block.items
        .slice(0, block.columns)
        .map((item) => {
          const alignItems =
            block.itemContentAlignX === "left"
              ? "flex-start"
              : block.itemContentAlignX === "center"
                ? "center"
                : block.itemContentAlignX === "right"
                  ? "flex-end"
                  : "stretch"
          const justifyContent =
            block.itemContentAlignY === "top"
              ? "flex-start"
              : block.itemContentAlignY === "center"
                ? "center"
                : "flex-end"
          return `<article class="me-managed-column-item" style="display:flex;flex-direction:column;align-items:${alignItems};justify-content:${justifyContent};padding:${block.itemPaddingY}px ${block.itemPaddingX}px;">${sanitizeRichText(item)}</article>`
        })
        .join("")

      return `<section class="me-managed-columns" style="grid-template-columns:repeat(${block.columns},minmax(0,1fr));column-gap:${block.gap}px;row-gap:${block.rowGap}px;align-items:${block.alignItems};justify-items:${block.justifyItems};">${items}</section>`
}

function renderBlocksToHtml(blocks: PageBlock[]) {
  return blocks
    .map((block) => renderSingleBlockToHtml(block))
    .map((html, index) => {
      const block = blocks[index]
      return `<section class="me-managed-block" style="${getWrapperStyle(block.layout)}">${html}</section>`
    })
    .join("")
}

export function renderDocumentToHtml(document: SitePageBuilderDocument) {
  const blocksHtml = renderBlocksToHtml(document.blocks)
  return `<div class="me-managed-page-root">${blocksHtml}</div>`
}

export function getDefaultStyleCss() {
  return `
.me-managed-page-root {
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 20px 76px;
}
.me-managed-block {
  box-sizing: border-box;
}
.me-managed-block + .me-managed-block {
  margin-top: 8px;
}
.me-managed-richtext {
  color: #24324a;
  line-height: 1.85;
  font-size: 18px;
}
.me-managed-richtext p {
  margin: 0 0 14px;
}
.me-managed-richtext h2,
.me-managed-richtext h3,
.me-managed-richtext h4 {
  margin: 0 0 12px;
  color: #0f122c;
}
.me-managed-richtext img {
  max-width: 100%;
  height: auto;
}
.me-managed-columns {
  display: grid;
}
.me-managed-container-column {
  min-width: 0;
}
.me-managed-column-item {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: #ffffff;
  padding: 16px;
}
.me-home-section {
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  padding: 72px 0;
}
.me-home-shell {
  width: min(1200px, calc(100vw - 48px));
  margin: 0 auto;
}
.me-home-hero {
  background: #f5fafc;
}
.me-home-hero-grid,
.me-home-grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  align-items: center;
}
.me-home-hero-art {
  aspect-ratio: 1 / 1;
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.me-home-hero-art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 24px;
  box-sizing: border-box;
}
.me-home-hero-copy h1 {
  max-width: 12ch;
  margin: 0 0 16px;
  font-size: clamp(48px, 6vw, 72px);
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: #0f122c;
}
.me-home-hero-copy h2 {
  max-width: 14ch;
  margin: 0 0 18px;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.18;
  color: rgba(15, 18, 44, 0.82);
}
.me-home-hero-copy p {
  max-width: 18ch;
  margin: 0 0 28px;
  font-size: 22px;
  line-height: 1.55;
  color: #46464d;
}
.me-home-primary-button,
.me-home-secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-weight: 800;
}
.me-home-primary-button {
  border-radius: 999px;
  background: #242742;
  color: #ffffff;
  padding: 16px 30px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 12px;
  box-shadow: 0 16px 40px rgba(36, 39, 66, 0.18);
}
.me-home-soft {
  background: rgba(239, 244, 246, 0.5);
}
.me-home-neutral {
  background: #eff4f6;
}
.me-home-card {
  border: 1px solid rgba(71, 71, 77, 0.12);
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  padding: 32px;
  box-sizing: border-box;
}
.me-home-card-centered {
  padding: 48px;
  text-align: center;
}
.me-home-card-small {
  text-align: center;
  min-height: 100%;
}
.me-home-feature-grid,
.me-home-steps-grid {
  display: grid;
  gap: 24px;
}
.me-home-feature-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.me-home-steps-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.me-home-eyebrow {
  display: inline-flex;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.me-home-eyebrow-dark {
  background: #242742;
  color: #ffffff;
}
.me-home-display-copy {
  margin: 24px 0 0;
  font-size: 38px;
  line-height: 1.45;
  color: #0f122c;
}
.me-home-card-small p,
.me-home-steps-grid p,
.me-home-section-intro p,
.me-home-trust-right p,
.me-home-review-placeholder p {
  color: #46464d;
}
.me-home-card-small p {
  margin: 18px 0 0;
  font-size: 14px;
  line-height: 1.75;
}
.me-home-section-intro {
  max-width: 700px;
  margin-bottom: 48px;
}
.me-home-section-intro h2,
.me-home-reviews h2 {
  margin: 0 0 20px;
  font-size: clamp(40px, 5vw, 58px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #0f122c;
}
.me-home-section-intro p,
.me-home-reviews > .me-home-shell > p {
  margin: 0;
  font-size: 18px;
  line-height: 1.8;
}
.me-home-steps-grid .me-home-card p {
  margin: 28px 0 0;
  font-size: 16px;
  line-height: 1.8;
}
.me-home-chip-title {
  display: inline-flex;
  border-radius: 999px;
  padding: 10px 18px;
  font-size: 22px;
  margin: 0 0 28px;
}
.me-home-chip-blue {
  background: rgba(169, 207, 255, 0.35);
  color: #0f122c;
}
.me-home-chip-white {
  background: #ffffff;
  color: #0f122c;
}
.me-home-list {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 18px;
  color: #242742;
}
.me-home-list li {
  line-height: 1.75;
}
.me-home-trust-right {
  border-radius: 24px;
  background: rgba(169, 207, 255, 0.2);
  padding: 40px;
  box-sizing: border-box;
}
.me-home-list-compact li {
  font-size: 15px;
}
.me-home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 32px;
}
.me-home-secondary-button {
  border-radius: 14px;
  border: 1px solid rgba(71, 71, 77, 0.12);
  background: #ffffff;
  color: #0f122c;
  padding: 14px 22px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 11px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}
.me-home-reviews {
  background: #f5fafc;
}
.me-home-center {
  text-align: center;
}
.me-home-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #ffffff;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #567085;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}
.me-home-review-placeholder {
  max-width: 760px;
  margin: 36px auto 0;
  border-radius: 20px;
  border: 1px dashed rgba(71, 71, 77, 0.18);
  background: #ffffff;
  padding: 28px;
}
.me-about-page {
  background: #d8e8ef;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  padding: 56px 0;
}
.me-about-page-soft {
  background: #eaf2f6;
}
.me-about-shell {
  width: min(1200px, calc(100vw - 48px));
  margin: 0 auto;
}
.me-about-hero {
  max-width: 860px;
  margin: 0 auto;
  text-align: center;
}
.me-about-hero h1,
.me-about-section-head h2 {
  margin: 0;
  color: #0f122c;
  line-height: 1.12;
  letter-spacing: -0.03em;
}
.me-about-hero h1 {
  font-size: clamp(34px, 4.8vw, 62px);
}
.me-about-section-head {
  max-width: 980px;
  margin: 0 auto;
  text-align: center;
}
.me-about-section-head h2 {
  font-size: clamp(32px, 4vw, 58px);
}
.me-about-grid,
.me-about-card-grid {
  display: grid;
  gap: 32px;
  margin-top: 48px;
}
.me-about-grid {
  align-items: center;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.me-about-photo {
  min-height: 430px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: #e8f0f4;
  padding: 32px;
}
.me-about-photo p {
  margin: 0;
  color: #1f2237;
  font-size: clamp(34px, 4vw, 54px);
}
.me-about-copy {
  display: grid;
  gap: 28px;
  text-align: left;
}
.me-about-copy p {
  margin: 0;
  color: #24324a;
  font-size: 22px;
  line-height: 1.8;
  font-weight: 600;
}
.me-about-copy .me-about-lead {
  color: #0f122c;
  font-size: 30px;
  line-height: 1.45;
  font-weight: 700;
}
.me-about-copy span {
  color: #1a4da8;
}
.me-about-card-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.me-about-card {
  border-radius: 18px;
  background: #e8f0f4;
  padding: 36px 40px;
}
.me-about-card p {
  margin: 0;
  color: #24324a;
  font-size: 22px;
  line-height: 1.8;
  font-weight: 600;
}
.me-about-pillars {
  display: grid;
  gap: 28px;
  margin-top: 48px;
}
.me-about-pillar {
  display: grid;
  gap: 16px;
  align-items: center;
}
.me-about-pillar-right {
  grid-template-columns: minmax(0, 1fr) 220px;
}
.me-about-pillar-left {
  grid-template-columns: 220px minmax(0, 1fr);
}
.me-about-pillar-wide {
  grid-template-columns: minmax(0, 1fr) 240px;
}
.me-about-pillar-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 94px;
  border-radius: 18px;
  background: #9aa8bb;
  padding: 20px;
}
.me-about-pillar-tag p {
  margin: 0;
  color: #0f122c;
  text-align: center;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
}
.me-legal-page {
  background: #ffffff;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  padding: 28px 0;
}
.me-legal-page-soft {
  padding-top: 0;
}
.me-legal-shell {
  width: min(1024px, calc(100vw - 48px));
  margin: 0 auto;
}
.me-legal-back {
  display: inline-flex;
  color: #64748b;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}
.me-legal-hero-card {
  margin-top: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 28px;
  background: rgba(248, 250, 252, 0.78);
  padding: 32px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
}
.me-legal-eyebrow {
  margin: 0;
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}
.me-legal-hero-card h1,
.me-legal-article h2,
.me-legal-support h2 {
  margin: 0;
  color: #020617;
}
.me-legal-hero-card h1 {
  margin-top: 16px;
  font-size: clamp(34px, 4vw, 50px);
}
.me-legal-intro {
  margin: 16px 0 0;
  max-width: 900px;
  color: #475569;
  font-size: 16px;
  line-height: 1.85;
}
.me-legal-updated {
  display: inline-flex;
  margin-top: 24px;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 10px 16px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.me-legal-article {
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 28px 32px;
  box-shadow: 0 18px 48px -30px rgba(15, 23, 42, 0.35);
}
.me-legal-article h2,
.me-legal-support h2 {
  font-size: clamp(28px, 3vw, 38px);
}
.me-legal-article-body {
  margin-top: 18px;
  display: grid;
  gap: 16px;
}
.me-legal-article-body p,
.me-legal-support p {
  margin: 0;
  color: #475569;
  font-size: 15px;
  line-height: 1.9;
}
.me-legal-support {
  border: 1px solid #dbeafe;
  border-radius: 24px;
  background: rgba(240, 249, 255, 0.8);
  padding: 28px 32px;
}
.me-legal-support h2 {
  margin-top: 12px;
}
.me-legal-support p {
  max-width: 760px;
  margin-top: 12px;
}
.me-legal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}
.me-legal-action-primary,
.me-legal-action-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  padding: 14px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
}
.me-legal-action-primary {
  background: #020617;
  color: #ffffff;
}
.me-legal-action-secondary {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
}
@media (max-width: 880px) {
  .me-managed-columns {
    grid-template-columns: 1fr !important;
  }
  .me-home-shell {
    width: min(100vw - 28px, 1200px);
  }
  .me-home-hero-grid,
  .me-home-grid-two,
  .me-home-feature-grid,
  .me-home-steps-grid {
    grid-template-columns: 1fr;
  }
  .me-home-section {
    padding: 44px 0;
  }
  .me-home-card,
  .me-home-card-centered,
  .me-home-trust-right {
    padding: 24px;
  }
  .me-home-display-copy {
    font-size: 28px;
  }
  .me-about-shell,
  .me-legal-shell {
    width: min(100vw - 28px, 1200px);
  }
  .me-about-grid,
  .me-about-card-grid,
  .me-about-pillar-right,
  .me-about-pillar-left,
  .me-about-pillar-wide {
    grid-template-columns: 1fr;
  }
  .me-about-photo {
    min-height: 260px;
  }
  .me-about-copy,
  .me-about-copy p,
  .me-about-copy .me-about-lead {
    text-align: center;
  }
  .me-about-card,
  .me-legal-hero-card,
  .me-legal-article,
  .me-legal-support {
    padding: 22px;
  }
  .me-about-card p,
  .me-about-copy p {
    font-size: 18px;
  }
}
  `.trim()
}

export function composeManagedPageCss(additionalCss?: string | null) {
  const baseCss = getDefaultStyleCss().trim()
  const extraCss = String(additionalCss ?? "").trim()
  return extraCss ? `${baseCss}\n\n${extraCss}` : baseCss
}








