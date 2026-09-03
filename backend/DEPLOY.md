# Deploying the FinBooks backend (for a real / Play Store app)

The mobile app currently talks to the backend over your PC's LAN IP (`http://192.168.x.x:4001`).
That only works on your home Wi-Fi. For a real app that works on **any** device anywhere, the
backend must run on a **public server with an HTTPS URL**, and the app must point at that URL.

This guide gets there. You need two things online: **(A) a MySQL database** and **(B) this backend**.

---

## A. Hosted MySQL database

Pick one (all have usable free/cheap tiers):

- **Railway** — add a MySQL service in the same project as the backend (easiest; keeps them together).
- **Aiven for MySQL** — free trial / small paid plan.
- **PlanetScale** — MySQL-compatible (note: uses its own connection string).

From the provider, copy the **connection string**. It looks like:
```
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```
That becomes your `DATABASE_URL`.

---

## B. Host this backend

Recommended: **Render** or **Railway** (both build straight from a GitHub repo).

### Option 1 — Node buildpack (no Docker)
Create a new **Web Service** from your repo, root directory `backend`, then set:

- **Build command:**
  ```
  npm ci && npx prisma generate && npm run build
  ```
- **Start command:**
  ```
  npx prisma migrate deploy && npm run start
  ```

### Option 2 — Docker
A `Dockerfile` is included in this folder. Point the host at it (root directory `backend`).
It runs `prisma migrate deploy` then starts the server.

### Environment variables (set these on the host)
| Variable | Value |
|---|---|
| `DATABASE_URL` | your hosted MySQL connection string (from step A) |
| `JWT_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | the port the host expects (many hosts set this automatically) |
| `CORS_ORIGIN` | your deployed **web** frontend URL (only needed for the web app; the mobile app is native and not subject to CORS) |

> Note: `src/env.ts` reads `PORT` from the environment. If your host injects its own `$PORT`,
> the server will use it. Make sure the host's port and the exposed port match.

### First deploy
1. Deploy — the start command applies migrations automatically (`prisma migrate deploy`).
2. (Optional) Seed demo data once, from the host shell or locally against the prod DB:
   ```
   npm run db:seed
   ```
   Only do this on a fresh database — it wipes and recreates the demo company.
3. Test: open `https://YOUR-BACKEND-URL/health` → should return `{"ok":true,...}`.

---

## C. Point the mobile app at the hosted backend

Once the backend is live over HTTPS:

1. In `finbooks-mobile/src/config/env.ts`, set:
   ```ts
   const MANUAL_API_URL = "https://YOUR-BACKEND-URL/api";
   ```
2. Because the URL is now **HTTPS**, you can turn OFF the cleartext workaround in
   `finbooks-mobile/app.json` (set `usesCleartextTraffic` to `false`, or remove it) for a more
   secure production build.
3. Rebuild the app:
   ```
   npx eas-cli build --platform android --profile production
   ```
   (`production` outputs an `.aab` for the Play Store; use `preview` for a test `.apk`.)

Users can also change the server URL in-app (Login → ⚙️ Server settings) without a rebuild.

---

## Checklist before Play Store
- [ ] MySQL hosted, `DATABASE_URL` set
- [ ] Backend deployed, `https://.../health` returns ok
- [ ] App `MANUAL_API_URL` set to the HTTPS backend, cleartext disabled
- [ ] Production `.aab` built
- [ ] Privacy policy hosted at a public URL (see `finbooks-mobile/legal/privacy-policy.html`)
- [ ] Play Console account ($25), listing + screenshots ready
