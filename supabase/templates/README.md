# Templates versionados do Supabase Auth

## Confirmacao de email

- Assunto sugerido: `Confirma o teu email | Mariana Explica`
- Arquivo canonico: `supabase/templates/auth-confirmation-email.html`

## Publicacao

1. Abrir o projeto correto no Supabase Dashboard.
2. Ir a `Authentication` -> `Email Templates` -> `Confirm signup`.
3. Substituir o HTML pelo conteudo de `auth-confirmation-email.html`.
4. Confirmar que o CTA continua a usar `{{ .ConfirmationURL }}`.
5. Guardar e enviar um email de teste antes do deploy final.
