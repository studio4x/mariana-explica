# Skill: Edge Function Secure Flow

## Propósito

Padronizar a criação de Edge Functions seguras com validação robusta de autenticação, autorização, input, idempotência, logs e auditoria.

**Objetivo:** garantir que toda função crítica (checkout, webhook, grants, admin) respeita camadas de segurança, valida cada passo e é rastreável para auditoria.

---

## Quando usar esta skill

Use **Edge Function Secure Flow** quando:

- precisar **criar uma Edge Function** para operação crítica
- precisar **integrar com Stripe** (checkout ou webhook)
- precisar **gerar URL assinada** para arquivo protegido
- precisar **criar ou revogar grant de acesso**
- precisar **realizar ação administrativa** a partir do backend
- precisar **processar webhook de pagamento**
- precisar **executar automação** em massa ou agendada
- precisar **validar token** de um usuário
- tiver dúvida sobre **segurança ou estrutura** de uma função
- precisar **garantir idempotência** em operação crítica

---

## Documentos obrigatórios a consultar

Na ordem de prioridade:

1. **docs/05-backend-edge-functions.md** — padrão de Edge Functions
2. **docs/10-autenticacao-seguranca.md** — validação, auth, RLS
3. **docs/11-integracoes.md** — integração Stripe, webhooks
4. **docs/12-automacoes.md** — fluxos automatizados
5. **docs/02-regras-negocio.md** — regras que a função deve enforçar

---

## Regra crítica: Stripe é backend-only

**NUNCA:**

- ❌ Chamar Stripe directamente do frontend
- ❌ Expor chave de API do Stripe no cliente
- ❌ Confirmar compra apenas pelo redirect `success_url`
- ❌ Criar grant de acesso apenas no frontend

**SEMPRE:**

- ✅ Criar checkout session em Edge Function
- ✅ Retornar session ID para frontend redirecionar
- ✅ Validar webhook Stripe com assinatura no backend
- ✅ Criar grant APENAS após `payment_intent.succeeded` no webhook
- ✅ Usar idempotency key em checkout para evitar duplicatas

---

## Padrão obrigatório de Edge Function

### Estrutura base

```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Importar helpers compartilhados
import { requireAuth } from "../_shared/auth.ts";
import { validateInput } from "../_shared/validation.ts";
import { logAudit } from "../_shared/audit.ts";
import { handleError } from "../_shared/errors.ts";

serve(async (req: Request) => {
  try {
    // 1. VALIDAR MÉTODO
    if (req.method !== "POST") {
      return handleError("Method not allowed", 405);
    }

    // 2. EXTRAIR DADOS
    const body = await req.json();

    // 3. VALIDAR AUTH (obrigatório)
    const user = await requireAuth(req);
    if (!user) {
      return handleError("Unauthorized", 401);
    }

    // 4. VALIDAR INPUT
    const validData = validateInput(body, schema);
    if (!validData.valid) {
      return handleError("Invalid input: " + validData.errors, 400);
    }

    // 5. VALIDAR AUTORIZAÇÃO / ROLE
    if (user.role !== "admin" && someCondition) {
      return handleError("Forbidden", 403);
    }

    // 6. EXECUTAR LÓGICA CRÍTICA
    const result = await executarLogicaSegura(user, validData.data);

    // 7. AUDITAR (se crítico)
    await logAudit({
      user_id: user.id,
      action: "sensitive_operation",
      details: { operation: "checkout_created", session_id: result.id },
      status: "success",
    });

    // 8. RETORNAR RESULTADO
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // LOG DE ERRO
    console.error("Function error:", error);

    // NÃO EXPOR DETALHES SENSÍVEIS
    return handleError("Internal server error", 500);
  }
});
```

---

## Camadas de validação obrigatórias

### 1️⃣ Autenticação

```typescript
const user = await requireAuth(req);
if (!user) return handleError("Unauthorized", 401);

// user deve ter: id, email, role, status, metadata, etc.
```

- ✅ Extrair JWT do header `Authorization: Bearer token`
- ✅ Validar token com Supabase
- ✅ Garantir que user existe e está ativo
- ✅ Extrair role, status e metadata do user

### 2️⃣ Autorização (role-based)

```typescript
if (user.role !== "admin") {
  return handleError("Admin access required", 403);
}

// Ou regra de negócio específica
if (user.status !== "active") {
  return handleError("User not active", 403);
}
```

- ✅ Validar role (user, admin, affiliate, etc.)
- ✅ Validar status (active, banned, pending, etc.)
- ✅ Validar ownership (user só acessa seus dados)
- ✅ Regras negócio específicas (ex: só comprador pode gerar URL de download)

### 3️⃣ Validação de Input

