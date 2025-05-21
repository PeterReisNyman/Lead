# Supabase + NestJS Migration Issues

This document provides a list of GitHub issues that can be created to help move the project from the current MySQL + ASP.NET/Node setup to Supabase and NestJS services.

## 1. Prepare a Supabase Environment
- [ ] Create a Supabase account and project.
- [ ] Configure an initial Postgres database with connection credentials.
- [ ] Document environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc.).

## 2. Convert MySQL Schema to Supabase
- [ ] Map existing MySQL tables from `Database/schema.sql` to PostgreSQL syntax.
- [ ] Import the data from the current MySQL database into Supabase.
- [ ] Create SQL migration files so the schema can be reproduced via `psql` or Supabase CLI.

## 3. Establish a NestJS Monorepo
- [ ] Initialize a new NestJS workspace with `nest new` or `nest workspace`.
- [ ] Set up shared configuration for environment variables and Supabase connections.
- [ ] Plan whether each service becomes a standalone microservice or modules within a monorepo.

## 4. Rewrite Node Services using NestJS
For each folder under `Logic/` (`Messaging`, `Scheduler`, `Calendar`, `Intermediary`):
- [ ] Scaffold a NestJS service that exposes the same HTTP endpoints.
- [ ] Replace raw MySQL calls with Supabase client queries.
- [ ] Add unit tests for the new service logic.

## 5. Replace ASP.NET Sites with NestJS APIs or Frontend
- [ ] Decide if the functionality in `Site`, `DatabaseSite`, and `UserDataSite` should be reimplemented in NestJS (e.g., using NestJS MVC or serving a separate frontend).
- [ ] Port controllers, views, and hubs to NestJS equivalents if needed.
- [ ] Update Dockerfiles and environment variables for the new services.

## 6. Update Docker Compose for Supabase and NestJS
- [ ] Remove the MySQL service and reference Supabase connection strings instead.
- [ ] Build Docker images for each NestJS service.
- [ ] Ensure local development can run all services using `docker-compose up`.

## 7. Documentation and Clean Up
- [ ] Document the new setup in `README.md` including Supabase credentials and NestJS commands.
- [ ] Remove obsolete code once the NestJS services are stable.
- [ ] Provide migration notes for developers.

