import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { classLabel, classOptions } from "@/lib/students";
import { STUDENT_STATUS, studentFullName } from "@/lib/labels";
import { formatTotals } from "@/lib/money";
import { paymentStatus, schoolBalances, STATUS_LABELS, totalsByStudent } from "@/lib/finance";
import { Badge, Card, Input, LinkButton, PageHeader, Select, Table, Td, buttonClass } from "@/components/ui";

export const metadata = { title: "Élèves" };

const PAGE_SIZE = 50;

export default async function StudentsPage(props: PageProps<"/eleves">) {
  const sp = await props.searchParams;
  const { school } = await requireSchoolUser();
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const classId = typeof sp.classe === "string" && isUuid(sp.classe) ? sp.classe : "";
  const status = typeof sp.statut === "string" && sp.statut in STUDENT_STATUS ? sp.statut : "active";
  const page = Math.max(1, Number(sp.page) || 1);

  const like = `%${q.toLowerCase()}%`;
  const students = await sql<
    { id: string; student_number: string; last_name: string; middle_name: string | null; first_name: string | null;
      parent_phone: string | null; class_name: string | null; class_section: string | null; status: string; total: number }[]
  >`
    select s.id, s.student_number, s.last_name, s.middle_name, s.first_name, s.parent_phone, s.status,
           c.name as class_name, c.section as class_section, count(*) over ()::int as total
    from students s left join classes c on c.id = s.class_id
    where s.school_id = ${school.id} and s.status = ${status}
      ${classId ? sql`and s.class_id = ${classId}` : sql``}
      ${q ? sql`and (lower(s.last_name || ' ' || coalesce(s.middle_name, '') || ' ' || coalesce(s.first_name, '')) like ${like}
                    or lower(s.student_number) like ${like} or s.parent_phone like ${like})` : sql``}
    order by s.last_name, s.middle_name, s.first_name
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;

  const [classes, balances] = await Promise.all([
    classOptions(school.id, school.academic_year),
    schoolBalances(school.id, school.academic_year, { classId: classId || null }),
  ]);
  const byStudent = totalsByStudent(balances);
  const total = students[0]?.total ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (p: number) => `?${new URLSearchParams({ q, classe: classId, statut: status, page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Élèves"
        subtitle={`${total} élève${total > 1 ? "s" : ""} ${status === "active" ? "actif" : STUDENT_STATUS[status as keyof typeof STUDENT_STATUS].toLowerCase()}${total > 1 ? "s" : ""}`}
        actions={
          <>
            <LinkButton href="/eleves/nouveau">+ Inscrire un élève</LinkButton>
            <LinkButton href="/eleves/import" variant="secondary">Importer Excel</LinkButton>
            <a href={`/api/export/eleves${qs(1)}`} className={buttonClass("secondary")}>Exporter Excel</a>
          </>
        }
      />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_200px_160px_auto]">
          <Input name="q" defaultValue={q} placeholder="Nom, matricule ou téléphone du parent" type="search" aria-label="Rechercher" />
          <Select name="classe" defaultValue={classId} aria-label="Classe">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
          </Select>
          <Select name="statut" defaultValue={status} aria-label="Statut">
            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}s</option>)}
          </Select>
          <button className={buttonClass("primary")}>Rechercher</button>
        </form>
      </Card>
      <Card className="p-0 sm:p-0">
        <Table head={["Matricule", "Nom complet", "Classe", "Paiement", "Reste à payer", "Téléphone parent"]} empty="Aucun élève ne correspond à cette recherche.">
          {students.map((s) => {
            const t = byStudent.get(s.id);
            const st = t ? paymentStatus(t.due, t.paid, t.remaining) : "none";
            return (
              <tr key={s.id} className="hover:bg-gray-50">
                <Td className="font-mono text-xs">{s.student_number}</Td>
                <Td>
                  <Link href={`/eleves/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                    {studentFullName(s)}
                  </Link>
                </Td>
                <Td>{s.class_name ? classLabel({ name: s.class_name, section: s.class_section }) : "—"}</Td>
                <Td><Badge color={STATUS_LABELS[st].color}>{STATUS_LABELS[st].label}</Badge></Td>
                <Td className={t && t.remaining.USD + t.remaining.CDF > BigInt(0) ? "font-semibold text-red-700" : ""}>
                  {t ? formatTotals(t.remaining) : "—"}
                </Td>
                <Td>{s.parent_phone ?? "—"}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link className={buttonClass("secondary")} href={qs(page - 1)}>← Précédent</Link>}
          <span>Page {page} / {pages}</span>
          {page < pages && <Link className={buttonClass("secondary")} href={qs(page + 1)}>Suivant →</Link>}
        </div>
      )}
    </>
  );
}
