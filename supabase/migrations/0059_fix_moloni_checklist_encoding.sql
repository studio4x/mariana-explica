-- Corrige textos do checklist fiscal que foram persistidos com caracteres de substituição.
-- Não altera status, aprovações, configurações ou ambiente dos itens.

update public.moloni_fiscal_checklist_items
set
  title = case item_key
    when 'immediate_payment_document' then 'Documento para pagamento imediato'
    when 'production_document_set' then 'Série de produção'
    when 'homologation_strategy' then 'Estratégia de homologação'
    when 'moloni_products' then 'Artigos Moloni'
    when 'automatic_closing' then 'Fechamento automático'
    when 'customer_pdf_delivery' then 'Envio do PDF ao cliente'
    when 'buyer_without_vat' then 'Comprador sem NIF'
    when 'individual_required_data' then 'Dados de pessoa singular'
    when 'company_required_data' then 'Dados de empresa'
    when 'eac' then 'CAE aplicável'
    when 'portugal_vat' then 'IVA em Portugal'
    when 'international_sales' then 'Vendas internacionais'
    when 'eu_b2b_b2c_oss' then 'B2B/B2C intracomunitário e OSS'
    when 'exemptions' then 'Isenções'
    when 'full_refund' then 'Reembolso total'
    when 'partial_refund' then 'Reembolso parcial'
    when 'chargeback' then 'Chargeback e disputa'
    when 'tax_authority_communication' then 'Comunicação à Autoridade Tributária'
    else title
  end,
  description = case item_key
    when 'immediate_payment_document' then 'Definir fatura-recibo ou fatura seguida de recibo.'
    when 'production_document_set' then 'Confirmar a série documental que será usada em produção.'
    when 'homologation_strategy' then 'Definir empresa, série e regra de rascunho para testes seguros.'
    when 'moloni_products' then 'Confirmar os artigos correspondentes aos produtos digitais.'
    when 'automatic_closing' then 'Definir se o documento deve ser fechado ou permanecer em rascunho.'
    when 'customer_pdf_delivery' then 'Definir a política de disponibilização do documento fiscal.'
    when 'buyer_without_vat' then 'Definir a regra fiscal aplicável quando o comprador não indicar NIF.'
    when 'individual_required_data' then 'Definir os dados obrigatórios para compradores particulares.'
    when 'company_required_data' then 'Definir os dados obrigatórios para compradores empresariais.'
    when 'eac' then 'Confirmar o CAE aplicável ou registar que não se aplica.'
    when 'portugal_vat' then 'Definir a taxa e a regra de IVA para vendas em Portugal.'
    when 'international_sales' then 'Definir o tratamento fiscal de compradores de outros países.'
    when 'eu_b2b_b2c_oss' then 'Definir as regras intracomunitárias e eventual utilização de OSS.'
    when 'exemptions' then 'Definir os motivos legais de isenção ou registar que não se aplicam.'
    when 'full_refund' then 'Definir o documento retificativo exigido num reembolso total.'
    when 'partial_refund' then 'Definir o documento retificativo exigido num reembolso parcial.'
    when 'chargeback' then 'Definir o tratamento contabilístico de disputas e perdas definitivas.'
    when 'tax_authority_communication' then 'Confirmar a configuração de comunicação fiscal na conta Moloni.'
    else description
  end,
  updated_at = now()
where item_key in (
  'immediate_payment_document',
  'production_document_set',
  'homologation_strategy',
  'moloni_products',
  'automatic_closing',
  'customer_pdf_delivery',
  'buyer_without_vat',
  'individual_required_data',
  'company_required_data',
  'eac',
  'portugal_vat',
  'international_sales',
  'eu_b2b_b2c_oss',
  'exemptions',
  'full_refund',
  'partial_refund',
  'chargeback',
  'tax_authority_communication'
);
