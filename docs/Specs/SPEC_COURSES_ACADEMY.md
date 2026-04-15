# ESPECIFICAÇÕES - CURSOS E ACADEMY

## Visão Geral

Sistema de **Cursos e Academy** implementa plataforma de educação continuada com módulos, aulas, progresso auto-salvável, certificados automáticos e integração com algoritmo de busca. Reutilizável em plataformas de e-learning, treinamento corporativo e capacitação profissional.

---

## 1. CONCEITO

### Propósito
- **Capacitação técnica** de profissionais da saúde
- **Melhoria de ranking** em busca (Academy é métrica forte)
- **Certificação** profissional comprovável
- **Engajamento** e retenção de usuários
- **Diferencial competitivo** para planos pagos

### Acesso por Plano

| Plano | Acesso | Cursos | Certificados |
|-------|--------|--------|--------------|
| Free | ❌ | - | - |
| Monthly | ✅ | Limitado | ✅ |
| Yearly | ✅ | Todos | ✅ |

---

## 2. TABELAS DE BANCO DE DADOS

### `academy_courses`

```sql
id UUID PRIMARY KEY
slug VARCHAR UNIQUE -- "curso-basico-enfermagem"
title VARCHAR (200)
description TEXT
level ENUM: 'iniciante'|'intermediario'|'avancado'
duration_minutes INTEGER
category_id UUID (FK academy_categories.id)
instructor_id UUID (FK profiles.id)

-- Conteúdo
cover_image_url TEXT
overview_text TEXT

-- Pricing
price NUMERIC DEFAULT 0
free_tier BOOLEAN DEFAULT false

-- Video
video_source ENUM: 'url'|'storage'
video_url TEXT -- Se source = 'url'
video_storage_path TEXT -- Se source = 'storage'
video_mime TEXT

-- Status
is_active BOOLEAN DEFAULT true
published_at TIMESTAMP
updated_at TIMESTAMP
created_at TIMESTAMP
```

### `academy_modules`

```sql
id UUID PRIMARY KEY
course_slug VARCHAR (FK academy_courses.slug) ON DELETE CASCADE
title VARCHAR (200)
description TEXT
position INTEGER -- Ordem no curso
is_optional BOOLEAN DEFAULT false
prerequisite_module_id UUID -- Módulo anterior

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `academy_lessons`

```sql
id UUID PRIMARY KEY
module_id UUID (FK academy_modules.id) ON DELETE CASCADE
title VARCHAR (200)
description TEXT
content TEXT -- Rich content (HTML)
video_url TEXT
position INTEGER -- Ordem no módulo
duration_minutes INTEGER
requires_quiz BOOLEAN DEFAULT true
quiz_passing_score INTEGER DEFAULT 70

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `academy_user_progress`

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id) ON DELETE CASCADE
course_slug VARCHAR (FK academy_courses.slug) ON DELETE CASCADE
lesson_id UUID (FK academy_lessons.id) ON DELETE CASCADE

-- Status
is_completed BOOLEAN DEFAULT false
last_accessed_at TIMESTAMP
time_spent_seconds INTEGER DEFAULT 0

created_at TIMESTAMP
updated_at TIMESTAMP

-- Indices
UNIQUE(user_id, course_slug, lesson_id)
```

### `academy_course_completion`

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id) ON DELETE CASCADE
course_slug VARCHAR (FK academy_courses.slug) ON DELETE CASCADE
completion_percentage INTEGER -- 0-100%
completed_at TIMESTAMP
certificate_id UUID (FK certificates.id, if issued)

created_at TIMESTAMP
updated_at TIMESTAMP

UNIQUE(user_id, course_slug)
```

### `academy_quizzes`

```sql
id UUID PRIMARY KEY
lesson_id UUID (FK academy_lessons.id) ON DELETE CASCADE
title VARCHAR
description TEXT
passing_score INTEGER DEFAULT 70
time_limit_minutes INTEGER

created_at TIMESTAMP
```

### `academy_quiz_questions`

```sql
id UUID PRIMARY KEY
quiz_id UUID (FK academy_quizzes.id) ON DELETE CASCADE
question_text TEXT
question_type ENUM: 'multiple_choice'|'true_false'|'short_answer'
position INTEGER
points_value INTEGER DEFAULT 1

created_at TIMESTAMP
```

### `academy_quiz_answers`

```sql
id UUID PRIMARY KEY
question_id UUID (FK academy_quiz_questions.id) ON DELETE CASCADE
answer_text TEXT
is_correct BOOLEAN
position INTEGER

created_at TIMESTAMP
```

### `academy_user_quiz_attempts`

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id)
quiz_id UUID (FK academy_quizzes.id)
score INTEGER
percentage NUMERIC(3,1)
passed BOOLEAN
attempted_at TIMESTAMP
completed_at TIMESTAMP

