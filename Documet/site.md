# Site Overview

## Booking API
- **`GET /api/bookedslots`** retrieves booked time slots for a given date and realtor (lines 34-55 of `BookingController.cs`).
- **`GET /api/existing-booking`** checks if a phone number already has a booking (lines 58-104).
- **`GET /api/user`** returns lead information based on tracking parameters (lines 106-150).
- **`POST /api/book`** books or reschedules an appointment and notifies clients via SignalR (lines 152-319).
- **`GET /api/realtor`** fetches realtor info by UUID (lines 451-492).

## SignalR
`CalendarHub` broadcasts updates through the `BookingUpdated` event. Clients connect to `/calendarHub` (lines 1-11 of `CalendarHub.cs`; Program.cs lines 73-74).

## Calendar Integration
When a booking succeeds, the controller sends a POST request to `http://calendar:3002/create-event` with the booking details. It logs success or failure but does not block the booking if the calendar call fails (lines 263-310).

## Program Configuration
`Program.cs` registers controllers, SignalR, CORS and a transient `DatabaseService`. It loads the connection string named `DefaultConnection` from configuration and hosts the app on port 80 (lines 6-40). The environment is checked via `app.Environment.IsDevelopment()` to decide whether to show developer pages (lines 44-51). SignalR is mapped to `/calendarHub` (lines 73-74).

The site container passes these environment variables:
- `ASPNETCORE_ENVIRONMENT`
- `ASPNETCORE_URLS`
- `ConnectionStrings__DefaultConnection`
- `OPENAI_API_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

These provide database access and external API credentials.

Dependencies referenced in `Site.csproj` include `Microsoft.AspNetCore.SignalR` and `MySql.Data`.
