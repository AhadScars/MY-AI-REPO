import { describe, expect, it } from 'vitest';
import { splitSqlStatements } from '../electron/main/sql/sql-service';

describe('splitSqlStatements', () => {
  it('splits on bare semicolons', () => {
    const stmts = splitSqlStatements('SELECT 1; SELECT 2;');
    expect(stmts).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('ignores semicolons inside strings', () => {
    const stmts = splitSqlStatements(`INSERT INTO t VALUES ('a;b'); SELECT 1;`);
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("'a;b'");
  });

  it('ignores line comments', () => {
    const stmts = splitSqlStatements(`-- hi;\nSELECT 1;`);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toMatch(/SELECT 1/);
  });

  it('returns single statement without trailing semicolon', () => {
    expect(splitSqlStatements('SELECT * FROM users')).toEqual(['SELECT * FROM users']);
  });
});
