# Deploy — Mariana Explica

## 1. Contexto

Este documento define a estratégia de deploy da plataforma Mariana Explica.

O deploy cobre:

- frontend (React)
- backend (Supabase Edge Functions)
- banco de dados (migrations)
- storage
- variáveis de ambiente
- ambientes (dev, staging, produção)

---

## 2. Objetivo

Garantir que a plataforma:

- possa ser publicada com segurança
- tenha ambientes separados
- tenha controle de versão
- permita rollback
- tenha consistência entre frontend e backend
- evite erros operacionais em produção

---

## 3. Arquitetura de deploy

A plataforma será distribuída em:

### Frontend
- Vercel

### Backend + Banco
- Supabase

### Storage
- Supabase Storage

---

## 4. Ambientes

Devem existir pelo menos 3 ambientes:

### 4.1 Development (local)
- desenvolvimento no VS Code
- conexão com projeto Supabase de dev

---

### 4.2 Staging (opcional, mas recomendado)
- ambiente de testes
- simula produção
- usado para validar deploys antes do release

---

### 4.3 Production
- ambiente real
- dados reais
- acesso público

---

## 5. Estratégia de branches

Sugestão:

- `main` → produção
- `develop` → staging
- `feature/*` → desenvolvimento

---

## 6. Deploy do frontend (Vercel)

## 6.1 Stack

- React + Vite
- deploy via Vercel

## 6.2 Configuração

- conectar repositório Git
- definir build command:
  - `npm run build`
- definir output:
  - `dist`

---

## 6.3 Variáveis de ambiente (frontend)

Exemplos:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`
- `VITE_STRIPE_PUBLIC_KEY`

### Regras

- nunca colocar secrets no frontend
- apenas chaves públicas
- separar por ambiente

---

## 6.4 Domínio

- domínio principal configurado na Vercel
- HTTPS obrigatório

---

## 7. Deploy do backend (Supabase)

## 7.1 Edge Functions

Deploy via CLI:

- `supabase functions deploy`

### Regras

- versionar funções
- evitar alterações diretas no painel
- usar código como fonte de verdade

---

## 7.2 Banco de dados

## 7.2.1 Migrations

- todas alterações via SQL versionado
- nunca alterar estrutura manualmente em produção

### Comandos

- `supabase db push`
- `supabase migration new`

---

## 7.2.2 Ordem de execução

- tabelas
- índices
- constraints
- triggers
- RLS
- policies
- seeds

---

## 7.3 Storage

- buckets criados via script ou manual inicial
- permissões privadas por padrão
- organização por paths

---

## 8. Variáveis de ambiente (backend)

Exemplos:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER_API_KEY`
- `APP_BASE_URL`

### Regras

- nunca expor no frontend
- armazenar apenas no Supabase ou provedor seguro
- separar por ambiente

---

## 9. Integração com Stripe no deploy

## 9.1 Ambientes

### Test
- usar chaves de teste
- webhook de teste

### Production
- usar chaves reais
- webhook real

---

## 9.2 Webhook

- endpoint público da Edge Function
- registrar na Stripe
- validar assinatura obrigatoriamente

---

## 10. Build e publicação

## 10.1 Fluxo recomendado

1. desenvolver localmente
2. commit em branch feature
3. merge em develop (staging)
4. validar staging
5. merge em main
6. deploy automático Vercel
7. deploy backend + migrations
8. validar produção

---

## 11. Ordem de deploy segura

### IMPORTANTE

Sempre seguir:

1. deploy backend (funções)
2. deploy banco (migrations)
3. deploy frontend

---

## 12. Rollback

## 12.1 Frontend

- Vercel permite rollback de versão

---

## 12.2 Backend

- manter versionamento das funções
- reverter deploy manualmente

---

## 12.3 Banco

- migrations devem ser reversíveis quando possível
- evitar alterações destrutivas sem plano

---

## 13. Logs e monitoramento

## 13.1 Frontend

- erros via console
- integração futura com Sentry (opcional)

---

## 13.2 Backend

- logs das Edge Functions
- logs de webhook
- logs de automações

---

## 13.3 Banco

- monitorar queries
- monitorar erros de policy (RLS)

---

## 14. Segurança no deploy

- nunca commitar secrets
- usar variáveis de ambiente
- restringir acesso ao painel
- usar HTTPS sempre
- validar domínios
- proteger endpoints públicos

---

## 15. CI/CD (opcional evolutivo)

Pode ser implementado futuramente:

- testes automáticos
- lint
- validação de build
- deploy automático com validação

---

## 16. Seeds iniciais

Executar após deploy:

- criar admin inicial
- criar config base
- criar produto inicial
- validar acesso

---

## 17. Checklist pré-produção

Antes do primeiro deploy:

- RLS ativo
- Stripe testado
- webhook funcionando
- grants funcionando
- login funcionando
- storage protegido
- admin funcional
- logs ativos

---

## 18. Checklist pós-deploy

Após deploy:

- testar compra real (modo test primeiro)
- testar acesso ao conteúdo
- testar download
- testar suporte
- testar admin
- validar analytics
- validar notificações

---

## 19. Critérios de aceite

O deploy será considerado adequado quando:

- frontend estiver acessível
- backend responder corretamente
- banco consistente
- pagamentos funcionando
- grants funcionando
- arquivos protegidos
- admin funcional
- logs disponíveis

---

## 20. Riscos

### Técnicos

- deploy fora de ordem
- migration quebrando produção
- webhook não configurado
- variável de ambiente incorreta
- função desatualizada

---

### Operacionais

- admin não criado
- pagamento funcionando sem grant
- acesso liberado indevidamente
- ambiente misturado (test/prod)

---

## 21. Observações finais

- deploy é parte crítica do sistema
- nunca tratar deploy como etapa simples
- sempre validar ambiente antes de liberar
- produção deve ser previsível e controlada