create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  source text not null default 'masterclass',
  email_verified_at timestamptz,
  email_verification_code_hash text,
  email_verification_expires_at timestamptz,
  followup_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists email_verified_at timestamptz,
  add column if not exists email_verification_code_hash text,
  add column if not exists email_verification_expires_at timestamptz,
  add column if not exists followup_sent boolean not null default false;

-- Normalize existing data before deduplication
update public.leads
set email = lower(trim(email)),
    phone = case
      when regexp_replace(phone, '[^0-9+]', '', 'g') like '+%' then regexp_replace(phone, '[^0-9+]', '', 'g')
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 9 then '+34' || regexp_replace(phone, '[^0-9]', '', 'g')
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10 and left(regexp_replace(phone, '[^0-9]', '', 'g'), 1) = '0' then '+34' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 2)
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10 then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      else regexp_replace(phone, '[^0-9+]', '', 'g')
    end;

-- Remove duplicate normalized emails
with duplicates as (
  select
    id,
    row_number() over (
      partition by lower(trim(email))
      order by created_at asc
    ) as rn
  from public.leads
)
delete from public.leads
where id in (select id from duplicates where rn > 1);

-- Remove duplicate normalized phones
with duplicates as (
  select
    id,
    row_number() over (
      partition by phone
      order by created_at asc
    ) as rn
  from public.leads
)
delete from public.leads
where id in (select id from duplicates where rn > 1);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create unique index if not exists leads_email_unique_idx on public.leads (lower(trim(email)));
create unique index if not exists leads_phone_unique_idx on public.leads (phone);
