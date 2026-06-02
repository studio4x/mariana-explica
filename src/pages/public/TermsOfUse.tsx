import { LegalPageLayout, type LegalSection } from "./LegalPageLayout"

const sections: LegalSection[] = [
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
]

export function TermsOfUse() {
  return (
    <LegalPageLayout
      eyebrow="Termos"
      title="Termos de Uso"
      intro="Estes Termos de Uso definem as regras aplicáveis ao acesso ao site, criação de conta, compra de conteúdos digitais e utilização da plataforma Mariana Explica. O texto foi preparado para um serviço operado em Portugal e deve ser lido em conjunto com a Política de Privacidade, a Política de Cookies e as informações comerciais apresentadas nas páginas de produto e checkout."
      updatedAt="23/04/2026"
      sections={sections}
    />
  )
}
