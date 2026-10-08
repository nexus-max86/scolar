// Données de démonstration : 1 administrateur plateforme, 1 école avec directeur, caissier,
// classes, frais, ~120 élèves et des paiements. Relançable : l'école de démo est recréée.
import bcrypt from "bcryptjs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, onnotice: () => {} });

const YEAR = "2026-2027";
const DEMO_EMAILS = ["directeur@demo.cd", "caisse@demo.cd"];

const NOMS = ["MUKENDI", "KABILA", "TSHISEKEDI", "MBUYI", "KASONGO", "ILUNGA", "MWAMBA", "LUKUSA", "KALOMBO", "NGOY",
  "MULUMBA", "KAZADI", "BANZA", "MONGA", "NSIMBA", "MAKIESE", "LUTETE", "MASIALA", "BOLAMBA", "ELONGA", "MPIANA", "LOKOMBE",
  "NZUZI", "KIMBUANI", "TSHIBANDA", "MUTOMBO", "KAPINGA", "BOKETSHU", "LIKULIA", "NKULU"];
const POSTNOMS = ["KALALA", "NGALULA", "MBAYA", "TSHILOMBO", "MUJINGA", "KABEYA", "MUSAU", "NDAYA", "KANKU", "LUBOYA",
  "MBOMBO", "KAYEMBE", "MATONDO", "NSONA", "WEMBA", "BIDUAYA", "MASIKA", "NTUMBA", "LUSAMBA", "KITENGE"];
const PRENOMS_F = ["Grâce", "Divine", "Merveille", "Esther", "Rachel", "Sarah", "Joëlle", "Prisca", "Bénédicte", "Gloria", "Christelle", "Naomie"];
const PRENOMS_M = ["Jonathan", "Patrick", "Glody", "Exaucé", "Daniel", "Fiston", "Christian", "Héritier", "Benjamin", "Joël", "Moïse", "Cédric"];
const COMMUNES = ["Lingwala", "Kalamu", "Bandalungwa", "Limete", "Ngaliema", "Kintambo", "Lemba", "Matete", "Gombe", "Kasa-Vubu"];
const CLASSES: [string, string | null][] = [
  ["1re primaire", null], ["2e primaire", null], ["3e primaire", null], ["4e primaire", null], ["5e primaire", null],
  ["6e primaire", null], ["7e EB", "Éducation de base"], ["8e EB", "Éducation de base"],
  ["1re humanités", "Scientifique"], ["2e humanités", "Commerciale"],
];

// Générateur pseudo-aléatoire reproductible.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

