export function buildContactsListQuery({ query = {}, user = {} } = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const q = String(query.search || query.q || "").trim();
  const search = q ? `%${q}%` : null;

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const params = [search, limit, offset];
  let aggWhere = "";
  let contactTeamFilter = "";
  if (!isAdmin) {
    params.push(user.id);
    aggWhere = `WHERE (c.team_id IS NULL OR c.team_id IN (SELECT team_id FROM omni_team_members WHERE user_id = $${params.length}::uuid))`;
    contactTeamFilter = "AND agg.contact_id IS NOT NULL";
  }

  return {
    params,
    sql: `SELECT co.id, co.name, co.email, co.phone, co.wa_phone, co.ml_user_id,
                co.avatar_url, co.created_at, co.updated_at,
                COALESCE(agg.conversation_count, 0) AS conversation_count,
                agg.last_activity_at,
                COALESCE(agg.channels, '{}') AS channels,
                COUNT(*) OVER() AS total_count
           FROM omni_contacts co
           LEFT JOIN (
             SELECT c.contact_id,
                    COUNT(*)::int AS conversation_count,
                    MAX(c.updated_at) AS last_activity_at,
                    array_agg(DISTINCT c.channel) AS channels
               FROM omni_conversations c
               ${aggWhere}
              GROUP BY c.contact_id
           ) agg ON agg.contact_id = co.id
          WHERE co.properties->>'merged_into' IS NULL
            AND ($1::text IS NULL
                 OR co.name ILIKE $1 OR co.email ILIKE $1
                 OR co.phone ILIKE $1 OR co.wa_phone ILIKE $1)
            ${contactTeamFilter}
          ORDER BY co.updated_at DESC
          LIMIT $2 OFFSET $3`,
  };
}

export function mapContactsListRows(rows = []) {
  const totalCount = rows[0]?.total_count ?? 0;
  return {
    count: rows.length,
    total_count: Number(totalCount),
    contacts: rows.map(({ total_count: _tc, ...row }) => row),
  };
}
