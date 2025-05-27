# Environment Variables

This page summarises the variables defined in `.env.example` and what they are used for.

## Supabase
- `SUPABASE_URL` – URL of the Supabase instance used by the Nest backend.
- `SUPABASE_ANON_KEY` – public API key allowing anonymous access to Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` – service role key for privileged operations in Supabase.

## MySQL
- `MYSQL_ROOT_PASSWORD` – password for the MySQL `root` user when running the database container.
- `DB_USER` – application database user.
- `DB_PASSWORD` – password for `DB_USER`.
- `DB_NAME` – name of the MySQL database (defaults to `lead_db`).

## Twilio
- `TWILIO_ACCOUNT_SID` – account identifier for sending SMS via Twilio.
- `TWILIO_AUTH_TOKEN` – authentication token used with the SID.
- `TWILIO_PHONE_NUMBER` – phone number from which SMS are sent.

## Third‑party APIs
- `OPENAI_API_KEY` – key for generating AI responses via OpenAI.

## User Data Site
- `USER_DATA_PASSWORD` – password required to generate a user data report.

## Deployment
- `SERVER_IP` – target server address for `docker-deploy.sh`.
- `SERVER_USER` – SSH user for deployment (default `root`).
- `SERVER_PASSWORD` – password for the SSH user.
- `SERVER_PORT` – SSH port (default `22`).
- `DOCKER_USERNAME` – Docker Hub username used when tagging images.

## Miscellaneous
- `WEBHOOK_URL` – endpoint that receives lead data (used by the Facebook form utilities).
