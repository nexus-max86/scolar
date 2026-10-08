import { excelResponse } from "@/lib/excel";
import { forbidden, routeSchoolUser } from "@/lib/route-auth";

export async function GET() {
  if (!(await routeSchoolUser())) return forbidden();
  return excelResponse(
    "modele-import-eleves.xlsx",
    "Élèves",
    [
      { header: "Matricule", key: "a", width: 12 },
      { header: "Nom", key: "b" },
      { header: "Postnom", key: "c" },
      { header: "Prénom", key: "d" },
      { header: "Sexe", key: "e", width: 8 },
      { header: "Date de naissance", key: "f" },
      { header: "Classe", key: "g" },
      { header: "Nom du parent", key: "h", width: 24 },
      { header: "Téléphone du parent", key: "i", width: 20 },
      { header: "Adresse", key: "j", width: 30 },
    ],
    [{ a: "", b: "MUKENDI", c: "KALALA", d: "Grâce", e: "F", f: "14/03/2014", g: "6e primaire", h: "Jean Mukendi", i: "0812345678", j: "Av. Kasa-Vubu 10, Kinshasa" }],
  );
}
