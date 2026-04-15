# Skill: Platform Spec Guard

## Propósito

Servir como barreira inicial e continua para garantir que toda implementação respeita a documentação oficial, a arquitetura definida e as regras de negócio do projeto Mariana Explica.

**Objetivo:** prevenir implementação fora da spec, garantir alinhamento com os docs e reforçar que o agente não deve inventar arquitetura, permissões ou fluxos de negócio.

---

## Quando usar esta skill

Use **Platform Spec Guard** quando:

- receber uma **nova funcionalidade ou tarefa** para implementar
- precisar **validar se uma decisão arquitetural é segura** e alinhada com os docs
- houver **dúvida sobre fluxo de negócio, permissões ou autorização**
- suspeitar que uma **decisão viola as regras documentadas**
- precisar fazer **recomendação sobre stack ou padrão** a usar
- estiver pronto para **começar implementação** e quiser verificar contexto primeiro

---

## Documentos obrigatórios a consultar

Na ordem de prioridade:

1. **docs/02-regras-negocio.md** — regras operacionais, tipos de usuário, acesso
2. **docs/03-arquitetura.md** — stack, padrões, separação de camadas
3. **docs/10-autenticacao-seguranca.md** — autenticação, autorização, RLS, segurança
4. **docs/15-plano-de-implementacao.md** — ordem de execução, dependências
5. **AGENTS.md** — regras de execução deste repositório

---

## O que validar ANTES de implementar

### ✅ Checklist de especificação

- [ ] Li os docs corretos para a tarefa?
- [ ] Entendi as regras de negócio que governam esta feature?
- [ ] Validei que a implementação respeita a arquitetura (SPA + serverless)?
- [ ] Confirmei onde a lógica deve ficar (frontend vs Edge Function vs banco)?
- [ ] Identificar se precisa de autenticação, autorização ou RLS?
- [ ] A tarefa envolve operação crítica (pagamento, acesso, dados privados)?
- [ ] Existe alguma restrição de segurança que devo respeitar?
- [ ] Consultei a ordem de prioridade do plano de implementação?
- [ ] Existe conflito entre a tarefa pedida e os docs?

---

## Regras obrigatórias por contexto

### Regras gerais

1. **Fonte de verdade é `/docs`** — sempre que houver dúvida, o doc tem razão
2. **Stack é obrigatória** — salvo instrução explícita, usar React, TypeScript, Vite, Supabase, Edge Functions
3. **Frontend não é fonte de verdade** — lógica crítica vai para backend
4. **Segurança em camadas** — frontend bloqueia → backend valida → banco impõe com RLS
5. **Separação clara** — público, dashboard, admin devem ser isolados

### Regras de negócio críticas

- **Access grants** — a tabela `access_grants` é a base real de autorização de acesso
- compra confirmada ≠ acesso automático; precisa de grant válido
- reembolso pode exigir revogação de grant
- conteúdo protegido depende de grant válido ou regra explícita de acesso gratuito

### Regras arquiteturais

- backend sensível: Edge Functions, nunca frontend
- blob crítico: PostgreSQL + RLS, nunca confiar em cliente
- integrações externas: backend apenas (Stripe, webhooks, APIs)
- storage privado por padrão, URLs assinadas para arquivos protegidos

### Regras administrativas

- gestão de usuários = alta sensibilidade, requer auditoria
- alteração de role = operação crítica, deve ser auditada
- remoção de usuário = requer estratégia segura, não pode ser irrecuperável sem aprovação
- admin não pode remover a si próprio sem proteção

---

## Anti-padrões a evitar

❌ **NÃO FAÇA:**

- Inventar arquitetura fora dos docs
- Colocar lógica de pagamento no frontend
- Confiar apenas em frontend para autorização
- Criar tabela privada sem RLS
- Permitir acesso a arquivo sem URL assinada
- Alterar schema SQL manualmente sem migration
- Deixar operação crítica sem validação no backend
- Chamar Stripe diretamente do cliente
- Criar claim de acesso apenas no frontend
- Expor `service_role` do Supabase no cliente
- Modelar tabela privada com roles/permissions apenas — usar RLS
- Deixar admin remover a si próprio sem confirmação dupla

---

## Resultado esperado ao usar esta skill

Antes de começar a implementar:

1. ✅ Documentos corretos identificados e lidos
2. ✅ Regras de negócio confirmadas
3. ✅ Decisões arquiteturais validadas
4. ✅ Camadas de segurança planejadas
5. ✅ Anti-padrões confirmados que não serão usados
6. ✅ Ordem correta de implementação identificada
7. ✅ Contexto completo comunicado antes de codar

---

## Exemplo prático de uso

### Cenário: Implementar checkout Stripe

**Tarefa:** "Criar checkout Stripe para os produtos"

**Uso da skill:**

```
1. Ler docs/02-regras-negocio.md → entender fluxo de compra e criação de grant
2. Ler docs/03-arquitetura.md → confirmar que Stripe é no backend
3. Ler docs/05-backend-edge-functions.md → padrão de Edge Function
4. Ler docs/10-autenticacao-seguranca.md → validação segura de sessão
5. Ler docs/11-integracoes.md → integração Stripe específica
6. Ler AGENTS.md seção "Integrações" → regras Stripe obrigatórias
```

**Validações:**

- ✅ Checkout criado em Edge Function (backend)
- ✅ Sessão criada com Stripe
- ✅ Webhook de confirmação espera assinatura Stripe
- ✅ Grant só criado após `payment_intent.succeeded` confirmado no backend
- ✅ Order marcada como confirmada apenas após webhook
- ✅ Idempotência garantida (Stripe key na Edge Function)

---

## Checklist final

- [ ] Consultei os docs na ordem correta?
- [ ] As regras de negócio fazem sentido para a tarefa?
- [ ] Validei a separação de responsabilidades?
- [ ] Confirmei segurança em 3 camadas?
- [ ] Evitei todos os anti-padrões?
- [ ] Comunicar contexto antes de começar a codar