```typescript
const schema = {
  product_id: { type: "number", required: true },
  coupon_code: { type: "string", required: false, maxLength: 50 },
  quantity: { type: "number", required: false, min: 1, max: 100 },
};

const validated = validateInput(body, schema);
if (!validated.valid) {
  return handleError("Invalid input: " + validated.errors, 400);
}
```

- ✅ Validar tipo de campo
- ✅ Validar limites (min, max, length)
- ✅ Validar formato (email, URL, UUID, etc.)
- ✅ Sanitizar strings para evitar injection
- ✅ Rejeitar campos inesperados

### 4️⃣ Validação de regra de negócio

```typescript
// Verificar que produto existe
const product = await db.from("products").select("*").eq("id", product_id).single();
if (!product) {
  return handleError("Product not found", 404);
}

// Verificar que usuário pode acessar
const hasGrant = await db.from("access_grants")
  .select("*")
  .eq("user_id", user.id)
  .eq("product_id", product_id)
  .single();

if (!hasGrant) {
  return handleError("Access denied", 403);
}
```

- ✅ Validar integridade de dados (referências devem existir)
- ✅ Validar regras negócio (pode comprar? pode acessar? pode deletar?)
- ✅ Validar estado anterior (pedido já foi confirmado? já tem grant?)

### 5️⃣ Idempotência (em operações críticas)

```typescript
// Use idempotency key para operações com efeito colateral
const idempotencyKey = body.idempotency_key || generateUUID();

// Verificar se operação já foi feita com esta chave
const existing = await db.from("idempotency_store")
  .select("*")
  .eq("key", idempotencyKey)
  .eq("function", "create_checkout")
  .single();

if (existing?.data?.result) {
  return new Response(JSON.stringify(existing.data.result), { status: 200 });
}

// Executar operação critica
const result = await stripe.checkout.sessions.create({...}, {
  idempotency_key: idempotencyKey, // Stripe também valida idempotência
});

// Armazenar resultado
await db.from("idempotency_store").insert({
  key: idempotencyKey,
  function: "create_checkout",
  result,
  created_at: new Date(),
});

return new Response(JSON.stringify(result), { status: 200 });
```

- ✅ Gerar idempotency key cliente-side (ou servidor)
- ✅ Armazenar resultados de operações críticas
- ✅ Retornar mesmo resultado se operação for retentada
- ✅ Usar suporte de idempotência de APIs (Stripe, etc.)

### 6️⃣ Logging e Auditoria

```typescript
// LOG DE SUCESSO (operação sensível)
await logAudit({
  user_id: user.id,
  action: "checkout_created",
  target_type: "order",
  target_id: order.id,
  details: {
    product_id,
    amount: order.amount,
    stripe_session_id: session.id,
  },
  status: "success",
  ip_address: req.headers.get("x-forwarded-for") || "unknown",
  user_agent: req.headers.get("user-agent") || "unknown",
});

// LOG DE ERRO (falha em operação sensível)
await logAudit({
  user_id: user.id,
  action: "checkout_failed",
  target_type: "order",
  details: {
    product_id,
    error: error.message,
  },
  status: "failed",
});

// LOG DE SEGURANÇA (comportamento suspeito)
if (body.quantity > 1000) {
  await logAudit({
    user_id: user.id,
    action: "suspicious_quantity",
    details: { quantity: body.quantity },
    status: "flagged",
  });
}
```

- ✅ Logar ações críticas (pagamento, acesso, admin)
- ✅ Logar user_id, timestamp, ação, resultado
- ✅ Logar detalhes suficientes para investigação
- ✅ Logar comportamento suspeito
- ✅ Logar erros com contexto

### 7️⃣ Tratamento de erro seguro

```typescript
// ❌ NUNCA exponha stack trace ou detalhes internos
return new Response(JSON.stringify({
  error: error.stack, // NUNCA!
}), { status: 500 });

// ✅ SEMPRE retorne erro genérico
return handleError("Internal server error", 500);

// Se precisar debugar, use console.error (log interno)
console.error("[DEBUG] Error details:", {
  error: error.message,
  stack: error.stack,
  context: { user_id, product_id },
});
```

- ✅ Retornar erro genérico ao cliente
- ✅ Logar detalhes internos para investigação
- ✅ Não expor stack trace
- ✅ Não expor estrutura de dados interna

---

## Padrão por tipo de operação

### Checkout Stripe

```typescript
// supabase/functions/create-checkout/index.ts
const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  mode: "payment",
  customer_email: user.email,
  line_items: [{ price_data: {...}, quantity: 1 }],
  success_url: `${origin}/dashboard/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/products`,
}, {
  idempotency_key: body.idempotency_key,
});

// Criar order no banco com status pending
const order = await db.from("orders").insert({
  user_id: user.id,
  product_id: body.product_id,
  stripe_session_id: session.id,
  status: "pending",
  amount_cents: product.price_cents,
});

return new Response(JSON.stringify({ session_id: session.id }), { status: 200 });
```

