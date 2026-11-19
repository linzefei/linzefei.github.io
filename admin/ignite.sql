-- ─────────────────────────────────────────────────────────────
-- 点亮（ignite）功能迁移 — 在 Supabase → SQL Editor 中运行一次
-- 幂等：可重复执行，不报错。与 setup.sql 第 9 节内容相同。
-- ─────────────────────────────────────────────────────────────

-- 1. 词表加计数字段
alter table visitor_words
  add column if not exists ignite_count int not null default 0;

-- 2. 点亮记录表（谁点亮了哪个词；同一人对同一个词只有一行）
create table if not exists word_ignites (
  word_id    uuid        not null references visitor_words(id) on delete cascade,
  visitor_id text        not null,
  created_at timestamptz default now(),
  primary key (word_id, visitor_id)
);

alter table word_ignites enable row level security;

-- 不给 anon 任何直接访问策略：读写全部走下面的 RPC（security definer）
drop policy if exists "auth all ignites" on word_ignites;
create policy "auth all ignites" on word_ignites
  for all to authenticated using (true) with check (true);

-- 3. 点亮/取消点亮 RPC：返回 { ignited: bool, ignite_count: int }
create or replace function toggle_ignite(
  p_word_id    uuid,
  p_visitor_id text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_count   int;
  v_ignited boolean;
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) = 0 then
    return jsonb_build_object('error', 'visitor_id required');
  end if;
  if not exists (select 1 from visitor_words where id = p_word_id and approved = true) then
    return jsonb_build_object('error', 'word not found');
  end if;

  if exists (select 1 from word_ignites where word_id = p_word_id and visitor_id = p_visitor_id) then
    delete from word_ignites where word_id = p_word_id and visitor_id = p_visitor_id;
    v_ignited := false;
  else
    insert into word_ignites (word_id, visitor_id) values (p_word_id, p_visitor_id);
    v_ignited := true;
  end if;

  update visitor_words
     set ignite_count = (select count(*) from word_ignites where word_id = p_word_id)
   where id = p_word_id
  returning ignite_count into v_count;

  return jsonb_build_object('ignited', v_ignited, 'ignite_count', v_count);
end;
$$;

grant execute on function toggle_ignite(uuid, text) to anon;
