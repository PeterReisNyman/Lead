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
2. Copy `.env.example` to `.env` and fill in your Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Review `docker-compose.yml` and set any other environment variables required by your services (database credentials, Twilio keys, OpenAI key, Google calendar credentials, etc.).
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

Environment variables control connections to MySQL, Twilio, OpenAI, Google APIs and Supabase. The stack expects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to be set. Update them in `docker-compose.yml` or supply a `.env` file before starting the containers.

## License

This project is provided as‑is for demonstration purposes.

