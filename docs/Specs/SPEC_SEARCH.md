# ESPECIFICAÇÕES - BUSCA AVANÇADA

## Visão Geral

Sistema de **Busca Avançada** implementa full-text search, filtros multidimensionais, faceted search, autocomplete e ranking por relevância. Essencial em marketplaces, e-commerce e plataformas com grande volume de dados.

---

## 1. TIPOS DE BUSCA

### Full-Text Search

```
Busca: "enfermeiro são paulo cuidador mais barato"
Resultados: Profissionais que mencionam essas palavras
Ranking: Por relevância (TF-IDF ou BM25)
```

### Faceted Search (Filtros)

```
Especialidade: [Enfermeiro] [Fisioterapeuta] [Médico]
Disponibilidade: [Manhã] [Tarde] [Noite]
Avaliação: ⭐ 4+ | ⭐ 3+
Preço: R$ 0 - 500
Localização: Raio 10km
```

### Autocomplete

```
Digitado: "enfer"
Sugestões aparecem:
1. Enfermeiro
2. Enfermeira
3. Enfermagem
```

### Search-as-you-type

```
Usuário digita: "med"
Resultados atualizam em real-time
Mostram: Médicos, Medicamentos, etc
```

---

## 2. TECNOLOGIA BASE

### PostgreSQL Full-Text Search

```sql
-- Ativar extensão
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice de texto completo
ALTER TABLE profiles 
ADD COLUMN search_vector tsvector;

CREATE TRIGGER profiles_search_update 
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.portuguese', full_name, bio);

CREATE INDEX idx_profiles_search ON profiles USING GIN (search_vector);
```

### Elasticsearch (Alternativa para Scale)

```json
{
  "mappings": {
    "properties": {
      "full_name": { "type": "text", "analyzer": "portuguese" },
      "bio": { "type": "text" },
      "specialties": { "type": "keyword" },
      "location": { "type": "geo_point" },
      "rating": { "type": "float" }
    }
  }
}
```

---

## 3. TABELAS AUXILIARES

### `search_queries` (Analytics)

```sql
id UUID PRIMARY KEY
query_text VARCHAR
result_count INTEGER
clicked_result_id UUID (se clicado)
user_id UUID
created_at TIMESTAMP
```

### `search_filters_log`

```sql
id UUID PRIMARY KEY
query_id UUID
filter_type VARCHAR -- 'specialty', 'location', 'rating'
filter_value VARCHAR
created_at TIMESTAMP
```

---

## 4. COMPONENTES FRONTEND

### SearchBar com Autocomplete

**Localização**: `src/components/SearchBar.tsx`

```typescript
<SearchBar
  placeholder="Buscar professionais..."
  onSearch={handleSearch}
  onAutocomplete={handleAutoComplete}
  suggestions={suggestions}
/>
```

**Features**:
- ✅ Debounce de 300ms
- ✅ Suggestions dropdown
- ✅ Clear button
- ✅ Recent searches
- ✅ Popular searches

### SearchFilters

**Localização**: `src/components/SearchFilters.tsx`

```typescript
<SearchFilters
  filters={activeFilters}
  onFilterChange={handleFilter}
  options={filterOptions}
/>
```

**Componentes**:
- ✅ Multi-select checkboxes (especialidade)
- ✅ Range slider (preço, distância)
- ✅ Single select (ordenação)
- ✅ Rating filter (stars)
- ✅ Location (distance picker)

### SearchResults

**Localização**: `src/components/SearchResults.tsx`

```typescript
<SearchResults
  results={results}
  total={total}
  page={page}
  onPageChange={setPage}
  loading={loading}
/>
```

**Features**:
- ✅ Lazy loading / paginação
- ✅ Ordenação: Relevância, Preço, Rating
- ✅ Resultado count ("1-20 de 342")
- ✅ No results state

### ResultCard

```typescript
<ResultCard result={professional} />
```

**Exibe**:
- Avatar
- Nome + especialidade
- Rating + reviews count
- Preço/disponibilidade
- "Consultar" button

---

## 5. ALGORITMO DE RELEVÂNCIA

### Scoring

```
score = (
  relevance_score * 0.40 +      // Match TF-IDF
  popularity_score * 0.20 +      // Reviews + visits
  recency_score * 0.15 +         // Ativo recentemente?
  rating_score * 0.15 +          // ⭐ avaliação
  distance_score * 0.10          // Proximidade
)
```

### Query Parsing

```
Input: "enfermeiro são paulo 50km barato"

Parsed:
  - Query: "enfermeiro"
  - Location: "são paulo"
  - Distance: "50km"
  - Price: "baixo" (barato)
```

---

## 6. IMPLEMENTAÇÃO SQL

### Simples (PostgreSQL)

```sql
SELECT *, 
  ts_rank(search_vector, query) as rank
FROM profiles
WHERE search_vector @@ plainto_tsquery('portuguese', $1)
  AND state = $2
  AND specialties @> $3::jsonb
ORDER BY rank DESC
LIMIT 20 OFFSET $4;
```

### Com Filtros

