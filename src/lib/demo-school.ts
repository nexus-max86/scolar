// École de démonstration « Complexe Scolaire La Victoire » : ~120 élèves, frais, paiements, réductions,
// transport. Recréée à l'identique à chaque appel (script de seed et remise à zéro de chaque nuit).
import bcrypt from "bcryptjs";
import type postgres from "postgres";

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

export async function resetDemoSchool(sql: postgres.Sql) {
  seed = 42;
  const demoHash = await bcrypt.hash("Demo1234!", 10);
  return sql.begin(async (tx) => {
    await tx`delete from schools where is_demo or id in (select school_id from users where lower(email) = any(${DEMO_EMAILS}))`;
    const [school] = await tx<{ id: string }[]>`
      insert into schools (name, address, city, phone, email, director_name, academic_year, receipt_prefix, receipt_footer,
                           status, subscription_plan, subscription_end_date, is_demo)
      values ('Complexe Scolaire La Victoire', 'Av. de la Paix n°12, Lingwala', 'Kinshasa', '0812 345 678',
              'contact@lavictoire.cd', 'Jean-Pierre Mukendi', ${YEAR}, 'LV',
              'Les frais versés ne sont ni remboursables ni transférables.', 'active', 'standard', current_date + 365, true)
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

    const fee = async (name: string, category: string, cents: number, currency: string, due: string, classId: string | null = null, optional = false) => {
      const [f] = await tx<{ id: string }[]>`
        insert into fees (school_id, name, category, amount_cents, currency, academic_year, due_date, class_id, optional)
        values (${school.id}, ${name}, ${category}, ${cents}, ${currency}, ${YEAR}, ${due}, ${classId}, ${optional}) returning id`;
      return { id: f.id, cents, currency };
    };
    const inscription = await fee("Frais d'inscription", "inscription", 2000, "USD", "2026-09-15");
    const minerval1 = await fee("Minerval 1er trimestre", "minerval", 6000, "USD", "2026-10-15");
    await fee("Minerval 2e trimestre", "minerval", 6000, "USD", "2027-01-15");
    await fee("Minerval 3e trimestre", "minerval", 6000, "USD", "2027-04-15");
    const examen = await fee("Frais d'examen (1er semestre)", "examen", 2500000, "CDF", "2026-12-01");
    const labo = await fee("Frais de laboratoire", "autre", 1000, "USD", "2026-10-30", classIds[8]);
    // Transport scolaire : frais optionnel, seuls les élèves inscrits le doivent.
    const transport = [
      await fee("Transport – Septembre 2026", "transport", 2500, "USD", "2026-09-10", null, true),
      await fee("Transport – Octobre 2026", "transport", 2500, "USD", "2026-10-10", null, true),
      await fee("Transport – Novembre 2026", "transport", 2500, "USD", "2026-11-10", null, true),
    ];
    const override = async (studentId: string, feeId: string, cents: number, reason: string | null) => {
      await tx`insert into student_fee_overrides (student_id, fee_id, school_id, amount_cents, reason, created_by)
               values (${studentId}, ${feeId}, ${school.id}, ${cents}, ${reason}, ${director.id})`;
    };
    type Family = { lastName: string; parentName: string; phone: string };
    let family: Family | null = null;

    let studentCounter = 0;
    let receiptCounter = 0;
    const methods = ["especes", "especes", "especes", "mpesa", "airtel_money", "orange_money", "mpesa", "virement"];

    for (const [ci, classId] of classIds.entries()) {
      const count = 10 + Math.floor(rand() * 5);
      for (let i = 0; i < count; i++) {
        const female = rand() < 0.5;
        // Environ un élève sur huit a un frère ou une sœur déjà inscrit (même parent, même téléphone).
        const sibling: Family | null = family && rand() < 0.12 ? family : null;
        const lastName: string = sibling?.lastName ?? pick(NOMS);
        const parentName: string = sibling?.parentName ?? `${pick(PRENOMS_M)} ${lastName}`;
        const parentPhone: string = sibling?.phone ?? `08${Math.floor(10000000 + rand() * 89999999)}`;
        family = { lastName, parentName, phone: parentPhone };
        const birthYear = 2020 - ci - Math.floor(rand() * 2);
        studentCounter++;
        const [s] = await tx<{ id: string }[]>`
          insert into students (school_id, class_id, student_number, last_name, middle_name, first_name, birth_date, gender,
                                address, parent_name, parent_phone, enrolled_at, created_at)
          values (${school.id}, ${classId}, ${"26" + String(studentCounter).padStart(4, "0")}, ${lastName}, ${pick(POSTNOMS)},
                  ${female ? pick(PRENOMS_F) : pick(PRENOMS_M)}, ${`${birthYear}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`},
                  ${female ? "F" : "M"}, ${`Av. ${pick(NOMS).toLowerCase().replace(/^./, (c) => c.toUpperCase())} n°${1 + Math.floor(rand() * 90)}, ${pick(COMMUNES)}`},
                  ${parentName}, ${parentPhone},
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
        // Quelques réductions (enfants du personnel) et exemptions (bourses) sur le minerval.
        const special = rand();
        const minervalDue = special < 0.05 ? 3000 : special < 0.07 ? 0 : minerval1.cents;
        if (minervalDue !== minerval1.cents) {
          for (const f of [minerval1.id]) {
            await override(s.id, f, minervalDue, minervalDue === 0 ? "Bourse d'excellence" : "Enfant du personnel (50 %)");
          }
        }
        const r = rand();
        if (minervalDue !== minerval1.cents) {
          if (minervalDue > 0 && r < 0.7) await pay(minerval1, minervalDue, day(15, 30));
        } else if (r < 0.5) await pay(minerval1, minerval1.cents, day(15, 30));
        else if (r < 0.75) {
          await pay(minerval1, 3000, day(15, 30));
          if (rand() < 0.4) await pay(minerval1, 1500, day(1, 7, "10"));
        }
        if (rand() < 0.3) await pay(examen, rand() < 0.5 ? examen.cents : 1000000, day(1, 8, "10"));
        if (ci === 8 && rand() < 0.6) await pay(labo, labo.cents, day(20, 30));
        if (rand() < 0.2) {
          for (const t of transport) await override(s.id, t.id, t.cents, null);
          if (rand() < 0.8) await pay(transport[0], transport[0].cents, day(1, 10));
          if (rand() < 0.5) await pay(transport[1], transport[1].cents, day(1, 9, "10"));
        }
      }
    }
    // Quelques paiements du jour pour que la caisse du jour ne soit pas vide.
    await tx`
      update payments set payment_date = current_date, created_at = now() - (random() * interval '5 hours')
      where id in (select id from payments where school_id = ${school.id} order by created_at desc limit 6)`;
    await tx`update schools set student_counter = ${studentCounter}, receipt_counter = ${receiptCounter} where id = ${school.id}`;
    // Annonces d'exemple, avec quelques familles qui les ont déjà lues.
    const news: [string, string, string | null, "school" | "classes", string[], string][] = [
      ["Réunion des parents du 1er trimestre", "Chers parents,\n\nNous vous invitons à la réunion de fin du 1er trimestre, dans la grande salle à 9 h. Nous y présenterons les résultats et le calendrier des examens. Votre présence est importante.\n\nLa Direction", "current_date + 6", "school", [], "2 days"],
      ["Congé de la Toussaint", "Les cours seront suspendus du 1er au 3 novembre inclus. Reprise normale le lundi suivant à 7 h 30.", null, "school", [], "8 days"],
      ["Examens du 1er semestre : calendrier", "Les examens des humanités commencent le lundi 7 décembre. Chaque élève doit être en ordre avec les frais d'examen pour recevoir sa fiche de passage.", "'2026-12-07'", "classes", classIds.slice(6), "4 days"],
    ];
    for (const [title, body, date, audience, cls, ago] of news) {
      await tx.unsafe(
        `insert into announcements (school_id, title, body, event_date, audience, class_ids, created_by, created_at)
         values ($1, $2, $3, ${date ?? "null"}, $4, $5::uuid[], $6, now() - interval '${ago}')`,
        [school.id, title, body, audience, cls, director.id],
      );
    }
    await tx`
      insert into announcement_reads (announcement_id, student_id, read_at)
      select a.id, s.id, a.created_at + interval '3 hours'
      from announcements a join students s on s.school_id = a.school_id
      where a.school_id = ${school.id} and a.audience = 'school' and random() < 0.45`;
    return { students: studentCounter, payments: receiptCounter };
  });
}
