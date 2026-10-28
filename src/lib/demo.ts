import { sql } from "./db";

export const demoEnabled = () => process.env.DEMO_DISABLED !== "1";

export async function demoSchoolId(): Promise<string | null> {
  const [s] = await sql<{ id: string }[]>`select id from schools where is_demo order by created_at limit 1`;
  return s?.id ?? null;
}

/**
 * L'élève montré pendant la visite guidée : inscrit au transport, avec des paiements,
 * un reste à payer et un frère ou une sœur, pour que chaque écran ait quelque chose à montrer.
 */
export async function demoShowcase(schoolId: string) {
  const [s] = await sql<{ id: string; parent_token: string; payment_id: string | null }[]>`
    select s.id, s.parent_token,
           (select p.id from payments p where p.student_id = s.id and p.status = 'valid'
            order by p.created_at desc limit 1) as payment_id
    from students s
    where s.school_id = ${schoolId} and s.status = 'active'
      and exists (select 1 from student_fee_overrides o join fees f on f.id = o.fee_id where o.student_id = s.id and f.optional)
      and exists (select 1 from payments p where p.student_id = s.id and p.status = 'valid')
      and exists (select 1 from students b where b.school_id = s.school_id and b.id <> s.id and b.parent_phone = s.parent_phone)
    order by s.student_number limit 1`;
  if (s) return s;
  const [any] = await sql<{ id: string; parent_token: string; payment_id: string | null }[]>`
    select s.id, s.parent_token, null::uuid as payment_id from students s
    where s.school_id = ${schoolId} and s.status = 'active' order by s.student_number limit 1`;
  return any ?? null;
}

export type TourStep = { href: string; match: string; title: string; text: string };

export function tourSteps(role: string, show: { id: string; parent_token: string; payment_id: string | null } | null): TourStep[] {
  const student = show ? `/eleves/${show.id}` : "/eleves";
  const encaisser = show ? `/paiements/nouveau?eleve=${show.id}` : "/paiements/nouveau";
  const recu = show?.payment_id ? `/recus/${show.payment_id}` : "/paiements";
  const parent = show ? `/p/${show.parent_token}` : "/eleves";
  const steps: Record<string, TourStep> = {
    dashboard: { href: "/tableau-de-bord", match: "/tableau-de-bord", title: "Le tableau de bord", text: "Ce qui est rentré aujourd'hui, ce qui reste à percevoir et les élèves en retard, d'un coup d'œil." },
    student: { href: student, match: "/eleves/", title: "La fiche d'un élève", text: "Chaque frais, ce qui est payé et ce qui reste. Le directeur y accorde une réduction ou inscrit l'élève au transport." },
    pay: { href: encaisser, match: "/paiements/nouveau", title: "Encaisser", text: "Le montant est déjà rempli avec le reste à payer. Choisissez le moyen de paiement puis enregistrez." },
    receipt: { href: recu, match: "/recus/", title: "Le reçu", text: "Numéroté, en PDF, imprimable, et envoyé au parent par WhatsApp avec le lien de son espace." },
    unpaid: { href: "/impayes", match: "/impayes", title: "Les impayés", text: "Qui doit combien, par classe. Un clic pour encaisser ou envoyer un rappel WhatsApp au parent." },
    cash: { href: "/caisse", match: "/caisse", title: "La caisse du jour", text: "Le soir, le total par devise, par moyen de paiement et par caissier : la caisse tombe juste." },
    parent: { href: parent, match: "/p/", title: "Ce que voit le parent", text: "Sur son téléphone, sans compte : le solde, le prochain paiement et tous ses reçus." },
  };
  const order = role === "cashier"
    ? ["pay", "receipt", "unpaid", "cash", "parent"]
    : ["dashboard", "student", "pay", "receipt", "unpaid", "cash", "parent"];
  return order.map((k) => steps[k]);
}