**Regras:**

- ✅ Receber idempotency_key do cliente (ou gerar)
- ✅ Usar Stripe com idempotency_key
- ✅ Criar order com status `pending`
- ✅ Grant é criado APENAS no webhook após confirmação

### Webhook Payment Stripe

```typescript
// supabase/functions/payment-webhook/index.ts
const sig = req.headers.get("stripe-signature");
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

if (event.type === "payment_intent.succeeded") {
  const order = await db.from("orders")
    .select("*")
    .eq("stripe_session_id", event.data.object.metadata.session_id)
    .single();

  // 1. Marcar pedido como confirmado
  await db.from("orders")
    .update({ status: "confirmed" })
    .eq("id", order.id);

  // 2. Criar grant de acesso
  await db.from("access_grants").insert({
    user_id: order.user_id,
    product_id: order.product_id,
    granted_by: "stripe_webhook",
    granted_at: new Date(),
    expires_at: null,
  });

  // 3. Auditar
  await logAudit({
    user_id: order.user_id,
    action: "payment_confirmed",
    target_type: "order",
    target_id: order.id,
    status: "success",
  });
}

return new Response("ok", { status: 200 });
```

**Regras:**

- ✅ Validar assinatura Stripe (`stripe-signature`)
- ✅ Processar APENAS eventos relevantes
- ✅ Marcar order como confirmada
- ✅ Criar grant de acesso
- ✅ Auditar a operação
- ✅ Ser idempotente (webhook pode ser retentado)

### Gerar URL assinada para download

```typescript
// supabase/functions/generate-asset-access/index.ts
const hasAccess = await db.from("access_grants")
  .select("*")
  .eq("user_id", user.id)
  .eq("product_id", body.product_id)
  .single();

if (!hasAccess) {
  return handleError("Access denied and no valid grant", 403);
}

// Gerar URL assinada válida por 1 hora
const { data: { signedUrl } } = await storage
  .from("protected-content")
  .createSignedUrl(`products/${body.product_id}/material.pdf`, 3600);

// Auditar tentativa de download
await logAudit({
  user_id: user.id,
  action: "download_granted",
  target_type: "product",
  target_id: body.product_id,
  status: "success",
});

return new Response(JSON.stringify({ signed_url: signedUrl }), { status: 200 });
```

**Regras:**

- ✅ Validar que usuário tem grant válido
- ✅ Usar URL assinada (não compartilhável indefinidamente)
- ✅ Definir tempo de expiração (1-24h)
- ✅ Auditar tentativa de download
- ✅ Não liberar arquivo direto; retornar URL temporária

---

## Anti-padrões a evitar

❌ **NÃO FAÇA:**

- Confiar em JWT do cliente sem revalidação
- Aceitar user_id do body sem validar com token
- Esquecer validação de rol/status
- Deixar campo sem validação de tipo/length
- Chamar Stripe do frontend
- Confirmar compra sem webhook
- Criar grant antes de Stripe confirmar
- Expor arquivo protegido sem URL assinada
- Logar dados sensíveis (senhas, tokens, cards)
- Deixar função sem tratamento de erro
- Omitir idempotency em operação crítica
- Retornar stack trace em erro 500
- Assumir que frontend validou tudo

---

## Checklist antes de criar Edge Function

- [ ] Consultei docs/05-backend-edge-functions.md?
- [ ] É realmente operação crítica que precisa de backend?
- [ ] Validei autenticação (token JWT correto)?
- [ ] Validei autorização (role, ownership, status)?
- [ ] Validei input (tipo, length, formato)?
- [ ] Validei regra de negócio (referências, integridade)?
- [ ] Preciso de idempotência? Como garanto?
- [ ] Vou auditar a operação?
- [ ] Trato erros sem expor detalhes?
- [ ] Se Stripe: uso checkout no backend + webhook?
- [ ] Se grant: crio grant apenas após confirmação?
- [ ] Se arquivo: uso URL assinada com expiração?
- [ ] Testei com dados reais?

---

## Resultado esperado ao usar esta skill

- ✅ Edge Function criada com validação em 7 camadas
- ✅ Autenticação e autorização robustas
- ✅ Input validado e sanitizado
- ✅ Idempotência garantida (se crítico)
- ✅ Operação auditada
- ✅ Erros tratados sem expor detalhes
- ✅ Código pronto para produção
- ✅ Segurança em 3 camadas (frontend, backend, banco)
