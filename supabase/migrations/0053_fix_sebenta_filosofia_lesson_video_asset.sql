do $$
declare
  target_lesson_id constant uuid := '1d77856c-92ab-453c-9538-e8acec1ece21';
  current_asset_id constant uuid := '424906c1-0eee-4d4f-8efc-a35f61c881f9';
  replacement_asset_id constant uuid := '3b9d2b4b-1116-4e41-bb7c-17dad8394e05';
  lesson_module_product_id uuid;
  replacement_module_product_id uuid;
  current_value text;
begin
  select lesson.youtube_url, module.product_id
    into current_value, lesson_module_product_id
    from public.product_lessons as lesson
    join public.product_modules as module on module.id = lesson.module_id
   where lesson.id = target_lesson_id;

  if current_value = 'asset:' || replacement_asset_id::text then
    return;
  end if;

  if current_value is null or current_value <> ('asset:' || current_asset_id::text) then
    raise exception
      'A referência atual da Aula 1 da Sebenta não corresponde ao asset esperado: %',
      coalesce(current_value, '<null>');
  end if;

  select module.product_id
    into replacement_module_product_id
    from public.module_assets as asset
    join public.product_modules as module on module.id = asset.module_id
   where asset.id = replacement_asset_id
     and asset.asset_type = 'video_file'
     and asset.status = 'active'
     and asset.allow_stream = true;

  if replacement_module_product_id is null then
    raise exception 'O asset de substituição da Aula 1 não está disponível para streaming';
  end if;

  if replacement_module_product_id <> lesson_module_product_id then
    raise exception 'O asset de substituição não pertence ao mesmo produto da aula';
  end if;

  update public.product_lessons
     set youtube_url = 'asset:' || replacement_asset_id::text,
         updated_at = now()
   where id = target_lesson_id
     and youtube_url = 'asset:' || current_asset_id::text;

  if not found then
    raise exception 'A referência da Aula 1 mudou antes da correção ser aplicada';
  end if;
end
$$;

comment on column public.product_lessons.youtube_url is
  'Para vídeos protegidos, guarda o identificador do asset autorizado pelo módulo da própria aula.';