```sql
SELECT *
FROM profiles
WHERE 
  search_vector @@ plainto_tsquery('portuguese', $1)
  AND ($2::text[] IS NULL OR specialties @> $2::jsonb)
  AND ($3::int IS NULL OR rating >= $3)
  AND ($4::numeric IS NULL OR price <= $4)
  AND (
    $5::text IS NULL OR 
    earth_distance(
      ll_to_earth($6, $7),
      ll_to_earth(latitude, longitude)
    ) < ($5::numeric * 1000) -- convert km to meters
  )
ORDER BY ts_rank(search_vector, query) DESC
LIMIT 20;
```

---

## 7. EDGE FUNCTIONS

### `search-professionals`
```
GET /functions/v1/search-professionals?
  q=enfermeiro&
  specialty=enfermagem&
  state=SP&
  city=São%20Paulo&
  distance_km=10&
  min_rating=4&
  max_price=500&
  sort=relevance&
  page=1&
  limit=20
  
Response: {
  results: [],
  total: 342,
  page: 1,
  pages: 18,
  facets: {
    specialties: [...],
    states: [...],
    rating_distribution: {...}
  }
}
```

### `search-autocomplete`
```
GET /functions/v1/search-autocomplete?q=enf

Response: {
  suggestions: [
    "enfermeiro",
    "enfermeira",
    "técnico de enfermagem"
  ]
}
```

### `search-analytics`
```
POST /functions/v1/search-analytics
Auth: Bearer token
Body: {
  query_text: "enfermeiro",
  clicked_result_id?: "...",
  filters: {...}
}
Response: { success }
```

---

## 8. INTERFACE DE BUSCA

### Layout Desktop

```
┌─────────────────────────────────────────┐
│ [SearchBar: "enfermeiro sp"] [🔍]       │
├──────────────────┬──────────────────────┤
│   FILTROS        │   RESULTADOS         │
│                  │                      │
│ □ Enfermeiro    │ Result 1: ...         │
│ □ Técnico       │ Result 2: ...         │
│ □ Cuidador      │ Result 3: ...         │
│                  │                      │
│ ⭐ Rating       │ [Next] [Prev]         │
│ ⭐ 4+           │                      │
│                  │ 1-20 de 342          │
│ Preço           │                      │
│ R$ [0]--[500]   │                      │
│                  │                      │
│ Distância       │                      │
│ [10km]          │                      │
└──────────────────┴──────────────────────┘
```

### Layout Mobile

```
┌──────────────────────┐
│ [Search] [filters]   │
├──────────────────────┤
│  Result 1            │
│  Result 2            │
│  Result 3            │
├──────────────────────┤
│ [Refine Search]      │
└──────────────────────┘
```

---

## 9. PERFORMANCE

### Caching

```typescript
// Cache de autocomplete (30 min)
const suggestions = await redis.get(`autocomplete:${query}`);
if (!suggestions) {
  suggestions = await search(query);
  redis.setex(`autocomplete:${query}`, 1800, suggestions);
}
```

### Indexação

```sql
-- Rebuild search index diariamente
REFRESH MATERIALIZED VIEW search_index;
```

### Query Optimization

```sql
-- Explain plan antes de deploy
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM profiles
WHERE search_vector @@ ...
```

---

## 10. FILTROS DISPONÍVEIS

### Por Tipo de Negócio

**Marketplace de Profissionais**:
- Especialidade
- Localização (raio)
- Avaliação
- Disponibilidade
- Preço/hora

**E-commerce**:
- Categoria
- Preço (range)
- Marca
- Rating
- Em estoque

**Plataforma de Cursos**:
- Categoria
- Nível (iniciante/avançado)
- Duração
- Preço
- Idioma

---

## 11. SEO & DISCOVERY

### Meta Tags Dinâmicas

```html
<title>Enfermeiros em São Paulo - HomeCare Match</title>
<meta name="description" content="Encontre 342 enfermeiros qualificados em São Paulo...">
<meta property="og:url" content="/buscar?q=enfermeiro&state=SP">
```

### Sitemap Gerado Dinamicamente

```xml
<url>
  <loc>https://app.com/buscar?q=enfermeiro&state=SP</loc>
  <changefreq>daily</changefreq>
  <priority>0.8</priority>
</url>
```

---

## 12. ANALYTICS

### Dashboard Admin

```
Queries Populares (últimos 30 dias):
1. "enfermeiro são paulo" (342 buscas)
2. "fisioterapeuta" (284 buscas)
3. "cuidador idosos" (201 buscas)

Click-through Rate: 18%
Avg Results: 156
Bounce Rate: 5%
```

---

## 13. ROADMAP

- [ ] Busca por voz
- [ ] Busca por imagem
- [ ] AI-powered suggestions
- [ ] "Did you mean?" (fuzzy matching)
- [ ] Trending searches
- [ ] Saved searches (per user)
- [ ] Search history timeline

---

## 14. CHECKLIST DE IMPLEMENTAÇÃO

- [x] PostgreSQL full-text search configurado
- [x] SearchBar component com autocomplete
- [x] SearchFilters component
- [x] SearchResults component
- [x] Algoritmo de ranking
- [x] Página `/buscar`
- [x] Edge functions
- [x] Analytics tracking
- [x] Performance optimization
- [x] Mobile responsiveness
- [x] SEO integration

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção
