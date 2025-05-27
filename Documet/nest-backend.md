# NestJS Backend

This repository includes a small [NestJS](https://nestjs.com/) project located in `nest/lead-nest`. The service only exposes a single `GET /` endpoint returning `Hello World!` and demonstrates how to connect to Supabase.

## Minimal setup

- `AppModule` imports `ConfigModule.forRoot({ isGlobal: true })` and the custom `SupabaseClientModule`.
- `SupabaseClientModule` registers a provider named `SUPABASE_CLIENT` which creates a Supabase client using the `SUPABASE_URL` and `SUPABASE_KEY` environment variables. Services can inject this client with `@Inject(SupabaseClientToken)`.
- `main.ts` bootstraps the application and listens on the port specified by the `PORT` variable (default `3000`).

## Running the service

1. Copy `.env.example` in `nest/lead-nest` to `.env` and supply your Supabase URL and key.
2. Install dependencies and build the project:

   ```bash
   npm install
   npm run build
   npm run start
   ```

When started you should see `Server running on port 3000` and be able to access `http://localhost:3000`.

