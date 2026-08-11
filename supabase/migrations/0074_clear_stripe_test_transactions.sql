-- Remove somente as transações comerciais do ambiente Stripe de teste.
-- Não altera pedidos live, contas, catálogo, configurações fiscais nem grants gratuitos/manuais.

do $$
begin
  if exists (
    select 1
    from public.fiscal_documents
    where source_payment_environment = 'test'
      and environment <> 'draft'
  ) then
    raise exception
      'Limpeza de teste bloqueada: existe documento fiscal de teste fora do ambiente draft';
  end if;
end;
$$;

-- Mantém a utilização acumulada dos cupões coerente antes de os usos em pedidos
-- de teste serem eliminados em cascata com os pedidos.
with test_coupon_uses as (
  select coupon_usages.coupon_id, count(*)::integer as uses_to_remove
  from public.coupon_usages
  join public.orders on orders.id = coupon_usages.order_id
  where orders.payment_environment = 'test'
  group by coupon_usages.coupon_id
)
update public.coupons
set current_uses = greatest(0, coupons.current_uses - test_coupon_uses.uses_to_remove)
from test_coupon_uses
where coupons.id = test_coupon_uses.coupon_id;

-- Grants de compra são a autorização real ao conteúdo e devem ser removidos
-- antes dos pedidos, pois a FK de source_order_id usa ON DELETE SET NULL.
delete from public.access_grants
using public.orders
where access_grants.source_order_id = orders.id
  and orders.payment_environment = 'test';

-- Estes registos referenciam pedidos/documentos com ON DELETE RESTRICT.
delete from public.affiliate_referrals
using public.orders
where affiliate_referrals.order_id = orders.id
  and orders.payment_environment = 'test';

delete from public.fiscal_adjustment_requests
using public.orders
where fiscal_adjustment_requests.order_id = orders.id
  and orders.payment_environment = 'test';

-- Em Stripe test, a regra do modelo obriga documentos Moloni no ambiente draft.
-- A limpeza é apenas local: não altera documentos remotos de sandbox no Moloni.
-- Os respetivos jobs são removidos automaticamente por ON DELETE CASCADE.
delete from public.fiscal_documents
where source_payment_environment = 'test';

-- Remove pedidos e dependências em cascata: order_items, order_billing_details
-- e coupon_usages. Pedidos live permanecem intactos.
delete from public.orders
where payment_environment = 'test';
