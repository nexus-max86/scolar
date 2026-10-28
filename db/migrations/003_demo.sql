-- École de démonstration publique : accessible sans mot de passe depuis /demo, remise à zéro chaque nuit.
alter table schools add column is_demo boolean not null default false;
