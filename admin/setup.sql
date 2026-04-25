-- ─────────────────────────────────────────────────────────────
-- 在 Supabase → SQL Editor 中运行此文件完成初始化
-- 幂等：可重复执行，policy 用 drop if exists 保证不报错
-- ─────────────────────────────────────────────────────────────

-- 1. 访问记录表
create table if not exists page_visits (
  id          uuid        default gen_random_uuid() primary key,
  visited_at  timestamptz default now(),
  date        date        default current_date,
  visitor_id  text,
  referrer    text,
  user_agent  text,
  page        text        default '/'
);

alter table page_visits enable row level security;

drop policy if exists "anon insert"  on page_visits;
drop policy if exists "auth select"  on page_visits;

create policy "anon insert" on page_visits
  for insert to anon with check (true);

create policy "auth select" on page_visits
  for select to authenticated using (true);


-- 2. 标签表
create table if not exists site_tags (
  id          uuid        default gen_random_uuid() primary key,
  created_at  timestamptz default now(),
  name        text        not null,
  url         text,
  sort_order  bigint      default 0
);

alter table site_tags enable row level security;

drop policy if exists "anon select" on site_tags;
drop policy if exists "auth all"    on site_tags;

create policy "anon select" on site_tags
  for select to anon using (true);

create policy "auth all" on site_tags
  for all to authenticated using (true) with check (true);


-- 3. 内容/配置表
create table if not exists site_content (
  id          uuid        default gen_random_uuid() primary key,
  updated_at  timestamptz default now(),
  key         text        unique not null,
  value       jsonb       not null
);

alter table site_content enable row level security;

drop policy if exists "anon select" on site_content;
drop policy if exists "auth all"    on site_content;

create policy "anon select" on site_content
  for select to anon using (true);

create policy "auth all" on site_content
  for all to authenticated using (true) with check (true);


-- 4. 统一词库表（默认词 + 游客留词）
create table if not exists visitor_words (
  id          uuid        default gen_random_uuid() primary key,
  created_at  timestamptz default now(),
  word        text        not null check (char_length(word) between 1 and 20),
  visitor_id  text,
  approved    boolean     default false,  -- 需要管理员审批后才公开
  source      text        default 'visitor',  -- 'default' | 'visitor'
  sort_order  int         default 999     -- 默认词按此排序，游客词按时间
);

-- alter table visitor_words enable row level security;

drop policy if exists "anon insert words"    on visitor_words;
drop policy if exists "anon select approved" on visitor_words;
drop policy if exists "auth all words"       on visitor_words;

-- create policy "anon insert words" on visitor_words
--   for insert to anon with check (true);

create policy "anon select approved" on visitor_words
  for select to anon using (approved = true);

create policy "auth all words" on visitor_words
  for all to authenticated using (true) with check (true);


-- 5. 默认词入库（on conflict do nothing 保证幂等）
insert into visitor_words (word, source, sort_order, approved) values
  ('Hello World!', 'default',  1, true),
  ('Three.js',     'default',  2, true),
  ('JavaScript',   'default',  3, true),
  ('Python',       'default',  4, true),
  ('Java',         'default',  5, true),
  ('C++',          'default',  6, true),
  ('React',        'default',  7, true),
  ('Vue',          'default',  8, true),
  ('Angular',      'default',  9, true),
  ('Node.js',      'default', 10, true),
  ('linzefei',     'default', 11, true),
  ('Cursor',       'default', 12, true),
  ('2025',         'default', 13, true)
on conflict do nothing;


-- 6. 访客身份表（token_hash 防伪造，display_name 可选，country 自动检测）
create extension if not exists pgcrypto;

create table if not exists visitors (
  id           text        primary key,          -- = visitor_id（公开）
  created_at   timestamptz default now(),
  token_hash   text        not null,             -- SHA-256(token)，防伪造
  display_name text        check (char_length(display_name) <= 30),
  country      text,                             -- 国家名，如 "China"
  country_code text                              -- ISO 代码，如 "CN"（用于国旗 emoji）
);

alter table visitors enable row level security;

drop policy if exists "anon insert visitor"  on visitors;
drop policy if exists "anon select visitors" on visitors;
drop policy if exists "auth all visitors"    on visitors;

create policy "anon insert visitor" on visitors
  for insert to anon with check (true);

create policy "anon select visitors" on visitors
  for select to anon using (true);

create policy "auth all visitors" on visitors
  for all to authenticated using (true) with check (true);


-- 7. 安全改名 RPC：验证 token_hash 通过后才允许更新 display_name
create or replace function update_visitor_name(
  p_visitor_id text,
  p_token      text,
  p_name       text
) returns boolean
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  select token_hash into v_hash from visitors where id = p_visitor_id;
  if v_hash is null then return false; end if;
  if v_hash = encode(digest(p_token, 'sha256'), 'hex') then
    update visitors
      set display_name = nullif(trim(p_name), '')
      where id = p_visitor_id;
    return true;
  end if;
  return false;
end;
$$;

grant execute on function update_visitor_name(text, text, text) to anon;


-- 8. 保留旧 site_content 表的 display_order 键（向后兼容，实际不再使用）
insert into site_content (key, value)
values ('display_order', '["Hello World!", "Three.js", "JavaScript", "Python", "Java", "C++", "React", "Vue", "Angular", "Node.js", "linzefei", "Cursor", "2025"]')
on conflict (key) do nothing;