created_at TIMESTAMP
```

---

## 3. INTERFACE - DASHBOARD

### `/dashboard/cursos` - Courses Page

**Arquivo**: `src/pages/dashboard/CoursesPage.tsx`
**Componente**: `src/components/admin/CoursesTab.tsx`

### Layout

```
┌─────────────────────────────────────┐
│ ACADEMY - Meus Cursos               │
├─────────────────────────────────────┤
│ [FILTROS]                           │
│ Level: [Iniciante] [Intermediário]  │
│ Status: [Em Progresso] [Concluído]  │
├─────────────────────────────────────┤
│ 📚 Curso 1 (80% completo)           │
│    ▮▮▮▮▮▮▮▮░░ 8/10 aulas           │
│    [Continuar]                      │
├─────────────────────────────────────┤
│ 📚 Curso 2 (100% completo) ✅       │
│    📜 [Ver Certificado]             │
├─────────────────────────────────────┤
│ 📚 Curso 3 (0% - novo)              │
│    [Iniciar Curso]                  │
└─────────────────────────────────────┘
```

### Funcionalidades

- ✅ Lista de cursos (cards)
- ✅ Barra de progresso (%)
- ✅ Filtro por nível
- ✅ Filtro por status (em progresso, concluído, novo)
- ✅ Número de aulas completadas
- ✅ Botão "Continuar" ou "Iniciar"
- ✅ Badge "Completo" com certificado

---

## 4. PÁGINA DE CURSO - DETALHE

### `/dashboard/cursos/:slug`

**Arquivo**: `src/pages/CourseDetail.tsx`

### Side Navbar

```
📚 [Título do Curso] (level: Intermediário)
├── Módulo 1
│   ├── ✓ Aula 1
│   ├── ⏱ Aula 2 (0:15)
│   └──› Aula 3 (em progresso)
├── Módulo 2
│   ├── ○ Aula 4
│   └── ○ Aula 5
└── [Progress: 30%]
```

### Main Content

**Top Bar**:
- Título da aula
- Duração
- Progresso geral do curso

**Content**:
- Video player
- Descrição/conteúdo
- Próxima aula button
- Quiz (se aplicável)

**Right Sidebar**:
- Progress tracker
- Tempo estudado
- Status do quiz

---

## 5. COMPONENTES

### CourseCard

```typescript
<CourseCard
  course={course}
  progress={progress}
  onStart={handleStart}
/>
```

**Exibe**:
- Cover image
- Title + level badge
- Description (resumida)
- Duration
- Progress bar
- Completion %
- Button apropriado

### LessonPlayer

```typescript
<LessonPlayer
  lesson={lesson}
  videoUrl={videoUrl}
  onComplete={handleComplete}
  onTimeTrack={handleTimeTracking}
/>
```

**Features**:
- ✅ Video player (com pause/resume)
- ✅ Time tracking (auto-save a cada 30s)
- ✅ Legenda (se disponível)
- ✅ Playback speed controls
- ✅ Fullscreen

### QuizComponent

```typescript
<QuizComponent
  quiz={quiz}
  onSubmit={handleSubmit}
  passingScore={passingScore}
/>
```

**Features**:
- ✅ Multiple choice, true/false, short answer
- ✅ Timer (se houver time limit)
- ✅ Progress (1/10 questions)
- ✅ Submit button
- ✅ Feedback imediato

### CourseProgress

```typescript
<CourseProgress
  courseSlug={slug}
  userId={userId}
/>
```

**Exibe**:
- % completado
- N aulas concluídas / total
- Tempo estudado
- Último acesso

---

## 6. FLUXO DO USUÁRIO

### Iniciar Curso

```
1. Usuário clica "Iniciar Curso"
   ↓
2. Redireciona para primeira aula
   ↓
3. Player carrega + conteúdo
   ↓
4. Tempo começa a ser rastreado
   ↓
5. Usuario assiste (progress auto-save)
   ↓
6. Se quiz: obrigatório passar (70%+)
   ↓
7. Proxima aula liberada
```

### Salvar Progresso

```
Auto-save a cada 30 segundos:
  - Tempo assistido
  - Posição no vídeo
  - Aula atual
  - Quiz responses (se não final)

Manual save:
  - "Marcar como concluído"
  - "Salvar progresso"
```

### Concluir Curso

```
Quando 100% das aulas = concluído:
  1. Edge function: issue-certificate
  2. Cria entrada em certificates
  3. Gera unique code (8 dígitos)
  4. Marca course_completion.completed_at
  5. User vê "Certificado disponível"
  6. Badge no perfil
  7. Impacta score de ranking (ranking +10%)
