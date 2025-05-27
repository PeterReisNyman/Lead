# Repository Scripts

This document briefly describes the helper scripts provided with the project. All files are in the repository root unless otherwise noted.

## `scripts/load_supabase.sh`

Loads the PostgreSQL schema into a Supabase project. The script expects the environment variable `SUPABASE_DB_URL` to contain the connection string. It then runs `psql` to execute `Database/postgres.sql` and, if present, `Database/seed.sql`. Use it when you need to initialise a Supabase database with the project's schema and optional seed data:

```bash
SUPABASE_DB_URL=postgres://user:pass@host/db ./scripts/load_supabase.sh
```

## Other scripts
