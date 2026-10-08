-- ÉcoleFacile RDC : schéma initial (MVP)
-- Toutes les tables métier portent school_id : chaque école ne voit que ses données.
-- Les montants sont stockés en centimes (bigint) pour des calculs exacts.

create table schools (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  address               text,
  city                  text,
  phone                 text,
  email                 text,
  director_name         text,
  logo_data             bytea,
  logo_mime             text,
  academic_year         text not null,
  receipt_prefix        text not null default 'REC',
  receipt_footer        text,
  receipt_counter       integer not null default 0,
  student_counter       integer not null default 0,
  status                text not null default 'trial'
                        check (status in ('trial', 'active', 'suspended')),
  subscription_plan     text not null default 'basic'
                        check (subscription_plan in ('basic', 'standard', 'premium')),
  subscription_end_date date,
  created_at            timestamptz not null default now()
);

create table users (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid references schools(id) on delete cascade,
  name           text not null,
  email          text not null,
  phone          text,
  password_hash  text not null,
  role           text not null
                 check (role in ('super_admin', 'director', 'cashier', 'teacher', 'parent')),
  status         text not null default 'active' check (status in ('active', 'disabled')),
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  check ((role = 'super_admin') = (school_id is null))
);
create unique index users_email_unique on users (lower(email));
create index users_school_idx on users (school_id);

create table classes (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references schools(id) on delete cascade,
  name           text not null,
  section        text,
  academic_year  text not null,
  teacher_id     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (school_id, academic_year, name)
);

create table students (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  class_id        uuid references classes(id) on delete set null,
  student_number  text not null,
  last_name       text not null,          -- Nom
  middle_name     text,                   -- Postnom
  first_name      text,                   -- Prénom
  birth_date      date,
  gender          text check (gender in ('M', 'F')),
  address         text,
  parent_name     text,
  parent_phone    text,
  photo           text,
  status          text not null default 'active'
                  check (status in ('active', 'transferred', 'archived')),
  enrolled_at     date not null default current_date,
  created_at      timestamptz not null default now(),
  unique (school_id, student_number)
);
create index students_school_class_idx on students (school_id, class_id);
create index students_search_idx on students
  (school_id, lower(last_name || ' ' || coalesce(middle_name, '') || ' ' || coalesce(first_name, '')));

create table fees (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references schools(id) on delete cascade,
  name           text not null,
  category       text not null
                 check (category in ('inscription', 'mensuel', 'transport', 'examen', 'minerval', 'autre')),
  amount_cents   bigint not null check (amount_cents > 0),
  currency       text not null check (currency in ('USD', 'CDF')),
  academic_year  text not null,
  due_date       date,
  class_id       uuid references classes(id) on delete cascade, -- null = toutes les classes
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index fees_school_year_idx on fees (school_id, academic_year);

create table payments (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references schools(id) on delete cascade,
  student_id          uuid not null references students(id),
  fee_id              uuid not null references fees(id),
  amount_cents        bigint not null check (amount_cents > 0),
  currency            text not null check (currency in ('USD', 'CDF')),
  payment_method      text not null
                      check (payment_method in ('especes', 'airtel_money', 'mpesa', 'orange_money', 'virement', 'autre')),
  transaction_number  text,
  receipt_number      text not null,
  payment_date        date not null,
  recorded_by         uuid not null references users(id),
  comment             text,
  status              text not null default 'valid' check (status in ('valid', 'cancelled')),
  cancelled_by        uuid references users(id),
  cancelled_at        timestamptz,
  cancel_reason       text,
  created_at          timestamptz not null default now(),
  unique (school_id, receipt_number)
);
create index payments_school_date_idx on payments (school_id, payment_date);
create index payments_student_idx on payments (student_id);

create table audit_logs (
  id          bigserial primary key,
  school_id   uuid references schools(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  action      text not null,
  table_name  text,
  record_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_school_idx on audit_logs (school_id, created_at desc);
