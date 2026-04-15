# ESPECIFICAÇÕES - AUTENTICAÇÃO COM MAGIC LINK & OTP

## Visão Geral

Sistema de **Autenticação com Magic Link e OTP** implementa login seguro via email/SMS sem necessidade de senha, suportado por Supabase Auth. Elimina gestão de senhas, fornece 2FA opcional e é reutilizável em qualquer aplicação que necessite autenticação segura sem fricção.

---

## 1. FLUXO DE AUTENTICAÇÃO

### Magic Link (Email)

```
1. Usuário: /auth/login
   ↓
2. Digita email + clica "Enviar Link"
   ↓
3. Backend gera JWT token (uri-encoded)
   ↓
4. Envia email com link:
   https://app.homecarematch.com.br/auth/callback?token=...
   ↓
5. Usuário clica email
   ↓
6. Supabase verifica token
   ↓
7. Se válido: Session criada
   ↓
8. Redirect para /dashboard
```

### OTP (SMS - Futuro)

```
1. Usuário: /auth/login
   ↓
2. Digita telefone
   ↓
3. Receives SMS: "123456 é seu código"
   ↓
4. Digita código
   ↓
5. Backend verifica (match + timing)
   ↓
6. Cria session
```

### Backup: Senha Tradicional

```
- User pode set password em /dashboard/settings
- Permite login com email+password se preferir
- Optional 2FA via app authenticator
```

---

## 2. SUPABASE AUTH CONFIGURATION

### Config no `supabase/config.toml`

```toml
[auth]
enable_signup = true
enable_email_autoconfirm = false
enable_phone_autoconfirm = false

# Magic Link (Email)
[auth.email]
enable_signup = true
enable_confirmations = true
enable_recoveries = true
max_frequency = 10  # emails per hour
double_confirm_changes = false

# Email OTP
enable_otp = true
otp_expiry = 3600  # 1 hour
otp_length = 6

# SMS (futuro)
# [auth.sms]

# Session
session_lifetime = 3600  # 1 hour
single_session = false  # Múltiplas sessions OK
```

### Email Templates (Supabase)

#### Confirmation Email

```html
<h2>Confirme seu email</h2>
<p>Clique no link abaixo para confirmar seu cadastro:</p>
<a href="{{ .ConfirmationURL }}">Confirmar Email</a>

<p>Este link expira em 24 horas.</p>
<p>Se você não solicitou este email, ignore-o.</p>
```

#### Recovery Email (Password Reset)

```html
<h2>Resetar Senha</h2>
<p>Clique no link abaixo para redefinir sua senha:</p>
<a href="{{ .RecoveryURL }}">Resetar Senha</a>

<p>Este link expira em 1 hora.</p>
```

---

## 3. PÁGINAS DE AUTH

### `/auth/login` - Login Portal

**Arquivo**: `src/pages/auth/LoginPage.tsx`

**Layout**:
```
┌──────────────────────────────┐
│ HomeCare Match               │
├──────────────────────────────┤
│ Entre na sua conta           │
├──────────────────────────────┤
│ Email:                       │
│ [email@example.com]          │
│                              │
│ Sou:                         │
│ ○ Profissional               │
│ ○ Empresa                    │
│ ○ Família                    │
│                              │
│ [Enviar Link de Acesso]      │
├──────────────────────────────┤
│ Prefere senha?               │
│ [Usar Senha em Vez]          │
└──────────────────────────────┘
```

**Funcionalidades**:
- ✅ Email input
- ✅ User type selector (profissional/empresa/família)
- ✅ "Enviar Link" button
- ✅ Link para password login (fallback)
- ✅ Link para signup

### `/auth/callback` - Magic Link Handler

**Arquivo**: `src/pages/auth/CallbackPage.tsx`

