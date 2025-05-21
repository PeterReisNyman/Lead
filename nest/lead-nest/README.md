# Lead Nest Backend

This folder contains a basic [NestJS](https://nestjs.com/) project used for the lead management system.

## Development

1. Copy `.env.example` to `.env` and update the values for your Supabase instance.
2. Build and start the server:

```bash
npm install       # only required if dependencies are not installed
npm run build
npm run start
```

The server listens on the port specified by the `PORT` environment variable (default: `3000`).
