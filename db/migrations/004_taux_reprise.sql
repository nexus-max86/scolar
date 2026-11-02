-- Paiement dans l'autre devise : le parent paie en francs un frais en dollars (ou l'inverse) au taux du jour.
-- amount_cents / currency restent le montant crédité sur le frais ; received_* est ce qui est entré en caisse.
alter table payments add column received_cents bigint check (received_cents > 0);
alter table payments add column received_currency text check (received_currency in ('USD', 'CDF'));
alter table payments add column exchange_rate numeric(12, 2) check (exchange_rate > 0); -- francs pour 1 dollar
alter table payments add column imported boolean not null default false;              -- reprise depuis Excel
alter table schools add column last_exchange_rate numeric(12, 2);
alter table schools add column receipt_format text not null default 'a4'
  check (receipt_format in ('a4', 'ticket58', 'ticket80'));
