require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
const E = process.env;
const need = ['DISCORD_TOKEN', 'CLIENT_ID', 'CLIENT_SECRET', 'GUILD_ID', 'OWNER_ID', 'REVIEW_CHANNEL_ID', 'CONTACT_CHANNEL_ID', 'BASE_URL', 'SESSION_SECRET'];
const miss = need.filter(k => !E[k]);
if (miss.length) { console.error('Missing in .env: ' + miss.join(', ')); process.exit(1); }

const express = require('express'), session = require('express-session');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');
const db = require('./db'), bot = require('./bot');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '300kb' }));
app.use(session({
  secret: E.SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 7 * 864e5 }
}));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/media', express.static(path.join(__dirname, '..', 'uploads', 'media')));

// ---------- Discord login ----------
const API = 'https://discord.com/api/v10';
const redirect = () => E.BASE_URL.replace(/\/$/, '') + '/auth/callback';

app.get('/auth/login', (req, res) => {
  req.session.state = crypto.randomBytes(16).toString('hex');
  req.session.back = '#' + (['owner', 'contact', 'portal'].includes(req.query.to) ? req.query.to : 'home');
  res.redirect('https://discord.com/oauth2/authorize?' + new URLSearchParams({
    client_id: E.CLIENT_ID, response_type: 'code', redirect_uri: redirect(),
    scope: 'identify guilds.members.read', state: req.session.state
  }));
});

app.get('/auth/callback', async (req, res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.state) return res.status(400).send('Login failed. Go back and try again.');
    const t = await (await fetch(API + '/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: E.CLIENT_ID, client_secret: E.CLIENT_SECRET, grant_type: 'authorization_code', code: req.query.code, redirect_uri: redirect() })
    })).json();
    if (!t.access_token) throw new Error('No access token');
    const h = { Authorization: 'Bearer ' + t.access_token };
    const user = await (await fetch(API + '/users/@me', { headers: h })).json();
    const mr = await fetch(API + '/users/@me/guilds/' + E.GUILD_ID + '/member', { headers: h });
    const roles = mr.ok ? ((await mr.json()).roles || []) : [];
    const owner = user.id === E.OWNER_ID;
    const staff = owner || roles.some(r => db.get().settings.staffRoles.includes(r));
    const back = req.session.back || '#home';
    req.session.user = { id: user.id, name: user.global_name || user.username, staff, owner };
    res.redirect('/' + back);
  } catch (e) { console.error(e); res.status(500).send('Login failed.'); }
});

app.get('/auth/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

const needUser = (q, s, n) => q.session.user ? n() : s.status(401).json({ error: 'Sign in first' });
const needStaff = (q, s, n) => q.session.user && q.session.user.staff ? n() : s.status(403).json({ error: 'Staff only' });
const needOwner = (q, s, n) => q.session.user && q.session.user.owner ? n() : s.status(403).json({ error: 'Owner only' });
const isArr = Array.isArray;

// ---------- Public data ----------
app.get('/api/site', (q, s) => {
  const d = db.get();
  s.json({ settings: { siteName: d.settings.siteName, tagline: d.settings.tagline, invite: d.settings.invite }, about: d.about, departments: d.departments, staff: d.staff, media: d.media });
});
app.get('/api/me', (q, s) => s.json(q.session.user || null));

// ---------- Members ----------
app.post('/api/contact', needUser, async (q, s) => {
  const b = q.body || {};
  if (!b.subject || !b.message) return s.status(400).json({ error: 'Fill in the subject and message.' });
  try {
    const e = new EmbedBuilder().setColor(0x3b82f6).setTitle(String(b.subject).slice(0, 256))
      .setDescription(String(b.message).slice(0, 4000))
      .addFields({ name: 'To', value: String(b.to || 'Not given').slice(0, 200) }, { name: 'From', value: `<@${q.session.user.id}>` });
    await bot.post(E.CONTACT_CHANNEL_ID, { embeds: [e] });
    s.json({ ok: 1 });
  } catch (err) { console.error(err); s.status(500).json({ error: 'Could not send your message.' }); }
});

// ---------- Staff ----------
app.put('/api/about', needStaff, (q, s) => {
  if (!isArr(q.body)) return s.status(400).json({ error: 'Bad data' });
  db.get().about = q.body.map(String); db.save(); s.json({ ok: 1 });
});
app.put('/api/departments', needStaff, (q, s) => {
  if (!isArr(q.body)) return s.status(400).json({ error: 'Bad data' });
  db.get().departments = q.body; db.save(); s.json({ ok: 1 });
});
app.put('/api/staff-directory', needStaff, (q, s) => {
  if (!isArr(q.body)) return s.status(400).json({ error: 'Bad data' });
  db.get().staff = q.body; db.save(); s.json({ ok: 1 });
});
app.delete('/api/media/:id', needStaff, (q, s) => {
  const d = db.get(), m = d.media.find(x => x.id === q.params.id);
  if (!m) return s.status(404).json({ error: 'Not found' });
  fs.rmSync(path.join(__dirname, '..', 'uploads', 'media', path.basename(m.file)), { force: true });
  d.media = d.media.filter(x => x.id !== m.id); db.save(); s.json({ ok: 1 });
});
app.get('/api/channels', needStaff, async (q, s) => {
  try { s.json(await bot.channels()); } catch (e) { s.status(500).json({ error: 'Bot unavailable' }); }
});
app.post('/api/embed', needStaff, async (q, s) => {
  const b = q.body || {};
  if (!b.title && !b.description) return s.status(400).json({ error: 'Add a title or description.' });
  try {
    const e = new EmbedBuilder().setColor(parseInt(String(b.color || '#3b82f6').replace('#', ''), 16) || 0x3b82f6);
    if (b.title) e.setTitle(String(b.title).slice(0, 256));
    if (b.description) e.setDescription(String(b.description).slice(0, 4000));
    if (b.footer) e.setFooter({ text: String(b.footer).slice(0, 200) });
    if (b.image && /^https:\/\//.test(b.image)) e.setImage(b.image);
    await bot.post(String(b.channelId), { embeds: [e] });
    s.json({ ok: 1 });
  } catch (err) { console.error(err); s.status(500).json({ error: 'Could not send. Check the bot can post in that channel.' }); }
});

// ---------- Owner ----------
app.get('/api/settings', needOwner, (q, s) => s.json(db.get().settings));
app.put('/api/settings', needOwner, (q, s) => {
  const b = q.body || {}, c = db.get().settings;
  const ids = v => String(v || '').split(',').map(x => x.trim()).filter(x => /^\d+$/.test(x));
  c.siteName = String(b.siteName || c.siteName).slice(0, 60);
  c.tagline = String(b.tagline || '').slice(0, 160);
  c.invite = /^https:\/\//.test(b.invite || '') ? String(b.invite).slice(0, 200) : '';
  c.staffRoles = ids(b.staffRoles); c.approverRoles = ids(b.approverRoles);
  db.save(); s.json({ ok: 1 });
});

bot.start().catch(e => console.error('Bot failed to start:', e.message));
app.listen(E.PORT || 3000, () => console.log('Website running on port ' + (E.PORT || 3000)));
