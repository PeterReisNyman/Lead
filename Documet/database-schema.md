# Database Schema

This document summarizes the main tables used by the Lead Management System.
The table definitions can be found in [`Database/schema.sql`](../Database/schema.sql).
Example data for local development is provided in [`Database/seed.sql`](../Database/seed.sql).

## Tables

### Realtor
- `realtor_id` – primary key
- `uuid` – unique identifier
- `phone`
- `f_name` – first name
- `e_name` – last name
- `video_url`
- `email`
- `website_url`
- `created_at`

### Leads
- `phone` – primary key
- `realtor_id` – references `Realtor`
- `first_name`
- `last_name`
- `address`
- `lead_state` – booked/hot/warm/cold
- `home_type` – e.g. single family, condo
- `home_built`
- `home_worth`
- `sell_time`
- `home_condition`
- `working_with_agent`
- `looking_to_buy`
- `ad_id`
- `tracking_parameters`
- `sent_schedule_reminder`
- `created_at`

### Booked
- `phone` – primary key
- `full_name`
- `booked_date`
- `booked_time`
- `time_zone`
- `realtor_id` – references `Realtor`
- `created_at`

### Messages
- `phone` – references `Leads`
- `messages_conversation` – JSON payload

### scheduled_messages
- `id` – primary key
- `phone`
- `scheduled_time`
- `message_type`
- `message_status`
- `message_text`
- `created_at`

### message_logs
- `id` – primary key
- `phone`
- `message_type`
- `message_text`
- `sent_at`
- `status`

## Example Data
The seed script inserts two sample leads and a booked appointment:
```sql
INSERT INTO Leads (...)
    ('555-0001', 1, 'Eve', 'Example', '123 Main St', ...),
    ('555-0002', 2, 'John', 'Doe', '456 Oak Ave', ...);
INSERT INTO Booked (phone, full_name, booked_date, booked_time, time_zone, realtor_id)
VALUES ('555-0001', 'Eve Example', CURRENT_DATE, '10:00', 'UTC', 1);
```
See [`Database/seed.sql`](../Database/seed.sql) for the full statements.

## Loading the Schema
Run `scripts/load_supabase.sh` with the `SUPABASE_DB_URL` environment variable set to your Postgres connection string:
```bash
export SUPABASE_DB_URL="postgres://user:pass@host:port/db"
./scripts/load_supabase.sh
```
The script loads `Database/postgres.sql` and `Database/seed.sql` into the target database.
