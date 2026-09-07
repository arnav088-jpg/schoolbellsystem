# School Automatic Bell System

A web application for managing a school's automatic bell schedule: a
control-room style dashboard for the display monitor, and an admin panel
for configuration.

**Two deployment modes, same codebase:**

1. **Standalone/local** (`npm start` on a Windows PC) — everything runs on
   that one computer, no internet required, data stored in a local
   `data.json` file. See "Local installation" below.
2. **Netlify** (`netlify deploy`) — dashboard/admin served from Netlify's
   CDN, API logic runs as a Netlify Function, data stored in Netlify Blobs.
   See "Deploying on Netlify" below.

Which one to pick: standalone is the more traditional "dedicated bell PC"
setup and works with zero internet dependency. Netlify is useful if you
want the dashboard/admin reachable from anywhere (e.g. multiple staff
checking the schedule from their own devices, or you don't want to manage a
PC as a server) — but it does require internet connectivity on whatever
device is displaying the dashboard, since it's now loading from Netlify's
CDN rather than localhost.

## How it works (architecture)

- **Backend**: Node.js + Express (`server.js`). This is the single source of
  truth for the schedule and the bell log. It ticks once per second
  (`scheduler.js`) and fires a bell exactly once when the clock reaches a
  period's start time.
- **Storage**: one JSON file, `data.json`, created automatically on first
  run. Holds periods, settings, holidays, special schedules, and the bell
  log. No database server to install.
- **Reliability guarantees**:
  - A bell is only ever logged once per `(date, periodId)` — refreshing the
    dashboard, or the browser reconnecting, can never cause a duplicate.
  - If the computer/app was off at the exact minute a bell was due, that
    bell is simply skipped when the app restarts — it will **not** play a
    backlog of "missed" bells.
  - The scheduler runs independently of any browser tab; the dashboard is
    just a display/remote-control for it. You can close and reopen the
    dashboard freely without affecting bell timing.
- **Frontend**: static HTML/CSS/JS (`public/index.html` dashboard,
  `public/admin.html` admin panel). They poll the backend once per second
  for the clock/status and bell log.
- **Audio**: the default bell is synthesized in the browser (Web Audio API —
  no sound file required). Administrators can upload their own bell sound
  (mp3/wav) per period from the Admin Panel. Voice announcements use the
  browser's built-in Speech Synthesis (offline, no internet needed on the
  standalone deployment).

### Code layout

```
lib/createApp.js       Express app + all API routes (shared by both modes)
lib/scheduler.js       Bell-firing logic, store-agnostic
lib/fileStore.js       Storage backend for standalone mode (data.json + uploads/)
lib/blobStore.js       Storage backend for Netlify mode (Netlify Blobs)
server.js              Standalone entry point: node server.js
netlify/functions/
  api.js               Netlify Function wrapping the same Express app
  scheduled-tick.js     Once-a-minute safety-net bell check (Netlify only)
netlify.toml           Netlify build/redirect configuration
public/                Dashboard + admin panel (same for both modes)
```

## Requirements

- A Windows PC that will stay on during school hours (this can be the
  reception PC, a dedicated bell PC, or a small server).
- [Node.js](https://nodejs.org) LTS (v18 or newer) installed on that PC.
- A modern browser (Chrome or Edge recommended) for the dashboard display
  and for the admin panel. Any device on the same local network can open
  the admin panel over the LAN if desired.

## Local installation (Windows)

1. Install Node.js from https://nodejs.org (choose the LTS installer, click
   through with defaults).
2. Copy the `school-bell-system` folder onto the school computer, e.g. to
   `C:\BellSystem\school-bell-system`.
3. Open **Command Prompt** in that folder (Shift + right-click inside the
   folder → "Open PowerShell/Command window here").
4. Install dependencies (only needed once):
   ```
   npm install
   ```
5. Start the server:
   ```
   npm start
   ```
   You should see:
   ```
   School Bell System running: http://localhost:4000
   Admin panel:              http://localhost:4000/admin.html
   ```
