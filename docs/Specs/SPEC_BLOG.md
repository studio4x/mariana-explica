# ESPECIFICAÇÕES - BLOG E CONTEÚDO

## Visão Geral

Sistema de **Blog e CMS** implementa artigos com categorias, tags, SEO, autor, versionamento, comentários modulados e reutilizável em qualquer plataforma que necessite content management.

---

## 1. CONCEITOS PRINCIPAIS

### Hierarquia de Conteúdo

```
Blog (raiz)
├── Categorias (máx 50)
│   ├── Saúde
│   ├── Home Care
│   └── Legislação
└── Artigos
    ├── Metadados (SEO, autor)
    ├── Conteúdo (Rich text)
    ├── Tags
    ├── Comentários (modulados)
    └── Histórico (versions)
```

---

## 2. TABELAS DE BANCO DE DADOS

### `blog_categories`

```sql
id UUID PRIMARY KEY
name VARCHAR (100)
slug VARCHAR UNIQUE -- "saude-home-care"
description TEXT
icon_url TEXT -- URL do ícone
color_hex VARCHAR(7) -- "#FF5733"
display_order INTEGER
is_active BOOLEAN DEFAULT true
seo_title VARCHAR(60)
seo_description VARCHAR(160)
created_at TIMESTAMP
updated_at TIMESTAMP
```

### `blog_articles`

```sql
id UUID PRIMARY KEY
title VARCHAR (255)
slug VARCHAR UNIQUE -- URL: /blog/artigo/meu-artigo
content TEXT -- HTML rich text (sanitizado)
excerpt VARCHAR(300) -- Resumo para preview
author_id UUID (FK profiles.id)

-- SEO
seo_title VARCHAR(60)
seo_description VARCHAR(160)
seo_keywords VARCHAR(255)
og_image_url TEXT

-- Categorização
category_id UUID (FK blog_categories.id)
tags JSONB -- Array de strings

-- Status & Publicação
status ENUM: 'draft'|'scheduled'|'published'|'archived'
published_at TIMESTAMP
scheduled_publish_at TIMESTAMP

-- Media
cover_image_url TEXT

-- Engajamento
view_count INTEGER DEFAULT 0
like_count INTEGER DEFAULT 0

-- Metadata
reading_time_minutes INTEGER -- Auto-calc
word_count INTEGER -- Auto-calc

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `blog_article_versions`

```sql
id UUID PRIMARY KEY
article_id UUID (FK blog_articles.id)
version_number INTEGER
title VARCHAR
content TEXT
changed_by UUID (FK profiles.id)
change_reason VARCHAR
created_at TIMESTAMP
```

### `blog_comments`

```sql
id UUID PRIMARY KEY
article_id UUID (FK blog_articles.id)
author_id UUID (FK profiles.id)
content TEXT (3000 chars)
is_approved BOOLEAN DEFAULT false
is_moderated BOOLEAN DEFAULT false
moderation_reason VARCHAR (se rejeitado)

-- Replies
parent_comment_id UUID (FK blog_comments.id, se reply)

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `blog_likes`

```sql
id UUID PRIMARY KEY
article_id UUID (FK blog_articles.id)
user_id UUID (FK profiles.id)
created_at TIMESTAMP
UNIQUE(article_id, user_id)
```

---

## 3. PÁGINAS FRONTEND

### `/blog` - Blog Listing

**Arquivo**: `src/pages/Blog.tsx`

**Features**:
- ✅ Grid/List de artigos recentes
- ✅ Filtro por categoria
- ✅ Cards com cover image, título, excerpt, author, date
- ✅ "Leia mais" link para artigo
- ✅ Paginação ou infinite scroll
- ✅ Featured article (banner topo)

**Layout**:
```
┌─────────────────────────────────────────┐
│ FEATURED: "Novo protocolo de Home Care" │
├─────────────────┬──────────┬────────────┤
│ Article 1       │ Article 2 │ Article 3  │
│ [Cover]         │ [Cover]  │ [Cover]    │
│ Title           │ Title    │ Title      │
│ Excerpt...      │ Excerpt..│ Excerpt... │
│ [Leia mais]     │ [Leia...]│ [Leia...]  │
├────────────────────────────────────────┤
│ [1] [2] [3] [4] [Próx]                 │
└────────────────────────────────────────┘
```

