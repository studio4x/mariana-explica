import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { LegalPageLayout, type LegalSection } from "./LegalPageLayout"

const sections: LegalSection[] = [
  {
    title: "1. Quem trata os seus dados",
    body: [
      "A presente Política de Privacidade aplica-se ao site e à plataforma Mariana Explica. A entidade responsável pelo tratamento é a operadora da plataforma Mariana Explica, enquanto responsável pela gestão comercial, autenticação, prestação de conteúdos digitais, apoio ao cliente e cumprimento de obrigações legais associadas ao serviço.",
      'Sempre que esta política mencionar "Mariana Explica", "nós" ou "plataforma", refere-se ao responsável pelo tratamento dos dados pessoais recolhidos através do site, da Área autenticada, do checkout e dos respetivos canais de apoio.',
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
]

export function PrivacyPolicy() {
  return (
    <VisualEditorProvider pageKey="privacy">
      <LegalPageLayout
        eyebrow="Privacidade"
        title="Política de Privacidade"
        intro="Esta página explica como a Mariana Explica recolhe, utiliza, protege e conserva dados pessoais no contexto do site público, da Área autenticada, do checkout, do suporte e da entrega de conteúdos digitais. O texto foi estruturado para refletir os princípios do RGPD e a legislação aplicável em Portugal e na União Europeia."
        updatedAt="23/04/2026"
        sections={sections}
      />
    </VisualEditorProvider>
  )
}