6. On the display computer, open Chrome and go to `http://localhost:4000`
   for the dashboard. On any computer on the same network, open
   `http://<bell-pc-ip-address>:4000` (find the PC's IP with `ipconfig`).
7. Open `http://localhost:4000/admin.html` to configure periods, holidays,
   sounds, and system settings.

## Deploying on Netlify

This deploys the dashboard/admin panel to Netlify's CDN and the API as a
Netlify Function backed by Netlify Blobs (a persistent key-value store —
no separate database to set up).

### One-time setup

1. Install the Netlify CLI (needs Node.js already installed):
   ```
   npm install -g netlify-cli
   ```
2. From inside the `school-bell-system` folder, log in and link/create a
   site:
   ```
   netlify login
   netlify init
   ```
   Choose "Create & configure a new site" (or link an existing one), and
   accept the defaults from `netlify.toml` — publish directory `public`,
   functions directory `netlify/functions`.
3. Install dependencies locally once (Netlify's build also runs
   `npm install` per `netlify.toml`, but this lets you test the function
   locally first):
   ```
   npm install
   ```

### Deploy

```
netlify deploy --prod
```

Netlify will print your live URL, e.g. `https://your-site.netlify.app`.
Open it for the dashboard, and `https://your-site.netlify.app/admin.html`
for the admin panel.

### Netlify Blobs

No setup needed — `@netlify/blobs` automatically uses the site's built-in
Blobs store when the function runs on Netlify's infrastructure (it picks up
credentials from the Netlify runtime environment automatically). The first
request creates the store with the default schedule; after that, all your
edits in the Admin Panel persist there.

### Local testing before deploying (optional)

```
netlify dev
```
This runs the static site and the Netlify Function together locally
(`http://localhost:8888`), using a local emulation of Netlify Blobs, so you
can test the full Netlify-mode behavior before pushing to production.

### About Scheduled Functions (`netlify/functions/scheduled-tick.js`)

On the standalone deployment, the bell scheduler runs continuously in the
background, independent of whether a browser is open. On Netlify there is
no long-running background process — instead:

- While the dashboard tab is open, its once-per-second polling of
  `/api/status` triggers the same tick logic, so bells fire on schedule
  with second-level accuracy, exactly as in standalone mode.