### `/blog/artigo/:slug` - Article Detail

**Arquivo**: `src/pages/BlogArticle.tsx`

**Seções**:
1. **Header**
   - Cover image (full-width)
   - Título + subtitle
   - Author (avatar, name, role)
   - Published date + reading time
   - Badges: Category, tags
   - Share buttons

2. **Content**
   - Rich text (HTML renderizado)
   - Embedded media (images, videos)
   - Table of contents (auto-gerado)

3. **Engagement**
   - Like button (♥)
   - Share buttons (Facebook, Twitter, LinkedIn, WhatsApp)
   - Copy link

4. **Comments**
   - Form para novo comentário
   - Lista de comentários aprovados (tree)
   - Reply to comment

5. **Related Articles**
   - 3 artigos similares (mesma categoria)

### `/blog/categoria/:slug` - Category Archive

**Arquivo**: `src/pages/BlogCategories.tsx`

- ✅ Artigos da categoria
- ✅ Breadcrumb
- ✅ Descrição da categoria
- ✅ Paginação

### `/blog/tag/:slug` - Tag Archive

**Arquivo**: `src/pages/BlogTags.tsx`

- ✅ Artigos com tag
- ✅ Nuvem de tags (sidebar)

### `/blog/buscar` - Search

**Arquivo**: `src/pages/BlogSearch.tsx`

- ✅ Full-text search em artigos
- ✅ Resultados com relevância
- ✅ Filtro por categoria
- ✅ Sugestões (autocomplete)

---

## 4. ADMIN INTERFACE

### `/admin/blog` - Blog Management

**Arquivo**: `src/pages/admin/BlogPage.tsx`
**Componente**: `src/components/admin/BlogTab.tsx`

### Features

#### 1. Dashboard
- Total artigos (draft, published, archived)
- Views este mês
- Articles com mais engagement
- Autores mais ativos

#### 2. Gerenciar Artigos

**Listar**:
```
Title | Category | Status | Author | Published | Views | Actions
────────────────────────────────────────────────────────────────
Novo protocolo | Saúde | Published | João | 2026-04-10 | 1.234 | ...
Dicas... | Home Care | Draft | Maria | — | — | ...
```

**Criar/Editar**:
- ✅ Title input (com slug auto-gerado)
- ✅ Category select
- ✅ Rich text editor (TipTap)
- ✅ Excerpt (auto-calc ou manual)
- ✅ Cover image upload (com cropper)
- ✅ Tags input (autocomplete)
- ✅ SEO fields (title, description, keywords)
- ✅ Status (draft, scheduled, published)
- ✅ Scheduled publish (date picker)
- ✅ Published date widget

**Operações**:
- Save draft
- Preview
- Publish
- Unpublish
- Schedule publish
- Delete

#### 3. Categorias

- ✅ CRUD de categorias
- ✅ Reordenar (drag-and-drop)
- ✅ Activar/desactivar
- ✅ SEO por categoria

#### 4. Comentários

**Moderação**:
- ✅ Fila de comentários pendentes
- ✅ Preview do comentário
- ✅ Approve/Reject (com motivo)
- ✅ Bulk actions
- ✅ Filter por artigo

#### 5. Analytics

```
Top Articles (últimos 30 dias):
1. "Novo protocolo" - 1.234 views
2. "Dicas de segurança" - 987 views

Engagement:
- Avg views/article: 456
- Liked articles: 45%
- Comments/article: 2.3

Traffic by source:
- Organic: 65%
- Direct: 25%
- Referral: 10%
```

---

## 5. EDITOR RICH TEXT

### Localização
**Componente**: `src/components/admin/BlogRichTextEditor.tsx`

**Powered by**: TipTap

**Toolbar Features**:
- ✅ Heading (H1, H2, H3)
- ✅ Bold, Italic, Underline, Strikethrough
- ✅ Lists (ordered, unordered)
- ✅ Links (com preview)
- ✅ Code blocks (syntax highlight)
- ✅ Blockquotes
- ✅ Dividers
- ✅ Images (upload ou URL)
- ✅ Videos (embed URL)
- ✅ Tables
- ✅ Undo/Redo
- ✅ Clear formatting

**Output**: HTML sanitizado (DOMPurify)

---

## 6. COMPONENTES

### BlogPostCard

