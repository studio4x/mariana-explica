# ESPECIFICAÇÕES - REDEFINIÇÃO DE SENHA

## Visão Geral

Sistema de **Redefinição de Senha** implementa recuperação segura de senha via email, utilizando o sistema de autenticação do Supabase Auth. Permite que usuários recuperem acesso à conta sem intervenção manual, com foco em segurança e experiência do usuário.

---

## 1. FLUXO DE REDEFINIÇÃO DE SENHA

### Fluxo Completo

```
1. Usuário: /login
   ↓
2. Clica "Esqueci minha senha"
   ↓
3. Modal: "Recuperar Senha" aparece
   ↓
4. Confirma e-mail (pré-preenchido)
   ↓
5. Backend: supabase.auth.resetPasswordForEmail()
   ↓
6. Supabase envia email de recovery
   ↓
7. Usuário recebe email com link
   ↓
8. Clica link: /redefinir-senha#type=recovery&access_token=...
   ↓
9. Página ResetPassword.tsx valida token
   ↓
10. Usuário define nova senha
    ↓
11. Backend: supabase.auth.updateUser({ password })
    ↓
12. Redireciona para /dashboard
```

### Estados de Erro

- **Link expirado/inválido**: Redireciona para login com mensagem
- **Email não encontrado**: Mesmo fluxo (segurança - não revela se email existe)
- **Senha fraca**: Validação client-side (mínimo 6 caracteres)
- **Senhas não coincidem**: Validação client-side

---

## 2. SUPABASE AUTH CONFIGURATION

### Config no `supabase/config.toml`

```toml
[auth]
# Habilita recoveries
enable_signup = true
enable_email_autoconfirm = false

# Email recoveries
[auth.email]
enable_recoveries = true
max_frequency = 10  # emails per hour

# Session settings
jwt_expiry = 3600  # 1 hour
session_lifetime = 3600  # 1 hour
```

### Rate Limiting

```toml
[auth.rate_limit]
email_sent = 2  # emails per hour
token_verifications = 30  # verifications per 5 min
```

### Email Template (Supabase)

#### Recovery Email

```html
<h2>Resetar Senha</h2>
<p>Clique no link abaixo para redefinir sua senha:</p>
<a href="{{ .RecoveryURL }}">Resetar Senha</a>

<p>Este link expira em 1 hora.</p>
<p>Se você não solicitou este email, ignore-o.</p>
```

**RecoveryURL**: `https://app.homecarematch.com.br/redefinir-senha#type=recovery&access_token=...&refresh_token=...`

---

## 3. COMPONENTES E PÁGINAS

### AuthForm.tsx - Modal de Recuperação

**Localização**: `src/components/auth/AuthForm.tsx`

**Funcionalidades**:
- ✅ Modal "Esqueci minha senha" no login
- ✅ Pré-preenche email do formulário
- ✅ Validação básica de email
- ✅ Chama `supabase.auth.resetPasswordForEmail()`
- ✅ Modal de confirmação "E-mail enviado!"

**Código relevante**:
```typescript
const handleResetPassword = async () => {
  const email = getValues("email");
  if (!email) {
    toast.error("Digite seu e-mail primeiro.");
    return;
  }

  setLoading(true);
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/redefinir-senha",
    });
    if (error) throw error;
    
    setShowForgotPasswordModal(false);
    setShowResetSentModal(true);
  } catch (error: any) {
    toast.error(translateAuthError(error.message));
  } finally {
    setLoading(false);
  }
};
```

### ResetPassword.tsx - Página de Redefinição

**Localização**: `src/pages/ResetPassword.tsx`

**Rota**: `/redefinir-senha`

**Funcionalidades**:
- ✅ Valida presença de `type=recovery` na URL
- ✅ Verifica sessão ativa ou token válido
- ✅ Formulário para nova senha + confirmação
- ✅ Validações: mínimo 6 chars, senhas iguais
- ✅ Chama `supabase.auth.updateUser({ password })`
- ✅ Redireciona para `/dashboard` em sucesso
- ✅ Trata erros e links expirados

