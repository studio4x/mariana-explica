update public.visual_site_page_versions
set entries_json = jsonb_set(
  coalesce(entries_json, '{}'::jsonb),
  '{hero,image,src}',
  to_jsonb('/support-hero-illustration.svg'::text),
  true
)
where page_id in (
  select id
  from public.visual_site_pages
  where page_key = 'support'
);