```typescript
useEffect(() => {
  const handleCallback = async () => {
    // Extract token from URL
    const { data, error } = await supabase.auth.getSession();
    
    if (error || !data.session) {
      setError("Link inválido ou expirado");
      return;
    }
    
    // Session criada, redireciona
    navigate('/dashboard');
  };
  
  handleCallback();
}, []);
```

**States**:
- Loading: "Verificando link..."
- Success: Redirect para /dashboard
- Error: "Link expirado. Solicite um novo."

### `/auth/signup` - Signup Portal

**Arquivo**: `src/pages/auth/SignupPage.tsx`

**Fluxo**:

```
1. Email + User Type
   ↓
2. Send confirmation email
   ↓
3. "Verifique seu email"
   ↓
4. User clica email
   ↓
5. Redireciona para /auth/onboarding
   ↓
6. Onboarding flow completa
```

### `/dashboard/settings/security` - Password Management

**Arquivo**: `src/pages/dashboard/SettingsSecurityPage.tsx`

**Features**:
- ✅ Change password (via ChangePasswordDialog)
- ✅ Enable/disable 2FA
- ✅ View active sessions
- ✅ Logout all devices
- ✅ View login history

---

## 4. COMPONENTES

### AuthProvider

**Localização**: `src/components/auth/AuthProvider.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, userType: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  // ... other methods

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
```

### ChangePasswordDialog

**Localização**: `src/components/ChangePasswordDialog.tsx` (já existe)

```typescript
const ChangePasswordDialog = () => {
  const { updatePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!oldPassword) throw new Error("Old password required");
    if (newPassword.length < 8) throw new Error("Min 8 characters");
    if (newPassword !== newPasswordConfirm) throw new Error("Passwords don't match");

    await updatePassword(oldPassword, newPassword);
    toast.success("Password updated!");
  };

  return (
    <Dialog>
      <form onSubmit={handleSubmit}>
        <PasswordInput 
          label="Senha Atual" 
          value={oldPassword} 
          onChange={setOldPassword}
        />
        <PasswordInput 
          label="Nova Senha" 
          value={newPassword} 
          onChange={setNewPassword}
        />
        <PasswordInput 
          label="Confirmar Senha" 
          value={newPasswordConfirm} 
          onChange={setNewPasswordConfirm}
        />
        <Button type="submit">Atualizar Senha</Button>
      </form>
    </Dialog>
  );
};
```

### LoginForm

```typescript
const LoginForm = () => {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card>
        <CardContent className="text-center py-10">
          <h2>Verifique seu email 📧</h2>
          <p>Enviamos um link de acesso para {email}</p>
          <p className="text-sm text-muted-foreground">
            Clique no link para entrar. Válido por 24 horas.
          </p>
          <Button variant="outline" onClick={() => setSent(false)}>
            Usar outro email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <Input
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <RadioGroup value={userType} onValueChange={setUserType}>
          <Label className="flex items-center gap-2">
            <Radio value="professional" />
            Profissional
          </Label>
          <Label className="flex items-center gap-2">
            <Radio value="company" />
            Empresa
          </Label>
          <Label className="flex items-center gap-2">
            <Radio value="family" />
            Família
          </Label>
        </RadioGroup>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Enviando..." : "Enviar Link de Acesso"}
        </Button>

        <Button variant="ghost" type="button">
          Prefere password? {/* link para /auth/login-password */}
        </Button>
      </div>
    </form>
  );
};
```

---

## 5. FLUXO DETALHADO

### Sign In with Magic Link

```typescript
// 1. User submits email
const handleSignIn = async (email: string) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
};

// 2. Supabase envia email com link

// 3. User clica email
// Link contém: ?code=xyz&access_token=abc123

// 4. CallbackPage processa
const { data, error } = await supabase.auth.getSession();

// 5. Session criada, redirect para /dashboard
```

### Password Reset Flow