**Código relevante**:
```typescript
const hasRecoveryHash = useMemo(() => {
  if (typeof window === "undefined") return false;
  return window.location.hash.includes("type=recovery");
}, []);

const handleSubmit = async (event: React.FormEvent) => {
  // Validações...
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  
  toast.success("Senha redefinida com sucesso!");
  navigate("/dashboard", { replace: true });
};
```

---

## 4. SEGURANÇA

### Medidas Implementadas

1. **Rate Limiting**:
   - Máximo 2 emails de recovery por hora por IP
   - Máximo 30 verificações de token por 5 minutos

2. **Token Expiracy**:
   - Links de recovery expiram em 1 hora
   - JWT tokens expiram em 1 hora

3. **Validações**:
   - Senha mínima: 6 caracteres
   - Confirmação de senha obrigatória
   - Email deve existir (mas não revela se não existe)

4. **Sessão Segura**:
   - Após redefinição, cria nova sessão
   - Invalida tokens anteriores
   - Redireciona para dashboard

### Riscos Mitigados

- **Brute Force**: Rate limiting no envio de emails
- **Token Theft**: Tokens de curto prazo, single-use
- **User Enumeration**: Mesmo fluxo para emails existentes/não existentes
- **Session Hijacking**: Refresh token rotation

---

## 5. EXPERIÊNCIA DO USUÁRIO

### Estados da UI

1. **Login Form**:
   - Link "Esqueci minha senha" abaixo do botão de login

2. **Modal Recuperar Senha**:
   - Ícone HelpCircle
   - Texto explicativo
   - Botão "Enviar Link de Recuperação"

3. **Modal E-mail Enviado**:
   - Ícone MailCheck verde
   - Mensagem de confirmação
   - Botão "Entendido"

4. **Página Redefinir Senha**:
   - Validação de link
   - Formulário com campos de senha
   - Botão de submit com loading
   - Mensagens de erro/toast

### Mensagens de Feedback

- **Sucesso**: "Senha redefinida com sucesso!"
- **Erro**: "Link inválido ou expirado"
- **Validação**: "A nova senha deve ter pelo menos 6 caracteres"
- **Validação**: "As senhas não coincidem"

---

## 6. INTEGRAÇÃO COM SISTEMA

### AuthProvider

**Localização**: `src/components/auth/AuthProvider.tsx`

- Monitora mudanças de auth state
- Atualiza session após redefinição
- Redireciona baseado em role (admin/dashboard)

### Roteamento

**App.tsx**:
```typescript
<Route path="/redefinir-senha" element={<ResetPassword />} />
```

### Tratamento de Erros

- `translateAuthError()` para mensagens em português
- Toast notifications para feedback
- Logging de eventos de auth

---

## 7. TESTES E VALIDAÇÃO

### Cenários a Testar

1. **Fluxo Normal**:
   - Solicitar recovery → Receber email → Clicar link → Redefinir senha

2. **Edge Cases**:
   - Link expirado
   - Email não cadastrado
   - Senha fraca
   - Senhas não coincidem

3. **Segurança**:
   - Rate limiting
   - Token reuse
   - Session management

### Validações Automáticas

- Build: ESLint + TypeScript
- Runtime: Form validations
- E2E: Cypress (futuro)

---

## 8. MONITORAMENTO E LOGS

### Métricas a Monitorar

- Taxa de sucesso de redefinições
- Tempo médio para completar redefinição
- Taxa de links expirados
- Emails de recovery enviados por hora

### Logs

- Eventos de auth email (logAuthEmailEvent)
- Erros de Supabase
- Tentativas de rate limit

---

## 9. CONSIDERAÇÕES FUTURAS

### Melhorias Planejadas

1. **2FA Integration**: Requerir 2FA para mudanças críticas
2. **Audit Trail**: Log detalhado de mudanças de senha
3. **Password Strength**: Indicador visual de força da senha
4. **SMS Recovery**: Opção de recovery via SMS (futuro)
5. **Account Lockout**: Bloqueio temporário após tentativas falhidas

### Escalabilidade

- Supabase Auth escala automaticamente
- Rate limiting configurável
- Templates de email customizáveis</content>
<parameter name="filePath">c:\PLATAFORMAS VS CODE\HOMECARE MATCH\homecare-match\architecture\SPEC_PASSWORD_RESET.md