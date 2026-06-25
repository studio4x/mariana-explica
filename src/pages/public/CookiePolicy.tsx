import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { LegalPageLayout, type LegalSection } from "./LegalPageLayout"

const sections: LegalSection[] = [
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
]

export function CookiePolicy() {
  return (
    <VisualEditorProvider pageKey="cookies">
      <LegalPageLayout
        eyebrow="Cookies"
        title="Política de Cookies"
        intro="Esta Política de Cookies descreve de forma transparente que tipos de cookies e tecnologias semelhantes podem ser utilizados na Mariana Explica, em que circunstâncias são necessários, quando dependem de consentimento e como podem ser geridos pelo utilizador, em conformidade com as regras aplicáveis em Portugal e na União Europeia."
        updatedAt="23/04/2026"
        sections={sections}
      />
    </VisualEditorProvider>
  )
}

