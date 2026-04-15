# PWA — Mariana Explica

## 1. Contexto

Este documento define a estratégia de Progressive Web App (PWA) da plataforma Mariana Explica.

O objetivo do PWA é permitir que a plataforma funcione, no mobile, com uma experiência próxima à de um aplicativo instalado, sem depender inicialmente de publicação em loja.

O PWA deve melhorar:

- acesso rápido à plataforma
- recorrência de uso
- percepção de produto premium
- experiência mobile da área do aluno
- retenção

---

## 2. Objetivo

Garantir que a plataforma:

- possa ser instalada na tela inicial
- tenha comportamento semelhante a app no mobile
- carregue com mais previsibilidade
- tenha suporte básico offline quando aplicável
- permita expansão futura para notificações e experiências mais avançadas

---

## 3. Escopo do PWA

O PWA da plataforma deve cobrir:

- manifest
- service worker
- cache do shell da aplicação
- tela offline
- instalação no dispositivo
- experiência standalone
- ícones e metadados
- preparação para notificações futuras

---

## 4. Fora de escopo inicial

- publicação em App Store
- publicação em Google Play como app nativo empacotado
- funcionamento offline completo da área do aluno com todos os conteúdos
- sincronização offline complexa
- download local massivo de materiais para uso totalmente offline

---

## 5. Papel do PWA na plataforma

O PWA deve servir principalmente para:

- facilitar o retorno do aluno à plataforma
- permitir abertura rápida da área do aluno
- reforçar a ideia de “app de estudos”
- melhorar a experiência mobile do produto

A prioridade do PWA está mais na experiência de acesso e retenção do que em offline complexo.

---

## 6. Princípios obrigatórios

### 6.1 Mobile-first

O PWA deve ser projetado primeiro pensando no celular.

### 6.2 Instalação simples

O usuário deve conseguir instalar a plataforma com o menor atrito possível.

### 6.3 Offline consciente

O sistema deve oferecer fallback offline coerente, sem prometer acesso local a conteúdos que dependem de autenticação, grant ou URL assinada.

### 6.4 Segurança preservada

O PWA não pode quebrar a política de acesso a conteúdos pagos ou restritos.

### 6.5 Consistência com o frontend

O comportamento em modo instalado deve continuar respeitando as mesmas regras de:

- autenticação
- autorização
- grants
- acesso a arquivos
- sessão

---

## 7. Estratégia geral

A plataforma deve usar PWA com:

- `manifest.webmanifest`
- `service worker`
- cache controlado
- tela offline
- metadados para Android e iOS
- prompt de instalação

A experiência instalada deve priorizar:

- home
- catálogo
- login
- dashboard
- reentrada rápida na área do aluno

---

## 8. Manifest

## 8.1 Objetivo

Definir metadados do app para instalação no dispositivo.

## 8.2 Arquivo

Local recomendado:

- `public/manifest.webmanifest`

## 8.3 Campos obrigatórios

- `id`
- `name`
- `short_name`
- `description`
- `lang`
- `start_url`
- `scope`
- `display`
- `orientation`
- `theme_color`
- `background_color`
- `icons`

## 8.4 Valores recomendados para a plataforma

### Nome do app
- `Mariana Explica`

### Nome curto
- `Mariana`

### Idioma
- `pt-PT` ou `pt-BR`, conforme estratégia final da marca e público
- como o projeto está orientado ao contexto português, a recomendação principal é `pt-PT`

### Start URL
- `/`

### Scope
- `/`

### Display
- `standalone`

### Orientation
- `portrait`

### Theme color
- derivado da cor principal da marca

### Background color
- derivado do fundo claro principal da marca

---

## 9. Ícones do PWA

## 9.1 Requisitos

A plataforma deve fornecer ícones em resoluções adequadas para instalação.

## 9.2 Arquivos mínimos recomendados

- `192x192`
- `512x512`
- `512x512 maskable`

## 9.3 Regras

- ícones devem respeitar a identidade visual da Mariana Explica
- o ícone deve ser legível em tamanhos pequenos
- deve haver versão maskable para melhor integração com Android
- os arquivos devem ficar em `public/`

---

## 10. Metadados HTML relacionados ao PWA

O `index.html` deve conter:

