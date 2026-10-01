// Tiny JSON-file storage. Everything lives in data/site.json.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'site.json');
fs.mkdirSync(DIR, { recursive: true });

const T = (n, rows) => ({ n, rows: rows.map(r => ({ r: r[0], p: r[1] || '', c: r[2] || '', s: r[3] || 'Vacant' })) });

const defaults = {
  settings: { siteName: 'CSRP Roleplay', tagline: 'A realistic, community-driven roleplay experience.', invite: '', staffRoles: [], approverRoles: [] },
  about: [
    'Placeholder: a short intro to your server, its departments, and what members can expect.',
    'Placeholder: your server description goes here. Mention your departments, subdivisions, and any tools you use.',
    'Placeholder: requirements, whitelist or application info, and what makes your community different.'
  ],
  departments: [
    { n: 'Law Enforcement', a: 'LEO', o: true, d: 'Placeholder: what this department does and how to join.', link: '',
      tiers: [T('Administrative', [['Sheriff'], ['Undersheriff']]), T('Command', [['Captain']]), T('Patrol', [['Deputy'], ['Probationary Deputy', '', '', 'Needs R/A']])] }
  ],
  staff: [{ n: 'Founders', people: [{ name: 'Founder name', handle: '@discord', tag: 'Founder' }] }],
  media: [],
  pending: {}
};

const existed = fs.existsSync(FILE);
const data = existed ? Object.assign({}, defaults, JSON.parse(fs.readFileSync(FILE, 'utf8'))) : defaults;
data.settings = Object.assign({}, defaults.settings, data.settings);
if (!data.settings.siteName) data.settings.siteName = defaults.settings.siteName;

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}
save();
module.exports = { get: () => data, save };
