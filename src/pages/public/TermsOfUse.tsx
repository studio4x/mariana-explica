import { LegalPageLayout, type LegalSection } from "./LegalPageLayout"
import { VisualEditorProvider, useVisualEditorPage } from "@/features/site-editor/visual-editor"
import {
  LEGAL_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type LegalVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"

const sections: LegalSection[] = [
  {
    title: "1. Objeto e ambito",
    body: [
      "Os presentes Termos de Uso regulam o acesso e a utilizacao do site, da area autenticada e dos conteudos digitais disponibilizados pela Mariana Explica. Ao navegar, criar conta, adquirir um material ou utilizar qualquer funcionalidade da plataforma, o utilizador aceita estes termos na medida aplicavel.",
      "Se alguma funcionalidade especifica tiver condicoes proprias, essas condicoes complementam estes termos no respetivo ambito.",
    ],
  },
  {
    title: "2. Conta de utilizador",
    body: [
      "Para aceder a determinadas funcionalidades, o utilizador pode necessitar de criar conta e manter os seus dados atualizados. O utilizador e responsavel pela confidencialidade das credenciais de acesso e por todas as atividades realizadas atraves da sua conta, salvo prova de utilizacao indevida nao imputavel ao proprio.",
      "A plataforma pode suspender, limitar ou encerrar contas quando existam indicios de utilizacao abusiva, fraude, violacao destes termos, incumprimento legal ou risco para a seguranca do servico.",
    ],
  },
  {
    title: "3. Produtos digitais e acesso aos conteudos",
    body: [
      "A Mariana Explica disponibiliza materiais, materiais de apoio e outros conteudos digitais de natureza educativa. As condicoes comerciais, como preco, modalidade, acesso gratuito ou pago e eventuais limitacoes de utilizacao, sao apresentadas na pagina do produto e no checkout.",
      "O acesso efetivo ao conteudo depende da confirmacao interna do direito de acesso na plataforma. A compra ou ativacao comercial pode exigir validacao adicional de pagamento, concessao de acesso, verificacoes antifraude ou aplicacao das regras operacionais do servico.",
    ],
  },
  {
    title: "4. Precos, pagamentos e faturacao",
    body: [
      "Os precos apresentados devem ser entendidos nos termos indicados no checkout e podem ser atualizados sem efeito retroativo sobre compras ja concluidas. Os pagamentos podem ser processados por prestadores externos especializados, nos termos das respetivas condicoes e politicas.",
      "A plataforma pode manter registos internos de pedidos, pagamentos, estado comercial, reconciliacao e faturacao para cumprimento contratual, suporte ao utilizador, auditoria e obrigacoes legais.",
    ],
  },
  {
    title: "5. Direito de livre resolucao e conteudos digitais",
    body: [
      "Quando o utilizador atue na qualidade de consumidor e a lei lhe reconheca direito de livre resolucao, esse direito sera aplicado nos termos legalmente exigidos. Contudo, nos contratos de fornecimento de conteudos digitais nao prestados em suporte material, o direito de livre resolucao pode deixar de existir depois de iniciada a execucao com consentimento previo e expresso do consumidor e reconhecimento de que perde esse direito, nos termos da legislacao de defesa do consumidor aplicavel.",
      "Quando existam pedidos de reembolso, cancelamento ou contestacao, estes poderao estar sujeitos a verificacao do estado do pedido, do acesso concedido, do consumo do conteudo e das regras legais e comerciais aplicaveis.",
    ],
  },
  {
    title: "6. Regras de utilizacao da plataforma",
    body: [
      "O utilizador compromete-se a utilizar a plataforma de forma licita, diligente e compativel com a sua finalidade educativa. E proibido contornar mecanismos de autenticacao, partilhar acessos de forma indevida, copiar ou redistribuir conteudos sem autorizacao, explorar vulnerabilidades, automatizar usos abusivos ou interferir com o funcionamento normal do servico.",
      "Tambem nao e permitido utilizar a plataforma para introduzir conteudos ilicitos, ofensivos, fraudulentos ou que violem direitos de terceiros.",
    ],
  },
  {
    title: "7. Propriedade intelectual",
    body: [
      "Os conteudos, marcas, textos, imagens, organizacao pedagogica, materiais descarregaveis, interface e demais elementos da Mariana Explica estao protegidos por direitos de propriedade intelectual e nao podem ser reproduzidos, comunicados, distribuidos, alterados ou explorados fora das permissoes expressamente concedidas.",
      "A aquisicao de um material concede apenas um direito de utilizacao pessoal, limitado e nao exclusivo, de acordo com as condicoes do servico.",
    ],
  },
  {
    title: "8. Suporte, reclamacoes e resolucao de litigios",
    body: [
      "A plataforma disponibiliza canais de suporte para pedidos de ajuda, questoes operacionais, problemas de acesso e tratamento de reclamacoes. Sempre que aplicavel, o utilizador consumidor pode tambem recorrer aos mecanismos legais de reclamacao e a entidades de resolucao alternativa de litigios de consumo nos termos da legislacao portuguesa.",
    ],
  },
  {
    title: "9. Responsabilidade e disponibilidade do servico",
    body: [
      "A Mariana Explica procura assegurar disponibilidade, seguranca e fiabilidade do servico, mas nao garante funcionamento ininterrupto nem ausencia absoluta de erros, falhas de rede, manutencoes ou indisponibilidades decorrentes de terceiros.",
      "Na medida permitida por lei, a responsabilidade da plataforma fica limitada aos danos que devam ser legalmente imputados e que resultem de incumprimento demonstrado, sem prejuizo dos direitos imperativos do consumidor.",
    ],
  },
  {
    title: "10. Lei aplicavel e alteracoes",
    body: [
      "Estes termos regem-se pela legislacao portuguesa e pelo direito da Uniao Europeia aplicavel, sem prejuizo das normas imperativas de protecao do consumidor que devam prevalecer.",
      "A Mariana Explica pode atualizar os presentes termos para refletir alteracoes legais, operacionais ou funcionais. A versao em vigor sera sempre a publicada nesta pagina com a respetiva data de atualizacao.",
    ],
  },
]

function TermsOfUsePageContent() {
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

export function TermsOfUse() {
  return (
    <VisualEditorProvider pageKey="terms">
      <TermsOfUsePageContent />
    </VisualEditorProvider>
  )
}
