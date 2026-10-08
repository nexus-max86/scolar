import type postgres from "postgres";
import { sql as defaultSql } from "./db";

export async function audit(
  entry: {
    schoolId: string | null;
    userId: string | null;
    action: string;
    table?: string;
    recordId?: string;
    details?: Record<string, unknown>;
  },
  tx: postgres.Sql | postgres.TransactionSql = defaultSql,
) {
  await tx`
    insert into audit_logs (school_id, user_id, action, table_name, record_id, details)
    values (${entry.schoolId}, ${entry.userId}, ${entry.action}, ${entry.table ?? null},
            ${entry.recordId ?? null}, ${entry.details ? tx.json(entry.details as postgres.JSONValue) : null})`;
}
