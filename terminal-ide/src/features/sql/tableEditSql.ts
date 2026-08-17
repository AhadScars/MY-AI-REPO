/** Build INSERT / UPDATE / DELETE without the user writing SQL. */

export type ColMeta = { name: string; type: string; notnull: boolean; pk: boolean };

export function qIdent(name: string, mysql: boolean): string {
  return mysql ? `\`${name.replace(/`/g, '``')}\`` : `"${name.replace(/"/g, '""')}"`;
}

export function qValue(v: string | null): string {
  if (v === null) return 'NULL';
  // numeric-looking unquoted (int/float) — safer quoted always for user data
  const t = v.trim();
  if (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) return t;
  return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

export function cellToDisplay(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export function buildUpdateSql(
  table: string,
  columns: ColMeta[],
  original: (string | null)[],
  current: (string | null)[],
  mysql: boolean,
): string | null {
  const t = qIdent(table, mysql);
  const sets: string[] = [];
  columns.forEach((c, i) => {
    if (original[i] === current[i]) return;
    sets.push(`${qIdent(c.name, mysql)} = ${qValue(current[i] ?? null)}`);
  });
  if (sets.length === 0) return null;

  const pkIdx = columns.map((c, i) => (c.pk ? i : -1)).filter((i) => i >= 0);
  let where: string;
  if (pkIdx.length > 0) {
    where = pkIdx
      .map((i) => `${qIdent(columns[i]!.name, mysql)} = ${qValue(original[i] ?? null)}`)
      .join(' AND ');
  } else {
    // fallback: match all original columns
    where = columns
      .map((c, i) => {
        const v = original[i];
        if (v === null) return `${qIdent(c.name, mysql)} IS NULL`;
        return `${qIdent(c.name, mysql)} = ${qValue(v)}`;
      })
      .join(' AND ');
  }
  return `UPDATE ${t} SET ${sets.join(', ')} WHERE ${where}`;
}

export function buildInsertSql(
  table: string,
  columns: ColMeta[],
  row: (string | null)[],
  mysql: boolean,
): string {
  const t = qIdent(table, mysql);
  const cols: string[] = [];
  const vals: string[] = [];
  columns.forEach((c, i) => {
    // skip empty for auto-increment PK
    if (c.pk && (row[i] === null || row[i] === '')) return;
    cols.push(qIdent(c.name, mysql));
    vals.push(qValue(row[i] ?? null));
  });
  if (cols.length === 0) {
    return `INSERT INTO ${t} DEFAULT VALUES`;
  }
  return `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
}

export function buildDeleteSql(
  table: string,
  columns: ColMeta[],
  original: (string | null)[],
  mysql: boolean,
): string {
  const t = qIdent(table, mysql);
  const pkIdx = columns.map((c, i) => (c.pk ? i : -1)).filter((i) => i >= 0);
  let where: string;
  if (pkIdx.length > 0) {
    where = pkIdx
      .map((i) => `${qIdent(columns[i]!.name, mysql)} = ${qValue(original[i] ?? null)}`)
      .join(' AND ');
  } else {
    where = columns
      .map((c, i) => {
        const v = original[i];
        if (v === null) return `${qIdent(c.name, mysql)} IS NULL`;
        return `${qIdent(c.name, mysql)} = ${qValue(v)}`;
      })
      .join(' AND ');
  }
  return `DELETE FROM ${t} WHERE ${where}`;
}