```
1. User em /auth/forgot-password
   ↓
2. Digita email
   ↓
3. Backend envia recovery email
   ↓
4. User clica email
   ↓
5. Redirect para /auth/reset-password?token=xyz
   ↓
6. Form com "Nova Senha" + "Confirmar"
   ↓
7. Submit: updatePassword()
   ↓
8. Success: redirect /dashboard
```

### 2FA (Optional)

```
1. User em /dashboard/settings/security
   ↓
2. Clica "Enable 2FA"
   ↓
3. App authenticator (Google Authenticator, Authy)
   ↓
4. Scan QR code
   ↓
5. Confirma com código de 6 dígitos
   ↓
6. Backup codes gerados
   ↓
7. Próximo login: after password, pedes código
```

---

## 6. EDGE FUNCTIONS

### `login-with-magic-link`
```
POST /functions/v1/login-with-magic-link
Body: { email, user_type? }
Response: { success, message }
```

### `verify-magic-link`
```
GET /functions/v1/verify-magic-link?token=X
Response: { valid, user_id, email }
```

### `refresh-session`
```
POST /functions/v1/refresh-session
Auth: Bearer refresh_token
Response: { session, new_refresh_token }
```

### `update-password`
```
POST /functions/v1/update-password
Auth: Bearer token
Body: { old_password, new_password }
Response: { success }
```

---

## 7. SEGURANÇA

### Rate Limiting

```
- 5 tentativas de magic link por email / por dia
- 3 tentativas de password por IP / por hora
- Exponential backoff after failures
```

### Token Security

```
- Tokens JWT com expiry curto (1 hour)
- Refresh tokens com expiry longo (7 days)
- HTTPS only
- Secure HttpOnly cookies
```

### Password Requirements (se usando senha)

```
- Min 8 characters
- 1 uppercase
- 1 lowercase
- 1 number
- 1 special character
```

---

## 8. EMAIL TEMPLATES

### Magic Link

```
Assunto: Seu link de acesso | HomeCare Match
Corpo:
Olá,

Clique no link abaixo para entrar na sua conta:
[MAGIC_LINK_URL]

Este link expira em 24 horas.

Se você não solicitou este email, ignore-o.
```

### Password Reset

```
Assunto: Redefinir sua senha | HomeCare Match
Corpo:
Olá,

Clique no link abaixo para redefinir sua senha:
[RESET_PASSWORD_URL]

Este link expira em 1 hora.

Se você não solicitou, ignore este email.
```

### 2FA Setup

```
Assunto: Configure autenticação em 2 fatores
Corpo:
Olá,

Para aumentar a segurança, configure 2FA:
[SETUP_2FA_LINK]

Ou use estes códigos de backup:
CODE1
CODE2
CODE3
```

---

## 9. FLOW DIAGRAM

```
Login Portal
    ↓
Magic Link Email
    ↓
User Clicks Email
    ↓
Callback Page (verifies token)
    ↓
Session Created
    ↓
Redirect Dashboard
    ↓
AuthProvider updates context
    ↓
Protected Routes unlock
```

---

## 10. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Supabase Auth configured (magic link + password)
- [x] AuthProvider context
- [x] LoginPage with magic link form
- [x] CallbackPage para magic link verification
- [x] SignupPage with email verification
- [x] PasswordReset flow
- [x] ChangePasswordDialog
- [x] 2FA settings (optional)
- [x] Session persistence
- [x] Protected routes
- [x] Logout functionality
- [x] Email templates
- [x] Rate limiting
- [x] Security headers

---

## 11. ROADMAP

- [ ] Social login (Google, GitHub, Microsoft)
- [ ] SMS OTP authentication
- [ ] Biometric auth (fingerprint, face)
- [ ] Passkeys (FIDO2)
- [ ] Session management dashboard
- [ ] Login activity alerts

---

## 12. REFERÊNCIAS

- [Supabase Auth](https://supabase.com/docs/guides/auth/overview)
- [Magic Link Auth](https://supabase.com/docs/guides/auth/auth-magic-link)
- [OWASP Auth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção
