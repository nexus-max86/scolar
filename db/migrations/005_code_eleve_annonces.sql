-- Code Scolar unique pour chaque élève, dans toutes les écoles : SC-2026-000125.
create sequence scolar_code_seq;
alter table students add column scolar_code text not null unique
  default ('SC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('scolar_code_seq')::text, 6, '0'));

-- Annonces de l'école aux parents : toute l'école, certaines classes ou un élève.
create table announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  title text not null check (length(title) between 3 and 120),
  body text not null check (length(body) between 1 and 4000),
  event_date date,
  audience text not null check (audience in ('school', 'classes', 'student')),
  class_ids uuid[] not null default '{}',
  student_id uuid references students(id) on delete cascade,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (audience <> 'student' or student_id is not null),
  check (audience <> 'classes' or cardinality(class_ids) > 0)
);
create index announcements_school_idx on announcements (school_id, created_at desc);

-- Première ouverture d'une annonce par la famille d'un élève (accusé de lecture).
create table announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, student_id)
);
