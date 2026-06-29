import { LegalPageLayout, type LegalSection } from "./LegalPageLayout"
import { VisualEditorProvider, useVisualEditorPage } from "@/features/site-editor/visual-editor"
import {
  LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type LegalVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"

const sections: LegalSection[] = [
  {
    title: "1. O que sao cookies",
    body: [
      "Cookies sao pequenos ficheiros de texto armazenados no dispositivo do utilizador quando visita um site. Servem para memorizar preferencias, suportar funcionalidades tecnicas, reforcar seguranca, medir desempenho e, quando aplicavel, personalizar comunicacoes e publicidade.",
    ],
  },
  {
    title: "2. Como usamos cookies nesta plataforma",
    body: [
      "A Mariana Explica pode utilizar cookies estritamente necessarios para autenticar sessoes, manter a seguranca da navegacao, equilibrar servicos tecnicos, recordar definicoes essenciais e garantir o funcionamento correto de areas privadas, checkout e formularios.",
      "Tambem podemos utilizar cookies de preferencia, analitica ou medicao, bem como tecnologias semelhantes para compreender o uso do site, melhorar a experiencia, medir campanhas e suportar integracoes de marketing, mas apenas quando exista fundamento juridico adequado e, quando exigido, consentimento previo do utilizador.",
    ],
  },
  {
    title: "3. Categorias de cookies",
    body: [
      "Cookies estritamente necessarios: indispensaveis para o funcionamento tecnico do site, autenticacao, seguranca, navegacao e prestacao de servicos pedidos pelo utilizador. Estes cookies nao dependem de consentimento quando forem realmente essenciais.",
      "Cookies de preferencia: permitem recordar escolhas como idioma, interface ou outras preferencias operacionais. Podem depender de configuracao do utilizador e, em certos casos, de consentimento.",
      "Cookies analiticos ou estatisticos: ajudam a medir visitas, desempenho e utilizacao das paginas para melhorar a plataforma. Quando nao forem anonimizados de forma suficiente ou quando a lei o exigir, sao ativados apenas com consentimento.",
      "Cookies de marketing ou publicidade: utilizados para medir conversoes, campanhas e personalizacao promocional. Sao sempre tratados com especial cuidado e dependem de consentimento previo quando aplicavel.",
    ],
  },
  {
    title: "4. Base legal e gestao do consentimento",
    body: [
      "Nos termos das regras europeias aplicaveis a comunicacoes eletronicas e da legislacao de protecao de dados, o armazenamento ou acesso a informacao no dispositivo do utilizador so pode ocorrer com consentimento previo, exceto quando a tecnologia for estritamente necessaria para prestar um servico expressamente solicitado ou para assegurar a comunicacao eletronica.",
      "Sempre que adotarmos cookies nao essenciais, o utilizador deve poder aceitar, recusar ou rever essas escolhas atraves do mecanismo de preferencias disponibilizado pela plataforma. A retirada do consentimento deve ser tao simples quanto a sua concessao.",
    ],
  },
  {
    title: "5. Cookies de terceiros",
    body: [
      "Algumas funcionalidades podem recorrer a servicos de terceiros, por exemplo para pagamentos, analise de utilizacao, campanhas ou suporte tecnico. Nesses casos, esses terceiros podem definir os seus proprios cookies ou tecnologias equivalentes, de acordo com as respetivas politicas.",
      "Sempre que esses terceiros atuem no contexto do nosso servico, procuramos usar configuracoes compativeis com os requisitos legais aplicaveis e com o nivel de controlo esperado pelo utilizador.",
    ],
  },
  {
    title: "6. Como desativar ou remover cookies",
    body: [
      "O utilizador pode gerir cookies atraves do banner ou centro de preferencias disponibilizado no site, sempre que exista, e tambem atraves das definicoes do proprio navegador. A desativacao de cookies estritamente necessarios pode comprometer funcionalidades essenciais do servico, incluindo login, checkout ou acesso a conteudos protegidos.",
    ],
  },
  {
    title: "7. Conservacao e revisao desta politica",
    body: [
      "Os prazos de conservacao dos cookies variam conforme a sua finalidade, podendo existir cookies de sessao e cookies persistentes. Esta politica pode ser revista sempre que houver alteracoes tecnicas, juridicas ou funcionais relevantes.",
      "A versao publicada nesta pagina e a que se considera em vigor na data indicada como ultima atualizacao.",
    ],
  },
]

function CookiePolicyPageContent() {
  const { document } = useVisualEditorPage()
  const visualDocument = (document as LegalVisualEditorDocument | undefined) ?? LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT

  return (
    <LegalPageLayout
      eyebrow={visualDocument.hero.eyebrow}
      title={visualDocument.hero.title}
      intro={visualDocument.hero.intro}
      updatedAt={visualDocument.hero.updatedAt}
      sections={sections}
      support={{
        eyebrow: visualDocument.support.eyebrow,
        title: visualDocument.support.title,
        lead: visualDocument.support.lead,
        primaryCtaLabel: visualDocument.support.primaryCta.label,
        primaryCtaHref: visualDocument.support.primaryCta.href,
        secondaryCtaLabel: visualDocument.support.secondaryCta.label,
        secondaryCtaHref: visualDocument.support.secondaryCta.href,
      }}
    />
  )
}

export function CookiePolicy() {
  return (
    <VisualEditorProvider pageKey="cookies">
      <CookiePolicyPageContent />
    </VisualEditorProvider>
  )
}
