import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ROLE_LABELS, formatDate } from "@/lib/labels";
import { ActionForm, ConfirmActionButton, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { createUser, resetPassword, toggleUser } from "./actions";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const { user, school } = await requireSchoolUser(["director"]);
  const users = await sql<{ id: string; name: string; email: string; phone: string | null; role: string; status: string; last_login_at: Date | null }[]>`
    select id, name, email, phone, role, status, last_login_at from users
    where school_id = ${school.id} order by status, role desc, name`;

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Les personnes qui peuvent se connecter à l'espace de votre école" />
      <Card title="Ajouter un utilisateur" className="mb-4">
        <ActionForm action={createUser} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
          <Field label="Nom complet *"><Input name="name" required /></Field>
          <Field label="E-mail de connexion *"><Input name="email" type="email" required /></Field>
          <Field label="Téléphone"><Input name="phone" type="tel" /></Field>
          <Field label="Rôle *">
            <Select name="role" defaultValue="cashier">
              <option value="cashier">Secrétaire / caissier</option>
              <option value="director">Directeur (accès complet)</option>
            </Select>
          </Field>
          <Field label="Mot de passe provisoire *" hint="8 caractères minimum"><Input name="password" required minLength={8} autoComplete="new-password" /></Field>
          <div className="flex items-end"><SubmitButton>Créer le compte</SubmitButton></div>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">
          Le caissier peut inscrire des élèves, encaisser, imprimer les reçus et voir les impayés. Il ne peut pas modifier les
          frais, annuler un paiement ni gérer les utilisateurs.
        </p>
      </Card>
      <Card className="p-0 sm:p-0">
        <Table head={["Nom", "Rôle", "Statut", "Dernière connexion", ""]}>
          {users.map((u) => (
            <tr key={u.id} className="align-top">
              <Td><div className="font-semibold">{u.name}</div><div className="text-xs text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</div></Td>
              <Td>{ROLE_LABELS[u.role]}</Td>
              <Td><Badge color={u.status === "active" ? "green" : "gray"}>{u.status === "active" ? "Actif" : "Désactivé"}</Badge></Td>
              <Td>{formatDate(u.last_login_at)}</Td>
              <Td>
                {u.id !== user.id && (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-brand-700">Gérer</summary>
                    <div className="mt-2 w-64 space-y-3 whitespace-normal">
                      <ActionForm action={resetPassword} resetOnSuccess className="space-y-2">
                        <input type="hidden" name="id" value={u.id} />
                        <Field label="Nouveau mot de passe"><Input name="password" required minLength={8} autoComplete="new-password" /></Field>
                        <SubmitButton variant="secondary">Changer le mot de passe</SubmitButton>
                      </ActionForm>
                      <ConfirmActionButton
                        action={toggleUser}
                        fields={{ id: u.id }}
                        label={u.status === "active" ? "Désactiver le compte" : "Réactiver le compte"}
                        variant={u.status === "active" ? "danger" : "secondary"}
                        confirmMessage={u.status === "active" ? `Désactiver le compte de ${u.name} ?` : `Réactiver le compte de ${u.name} ?`}
                      />
                    </div>
                  </details>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
