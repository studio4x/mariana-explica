# PWA Spec Exata - Mariana Explica

Este arquivo documenta a estrutura e as configuracoes reais do PWA atualmente implementado neste projeto.

Use este spec como base para replicar a mesma abordagem em outro projeto, alterando apenas marca, cores, nomes de arquivos e ativos visuais quando necessario.

## 1. Objetivo

O PWA desta base foi montado para:

- permitir instalacao na tela inicial
- funcionar como app standalone no mobile
- registrar um service worker simples e previsivel
- oferecer fallback offline basico
- mostrar prompt de instalacao nativo quando disponivel
- limpar cache antigo quando a versao de runtime muda

Nao existe, neste estado atual, um sistema avancado de push notifications, meta tags dinamicas ou manifesto gerado em runtime.

O favicon do navegador e uma excecao: ele e aplicado em runtime a partir do asset `favicon` publicado em `site_config`.

## 2. Estrutura de arquivos

Arquivos que compoem o PWA nesta base:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/offline.html`
- `public/favicon.svg`
- `public/icon-app.svg`
- `public/icon-maskable.svg`
- `public/icons.svg`
- `src/main.tsx`
- `src/components/common/InstallPrompt.tsx`
- `index.html`

## 3. Manifest

### 3.1 Localizacao

- arquivo: `public/manifest.webmanifest`
- link no HTML: `<link rel="manifest" href="/manifest.webmanifest" />`

### 3.2 Conteudo exato

```json
{
  "id": "/",
  "name": "Mariana Explica",
  "short_name": "Mariana",
  "description": "Plataforma de venda e entrega de conteúdos educacionais digitais.",
  "lang": "pt-PT",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#242742",
  "background_color": "#f8fbfd",
  "icons": [
    {
      "src": "/favicon",
      "sizes": "512x512",
      "purpose": "any"
    },
    {
      "src": "/favicon",
      "sizes": "512x512",
      "purpose": "maskable"
    }
  ]
}
```

### 3.3 Configuracoes usadas

- `id`: `/`
- `name`: `Mariana Explica`
- `short_name`: `Mariana`
- `description`: `Plataforma de venda e entrega de conteúdos educacionais digitais.`
- `lang`: `pt-PT`
- `start_url`: `/`
- `scope`: `/`
- `display`: `standalone`
- `orientation`: `portrait`
- `theme_color`: `#242742`
- `background_color`: `#f8fbfd`

### 3.4 Icons

O manifesto usa o favicon canonico e dinamico configurado no painel:

- `/favicon` com `purpose: any`
- `/favicon` com `purpose: maskable`

O asset publicado deve ser quadrado e ter 512x512 px. O formato real e informado pela resposta HTTP.

## 4. HTML principal

### 4.1 Arquivo

- `index.html`

### 4.2 Tags PWA presentes

```html
<meta name="theme-color" content="#242742" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Mariana" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="description" content="Plataforma de venda e entrega de conteúdos educacionais digitais." />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" sizes="512x512" href="/favicon" />
<link rel="apple-touch-icon" sizes="512x512" href="/favicon" />
```

### 4.3 O que nao existe neste HTML

- nao ha `meta` para Open Graph
- nao ha `meta` para Twitter Cards
- nao ha splash screens iOS dedicadas
- nao ha favicon estatico: `/favicon` serve o asset configurado em `site_config`

### 4.4 Favicon dinamico

- fonte: `fetchPublicBrandingConfig()` em `site_config`
- campo: `config_value.favicon.public_url`
- aplicacao: `src/components/common/SiteBrandingManager.tsx`
- URL canonica e estavel: `/favicon`
- o builder LMS monta o mesmo manager no seu layout proprio
- quando nao ha asset configurado, os links de favicon sao removidos e nenhum fallback e recriado

## 5. Service Worker

### 5.1 Localizacao

- arquivo: `public/sw.js`
- registro: `src/main.tsx`

### 5.2 Versao de cache

```js
const CACHE_VERSION = "mariana-explica-pwa-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
```

### 5.3 URLs pre-cacheadas

```js
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
];
```

### 5.4 Install

- abre `SHELL_CACHE`
- faz `cache.addAll(PRECACHE_URLS)`
- chama `self.skipWaiting()`

### 5.5 Activate

- remove caches antigos que nao sejam `SHELL_CACHE` ou `RUNTIME_CACHE`
- chama `self.clients.claim()`

### 5.6 Fetch

Regras reais do service worker:

- ignora requests que nao sao `GET`
- para navegacao (`request.mode === "navigate"`):
  - tenta rede primeiro
  - se responder, grava a pagina em `RUNTIME_CACHE`
  - se falhar, tenta cache da request
  - se nao houver cache, cai em `"/offline.html"`
