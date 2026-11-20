import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { classBulletins, DECISIONS, formatPercent, formatPoints, isExam, isPeriod, MARK_OPTIONS, periodLabel, periodMax, periodsOf, REGIMES, terms, type PeriodCode, type Regime } from "@/lib/bulletin";
import { studentFullName } from "@/lib/labels";
import { ActionForm, ConfirmActionButton, SubmitButton } from "@/components/forms";
import { Alert, Card, Field, Input, LinkButton, PageHeader, Select, buttonClass, cx } from "@/components/ui";
import { addSubject, addSubjectSet, deleteSubject, saveBulletinLayout, saveBulletinSettings, saveGrades, saveRemarks, updateSubject } from "../actions";

export const metadata = { title: "Bulletins de la classe" };

const TABS = [
  { key: "notes", label: "Saisir les points" },
  { key: "cours", label: "Cours et maxima" },
  { key: "appreciations", label: "Décision de fin d'année" },
  { key: "resultats", label: "Résultats et impression" },
] as const;

export default async function ClassBulletinPage(props: PageProps<"/bulletins/[classId]">) {
  const { classId } = await props.params;
  const sp = await props.searchParams;
  const { user, school } = await requireSchoolUser();
  if (!isUuid(classId)) notFound();
  const [cls] = await sql<{
    id: string; name: string; section: string | null; bulletin_period: PeriodCode | null; titular_name: string | null;
    bulletin_regime: Regime; bulletin_title: string | null;
  }[]>`
    select id, name, section, bulletin_period, titular_name, bulletin_regime, bulletin_title
    from classes where id = ${classId} and school_id = ${school.id}`;
  if (!cls) notFound();

  const isDirector = user.role === "director";
  const regime = cls.bulletin_regime;
  const data = await classBulletins(school.id, classId, school.academic_year, regime);
  const { subjects, bulletins, ranked } = data;
  const periods = periodsOf(regime);
  const tab = TABS.some((t) => t.key === sp.onglet) ? (sp.onglet as (typeof TABS)[number]["key"]) : subjects.length ? "notes" : "cours";
  const period: PeriodCode = isPeriod(sp.periode, regime) ? sp.periode : "p1";
  const exam = isExam(period);
  const gridSubjects = exam ? subjects.filter((s) => s.has_exam) : subjects;
  const domains = [...new Set(subjects.map((s) => s.domain).filter((d): d is string => !!d))];
  const groups = [...new Set(subjects.map((s) => s.grp).filter((g): g is string => !!g))];
  const otherClasses = isDirector
    ? await sql<{ id: string; name: string }[]>`
        select c.id, c.name from classes c where c.school_id = ${school.id} and c.id <> ${classId}
          and exists (select 1 from subjects s where s.class_id = c.id) order by c.name`
    : [];
  const grades = await sql<{ student_id: string; subject_id: string; points: string }[]>`
    select g.student_id, g.subject_id, g.points from grades g join subjects s on s.id = g.subject_id
    where s.class_id = ${classId} and g.period = ${period}`;
  const gradeMap = new Map(grades.map((g) => [`${g.student_id}|${g.subject_id}`, formatPoints(Number(g.points))]));
  const href = (q: Record<string, string>) => `/bulletins/${classId}?${new URLSearchParams(q)}`;
  const label = `${cls.name}${cls.section ? ` (${cls.section})` : ""}`;

  return (
    <>
      <PageHeader
        title={`Bulletins · ${label}`}
        subtitle={`${bulletins.length} élève${bulletins.length > 1 ? "s" : ""} · ${subjects.length} cours · année ${school.academic_year}`}
        back={{ href: "/bulletins", label: "Toutes les classes" }}
        actions={subjects.length > 0 && bulletins.length > 0 ? (
          <LinkButton href={`/bulletins/${classId}/imprimer`} target="_blank">Imprimer tous les bulletins</LinkButton>
        ) : undefined}
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-canvas p-1 text-sm" role="tablist">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ onglet: t.key })} role="tab" aria-selected={tab === t.key}
            className={cx("whitespace-nowrap rounded-md px-3 py-2", tab === t.key ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "cours" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Cours de la classe" className="lg:col-span-2">
            {subjects.length === 0 ? (
              <p className="text-sm text-muted">Aucun cours. Ajoutez la liste habituelle d&apos;un coup, puis ajustez les maxima.</p>
            ) : (
              <ul className="divide-y divide-line">
                {subjects.map((s) => (
                  <li key={s.id} className="py-2">
                    {isDirector ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <ActionForm action={updateSubject} className="grid flex-1 grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 sm:grid-cols-[3.5rem_minmax(0,1fr)_4.5rem_auto_auto]">
                          <input type="hidden" name="id" value={s.id} />
                          <Input name="position" defaultValue={s.position} aria-label="Ordre" inputMode="numeric" />
                          <Input name="name" defaultValue={s.name} aria-label="Nom du cours" />
                          <Input name="max_points" defaultValue={s.max_points} aria-label="Maximum par période" inputMode="numeric" />
                          <label className="col-span-3 flex items-center gap-1.5 text-xs text-muted sm:col-span-1">
                            <input type="checkbox" name="has_exam" defaultChecked={s.has_exam} /> Examen
                          </label>
                          <div className="hidden sm:block"><SubmitButton variant="secondary" pendingText="…">Enregistrer</SubmitButton></div>
                          <div className="col-span-3 grid grid-cols-2 gap-2 sm:col-span-5">
                            <Input name="domain" defaultValue={s.domain ?? ""} list="domaines" aria-label="Domaine" placeholder="Domaine (facultatif)" className="text-xs" />
                            <Input name="grp" defaultValue={s.grp ?? ""} list="groupes" aria-label="Sous-groupe" placeholder="Sous-groupe (facultatif)" className="text-xs" />
                          </div>
                          <div className="col-span-3 sm:hidden"><SubmitButton variant="secondary" pendingText="…">Enregistrer</SubmitButton></div>
                        </ActionForm>
                        <ConfirmActionButton action={deleteSubject} fields={{ id: s.id }} label="Supprimer" confirmMessage={`Supprimer « ${s.name} » et toutes ses notes ?`} />
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm"><span>{s.name}</span><span className="text-muted">sur {s.max_points}{s.has_exam ? "" : " · sans examen"}</span></div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <datalist id="domaines">{domains.map((d) => <option key={d} value={d} />)}</datalist>
            <datalist id="groupes">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            <p className="mt-3 text-xs text-muted">
              Ordre · nom · maximum par période · examen · domaine · sous-groupe. L&apos;examen compte le double (cours sur 10 → examen sur 20).
              Décochez « Examen » pour un cours sans examen (pratique professionnelle…). Le domaine et le sous-groupe font les titres
              et les sous-totaux du bulletin du primaire ; au secondaire, laissez-les vides : les cours sont groupés par maxima.
            </p>
          </Card>
          {isDirector && (
            <div className="space-y-4">
              <Card title="Modèle du bulletin">
                <ActionForm action={saveBulletinLayout}>
                  <input type="hidden" name="class_id" value={classId} />
                  <Field label="Organisation de l'année">
                    <Select name="bulletin_regime" defaultValue={regime}>
                      {(Object.keys(REGIMES) as Regime[]).map((r) => <option key={r} value={r}>{REGIMES[r]}</option>)}
                    </Select>
                  </Field>
                  <Field label="Titre imprimé" hint="Laissez vide pour « Bulletin de l'élève · classe »">
                    <Input name="bulletin_title" defaultValue={cls.bulletin_title ?? ""}
                      placeholder={regime === "trimestre" ? "Bulletin de l'élève degré élémentaire (1re, 2e année)" : "Bulletin de la 1re année construction"} />
                  </Field>
                  <Field label="Titulaire de la classe">
                    <Input name="titular_name" defaultValue={cls.titular_name ?? ""} placeholder="Ex. Mme KABEYA" />
                  </Field>
                  <SubmitButton variant="secondary">Enregistrer</SubmitButton>
                </ActionForm>
              </Card>
              <Card title="Ajouter un cours">
                <ActionForm action={addSubject} resetOnSuccess>
                  <input type="hidden" name="class_id" value={classId} />
                  <Field label="Nom du cours"><Input name="name" required placeholder="Ex. Mathématiques" /></Field>
                  <Field label="Maximum par période" hint="Souvent 10, 20, 40 ou 80"><Input name="max_points" required inputMode="numeric" defaultValue="10" /></Field>
                  <Field label="Domaine" hint="Primaire, facultatif"><Input name="domain" list="domaines" placeholder="Ex. Domaine des langues" /></Field>
                  <Field label="Sous-groupe" hint="Facultatif"><Input name="grp" list="groupes" placeholder="Ex. Français" /></Field>
                  <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" name="has_exam" defaultChecked /> Ce cours a un examen</label>
                  <SubmitButton>Ajouter</SubmitButton>
                </ActionForm>
              </Card>
              <Card title="Ajouter une liste toute prête">
                <ActionForm action={addSubjectSet}>
                  <input type="hidden" name="class_id" value={classId} />
                  <Select name="source" aria-label="Liste de cours" defaultValue={regime === "trimestre" ? "primaire" : "secondaire"}>
                    <option value="primaire">Primaire, degré élémentaire (1re et 2e année)</option>
                    <option value="secondaire">Cours habituels du secondaire</option>
                    {otherClasses.map((c) => <option key={c.id} value={c.id}>Copier les cours de {c.name}</option>)}
                  </Select>
                  <SubmitButton variant="secondary">Ajouter ces cours</SubmitButton>
                </ActionForm>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        subjects.length === 0 ? (
          <Alert kind="info">Définissez d&apos;abord les cours de la classe dans l&apos;onglet « Cours et maxima ».</Alert>
        ) : bulletins.length === 0 ? (
          <Alert kind="info">Aucun élève actif dans cette classe.</Alert>
        ) : (
          <Card>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {periods.map((p) => (
                <Link key={p} href={href({ onglet: "notes", periode: p })}
                  className={cx("rounded-full border px-3 py-1.5 text-sm", period === p ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-line text-ink hover:bg-gray-50")}>
                  {periodLabel(p, regime)}
                </Link>
              ))}
            </div>
            <ActionForm action={saveGrades} key={period}>
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="period" value={period} />
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="min-w-full text-sm">
                  <thead className="bg-canvas">
                    <tr>
                      <th className="sticky left-0 z-10 bg-canvas px-3 py-2 text-left text-xs font-medium text-muted">Élève</th>
                      {gridSubjects.map((s) => (
                        <th key={s.id} className="px-1.5 py-2 text-center text-xs font-medium text-muted">
                          <div className="max-w-24 truncate" title={s.name}>{s.name}</div>
                          <div className="font-normal">/ {periodMax(s.max_points, period)}</div>
                        </th>
                      ))}
                      {!exam && <th className="px-1.5 py-2 text-center text-xs font-medium text-muted">Application</th>}
                      {!exam && <th className="px-1.5 py-2 text-center text-xs font-medium text-muted">Conduite</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {bulletins.map(({ student }) => (
                      <tr key={student.id}>
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium">{studentFullName(student)}</td>
                        {gridSubjects.map((s) => (
                          <td key={s.id} className="px-1 py-1">
                            <input
                              name={`g_${student.id}_${s.id}`}
                              defaultValue={gradeMap.get(`${student.id}|${s.id}`) ?? ""}
                              inputMode="decimal"
                              aria-label={`${studentFullName(student)}, ${s.name}`}
                              className="h-9 w-16 rounded-md border border-line px-1.5 text-center tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                            />
                          </td>
                        ))}
                        {!exam && (["app", "cond"] as const).map((k) => (
                          <td key={k} className="px-1 py-1">
                            <input
                              name={`${k}_${student.id}`}
                              defaultValue={(k === "app" ? student.marks[period]?.application : student.marks[period]?.conduct) ?? ""}
                              list="appreciations"
                              aria-label={`${studentFullName(student)}, ${k === "app" ? "application" : "conduite"}`}
                              className="h-9 w-16 rounded-md border border-line px-1.5 text-center uppercase focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <datalist id="appreciations">{MARK_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
              {exam && gridSubjects.length < subjects.length && (
                <p className="text-xs text-muted">Les cours sans examen ({subjects.filter((s) => !s.has_exam).map((s) => s.name).join(", ")}) n&apos;apparaissent pas ici.</p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton pendingText="Enregistrement des notes…">Enregistrer les notes</SubmitButton>
                <span className="text-xs text-muted">Case vide = pas encore noté. Les virgules sont acceptées (7,5).{!exam && " Application et conduite : E, TB, B, AB, M…"}</span>
              </div>
            </ActionForm>
          </Card>
        )
      )}

      {tab === "appreciations" && (
        bulletins.length === 0 ? <Alert kind="info">Aucun élève actif dans cette classe.</Alert> : (
          <Card>
            <ActionForm action={saveRemarks}>
              <input type="hidden" name="class_id" value={classId} />
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-2 py-2 font-medium">Élève</th>
                      <th className="px-2 py-2 text-right font-medium">Année</th>
                      <th className="px-2 py-2 font-medium">Décision</th>
                      <th className="px-2 py-2 font-medium">Cours à repasser (repêchage)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {bulletins.map(({ student: s, percent }) => (
                      <tr key={s.id}>
                        <td className="whitespace-nowrap px-2 py-1.5 font-medium">{studentFullName(s)}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted">{formatPercent(percent.total) || "—"}</td>
                        <td className="px-2 py-1.5">
                          <Select name={`decision_${s.id}`} defaultValue={s.decision && s.decision in DECISIONS ? s.decision : ""} aria-label="Décision" className="min-w-36">
                            <option value="">Pas encore décidé</option>
                            <option value="passe">Passe</option>
                            <option value="double">Double</option>
                            <option value="echoue">A échoué</option>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5"><Input name={`repechage_${s.id}`} defaultValue={s.repechage ?? ""} className="min-w-56" placeholder="Ex. Mathématiques, Physique" aria-label="Cours à repasser" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted">Application et conduite se notent à chaque période, dans l&apos;onglet « Saisir les points ».</p>
              <SubmitButton>Enregistrer les décisions</SubmitButton>
            </ActionForm>
          </Card>
        )
      )}

      {tab === "resultats" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Classement" className="lg:col-span-2">
            {bulletins.length === 0 || subjects.length === 0 ? (
              <p className="text-sm text-muted">Pas encore de résultats.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-2 py-2 font-medium">Élève</th>
                      {terms(regime).map((t, i) => <th key={t.key} className="px-2 py-2 text-right font-medium">{i === 0 ? "1er" : `${i + 1}e`} {regime === "trimestre" ? "trim." : "sem."}</th>)}
                      <th className="px-2 py-2 text-right font-medium">Année</th>
                      <th className="px-2 py-2 text-right font-medium">Place</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...bulletins].sort((a, b) => (a.place.total ?? 999) - (b.place.total ?? 999)).map((b) => (
                      <tr key={b.student.id}>
                        <td className="whitespace-nowrap px-2 py-2 font-medium">{studentFullName(b.student)}</td>
                        {terms(regime).map((t) => <td key={t.key} className="px-2 py-2 text-right tabular-nums">{formatPercent(b.percent[t.key]) || "—"}</td>)}
                        <td className={cx("px-2 py-2 text-right font-semibold tabular-nums", b.percent.total !== null && (b.percent.total >= 50 ? "text-green-800" : "text-red-700"))}>
                          {formatPercent(b.percent.total) || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{b.place.total === null ? "—" : `${b.place.total} / ${ranked.total}`}</td>
                        <td className="px-2 py-2 text-right">
                          <a href={`/bulletins/${classId}/imprimer?eleve=${b.student.id}`} target="_blank" rel="noopener" className="text-brand-600 hover:underline">Bulletin</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Publication aux parents">
            {isDirector ? (
              <ActionForm action={saveBulletinSettings}>
                <input type="hidden" name="class_id" value={classId} />
                <Field label="Les parents voient le bulletin jusqu'à" hint="Dans leur espace parent, sur leur téléphone">
                  <Select name="bulletin_period" defaultValue={cls.bulletin_period ?? ""}>
                    <option value="">Ne pas publier</option>
                    {periods.map((p) => <option key={p} value={p}>{periodLabel(p, regime)}</option>)}
                  </Select>
                </Field>
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Le directeur choisit quand les parents voient le bulletin.</p>
            )}
            <a href={`/bulletins/${classId}/imprimer`} target="_blank" rel="noopener" className={buttonClass("secondary", "mt-4 w-full")}>Imprimer tous les bulletins</a>
          </Card>
        </div>
      )}
    </>
  );
}