```typescript
<BlogPostCard
  post={article}
  showExcerpt={true}
  showCategory={true}
/>
```

**Exibe**:
- Cover image
- Category badge
- Title
- Excerpt
- Author (avatar + name)
- Date + reading time
- Link

### BlogCommentForm

```typescript
<BlogCommentForm
  articleId={id}
  onSubmit={(comment) => {...}}
/>
```

**Fields**:
- Name (se não autenticado)
- Email (se não autenticado)
- Textarea para comentário
- Submit button

### BlogCommentTree

```typescript
<BlogCommentTree
  comments={comments}
  onReply={(parentId) => {...}}
  onModerationAction={handleModeration}
/>
```

**Features**:
- ✅ Mostrar replies aninhadas
- ✅ Reply button
- ✅ Delete comment (próprio)
- ✅ Admin: Approve/Reject

---

## 7. SEO OPTIMIZATION

### Meta Tags Dinâmicas

```jsx
<SeoMeta
  title={article.seo_title}
  description={article.seo_description}
  image={article.og_image_url}
  url={`/blog/artigo/${article.slug}`}
  keywords={article.seo_keywords}
/>
```

### Schema.org Markup

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Novo protocolo de Home Care",
  "image": "...",
  "datePublished": "2026-04-10",
  "author": {
    "@type": "Person",
    "name": "João Silva"
  },
  "description": "..."
}
```

### Sitemap

```xml
<url>
  <loc>https://app.com/blog/artigo/novo-protocolo</loc>
  <lastmod>2026-04-10</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

---

## 8. FLUXO DE PUBLICAÇÃO

### Rascunho → Publicado

```
1. Admin clica "Novo artigo"
   ↓
2. Preenche título, conteúdo, categorias
   ↓
3. Salva como "Draft"
   ↓
4. Admin revisa e clica "Publicar"
   ↓
5. Se scheduled: Define data/hora
   ↓
6. Artigo fica public
   ↓
7. Notificação email para subscribers (opcional)
```

---

## 9. EDGE FUNCTIONS

### `publish-article`
```
POST /functions/v1/publish-article
Auth: Bearer token (admin)
Body: { article_id }
Response: { success, published_at, url }
```

### `generate-article-summary`
```
POST /functions/v1/generate-article-summary
Auth: Bearer token (admin)
Body: { article_id }
Response: { excerpt, reading_time }
```

### `generate-article-cover`
```
POST /functions/v1/generate-article-cover
Auth: Bearer token (admin)
Body: { title, category }
Response: { cover_image_url }
```

---

## 10. EMAIL TEMPLATES

### Template: Novo Artigo Publicado

```
Assunto: Novo artigo no nosso blog
Corpo:
- Título + cover image
- Excerpt
- Autor
- "Ler artigo" CTA
- Link para inscrever em newsletter
```

---

## 11. INTEGRAÇÃO COM NEWSLETTER

- ✅ Botão "Inscrever em newsletter"
- ✅ Artigos mais recentes no email
- ✅ Frequency: Semanal ou diária

---

## 12. PERFORMANCE

### Caching

```
- Homepage blog: Cache 1h
- Articl page: Cache até ser editado
- Search results: Cache 30min
```

### Índices

```sql
CREATE INDEX idx_articles_slug ON blog_articles(slug);
CREATE INDEX idx_articles_category ON blog_articles(category_id);
CREATE INDEX idx_articles_published ON blog_articles(published_at DESC);
CREATE INDEX idx_articles_search ON blog_articles USING GIN (search_vector);
```

---

## 13. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas de banco de dados criadas
- [x] `/blog` página
- [x] `/blog/artigo/:slug` página
- [x] Admin `/admin/blog` interface
- [x] BlogTab com CRUD completo
- [x] Rich text editor (TipTap)
- [x] Categorias & Tags
- [x] Comments (with moderation)
- [x] SEO meta tags & schema
- [x] Email templates
- [x] Analytics dashboard
- [x] Performance optimization

---

## 14. ROADMAP

- [ ] AI-powered article suggestions
- [ ] Multi-language support
- [ ] Scheduling calendar view
- [ ] Collaboration (co-authoring)
- [ ] Article versioning UI
- [ ] Comments notifications
- [ ] Related articles ML
- [ ] Social share counters

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção
