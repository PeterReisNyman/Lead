# User Data Site

This document explains the `/UserData/{phone}` view of the **UserDataSite** ASP.NET Core project and the associated POST action that generates user reports. Basic configuration steps are included as well.

## `/UserData/{phone}` View

- **Route:** `GET /UserData/{phone}`
- **Purpose:** Presents a small form where an authorized person can generate an HTML report for a user's phone number.
- **View Model:** None. The phone number is passed through `ViewBag.Phone` so it can be embedded in the form.
- **Workflow:**
  1. Navigate to `/UserData/1234567890` replacing the last segment with the desired phone number.
  2. The page shows the phone number and prompts for the generation password.
  3. Submitting the form posts to `UserData/generate`.

## `POST /UserData/generate`

- **Parameters:**
  - `phone` – the phone number originally passed on the query.
  - `password` – must match the configured `UserDataPassword`.
- **Validation:** If the password is incorrect the page is redisplayed with an error message.
- **Data Retrieval:**
  1. Connects to the `DefaultConnection` MySQL database.
  2. Reads lead details from the `Leads` table for the given phone number.
  3. Reads the optional conversation history from the `Messages` table.
- **Result:** Renders the `Details` view using `UserDataViewModel`. The view lists lead fields such as address, home info and marketing parameters and displays any SMS conversation.

## Configuration

`UserDataSite/appsettings.json` contains the settings used by the controller:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "server=database;port=3306;database=lead_db;user=your_username;password=your_password;AllowZeroDateTime=True;ConvertZeroDateTime=True"
  },
  "UserDataPassword": "ChangeThisPassword"
}
```

- Update `DefaultConnection` with the correct MySQL host, credentials and database name.
- Change `UserDataPassword` to a secret value. The form's password field must match this to retrieve data.
- These values can also be provided via environment variables when deploying with Docker or another host.

After configuration run the site and visit `http://localhost:5052/UserData/{phone}` to generate a user's report.
