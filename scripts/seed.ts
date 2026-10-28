// Données de démonstration : 1 administrateur plateforme et l'école de démo (voir src/lib/demo-school.ts).
// Relançable : l'école de démo est recréée.
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { resetDemoSchool } from "../src/lib/demo-school";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, onnotice: () => {} });

async function main() {
  const adminHash = await bcrypt.hash("Admin1234!", 10);
  await sql`
    insert into users (name, email, password_hash, role)
    values ('Équipe Scolar', 'admin@scolar.cd', ${adminHash}, 'super_admin')
    on conflict (lower(email)) do update set password_hash = excluded.password_hash`;
  const r = await resetDemoSchool(sql);
  console.log(`École de démo : ${r.students} élèves, ${r.payments} paiements.`);
  console.log(`
Comptes de démonstration :
  Administrateur plateforme : admin@scolar.cd / Admin1234!
  Directeur                 : directeur@demo.cd    / Demo1234!
  Caissier                  : caisse@demo.cd       / Demo1234!`);
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
