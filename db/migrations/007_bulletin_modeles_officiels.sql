-- Bulletins conformes aux modèles officiels (IGE/P.S) :
-- primaire par trimestres (3 × 2 périodes + examen), secondaire par semestres (2 × 2 périodes + examen).

-- Périodes 5 et 6 et examen du 3e trimestre.
alter table grades drop constraint if exists grades_period_check;
alter table grades add constraint grades_period_check
  check (period in ('p1', 'p2', 'ex1', 'p3', 'p4', 'ex2', 'p5', 'p6', 'ex3'));
alter table classes drop constraint if exists classes_bulletin_period_check;
alter table classes add constraint classes_bulletin_period_check
  check (bulletin_period in ('p1', 'p2', 'ex1', 'p3', 'p4', 'ex2', 'p5', 'p6', 'ex3'));

-- Organisation de la classe : semestres (secondaire) ou trimestres (primaire), et titre imprimé.
alter table classes add column bulletin_regime text not null default 'semestre'
  check (bulletin_regime in ('semestre', 'trimestre'));
alter table classes add column bulletin_title text;
-- Les classes du primaire passent aux trimestres, comme le modèle officiel.
update classes set bulletin_regime = 'trimestre' where name ~* 'primaire';

-- Cours : domaine (« Domaine des langues »), sous-groupe (« Français ») et cours sans examen (pratique professionnelle).
alter table subjects add column domain text;
alter table subjects add column grp text;
alter table subjects add column has_exam boolean not null default true;

-- Application et conduite, notées à chaque période (lettres : E, TB, B, AB, M…).
create table bulletin_marks (
  student_id     uuid not null references students(id) on delete cascade,
  school_id      uuid not null references schools(id) on delete cascade,
  academic_year  text not null,
  period         text not null check (period in ('p1', 'p2', 'p3', 'p4', 'p5', 'p6')),
  application    text,
  conduct        text,
  updated_at     timestamptz not null default now(),
  primary key (student_id, academic_year, period)
);

-- Décision de fin d'année et cours de l'examen de repêchage.
alter table bulletin_remarks add column repechage text;

-- En-tête officiel du bulletin.
alter table schools add column province text;
alter table schools add column commune text;
alter table schools add column school_code text;
alter table students add column birth_place text;
alter table students add column perm_number text;   -- N° permanent
alter table students add column national_id text;   -- N° ID