- `theme-color`
- `manifest`
- suporte para iOS
- `apple-touch-icon`
- favicon coerente
- metadados básicos de app

Também é recomendável manter:

- Open Graph
- Twitter metadata
- título e descrição consistentes com a marca

---

## 11. Service Worker

## 11.1 Objetivo

Controlar cache, fallback offline e comportamento básico de carregamento do shell da aplicação.

## 11.2 Local recomendado

- `public/sw.js`

## 11.3 Registro

O registro deve ocorrer no frontend principal, após o carregamento da aplicação, de forma controlada.

## 11.4 Estratégia geral de cache

O service worker deve priorizar:

- cache do shell da aplicação
- fallback offline de páginas essenciais
- comportamento seguro para assets estáticos

Não deve tentar cachear indiscriminadamente:

- respostas privadas sensíveis
- downloads protegidos
- URLs assinadas temporárias
- payloads críticos de autenticação

---

## 12. Estratégia de cache

## 12.1 Shell cache

Deve incluir assets e páginas mínimas para manter a estrutura da app acessível.

Exemplos:
- `/`
- página offline
- ícones essenciais
- assets de layout básicos

## 12.2 Navegação

Estratégia recomendada:
- `network-first` para navegação
- fallback para cache
- fallback final para tela offline

## 12.3 Assets estáticos

Estratégia recomendada:
- `stale-while-revalidate` ou equivalente controlado para assets seguros
- sem cache agressivo de recursos dinâmicos sensíveis

## 12.4 Conteúdo privado

Conteúdos como:
- PDFs protegidos
- links assinados
- URLs temporárias
- recursos privados do storage

não devem ser persistidos no cache público do service worker como regra geral.

---

## 13. Página offline

## 13.1 Objetivo

Exibir uma experiência clara quando o usuário estiver sem conexão ou quando a navegação falhar.

## 13.2 Arquivo recomendado

- `public/offline.html`

## 13.3 Conteúdo esperado

A página offline deve:

- ter visual coerente com a plataforma
- explicar que a conexão está indisponível
- orientar o usuário a tentar novamente
- evitar depender de assets externos
- funcionar como arquivo estático independente

## 13.4 Regras

- a página offline não deve prometer acesso a conteúdos pagos offline
- deve ser simples, leve e confiável

---

## 14. Prompt de instalação

## 14.1 Objetivo

Estimular instalação do PWA quando fizer sentido.

## 14.2 Estratégia

A plataforma deve capturar o evento de instalação e exibir um prompt customizado, quando apropriado.

## 14.3 Regras

- não exibir se o app já estiver instalado
- não exibir de forma agressiva demais
- preferir timing contextual
- permitir dismiss
- persistir estado de rejeição temporária no navegador

## 14.4 Locais ideais para sugerir instalação

- após login
- dentro do dashboard
- após compra confirmada
- em momentos de maior intenção de retorno

---

## 15. Comportamento em modo standalone

Quando o app estiver instalado e rodando em modo standalone, a experiência deve:

- esconder dependência visual excessiva do navegador
- manter navegação clara
- preservar identidade visual do app
- continuar funcionando com autenticação normal
- respeitar proteção de rotas

---

## 16. PWA e autenticação

## 16.1 Regras

O fato de a plataforma estar instalada não altera as regras de autenticação.

Continua obrigatório:

- login para áreas privadas
- validação de sessão
- refresh de token
- logout consistente
- bloqueio quando o usuário perde permissão

## 16.2 Sessão expirada

Se a sessão expirar no app instalado:

- o usuário deve ser redirecionado corretamente para login
- a UI deve tratar a perda de sessão de forma clara
- rotas privadas não devem ficar acessíveis por cache visual antigo sem revalidação

---

## 17. PWA e conteúdos protegidos

## 17.1 Regras obrigatórias

Instalar a plataforma como PWA não dá direito adicional de acesso.

Todo conteúdo protegido continua exigindo:

- autenticação
- grant válido
- validação backend
- URL assinada quando necessário

## 17.2 PDFs e assets privados

- não devem ser tornados públicos pelo PWA
- não devem ser cacheados livremente
- devem continuar passando pelo fluxo seguro de acesso

---

## 18. PWA e notificações push

## 18.1 Situação inicial

O projeto deve nascer preparado para notificações push, mas essa funcionalidade pode ficar para fase posterior se necessário.

