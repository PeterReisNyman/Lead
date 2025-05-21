#!/bin/bash
# Simple helper to load the PostgreSQL schema and seed data into a Supabase project.
# Requires the SUPABASE_DB_URL environment variable pointing to your database.
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL environment variable not set" >&2
  exit 1
fi

psql "$SUPABASE_DB_URL" -f Database/postgres.sql
if [ -f Database/seed.sql ]; then
  psql "$SUPABASE_DB_URL" -f Database/seed.sql
fi