- para outros recursos:
  - tenta `caches.match(request)` primeiro
  - em paralelo tenta `fetch(request)`
  - se a rede responder com `response.ok` e o request for same-origin, grava em `RUNTIME_CACHE`
  - se a rede falhar, devolve o cache existente

### 5.7 Snippet exato

```js
const CACHE_VERSION = "mariana-explica-pwa-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
];
```

## 6. Registro do service worker

### 6.1 Arquivo

- `src/main.tsx`

### 6.2 Comportamento real

- o service worker so e registrado quando `window.load` dispara
- o registro usa `"/sw.js"`
- erros sao tratados com `console.warn`

### 6.3 Snippet exato

```ts
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[PWA] Falha ao registrar service worker:", error)
    })
  })
}
```

## 7. Limpeza por versao

### 7.1 Arquivo

- `src/main.tsx`

### 7.2 Chave de versao

```ts
const APP_RUNTIME_VERSION = BUILD_VERSION
```

### 7.3 O que a limpeza faz

Quando a versao atual e diferente da armazenada em `localStorage`, o app:

- tenta desregistrar todos os service workers
- tenta limpar todos os caches do browser
- grava a nova versao em `localStorage`

### 7.4 Key usada

- `mariana-explica:runtime-version`

### 7.5 Snippet exato

```ts
const previousVersion = window.localStorage.getItem("mariana-explica:runtime-version")
if (previousVersion === APP_RUNTIME_VERSION) {
  return
}
```

## 8. Prompt de instalacao

### 8.1 Arquivo

- `src/components/common/InstallPrompt.tsx`

### 8.2 Comportamento

- escuta `beforeinstallprompt`
- impede o comportamento padrao do browser
- guarda o evento em estado local
- escuta `appinstalled`
- quando instalado, limpa o prompt
- se nao houver evento, retorna `null`

### 8.3 UI

O prompt aparece como botao fixo no canto inferior direito com:

- icone `Download`
- texto `Instalar app`

### 8.4 Snippet exato

```ts
window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
window.addEventListener("appinstalled", onInstalled)
```

## 9. Offline page

### 9.1 Arquivo

- `public/offline.html`

### 9.2 Papel

Essa pagina e o fallback final quando:

- a navegacao falha
- nao existe cache da pagina solicitada
- o browser esta sem conectividade

### 9.3 Conteudo visual

- HTML simples e estatico
- titulo: `Offline | Mariana Explica`
- layout centralizado
- fundo em gradiente claro
- card com borda, sombra e raio grande
- linguagem `pt-PT`

### 9.4 Mensagem usada

> A plataforma continua protegida mesmo em modo offline. Assim que a ligação voltar, recarregue a página para retomar o acesso ao catálogo, ao dashboard e aos conteúdos.

## 10. Assets PWA

### 10.1 Arquivos existentes

- `favicon.svg`
- `icon-app.svg`
- `icon-maskable.svg`
- `icons.svg`

### 10.2 Observacao

O favicon e os icones declarados pelo manifesto usam `/favicon`, que reflete o asset publicado no painel administrativo.
Os arquivos SVG e PNG locais permanecem apenas como assets legados e nao sao a fonte visual ativa.

## 11. Estrutura recomendada para replicacao

Se for copiar a mesma base para outro projeto, replique esta estrutura:

```txt
public/
  favicon.svg
  icon-app.svg
  icon-maskable.svg
  manifest.webmanifest
  offline.html
  sw.js
src/
  components/common/InstallPrompt.tsx
  main.tsx
index.html
```

## 12. Sequencia de implementacao

Para criar o mesmo PWA em outro projeto, siga esta ordem:

1. criar `public/manifest.webmanifest`
2. adicionar meta tags no `index.html`
3. criar `public/sw.js`
4. registrar o service worker no `src/main.tsx`
5. adicionar limpeza por versao
6. criar `public/offline.html`
7. adicionar prompt de instalacao
8. validar build e comportamento offline

## 13. Pontos de atencao

- o service worker nao cacheia POST
- o service worker nao tenta proteger ou armazenar URLs assinadas
- o manifest usa o favicon dinamico publicado no painel
- a install experience depende do browser disparar `beforeinstallprompt`
- a pagina offline e basica e propositalmente simples

## 14. Resumo rapido

Configuracao atual exata:

- app name: `Mariana Explica`
- short name: `Mariana`
- lang: `pt-PT`
- display: `standalone`
- orientation: `portrait`
- theme color: `#242742`
- background color: `#f8fbfd`
- cache version: `mariana-explica-pwa-v2`
- precache: `/`, `/offline.html`, `/manifest.webmanifest`
- favicon: asset `favicon` de `site_config`, servido pela URL canonica `/favicon`
- icon path do manifesto: `/favicon`
- runtime cleanup key: `mariana-explica:runtime-version`
