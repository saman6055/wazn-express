import { describe, it, expect } from 'vitest';
import {
  isDuplicateKeyError,
  isForeignKeyError,
  dbErrorCode,
  dbErrorNumber,
  dbErrorReason,
} from './lib/dbErrors';

/**
 * These tests are written around the shape Drizzle actually throws, because
 * that shape is what the old checks got wrong: they read `code` off the
 * wrapper, where it does not exist, and grepped the wrapper's message, which
 * is the SQL statement rather than the reason.
 */

/** What mysql2 throws. */
const mysqlDuplicate = Object.assign(new Error("Duplicate entry 'EB000016' for key 'packageCode'"), {
  code: 'ER_DUP_ENTRY',
  errno: 1062,
  sqlMessage: "Duplicate entry 'EB000016' for key 'packageCode'",
});

/** What Drizzle throws once it has wrapped the above. */
const drizzleWrapped = Object.assign(
  new Error(
    'Failed query: insert into `packageOrderLinks` (`id`, `packageId`, `fullPackageOrderId`, ' +
    '`cartonIndex`, `isPrimary`, `createdAt`) values (default, ?, ?, ?, ?, default)\nparams: 3008,1466,1,true',
  ),
  { cause: mysqlDuplicate },
);

describe('the production bug: a duplicate hidden inside a Drizzle wrapper', () => {
  it('recognises the duplicate through the wrapper', () => {
    // This is the case that logged hundreds of false failures on every boot.
    expect(isDuplicateKeyError(drizzleWrapped)).toBe(true);
  });

  it('recognises a bare mysql2 duplicate too', () => {
    expect(isDuplicateKeyError(mysqlDuplicate)).toBe(true);
  });

  it('reads the code and errno out of the cause', () => {
    expect(dbErrorCode(drizzleWrapped)).toBe('ER_DUP_ENTRY');
    expect(dbErrorNumber(drizzleWrapped)).toBe(1062);
  });

  it('reports the reason, not the statement', () => {
    // The wrapper's own message is the whole INSERT, which is truncated in
    // logs exactly where the useful part would have been.
    const reason = dbErrorReason(drizzleWrapped);

    expect(reason).toContain('Duplicate entry');
    expect(reason).not.toContain('Failed query');
  });

  it('survives a wrapper nested more than once', () => {
    const doubled = Object.assign(new Error('Failed query: ...'), { cause: drizzleWrapped });

    expect(isDuplicateKeyError(doubled)).toBe(true);
  });
});

describe('what must not be mistaken for a duplicate', () => {
  it('does not treat a missing column as one', () => {
    const err = Object.assign(new Error('Failed query: ...'), {
      cause: Object.assign(new Error("Unknown column 'x' in 'field list'"), {
        code: 'ER_BAD_FIELD_ERROR',
        errno: 1054,
        sqlMessage: "Unknown column 'x' in 'field list'",
      }),
    });

    expect(isDuplicateKeyError(err)).toBe(false);
  });

  it('does not treat a foreign key violation as one', () => {
    // These mean the data is wrong, not merely repeated, and must stay loud.
    const err = Object.assign(new Error('Failed query: ...'), {
      cause: Object.assign(new Error('Cannot add or update a child row'), {
        code: 'ER_NO_REFERENCED_ROW_2',
        errno: 1452,
        sqlMessage: 'Cannot add or update a child row: a foreign key constraint fails',
      }),
    });

    expect(isDuplicateKeyError(err)).toBe(false);
    expect(isForeignKeyError(err)).toBe(true);
  });

  it('is not fooled by the word "unique" appearing in a table or column name', () => {
    // The old check grepped for /duplicate|unique/, so an error mentioning a
    // constraint called uniq_pol_pkg_order read as a duplicate whatever it was.
    const err = Object.assign(new Error('Failed query: ...'), {
      cause: Object.assign(new Error("Unknown column 'uniq_pol_pkg_order'"), {
        code: 'ER_BAD_FIELD_ERROR',
        errno: 1054,
        sqlMessage: "Unknown column 'uniq_pol_pkg_order' in 'field list'",
      }),
    });

    expect(isDuplicateKeyError(err)).toBe(false);
  });
});

describe('anything that is not a database error', () => {
  it('returns empty rather than throwing', () => {
    for (const v of [null, undefined, 'a string', 42, {}, new Error('plain')]) {
      expect(isDuplicateKeyError(v), String(v)).toBe(false);
      expect(dbErrorCode(v), String(v)).toBe('');
      expect(dbErrorNumber(v), String(v)).toBe(0);
    }
  });

  it('does not hang on a cause that points at itself', () => {
    const cyclic: Record<string, unknown> = { message: 'looping' };
    cyclic.cause = cyclic;

    expect(isDuplicateKeyError(cyclic)).toBe(false);
  });
});
