// server.js — local/standalone entry point (e.g. running on a Windows PC).
// Uses the file-backed store. For Netlify deployment, see
// netlify/functions/api.js instead (uses Netlify Blobs).

const { createApp } = require('./lib/createApp');
const { makeScheduler } = require('./lib/scheduler');
const fileStore = require('./lib/fileStore');
const path = require('path');

const PORT = process.env.PORT || 4000;

const app = createApp(fileStore, { staticDir: path.join(__dirname, 'public') });

// Locally we have a real long-lived process, so also run an independent
// background tick — bells keep firing on schedule even if no browser tab
// happens to be open/polling at that moment.
const scheduler = makeScheduler(fileStore);
setInterval(() => { scheduler.tick().catch(err => console.error('tick error', err)); }, 1000);

app.listen(PORT, () => {
  console.log(`School Bell System running: http://localhost:${PORT}`);
  console.log(`Admin panel:              http://localhost:${PORT}/admin.html`);
});
