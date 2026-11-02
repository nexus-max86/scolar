import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions";
import { announcementMessage, audienceLabel, getAnnouncement, recipientsOf, type Recipient } from "@/lib/announcements";
import { formatDate, studentFullName } from "@/lib/labels";
import { toWhatsAppNumber, whatsAppLink } from "@/lib/phone";
import { parentLink } from "@/lib/app-url";
import { CopyButton } from "@/components/copy-button";
import { ConfirmActionButton } from "@/components/forms";
import { Alert, Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { archiveAnnouncement } from "../actions";

export const metadata = { title: "Annonce" };

/** Une ligne par famille : les frères et sœurs qui partagent le numéro du parent sont regroupés. */
function families(recipients: Recipient[]) {
  const map = new Map<string, Recipient[]>();
  for (const r of recipients) {
    const key = toWhatsAppNumber(r.parent_phone) ?? `sans-numero-${r.id}`;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.values()];
}

export default async function AnnouncementPage(props: PageProps<"/annonces/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { school } = await requireSchoolUser(["director"]);
  if (!isUuid(id)) notFound();
  const a = await getAnnouncement(school.id, id);
  if (!a) notFound();
  const recipients = await recipientsOf(school.id, id);
  const groups = families(recipients);
  const groupMessage = announcementMessage(school.name, a);
  const withPhone = groups.filter((g) => toWhatsAppNumber(g[0].parent_phone));
  const links = await Promise.all(groups.map((g) => parentLink(g[0].parent_token)));

  return (
    <>
      <PageHeader
        title={a.title}
        subtitle={<>Publiée le {formatDate(a.created_at)}{a.author ? ` par ${a.author}` : ""} · {audienceLabel(a)}</>}
        back={{ href: "/annonces", label: "Annonces" }}
      />
      {sp.publiee && <div className="mb-4"><Alert kind="success">Annonce publiée sur l&apos;espace parent. Envoyez-la maintenant par WhatsApp pour prévenir les familles.</Alert></div>}
      {a.archived_at && <div className="mb-4"><Alert kind="warning">Cette annonce a été retirée : les parents ne la voient plus.</Alert></div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <Card title="Message">
            {a.event_date && <p className="mb-2 text-sm font-medium text-brand-700">Date : {formatDate(a.event_date)}</p>}
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-gray-800">{a.body}</p>
            <p className="mt-4 text-sm text-muted">Ouverte par les familles de <strong className="text-ink">{a.reads}</strong> élève{a.reads > 1 ? "s" : ""} sur {a.recipients} concerné{a.recipients > 1 ? "s" : ""}.</p>
          </Card>
          <Card title="Envoyer dans un groupe WhatsApp">
            <p className="text-sm text-muted">Pour le groupe des parents d&apos;une classe ou une liste de diffusion : copiez le message ou partagez-le directement.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={whatsAppLink(null, groupMessage)} target="_blank" rel="noopener" className={buttonClass("success")}>Partager dans WhatsApp</a>
              <CopyButton text={groupMessage} label="Copier le message" />
            </div>
          </Card>
          {!a.archived_at && (
            <ConfirmActionButton
              action={archiveAnnouncement}
              fields={{ id: a.id }}
              label="Retirer l'annonce"
              variant="secondary"
              confirmMessage="Retirer cette annonce de l'espace des parents ?"
            />
          )}
        </div>

        <Card title={`Envoyer à chaque famille (${withPhone.length})`} className="p-0 sm:p-0">
          <p className="px-4 pb-3 text-sm text-muted sm:px-5">Chaque message contient le lien personnel de la famille. Touchez « Envoyer », puis envoyez dans WhatsApp.</p>
          <ul className="divide-y divide-line border-t border-line">
            {groups.map((g, k) => {
              const first = g[0];
              const read = g.some((r) => r.read_at);
              return (
                <li key={first.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{g.map((r) => studentFullName(r)).join(", ")}</div>
                    <div className="truncate text-xs text-muted">
                      {[...new Set(g.map((r) => r.class_name ?? "Sans classe"))].join(", ")} · {first.parent_name ?? "Parent"} {first.parent_phone ? `· ${first.parent_phone}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {read && <Badge color="green">Lue</Badge>}
                    {toWhatsAppNumber(first.parent_phone) ? (
                      <a href={whatsAppLink(first.parent_phone, announcementMessage(school.name, a, links[k]))} target="_blank" rel="noopener" className={buttonClass("secondary", "min-h-9 px-3")}>Envoyer</a>
                    ) : (
                      <span className="text-xs text-muted">Pas de numéro</span>
                    )}
                  </div>
                </li>
              );
            })}
            {groups.length === 0 && <li className="px-4 py-3 text-sm text-muted sm:px-5">Aucun élève actif concerné.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
