import { LegalPageLayout, type LegalSection } from "./LegalPageLayout"

const sections: LegalSection[] = [
  {
    title: "1. Quem trata os seus dados",
    body: [
      "A presente Politica de Privacidade aplica-se ao site e a plataforma Mariana Explica. A entidade responsavel pelo tratamento e a operadora da plataforma Mariana Explica, enquanto responsavel pela gestao comercial, autenticacao, prestacao de conteudos digitais, apoio ao cliente e cumprimento de obrigacoes legais associadas ao servico.",
      "Sempre que esta politica mencionar \"Mariana Explica\", \"nos\" ou \"plataforma\", refere-se ao responsavel pelo tratamento dos dados pessoais recolhidos atraves do site, da area autenticada, do checkout e dos respetivos canais de apoio.",
    ],
  },
  {
    title: "2. Que dados pessoais podemos recolher",
    body: [
      "Podemos recolher dados de identificacao e contacto, como nome, endereco de email, dados da conta de utilizador e informacoes fornecidas em formularios, tickets de suporte, pedidos de contacto ou inscricoes em cursos e materiais digitais.",
      "Tambem podemos tratar dados de utilizacao da plataforma, incluindo acessos, progresso de aprendizagem, historico de compras, historico de pedidos, registos tecnicos de seguranca, notificacoes, interacoes com paginas publicas e preferencias associadas ao servico.",
      "Quando existe pagamento, os dados de faturacao e de pagamento sao tratados principalmente pelo prestador de pagamentos contratado. A plataforma conserva os dados estritamente necessarios para reconciliacao comercial, suporte, auditoria e cumprimento legal.",
    ],
  },
  {
    title: "3. Finalidades e bases legais do tratamento",
    body: [
      "Tratamos dados pessoais para criar e gerir contas, autenticar utilizadores, disponibilizar cursos e materiais, processar compras, conceder acessos, responder a pedidos de suporte, prevenir fraude, assegurar a seguranca da plataforma e cumprir deveres legais e fiscais.",
      "As bases juridicas utilizadas podem incluir a execucao de diligencias pre-contratuais e do contrato, o cumprimento de obrigacoes legais, o interesse legitimo na seguranca, operacao e melhoria do servico, e o consentimento quando este for exigido, nomeadamente para determinadas categorias de cookies ou comunicacoes nao essenciais.",
    ],
  },
  {
    title: "4. Com quem podemos partilhar dados",
    body: [
      "Os dados podem ser partilhados com subcontratantes e prestadores de servicos estritamente necessarios ao funcionamento da plataforma, tais como alojamento, base de dados, autenticacao, envio de email, analise operacional, suporte tecnico e processamento de pagamentos.",
      "Sempre que recorremos a terceiros, procuramos garantir que estes atuam ao abrigo de instrucoes adequadas, com medidas de seguranca apropriadas e apenas para as finalidades compativeis com a prestacao do servico.",
    ],
  },
  {
    title: "5. Transferencias internacionais de dados",
    body: [
      "Sempre que algum prestador de servicos esteja localizado fora do Espaco Economico Europeu ou realize tratamento internacional de dados, procuramos assegurar uma base juridica adequada para a transferencia, incluindo decisoes de adequacao, clausulas contratuais-tipo ou outras garantias reconhecidas pela legislacao aplicavel.",
    ],
  },
  {
    title: "6. Durante quanto tempo conservamos os dados",
    body: [
      "Conservamos os dados pessoais apenas pelo periodo necessario para as finalidades que justificaram a recolha, sem prejuizo de prazos de conservacao legal, fiscal, contabilistica, defesa de direitos ou gestao de incidentes de seguranca.",
      "Dados ligados a contas, pedidos, acessos concedidos, suporte e auditoria podem ser mantidos enquanto a relacao com o utilizador subsistir e pelo periodo adicional exigido por lei ou necessario para demonstracao de transacoes, resposta a reclamacoes ou protecao da plataforma.",
    ],
  },
  {
    title: "7. Os seus direitos ao abrigo do RGPD",
    body: [
      "Nos termos do Regulamento (UE) 2016/679, o titular dos dados pode solicitar acesso, retificacao, apagamento, limitacao do tratamento, portabilidade dos dados e oposicao, nos casos previstos na lei. Quando o tratamento assentar em consentimento, este pode ser retirado a qualquer momento, sem comprometer a licitude do tratamento anterior.",
      "Os pedidos podem ser apresentados pelos canais de apoio disponibilizados na plataforma. O titular dos dados tem igualmente o direito de apresentar reclamacao junto da autoridade de controlo competente, designadamente a CNPD em Portugal.",
    ],
  },
  {
    title: "8. Seguranca e protecao dos dados",
    body: [
      "Adotamos medidas tecnicas e organizativas adequadas para proteger os dados pessoais contra destruicao, perda, alteracao, divulgacao ou acesso nao autorizado, incluindo controlos de autenticacao, segregacao de acessos, protecao de areas privadas, registos operacionais e mecanismos de seguranca na infraestrutura utilizada.",
      "Apesar de nenhum sistema oferecer seguranca absoluta, procuramos rever continuamente as medidas de protecao aplicadas ao servico e limitar o acesso aos dados de acordo com a necessidade operacional.",
    ],
  },
  {
    title: "9. Menores e utilizacao da plataforma",
    body: [
      "A utilizacao da plataforma deve respeitar a legislacao aplicavel e as condicoes do servico. Quando o utilizador seja menor e a lei exija intervencao ou autorizacao do representante legal para determinados atos, essa responsabilidade deve ser assegurada pelo proprio utilizador e respetivo representante.",
    ],
  },
  {
    title: "10. Contactos e atualizacoes desta politica",
    body: [
      "Esta politica pode ser atualizada para refletir alteracoes legais, operacionais ou tecnicas. A versao em vigor sera sempre a que estiver publicada nesta pagina com a data da ultima atualizacao.",
      "Para questoes relacionadas com privacidade e exercicio de direitos, utilize o canal de suporte da plataforma. Sempre que legalmente exigido, poderemos disponibilizar contacto especifico adicional do responsavel pelo tratamento.",
    ],
  },
]

export function PrivacyPolicy() {
  return (
    <LegalPageLayout
      eyebrow="Privacidade"
      title="Politica de Privacidade"
      intro="Esta pagina explica como a Mariana Explica recolhe, utiliza, protege e conserva dados pessoais no contexto do site publico, da area autenticada, do checkout, do suporte e da entrega de conteudos digitais. O texto foi estruturado para refletir os principios do RGPD e a legislacao aplicavel em Portugal e na Uniao Europeia."
      updatedAt="23/04/2026"
      sections={sections}
    />
  )
}
