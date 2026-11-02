// Applique les fichiers SQL de db/migrations dans l'ordre, une seule fois chacun.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { resetDemoSchool } from "../src/lib/demo-school";

const url = process.env.DATABASE_URL;
if (!url) {
  // Sur Vercel, la base n'est peut-être pas encore connectée : on laisse le site se construire.
  if (process.env.VERCEL) {
    console.warn("DATABASE_URL manquant : migrations ignorées. Connectez la base puis redéployez.");
    process.exit(0);
  }
  console.error("DATABASE_URL manquant (voir .env.example)");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, onnotice: () => {} });
const dir = join(process.cwd(), "db", "migrations");

async function main() {
  await sql`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name),
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const content = readFileSync(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`✓ ${file}`);
  }
  console.log("Base de données à jour.");

  // Premier déploiement : compte administrateur plateforme (ADMIN_EMAIL / ADMIN_PASSWORD) et école de démo.
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users where role = 'super_admin'`;
  if (n === 0 && adminEmail && adminPassword && adminPassword.length >= 10) {
    await sql`insert into users (name, email, password_hash, role)
              values ('Équipe Scolar', ${adminEmail}, ${await bcrypt.hash(adminPassword, 10)}, 'super_admin')`;
    console.log(`✓ Compte administrateur créé : ${adminEmail}`);
  } else if (n === 1 && adminEmail) {
    // Changement de l'adresse de connexion du seul administrateur plateforme : le mot de passe ne change pas.
    const [taken] = await sql`select 1 from users where lower(email) = ${adminEmail}`;
    if (!taken) {
      await sql`update users set email = ${adminEmail} where role = 'super_admin'`;
      console.log(`✓ Adresse de l'administrateur changée : ${adminEmail}`);
    }
  }
  const [demo] = await sql`select 1 from schools where is_demo limit 1`;
  if (!demo && process.env.DEMO_DISABLED !== "1") {
    const r = await resetDemoSchool(sql);
    console.log(`✓ École de démonstration créée (${r.students} élèves)`);
  }
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
