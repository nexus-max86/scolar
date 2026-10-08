import { Field, Input, Select } from "@/components/ui";
import { classLabel, type ClassOption } from "@/lib/students";

type Defaults = Partial<{
  id: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  birth_date: Date | string | null;
  gender: string | null;
  address: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  class_id: string | null;
  student_number: string;
  enrolled_at: Date | string | null;
}>;

function isoDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return typeof d === "string" ? d.slice(0, 10) : d.toLocaleDateString("en-CA");
}

export function StudentFields({ classes, defaults = {}, edit = false }: { classes: ClassOption[]; defaults?: Defaults; edit?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <Field label="Nom *">
        <Input name="last_name" required defaultValue={defaults.last_name ?? ""} autoCapitalize="characters" />
      </Field>
      <Field label="Postnom">
        <Input name="middle_name" defaultValue={defaults.middle_name ?? ""} autoCapitalize="characters" />
      </Field>
      <Field label="Prénom">
        <Input name="first_name" defaultValue={defaults.first_name ?? ""} />
      </Field>
      <Field label="Sexe">
        <Select name="gender" defaultValue={defaults.gender ?? ""}>
          <option value="">—</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </Select>
      </Field>
      <Field label="Date de naissance">
        <Input name="birth_date" type="date" defaultValue={isoDate(defaults.birth_date)} />
      </Field>
      <Field label="Classe">
        <Select name="class_id" defaultValue={defaults.class_id ?? ""}>
          <option value="">— Choisir —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nom du parent ou tuteur">
        <Input name="parent_name" defaultValue={defaults.parent_name ?? ""} />
      </Field>
      <Field label="Téléphone du parent" hint="Utilisé pour WhatsApp">
        <Input name="parent_phone" type="tel" defaultValue={defaults.parent_phone ?? ""} placeholder="0812 345 678" />
      </Field>
      <Field label="Adresse">
        <Input name="address" defaultValue={defaults.address ?? ""} />
      </Field>
      <Field label={edit ? "Matricule *" : "Matricule"} hint={edit ? undefined : "Laisser vide pour un numéro automatique"}>
        <Input name="student_number" defaultValue={defaults.student_number ?? ""} required={edit} />
      </Field>
      <Field label="Date d'inscription">
        <Input name="enrolled_at" type="date" defaultValue={isoDate(defaults.enrolled_at)} />
      </Field>
    </div>
  );
}
