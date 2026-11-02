import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/lib/guides";
import { GuideShell, Rich } from "@/components/guide-ui";
import { PrintButton } from "@/components/print-button";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/aide/[slug]">) {
  const g = getGuide((await props.params).slug);
  return g ? { title: g.title, description: g.summary } : {};
}

export default async function GuidePage(props: PageProps<"/aide/[slug]">) {
  const guide = getGuide((await props.params).slug);
  if (!guide) notFound();
  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <GuideShell>
      <Link href="/aide" className="no-print text-sm text-brand-700 hover:underline">← Tous les guides</Link>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">{guide.audience}</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">{guide.title}</h1>
          <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-muted">{guide.summary}</p>
        </div>
        <div className="no-print"><PrintButton /></div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Sommaire" className="no-print lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-4 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mb-2 text-xs font-medium text-muted">Sommaire</div>
            <ol className="space-y-1 text-sm">
              {guide.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 rounded-md py-1 text-gray-700 hover:text-brand-700">
                    <span className="w-5 shrink-0 tabular-nums text-muted">{i + 1}.</span>{s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {guide.sections.map((s, i) => {
            const phone = s.image?.file.startsWith("m-");
            return (
              <section key={s.id} id={s.id} className="scroll-mt-24 break-inside-avoid rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
                <h2 className="flex items-baseline gap-2 text-lg font-semibold text-ink">
                  <span className="tabular-nums text-brand-600">{i + 1}.</span>{s.title}
                </h2>
                <div className={phone ? "mt-3 grid gap-6 md:grid-cols-[1fr_260px] md:items-start" : "mt-3"}>
                  <div className="text-[15px] leading-relaxed text-gray-700">
                    {s.intro && <p className="mb-3">{s.intro}</p>}
                    {s.steps && (
                      <ol className="space-y-2.5">
                        {s.steps.map((t, k) => (
                          <li key={k} className="flex gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{k + 1}</span>
                            <span><Rich text={t} /></span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {s.points && (
                      <ul className="space-y-2">
                        {s.points.map((t, k) => (
                          <li key={k} className="flex gap-3">
                            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                            <span><Rich text={t} /></span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.tip && (
                      <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800"><strong className="font-semibold">Astuce : </strong><Rich text={s.tip} /></p>
                    )}
                  </div>
                  {s.image && (
                    <figure className={phone ? "mx-auto w-full max-w-[260px]" : "mt-5"}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/guides/${s.image.file}.webp`}
                        alt={s.image.alt}
                        width={phone ? 780 : 1600}
                        height={phone ? 1688 : 1000}
                        loading="lazy"
                        className={phone ? "h-auto w-full rounded-[22px] border-4 border-gray-800 shadow-sm" : "h-auto w-full rounded-lg border border-line shadow-sm"}
                      />
                      <figcaption className="mt-2 text-center text-xs text-muted">{s.image.alt}</figcaption>
                    </figure>
                  )}
                </div>
              </section>
            );
          })}

          <div className="no-print rounded-[var(--radius-card)] border border-line bg-white p-5 text-sm text-muted">
            Autres guides :{" "}
            {others.map((g, k) => (
              <span key={g.slug}>{k > 0 && " · "}<Link href={`/aide/${g.slug}`} className="font-medium text-brand-700 hover:underline">{g.title}</Link></span>
            ))}
          </div>
        </div>
      </div>
    </GuideShell>
  );
}
