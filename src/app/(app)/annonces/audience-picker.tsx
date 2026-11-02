"use client";

import { useState } from "react";

type ClassOpt = { id: string; label: string };

/** Choix du public : toute l'école, certaines classes, ou la famille d'un élève (depuis sa fiche). */
export function AudiencePicker({ classes, student }: { classes: ClassOpt[]; student: { id: string; name: string } | null }) {
  const [audience, setAudience] = useState(student ? "student" : "school");
  const options: [string, string][] = [["school", "Toute l'école"], ["classes", "Certaines classes"]];
  if (student) options.push(["student", `Famille de ${student.name}`]);
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-gray-700">Pour qui ? *</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${audience === value ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-line bg-white"}`}>
            <input type="radio" name="audience" value={value} checked={audience === value} onChange={() => setAudience(value)} className="h-4 w-4" />
            {label}
          </label>
        ))}
      </div>
      {student && <input type="hidden" name="student_id" value={student.id} />}
      {audience === "classes" && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-3">
          {classes.length === 0 && <p className="text-sm text-muted">Aucune classe pour cette année.</p>}
          {classes.map((c) => (
            <label key={c.id} className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" name="class_ids" value={c.id} className="h-5 w-5" /> {c.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
