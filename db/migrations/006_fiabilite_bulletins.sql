-- Lot 1 : fiabilité de la caisse (alertes, paiements groupés d'avance) et bulletin électronique standard.

-- Alertes pour le directeur : import en erreur, montant ou taux inhabituel, doublon confirmé, erreur technique.
create table alerts (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  kind        text not null check (kind in ('import', 'doublon', 'montant', 'taux', 'date', 'annulation', 'erreur')),
  title       text not null,
  body        text,
  link        text,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  read_by     uuid references users(id) on delete set null
);
create index alerts_school_idx on alerts (school_id, created_at desc);
create index alerts_unread_idx on alerts (school_id) where read_at is null;

-- Plusieurs frais payés en une fois (paiement d'avance) : chaque frais garde son reçu, le lot les regroupe.
alter table payments add column batch_id uuid;
create index payments_batch_idx on payments (batch_id) where batch_id is not null;
-- Recherche rapide des doublons : même élève, même frais, même montant, même jour.
create index payments_dup_idx on payments (student_id, fee_id, payment_date) where status = 'valid';
create index payments_transaction_idx on payments (school_id, lower(transaction_number))
  where transaction_number is not null and status = 'valid';

-- Bulletin standard (format RDC) : cours de la classe avec leur maximum par période.
-- Les examens comptent le double d'une période : maxima P = 10 → examen sur 20.
create table subjects (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  class_id    uuid not null references classes(id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  max_points  integer not null check (max_points between 1 and 200),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (class_id, name)
);
create index subjects_class_idx on subjects (class_id, position);

-- Points d'un élève : p1, p2, ex1 (1er semestre), p3, p4, ex2 (2e semestre).
create table grades (
  student_id  uuid not null references students(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  period      text not null check (period in ('p1', 'p2', 'ex1', 'p3', 'p4', 'ex2')),
  points      numeric(6, 2) not null check (points >= 0),
  updated_by  uuid references users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (student_id, subject_id, period)
);
create index grades_school_idx on grades (school_id);

-- Conduite, observation du titulaire et décision de fin d'année, par élève et par année.
create table bulletin_remarks (
  student_id     uuid not null references students(id) on delete cascade,
  school_id      uuid not null references schools(id) on delete cascade,
  academic_year  text not null,
  conduct        text,
  remark         text,
  decision       text,
  updated_at     timestamptz not null default now(),
  primary key (student_id, academic_year)
);

-- Dernière période visible par les parents (null = bulletin pas encore publié).
alter table classes add column bulletin_period text check (bulletin_period in ('p1', 'p2', 'ex1', 'p3', 'p4', 'ex2'));
-- Nom du titulaire imprimé sur le bulletin.
alter table classes add column titular_name text;
