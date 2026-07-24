-- Corrige a mensagem persistida da fila fiscal sem alterar estados, códigos ou tentativas.

update public.fiscal_documents
set
  last_error_message = 'Emissão desativada até conclusão e aprovação do checklist fiscal.',
  updated_at = now()
where last_error_code = 'FISCAL_CONFIGURATION_INCOMPLETE';

update public.moloni_document_jobs
set
  last_error = 'Emissão desativada até conclusão e aprovação do checklist fiscal.',
  updated_at = now()
where last_error_code = 'FISCAL_CONFIGURATION_INCOMPLETE';
