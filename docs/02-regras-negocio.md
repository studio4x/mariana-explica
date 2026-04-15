# Regras de Negócio — Mariana Explica

## 1. Contexto

Este documento define todas as regras operacionais da plataforma, incluindo acesso a conteúdo, compras, permissões, afiliados e comportamento do sistema.

Todas as decisões de backend, banco de dados e frontend devem respeitar estas regras.

---

## 2. Objetivo

Garantir que:

- o acesso ao conteúdo seja corretamente controlado
- compras sejam refletidas imediatamente no sistema
- não existam brechas de acesso indevido
- a lógica de monetização funcione corretamente
- o comportamento do sistema seja previsível e auditável

---

## 3. Tipos de usuário

### 3.1 Visitante (não autenticado)

- pode navegar no site
- pode visualizar produtos
- pode iniciar checkout
- não tem acesso a conteúdos

---

### 3.2 Usuário autenticado (Aluno)

- possui conta na plataforma
- pode acessar produtos adquiridos
- pode acessar produtos gratuitos
- pode se tornar afiliado

---

### 3.3 Administrador

- acesso total ao sistema
- pode gerenciar produtos, usuários, pedidos e configurações
- pode visualizar dados de todos os usuários

---

## 4. Tipos de produto

### 4.1 Produto pago

- exige pagamento para acesso
- libera conteúdo completo após confirmação da compra

---

### 4.2 Produto gratuito (lead magnet)

- exige cadastro do usuário
- não exige pagamento
- pode ter conteúdo parcialmente bloqueado

---

### 4.3 Produto híbrido

- possui parte gratuita e parte paga
- acesso parcial liberado sem pagamento
- acesso total liberado após compra

---

## 5. Estrutura de conteúdo

### 5.1 Produto

- representa um item vendável
- contém módulos

---

### 5.2 Módulo

- unidade de conteúdo dentro do produto
- pode ser:
  - PDF
  - vídeo
  - link externo

---

## 6. Regras de acesso ao conteúdo

### 6.1 Acesso geral

O usuário só pode acessar um produto se:

- comprou o produto
OU
- o produto é gratuito

---

### 6.2 Acesso a módulos

- módulos seguem as permissões do produto
- módulos podem ser:
  - liberados
  - bloqueados

---

### 6.3 Acesso híbrido

- parte dos módulos pode ser pública
- parte exige compra

---

## 7. Regras de download de arquivos

### 7.1 PDF pago

- download permitido
- acesso apenas para quem comprou

---

### 7.2 PDF gratuito

- visualização permitida
- download bloqueado

---

### 7.3 Liberação pós-compra

- ao comprar qualquer produto elegível:
  - desbloqueia download de conteúdos previamente bloqueados

---

### 7.4 Segurança de arquivos

- arquivos não podem ter URL pública direta
- acesso deve ser feito via URL assinada temporária
- backend valida permissão antes de gerar acesso

---

## 8. Regras de compra

### 8.1 Criação de conta

- usuário é criado automaticamente no checkout, se não existir

---

### 8.2 Associação de compra

- cada compra gera um registro
- compra é vinculada ao usuário e ao produto

---

### 8.3 Liberação de acesso

- acesso liberado somente após confirmação de pagamento

---

### 8.4 Status da compra

- pending → aguardando pagamento
- paid → pagamento confirmado
- failed → pagamento falhou
- refunded → reembolsado

---

### 8.5 Comportamento por status

- pending → sem acesso
- paid → acesso liberado
- failed → sem acesso
- refunded → acesso removido

---

## 9. Regras de afiliados

### 9.1 Criação de afiliado

- qualquer usuário pode se tornar afiliado
- recebe um código único

---

### 9.2 Rastreamento

- vendas associadas ao código de afiliado
- tracking via link ou parâmetro

---

### 9.3 Comissão

- gerada apenas quando:
  - pagamento for confirmado (status = paid)

---

### 9.4 Segurança

- cálculo de comissão feito no backend
- não confiar em dados do frontend

---

## 10. Regras de cupons

### 10.1 Tipos

- percentual (%)
- valor fixo

---

### 10.2 Validade

- pode ter data de expiração

---

### 10.3 Limite de uso

- pode ter limite total
- pode ter limite por usuário

---

### 10.4 Aplicação

- aplicado no checkout
- validado no backend

---

## 11. Regras de produtos gratuitos (lead)

### 11.1 Acesso

- exige cadastro do usuário

---

### 11.2 Objetivo

- captura de e-mail
- entrada no funil de marketing

---

### 11.3 Limitações

- acesso parcial ao conteúdo
- download bloqueado (quando aplicável)

---

## 12. Regras de notificações

### 12.1 Tipos

- transacional (compra, acesso)
- informativa (avisos)
- campanha (marketing)

---

### 12.2 Disparo

- automático
- manual (admin)

---

## 13. Regras de suporte

### 13.1 Acesso

- apenas usuários autenticados

---

### 13.2 Tipos

- ticket interno
OU
- redirecionamento externo

---

## 14. Regras de sessão e acesso

- usuário precisa estar autenticado para acessar dashboard
- sessão inválida → redirecionamento para login
- perda de permissão → bloqueio de acesso

---

## 15. Regras de segurança

- nenhuma regra crítica deve depender do frontend
- toda validação deve existir no backend
- banco deve aplicar RLS
- acesso a dados deve ser restrito por usuário

---

## 16. Critérios de aceite

- usuário compra → acesso imediato ao conteúdo
- usuário não autorizado → acesso bloqueado
- PDFs protegidos corretamente
- afiliado recebe comissão corretamente
- cupons aplicados corretamente
- conteúdo híbrido respeita bloqueios

---

## 17. Riscos e observações

- compartilhamento de contas
- tentativa de acesso direto a arquivos
- manipulação de parâmetros de afiliado
- uso indevido de cupons

Todas essas situações devem ser tratadas no backend e banco.