# Database migrations

- `0000` – initial schema.
- `0001` – everything added since `0000` (credentials vault, messaging, print records,
  history tables, expense rejection fields, `numeric(12,2)` money columns, ...).
  It replaces the earlier hand-written `0001` that had no snapshot. Money columns are
  converted from `varchar` with an explicit `USING` cast.

## Fresh database
```bash
DATABASE_URL=... npx drizzle-kit migrate
```

## Existing database (created earlier with `db:push`)
Do **not** run `0001`: its objects already exist and it would fail. Back up first, then
compare with `npx drizzle-kit push` (review the diff it prints before confirming), or
mark the migrations as applied in `drizzle.__drizzle_migrations`.
Note: on an existing database the money columns may still be `varchar` — check before pushing.

## Changing the schema
Edit `shared/schema.ts`, run `npx drizzle-kit generate`, review the SQL, commit it.
Prefer `migrate` over `push` in production.

## Verifying migrations
`npm run test:integration` (needs `TEST_DATABASE_URL`, see `tests/integration/`) applies all
migrations to an empty database before running the tests, so a migration that does not apply
cleanly fails CI.