async function main() {
  const adminHash = await bcrypt.hash("Admin1234!", 10);
  const demoHash = await bcrypt.hash("Demo1234!", 10);

  await sql.begin(async (tx) => {
    await tx`delete from schools where id in (select school_id from users where lower(email) = any(${DEMO_EMAILS}))`;
    await tx`
      insert into users (name, email, password_hash, role)
      values ('Équipe Scolar', 'admin@scolar.cd', ${adminHash}, 'super_admin')
      on conflict (lower(email)) do update set password_hash = excluded.password_hash`;

    const [school] = await tx<{ id: string }[]>`
      insert into schools (name, address, city, phone, email, director_name, academic_year, receipt_prefix, receipt_footer,
                           status, subscription_plan, subscription_end_date)
      values ('Complexe Scolaire La Victoire', 'Av. de la Paix n°12, Lingwala', 'Kinshasa', '0812 345 678',
              'contact@lavictoire.cd', 'Jean-Pierre Mukendi', ${YEAR}, 'LV',
              'Les frais versés ne sont ni remboursables ni transférables.', 'trial', 'basic', current_date + 25)
      returning id`;
    const [director] = await tx<{ id: string }[]>`
      insert into users (school_id, name, email, phone, password_hash, role)
      values (${school.id}, 'Jean-Pierre Mukendi', 'directeur@demo.cd', '0812345678', ${demoHash}, 'director') returning id`;
    const [cashier] = await tx<{ id: string }[]>`
      insert into users (school_id, name, email, phone, password_hash, role)
      values (${school.id}, 'Esther Ngalula', 'caisse@demo.cd', '0998765432', ${demoHash}, 'cashier') returning id`;

    const classIds: string[] = [];
    for (const [name, section] of CLASSES) {
      const [c] = await tx<{ id: string }[]>`
        insert into classes (school_id, name, section, academic_year) values (${school.id}, ${name}, ${section}, ${YEAR}) returning id`;
      classIds.push(c.id);
    }

    const fee = async (name: string, category: string, cents: number, currency: string, due: string, classId: string | null = null) => {
      const [f] = await tx<{ id: string }[]>`
        insert into fees (school_id, name, category, amount_cents, currency, academic_year, due_date, class_id)
        values (${school.id}, ${name}, ${category}, ${cents}, ${currency}, ${YEAR}, ${due}, ${classId}) returning id`;
      return { id: f.id, cents, currency };
    };
    const inscription = await fee("Frais d'inscription", "inscription", 2000, "USD", "2026-09-15");
    const minerval1 = await fee("Minerval 1er trimestre", "minerval", 6000, "USD", "2026-10-15");
    await fee("Minerval 2e trimestre", "minerval", 6000, "USD", "2027-01-15");
    await fee("Minerval 3e trimestre", "minerval", 6000, "USD", "2027-04-15");
    const examen = await fee("Frais d'examen (1er semestre)", "examen", 2500000, "CDF", "2026-12-01");
    const labo = await fee("Frais de laboratoire", "autre", 1000, "USD", "2026-10-30", classIds[8]);

    let studentCounter = 0;
    let receiptCounter = 0;
    const methods = ["especes", "especes", "especes", "mpesa", "airtel_money", "orange_money", "mpesa", "virement"];

    for (const [ci, classId] of classIds.entries()) {
      const count = 10 + Math.floor(rand() * 5);
      for (let i = 0; i < count; i++) {
        const female = rand() < 0.5;
        const lastName = pick(NOMS);
        const birthYear = 2020 - ci - Math.floor(rand() * 2);
        studentCounter++;
        const [s] = await tx<{ id: string }[]>`
          insert into students (school_id, class_id, student_number, last_name, middle_name, first_name, birth_date, gender,
                                address, parent_name, parent_phone, enrolled_at, created_at)
          values (${school.id}, ${classId}, ${"26" + String(studentCounter).padStart(4, "0")}, ${lastName}, ${pick(POSTNOMS)},
                  ${female ? pick(PRENOMS_F) : pick(PRENOMS_M)}, ${`${birthYear}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`},
                  ${female ? "F" : "M"}, ${`Av. ${pick(NOMS).toLowerCase().replace(/^./, (c) => c.toUpperCase())} n°${1 + Math.floor(rand() * 90)}, ${pick(COMMUNES)}`},
                  ${`${pick(PRENOMS_M)} ${lastName}`}, ${`08${Math.floor(10000000 + rand() * 89999999)}`},
                  ${"2026-09-0" + (1 + Math.floor(rand() * 8))}, ${"2026-09-01"})
          returning id`;

        const pay = async (f: { id: string; currency: string }, cents: number, date: string) => {
          receiptCounter++;
          const hour = 8 + Math.floor(rand() * 7);
          const method = pick(methods);
          await tx`
            insert into payments (school_id, student_id, fee_id, amount_cents, currency, payment_method, transaction_number,
                                  receipt_number, payment_date, recorded_by, created_at)
            values (${school.id}, ${s.id}, ${f.id}, ${cents}, ${f.currency}, ${method},
                    ${method === "especes" ? null : `TX${Math.floor(100000000 + rand() * 899999999)}`},
                    ${`LV-2026-${String(receiptCounter).padStart(6, "0")}`}, ${date}, ${rand() < 0.7 ? cashier.id : director.id},
                    ${`${date} ${String(hour).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00+01`})`;
        };
        const day = (from: number, to: number, month = "09") => `2026-${month}-${String(from + Math.floor(rand() * (to - from + 1))).padStart(2, "0")}`;

        if (rand() < 0.92) await pay(inscription, inscription.cents, day(1, 12));
        const r = rand();
        if (r < 0.5) await pay(minerval1, minerval1.cents, day(15, 30));
        else if (r < 0.75) {
          await pay(minerval1, 3000, day(15, 30));
          if (rand() < 0.4) await pay(minerval1, 1500, day(1, 7, "10"));
        }
        if (rand() < 0.3) await pay(examen, rand() < 0.5 ? examen.cents : 1000000, day(1, 8, "10"));
        if (ci === 8 && rand() < 0.6) await pay(labo, labo.cents, day(20, 30));
      }
    }
    // Quelques paiements du jour pour que la caisse du jour ne soit pas vide.
    await tx`
      update payments set payment_date = current_date, created_at = now() - (random() * interval '5 hours')
      where id in (select id from payments where school_id = ${school.id} order by created_at desc limit 6)`;
    await tx`update schools set student_counter = ${studentCounter}, receipt_counter = ${receiptCounter} where id = ${school.id}`;
    console.log(`École de démo : ${studentCounter} élèves, ${receiptCounter} paiements.`);
  });

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