```

---

## 7. ADMIN INTERFACE

### `/admin/academy` - Gerenciar Cursos

**Arquivo**: `src/pages/admin/AcademyManagePage.tsx`
**Componente**: `src/components/admin/CoursesTab.tsx`

### Features

#### 1. CRUD de Cursos

- ✅ Criar novo curso
  - Slug, title, description, level
  - Video (upload ou URL)
  - Preço (0 = free tier)
  - Status (draft, published)

- ✅ Editar curso
  - Todos os campos
  - Reordenar módulos/aulas (drag-drop)

- ✅ Deletar curso
  - Soft delete (archive)
  - Preserve progress dos usuários

#### 2. Gerenciar Módulos

- ✅ Adicionar/editar/deletar módulos
- ✅ Reordenar (drag-drop)
- ✅ Marcar como optional

#### 3. Gerenciar Aulas

- ✅ Criar aula (título, content, vídeo, duração)
- ✅ Quiz associado (opcional)
- ✅ Reordenar dentro do módulo

#### 4. Quizzes

- ✅ CRUD de questões
- ✅ Types: multiple choice, true/false, short answer
- ✅ Passing score customizável
- ✅ Time limit (opcional)

#### 5. Analytics

```
Curso: Enfermagem Básica
──────────────────────────
Students enrolled: 342
Completion rate: 68%
Avg time spent: 4.5 hours
Avg quiz score: 82%
Most skipped lesson: "Módulo 3 - Aula 2"
Certificate issued: 232
```

---

## 8. EDGE FUNCTIONS

### `issue-certificate`
```
POST /functions/v1/issue-certificate
Auth: Bearer token (admin ou system)
Body: { user_id, course_slug }
Response: { certificate_id, code, certificate_url }
```

### `get-course-progress`
```
GET /functions/v1/get-course-progress?course_slug=X&user_id=Y
Auth: Bearer token
Response: {
  completion_percentage,
  lessons_completed,
  total_lessons,
  time_spent_seconds,
  last_lesson_id,
  completed_at?
}
```

### `track-lesson-time`
```
POST /functions/v1/track-lesson-time
Auth: Bearer token
Body: { user_id, lesson_id, seconds_watched }
Response: { success }
```

### `submit-quiz`
```
POST /functions/v1/submit-quiz
Auth: Bearer token
Body: {
  user_id,
  quiz_id,
  answers: [{ question_id, selected_answer }]
}
Response: {
  score,
  percentage,
  passed,
  passing_score,
  feedback
}
```

---

## 9. PERFORMANCE

### Caching

```
- Course list: 1 hour
- Course detail: Until edited
- User progress: Real-time
- Quiz results: Imediato
```

### Indices

```sql
CREATE INDEX idx_progress_user_course ON academy_user_progress(user_id, course_slug);
CREATE INDEX idx_progress_lesson ON academy_user_progress(lesson_id);
CREATE INDEX idx_completion_user ON academy_course_completion(user_id);
CREATE INDEX idx_completion_course ON academy_course_completion(course_slug);
```

---

## 10. SEGURANÇA

### Acesso Controlado

```
- User vê só cursos que tem acesso (subscription check)
- Quiz respostas não podem ser editadas após submit
- Progress salvo server-side (não confiar em client)
- Certificate slug único e imutável
```

### RLS

```sql
-- Usuários veem seus próprios progresso
-- Admins veem tudo
-- Instructors veem own courses + analytics
```

---

## 11. INTEGRAÇÃO COM BUSCA

### Ranking Boost

```
score += (
  10 * cursos_concluidos +
  5 * cursos_em_progresso +
  3 * quiz_average_score / 25
)
```

### Benefícios Visibilidade

- Perfis com 3+ cursos = "🎓 Educação Contínua"
- Aparece em filtro "Em desenvolvimento"
- Impacta prioridade de busca

---

## 12. EMAIL TEMPLATES

### Certificado Emitido

```
Assunto: 🎓 Você completou o curso!
Corpo:
- Congratulações
- Título do curso + level
- Código do certificado
- Download link
- Share buttons
```

---

## 13. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas criadas (courses, modules, lessons, progress)
- [x] Dashboard `/dashboard/cursos`
- [x] Página de detalhe `/dashboard/cursos/:slug`
- [x] Player com video
- [x] Progress tracking (auto-save)
- [x] Quiz system
- [x] Certificate generation
- [x] Admin interface
- [x] Analytics dashboard
- [x] Performance optimization
- [x] RLS security
- [x] Email templates

---

## 14. ROADMAP

- [ ] Live classes/webinars
- [ ] Student discussions/forum
- [ ] Instructor messaging
- [ ] Certificates em blockchain
- [ ] Gamification (badges, leaderboard)
- [ ] Adaptive learning (AI recommendations)

---

## 15. REFERÊNCIAS

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Academy Catalog](./catalogo_cursos_academy_detalhes.txt)

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção
