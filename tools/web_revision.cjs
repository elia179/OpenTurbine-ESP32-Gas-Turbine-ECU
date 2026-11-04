// The dashboard boot document declares the installed web generation. Audit
// navigation and every shared asset against it, without a stale test-only date.
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'data_src', 'index.html'), 'utf8');
const revision = html.match(/data-ot-version','([^']+)'/)?.[1];
if (!revision || !/^\d{8}[a-z]\d*$/.test(revision)) throw new Error('Dashboard web revision is missing or malformed');
module.exports = revision;