- `scheduled-tick.js` runs once a minute via Netlify's Scheduled Functions
  as a safety net, in case the display/browser is off at the exact moment a
  bell is due. Its timing is only accurate to within the minute (not the
  second), so it's a backup, not a substitute for keeping the dashboard
  open on the display screen. Scheduled Functions require a Netlify plan
  that supports them — check your plan if this function doesn't appear to
  be running (visible under your site's Functions tab in the Netlify UI).

### Uploaded bell sounds on Netlify

Custom bell sounds uploaded via Admin → Sounds are stored as binary blobs
in a separate Netlify Blobs store and served back via
`/api/sounds/:id/file`. There's no local `uploads/` folder involved in this
mode.

### Netlify limitations to be aware of

- Requires an internet connection on whatever device shows the dashboard
  (unlike standalone mode, which works fully offline on the local network).
- Netlify Functions have an execution time limit per invocation (fine here
  — each request is a fast, simple read/write), and Netlify Blobs has its
  own storage limits depending on your plan; a school's schedule/log data
  is small and comfortably within free-tier limits for normal use, though
  the bell log is capped at the last 2000 entries either way.
- If your Netlify plan doesn't include Scheduled Functions, rely on keeping
  the dashboard tab open (the normal setup for a bell display anyway).

## Running the dashboard in kiosk/full-screen mode

- Click the **Full Screen** button on the dashboard (top right), or
- Launch Chrome directly in kiosk mode with a shortcut:
  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk http://localhost:4000
  ```
  (Press `Alt+F4` to exit kiosk mode.)

## Configuring automatic startup with Windows

There are two things to auto-start: (1) the bell **server**, and (2) the
**dashboard browser window**. Recommended approach — Windows Task Scheduler
for the server, and a Startup-folder shortcut for the browser.

### 1. Auto-start the server with Task Scheduler

1. Open **Task Scheduler** (Start menu → search "Task Scheduler").
2. Click **Create Task…** (not "Basic Task", so you get more options).
3. **General tab**: Name it `School Bell Server`. Select "Run whether user
   is logged on or not" and check "Run with highest privileges".
4. **Triggers tab** → **New…** → "At startup" (or "At log on" if you'd
   rather it start when the admin account logs in).
5. **Actions tab** → **New…**:
   - Program/script: `C:\Program Files\nodejs\node.exe`
   - Add arguments: `server.js`
   - Start in: `C:\BellSystem\school-bell-system`
6. **Conditions tab**: uncheck "Start the task only if the computer is on
   AC power" (relevant for laptops).
7. Save. Restart the PC to confirm the server starts and
   `http://localhost:4000` loads.

### 2. Auto-open the dashboard browser window

1. Create a shortcut with target:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk http://localhost:4000
   ```
2. Press `Win + R`, type `shell:startup`, press Enter — this opens the
   Startup folder for the current user.
3. Move the shortcut into that folder. It will now launch automatically at
   login, right after the bell server starts.

## Testing the bell system

- **Test Bell button** (Dashboard): fires the currently-active or upcoming
  period's bell immediately, using its normal sound/voice settings —
  without needing to wait for the scheduled time.
- **Per-period Test button** (Admin → Periods): test any individual
  period's bell/announcement on demand.
- **Emergency Bell** (Dashboard or Admin): immediately plays an urgent
  alert with a custom message, independent of the schedule.
- **Bell Log** (Dashboard): shows a running log of every bell that has
  fired, with date, time, and whether it was scheduled/test/emergency —
  useful for verifying the system fired correctly on a given day.
- To test end-to-end timing without waiting for real class times, add a
  temporary period in Admin → Periods with a start time a minute or two in
  the future, save, and watch it fire automatically, then delete it.

## Admin Panel — what you can configure

- **System Control**: enable/disable the entire automatic system, pause
  temporarily, mute audio.
- **General Settings**: school name, volume, voice announcements on/off,
  which days of the week are school days.
- **Periods & Bells**: add/edit/delete periods, times, per-period bell
  on/off, custom announcement text, audio mode (bell / voice / both).
- **Sounds**: upload custom bell audio files; select per period.
- **Holidays**: mark specific dates as holidays — no bells fire on those
  days.
- **Special Schedules**: define a completely different timetable for a
  specific date (exam day, assembly, half-day), which overrides the normal
  schedule just for that day.
- **Manual Bell Control**: trigger the emergency bell on demand.
- **Backup & Restore**: export the entire configuration (periods, settings,
  holidays, special schedules, log) as a JSON file, and restore it later or
  on a replacement PC.

## Default schedule (seeded on first run)

| Period | Start | End |
|---|---|---|
| Period I | 7:45 AM | 8:20 AM |
| Period II | 8:20 AM | 9:20 AM |
| Period III | 9:20 AM | 10:20 AM |
| Lunch Break | 10:20 AM | 10:40 AM |
| Period IV | 10:40 AM | 11:30 AM |
| Period V | 11:30 AM | 12:10 PM |
| Period VI | 12:10 PM | 12:50 PM |
| Period VII | 12:50 PM | 1:30 PM |
| School Day Ended | 1:30 PM | 1:30 PM |

All of this is editable from the Admin Panel — nothing is hard-coded once
the app is running; `data.json` becomes the live configuration.

## Backing up your configuration

Use **Admin → Backup & Restore → Export Backup** regularly (e.g. weekly),
and keep the JSON file somewhere safe (USB drive, network share). If the PC
is ever replaced, install the app fresh and use **Restore From File** to
bring back the exact schedule, sounds list, and history.

## Troubleshooting

- **Dashboard shows the wrong time**: the app uses the PC's local system
  clock/timezone — check Windows date & time settings.
- **No sound plays**: check the dashboard tab isn't muted at the OS level,
  and check the Mute toggle on the dashboard/admin isn't enabled. Browsers
  require at least one page interaction before audio can autoplay — click
  anywhere on the dashboard once after it loads.
- **Server won't start / port already in use**: another program is using
  port 4000. Either close it, or run `set PORT=4500 && npm start` and open
  `http://localhost:4500` instead.
- **Bells didn't ring while the PC was off/asleep**: by design, missed
  bells are never replayed late. Disable Windows sleep/hibernate on the
  bell PC (Settings → Power) so it stays on during school hours.
