import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions";
import { classLabel, classOptions } from "@/lib/students";
import { studentFullName } from "@/lib/labels";
import { emptyTotals, formatMoney, formatTotals } from "@/lib/money";
import { whatsAppLink } from "@/lib/phone";
import { unpaidStudents } from "@/lib/unpaid";
import { Card, PageHeader, Select, StatCard, Table, Td, buttonClass, MoneyLines } from "@/components/ui";

export const metadata = { title: "Impayés" };

export default async function UnpaidPage(props: PageProps<"/impayes">) {
  const sp = await props.searchParams;
  const { school } = await requireSchoolUser();
  const classId = typeof sp.classe === "string" && isUuid(sp.classe) ? sp.classe : "";
  const overdueOnly = sp.echus === "1";

  const [classes, rows] = await Promise.all([
    classOptions(school.id, school.academic_year),
    unpaidStudents(school.id, school.academic_year, { classId: classId || undefined, overdueOnly }),
  ]);
  const total = emptyTotals();
  for (const r of rows) {
    total.USD += r.remaining.USD;
    total.CDF += r.remaining.CDF;
  }
  const qs = new URLSearchParams({ classe: classId, echus: overdueOnly ? "1" : "" }).toString();

  return (
    <>
      <PageHeader
        title="Impayés"
        subtitle={overdueOnly ? "Seulement les frais dont la date limite est dépassée" : "Tous les frais de l'année non soldés"}
        actions={<a href={`/api/export/impayes?${qs}`} className={buttonClass("secondary")}>Exporter Excel</a>}
      />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <Select name="classe" defaultValue={classId} aria-label="Classe">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
          </Select>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="echus" value="1" defaultChecked={overdueOnly} className="h-5 w-5" />
            Date limite dépassée seulement
          </label>
          <button className={buttonClass("primary")}>Afficher</button>
        </form>
      </Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Total restant à percevoir" value={<MoneyLines totals={total} />} tone="red" />
        <StatCard label="Élèves concernés" value={rows.length} tone="orange" />
      </div>
      <Card className="p-0 sm:p-0">
        <Table head={["Élève", "Classe", "Déjà payé", "Reste à payer", "Parent", "Rappel"]} empty="Aucun impayé. Bravo !">
          {rows.map((r) => {
            const msg =
              `Bonjour ${r.parent_name ?? ""}, ${school.name} vous rappelle qu'il reste ${formatTotals(r.remaining)} ` +
              `à payer pour ${studentFullName(r)} (${r.class_name ?? ""}). Merci de passer à la caisse ou de payer par Mobile Money.`;
            return (
              <tr key={r.id}>
                <Td><Link href={`/eleves/${r.id}`} className="font-semibold text-brand-700 hover:underline">{studentFullName(r)}</Link><div className="text-xs text-gray-500">{r.student_number}</div></Td>
                <Td>{r.class_name ?? "—"}</Td>
                <Td className="text-green-700">{formatTotals(r.paid)}</Td>
                <Td className="font-bold text-red-700">
                  {r.remaining.USD > BigInt(0) && <div>{formatMoney(r.remaining.USD, "USD")}</div>}
                  {r.remaining.CDF > BigInt(0) && <div>{formatMoney(r.remaining.CDF, "CDF")}</div>}
                </Td>
                <Td>{r.parent_name ?? "—"}<div className="text-xs text-gray-500">{r.parent_phone ?? ""}</div></Td>
                <Td>
                  {r.parent_phone ? (
                    <a href={whatsAppLink(r.parent_phone, msg)} target="_blank" rel="noopener" className="font-semibold text-green-700 hover:underline">WhatsApp</a>
                  ) : "—"}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
