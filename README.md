# Honda Recalls

Web app for checking Honda vehicle recalls by **VIN** or **registration number**.

Database: **Supabase (Postgres)**. Hosting: **Vercel** (via GitHub).

## Features

- Public search by VIN or Reg. No
- Admin Excel upload (merge by vehicle + Recall No.)
- User accounts with saved vehicles, in-app alerts, optional browser push
- SMS via Alt-à-Vie (admin)

## Local setup

1. Create a [Supabase](https://supabase.com) project.
2. In Supabase → **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy Project URL + **service_role** key (Settings → API) into `.env.local`:

```bash
npm install
cp .env.example .env.local   # or create .env.local manually
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin: [/admin](http://localhost:3000/admin).

### Required env vars

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_USERNAME=admin
ADMIN_PASSWORD=honda
SESSION_SECRET=change-me-to-a-long-random-string
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Also set SMS / SMTP / VAPID as needed (see below). Never commit `.env.local`.

## Deploy: GitHub → Vercel

1. Create a new empty GitHub repo (e.g. under `c.karaolis@galatariotis.com`).
2. Push this project:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git add .
git commit -m "Prepare Honda Recalls for Supabase and Vercel"
git push -u origin main
```

3. In [Vercel](https://vercel.com): **Add New Project** → Import the GitHub repo → Framework **Next.js**.
4. Add the same env vars as `.env.local` in **Project → Settings → Environment Variables** (Production + Preview).
5. Deploy. After you get the URL, set:

```
APP_URL=https://YOUR_APP.vercel.app
NEXT_PUBLIC_APP_URL=https://YOUR_APP.vercel.app
```

Redeploy so verification links and cookies use the live URL.

6. Admin login → upload Excel. Users register fresh (empty Supabase DB).

## Excel format

| Reg. No | Vin Number | Model | Recall No. | Description | Part Number | Surname | Name | Telephone | City | Done | Registration Date | Engine Number |
|---------|------------|-------|------------|-------------|-------------|---------|------|-----------|------|------|-------------------|---------------|
| ABC123  | JHMCExxxxx | Civic | R-2024-01  | Airbag inflator | 06170-TAA-A00 | Papadopoulos | Maria | 99123456 | Limassol | Yes | 2020-05-12 | ENG123 |

Template: [`public/templates/honda-recalls-upload-template.xlsx`](public/templates/honda-recalls-upload-template.xlsx)

Owner/phone/city fields are admin-only (not shown on public search).

If your Supabase `recalls` table already exists, also run [`supabase/migration_add_recall_vehicle_fields.sql`](supabase/migration_add_recall_vehicle_fields.sql) once.
## SMS (Alt-à-Vie)

```
ALTAVIE_SMS_ENDPOINT=https://www.altavie.com.cy/getusms/receive.aspx
ALTAVIE_SMS_LOGIN=your-login
ALTAVIE_SMS_PASSWORD=your-password
ALTAVIE_SMS_SENDER=YourSenderId
ALTAVIE_SMS_DRY_RUN=false
```

Appointment request emails (from customer account) go to `APPOINTMENT_TO`, or fall back to `SMTP_FROM` / `SMTP_USER`.

## Browser push

```bash
npx web-push generate-vapid-keys --json
```

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```