## 18.2 Preparação arquitetural

A estrutura deve permitir evolução futura para:

- push notifications
- campanhas segmentadas
- avisos operacionais
- alertas de suporte

## 18.3 Regras

Quando push for implementado no futuro:

- exigir consentimento
- respeitar preferências do usuário
- registrar status de inscrição
- integrar com backend de forma rastreável

---

## 19. PWA e consentimento

Se a plataforma usar cookies, pixels ou recursos dependentes de consentimento:

- o PWA deve respeitar a mesma política
- prompts de instalação e experiência mobile não devem conflitar com banners de consentimento
- o estado do consentimento precisa continuar válido também na experiência instalada

---

## 20. PWA e analytics

A experiência instalada também deve permitir mensuração consistente de uso.

Eventos recomendados:
- app instalado
- prompt exibido
- prompt aceito
- prompt rejeitado
- abertura em modo standalone
- retorno ao dashboard pelo app

Esses eventos não substituem a telemetria principal da plataforma, mas ajudam a medir retenção.

---

## 21. Telas mais críticas para o PWA

As telas que mais precisam funcionar bem em contexto PWA são:

- home
- catálogo
- página de produto
- login
- dashboard
- meus produtos
- página de conteúdo
- notificações
- suporte

---

## 22. Experiência mobile prioritária

O PWA deve reforçar:

- abertura rápida
- toque confortável
- navegação simples
- headers limpos
- CTAs claros
- boa leitura
- estabilidade visual

O foco principal está na experiência do aluno no celular.

---

## 23. Estados visuais e feedback

No PWA, deve existir tratamento claro para:

- carregamento inicial
- tentativa de uso sem internet
- sessão expirada
- conteúdo indisponível
- erro de rede
- atualização de versão do app

---

## 24. Atualização de versão

## 24.1 Objetivo

Garantir que o PWA possa ser atualizado com segurança sem comportamento inconsistente.

## 24.2 Regras

- o service worker deve versionar o cache
- versões antigas de cache devem ser limpas
- mudanças estruturais relevantes devem invalidar caches antigos
- a aplicação deve evitar servir UI quebrada por cache antigo

---

## 25. Estrutura técnica recomendada

Arquivos principais:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/offline.html`
- `src/components/layout/PwaMetaManager.tsx` ou equivalente
- `src/components/PwaInstallPrompt.tsx` ou equivalente
- registro do service worker em `src/main.tsx`

---

## 26. Configurações gerenciáveis

O projeto pode prever configurações administráveis para PWA, como:

- nome do app
- nome curto
- descrição
- cores
- ícones
- imagem do prompt
- texto do prompt de instalação

Essas configurações podem ser mantidas em `site_config` quando houver necessidade operacional.

---

## 27. Segurança do PWA

O PWA deve respeitar integralmente as políticas de segurança da plataforma.

### Regras críticas
- sem segredos no frontend
- sem acesso permanente a assets privados
- sem bypass de autenticação
- sem cache indevido de dados sensíveis
- sem confiar em UI cacheada para autorização real

---

## 28. Critérios de aceite

O PWA será considerado adequado quando:

- a plataforma puder ser instalada no celular
- a experiência em modo standalone for consistente
- existir manifest válido
- existir service worker funcional
- houver tela offline adequada
- o fluxo mobile for bom no dashboard
- conteúdos protegidos continuarem seguros
- a atualização de versão não causar inconsistência grave

---

## 29. Riscos

### Riscos técnicos
- cache incorreto de conteúdo sensível
- service worker servindo versão antiga da UI
- comportamento inconsistente após deploy
- prompt de instalação intrusivo
- assets privados ficando acessíveis indevidamente

### Riscos operacionais
- usuário achar que todo conteúdo funciona offline
- experiência ruim em iOS por expectativa incorreta
- divergência entre comportamento no navegador e app instalado
- falha de sessão em modo standalone sem tratamento claro

---

## 30. Observações finais

- o PWA deve ser tratado como canal estratégico de retenção
- o foco não é transformar a plataforma em app nativo agora
- a prioridade é acesso rápido, boa UX mobile e recorrência
- offline deve ser útil, mas honesto
- segurança de conteúdo continua acima da conveniência de cache