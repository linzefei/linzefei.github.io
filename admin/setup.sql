-- ─────────────────────────────────────────────────────────────
-- 在 Supabase → SQL Editor 中运行此文件完成初始化
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

-- 任何人可写（前端埋点用）
create policy "anon insert" on page_visits
  for insert to anon with check (true);

-- 只有登录用户可读
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

create policy "anon select" on site_content
  for select to anon using (true);

create policy "auth all" on site_content
  for all to authenticated using (true) with check (true);


-- 4. 默认内容配置
insert into site_content (key, value)
values ('display_order', '["Hello World!", "Three.js", "JavaScript", "Python", "Java", "C++", "React", "Vue", "Angular", "Node.js", "linzefei", "Cursor", "2025"]')
on conflict (key) do nothing;
