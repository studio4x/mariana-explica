alter table public.product_assessments
  add column if not exists requires_passing_score boolean not null default true;

comment on column public.product_assessments.requires_passing_score is
  'When false, the assessment records the score only for knowledge validation and does not produce pass/fail status.';
