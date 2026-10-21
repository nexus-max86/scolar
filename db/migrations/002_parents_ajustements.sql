-- Espace parents : un lien privé par élève, sans compte à créer.
-- gen_random_uuid() utilise un générateur aléatoire sûr (122 bits imprévisibles).
alter table students add column parent_token text not null
  default replace(gen_random_uuid()::text, '-', '');
create unique index students_parent_token_idx on students (parent_token);

-- Frais optionnels (transport, cantine…) : ne concernent que les élèves inscrits à ce frais.
alter table fees add column optional boolean not null default false;

-- Montant propre à un élève pour un frais : réduction, exemption (0) ou inscription à un frais optionnel.
create table student_fee_overrides (
  student_id    uuid not null references students(id) on delete cascade,
  fee_id        uuid not null references fees(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  amount_cents  bigint not null check (amount_cents >= 0),
  reason        text,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (student_id, fee_id)
);
create index student_fee_overrides_school_idx on student_fee_overrides (school_id);
