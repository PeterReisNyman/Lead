# Lead Management System

This repository contains a collection of services for processing lead data, scheduling appointments and sending follow up messages. The project is composed of ASP.NET Core web applications and Node.js microservices, all orchestrated with Docker Compose.

## Repository Structure

- `Site` – Main landing site where users can book an appointment with a realtor.
- `DatabaseSite` – Simple site for accessing the lead database.
- `UserDataSite` – Retrieves user data by phone number.
- `Logic` – Node.js services for messaging, scheduling, calendar integration and an intermediary service.
- `Database` – Contains the MySQL schema used by the services.
- `FacebookForm` – Example scripts for working with Facebook forms.
- `docker-compose.yml` – Defines all containers needed for local development.
- `docker-deploy.sh` – Helper script for deploying the containers to a server.

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose.
- Optional: .NET SDK and Node.js if you want to run services outside of containers.

## Running Locally

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in the required values. The file lists credentials for the database, Twilio, OpenAI and other services.
3. Review `docker-compose.yml` if you need to override any of the environment variables defined in `.env`.
4. Start the stack:

   ```bash
   docker-compose up --build
   ```

   The compose file starts the database, the ASP.NET sites and all Node.js services. Once running you can access:

   - Site Frontend: [http://localhost:5050](http://localhost:5050)
   - Database Site: [http://localhost:5051](http://localhost:5051)
   - User Data Site: [http://localhost:5052](http://localhost:5052)

## Deployment

The `docker-deploy.sh` script demonstrates how to build and push images and deploy them to a remote server. Adjust the script to match your environment before using it.

## Database

The MySQL schema is located in `Database/schema.sql`. When the database container is started, this file is loaded automatically to create tables such as `Realtor`, `Leads`, `Booked`, `Messages`, and `scheduled_messages`.

For Supabase or any PostgreSQL database a translated schema is provided in `Database/postgres.sql`. You can load it with the Supabase CLI or `psql` (the helper script `scripts/load_supabase.sh` automates these commands):

```bash
psql "$SUPABASE_DB_URL" -f Database/postgres.sql
psql "$SUPABASE_DB_URL" -f Database/seed.sql   # optional sample data
```
Or simply run:

```bash
./scripts/load_supabase.sh
```

## Services Overview

### ASP.NET Core Sites

- **Site** – Presents the booking page with a video player and calendar.
- **DatabaseSite** – Minimal site to browse the lead database.
- **UserDataSite** – Allows retrieving user data by phone number.

### Node.js Services (under `Logic`)

- **Messenger** – Sends and receives messages via Twilio and stores message logs.
- **Scheduler** – Schedules follow‑up SMS messages.
- **Calendar** – Integrates with Google Calendar to create events.
- **Intermediary** – Bridge between services and external APIs.

## Customization

Environment variables control connections to MySQL, Twilio, OpenAI, Google APIs and Supabase. Copy `.env.example` to `.env` and provide values for all required keys. The compose file will automatically read this file when starting the containers.

## License

This project is provided as‑is for demonstration purposes.

