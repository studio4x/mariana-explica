# Mariana Explica

Plataforma de venda e entrega de conteudos educacionais digitais, com:

- area publica comercial;
- area autenticada do aluno;
- painel administrativo;
- backend serverless;
- PostgreSQL com RLS;
- Supabase Auth e Storage;
- Stripe;
- PWA;
- deploy em Vercel + Supabase.

## Stack

- React + TypeScript + Vite
- React Router
- TanStack React Query
- Tailwind CSS + shadcn/ui + Radix UI
- Supabase (DB, Auth, Storage, Edge Functions)
- Stripe
- Vercel

## Fonte canonica

A documentacao oficial do produto esta em `docs/`.

Prioridade de leitura:

1. `docs/02-regras-negocio.md`
2. `docs/03-arquitetura.md`
3. `docs/10-autenticacao-seguranca.md`
4. `docs/04-banco-dados.md`
5. `docs/05-backend-edge-functions.md`
6. `docs/15-plano-de-implementacao.md`

`docs/Specs/` e material auxiliar. Em conflito, prevalecem os documentos canonicos acima.

## Setup local

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variaveis:

- criar/ajustar `.env.local` com credenciais de ambiente;
- nunca versionar tokens e segredos.

3. Rodar ambiente local:

```bash
npm run dev
```

4. Validar build:

```bash
npm run build
```

## Politica obrigatoria de entrega

Para cada novo ajuste aprovado neste repositorio:

1. executar validacao tecnica local (no minimo `npm run build`);
2. gerar commit da alteracao;
3. publicar no remoto (`git push`);
4. garantir deploy em producao na Vercel;
5. validar producao antes de encerrar.

### Checklist de validacao de deploy (obrigatorio)

Antes de concluir qualquer entrega:

- deploy de producao com status `READY`;
- dominio canonico (`https://www.mariana-explica.pt`) apontando para a revisao mais recente;
- SHA ativo em producao igual ao commit publicado;
- alias de producao nao preso em revisao antiga.

## Operacao de deploy

O fluxo padrao e CI na Vercel apos push para branch de release.

Comandos uteis de verificacao:

```bash
npx vercel ls --token <TOKEN>
npx vercel inspect <deployment-url-ou-id> --token <TOKEN>
```

Quando necessario, consultar a API da Vercel para confirmar `readyState`, `target`, `githubCommitSha` e `aliasAssigned`.

## Seguranca e regras criticas

- nunca expor `service_role` no frontend;
- nunca confiar no frontend para autorizacao final;
- toda alteracao estrutural de banco deve ser migration SQL versionada;
- `access_grants` e a fonte real de autorizacao ao conteudo.

## Observacao

As regras operacionais detalhadas para agentes e automacoes estao em [AGENTS.md](AGENTS.md).
