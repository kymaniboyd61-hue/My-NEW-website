const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let site, me, D;

async function api(url, method, body) {
  const r = await fetch(url, { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.error) || 'Request failed');
  return j;
}
async function reload() { site = await api('/api/site'); chrome(); }
async function init() { me = await api('/api/me'); await reload(); route(); }

function chrome() {
  const s = site.settings; s.siteName = s.siteName || 'Roleplay';
  document.title = s.siteName;
  $('#brand').textContent = s.siteName;
  $('#logo').textContent = s.siteName.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase();
  $('#dd .m').innerHTML = site.departments.map((d, i) => `<button onclick="location.hash='#dept/${i}'">${esc(d.n)}</button>`).join('') || '<button disabled>No departments yet</button>';
  const j = $('#join'); j.href = s.invite || '#'; j.style.display = s.invite ? '' : 'none';
  $('#portalBtn').textContent = me && me.staff ? 'Staff portal' : 'Staff sign in';
  $('#foot').textContent = '© ' + s.siteName;
}

const views = { home, about, media, staff, contact, portal, owner, dept };
function route() {
  const [v, a] = (location.hash.slice(1) || 'home').split('/');
  $('#dd').classList.remove('open');
  (views[v] || home)(a);
  window.scrollTo(0, 0);
  document.querySelectorAll('nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
}
window.onhashchange = route;

// ---------- Public pages ----------
function home() {
  const s = site.settings;
  $('#main').innerHTML = `<div class="hero"><h1>${esc(s.siteName)}</h1><p class="sub">${esc(s.tagline)}</p>${s.invite ? `<a class="btn p" style="padding:12px 26px;font-size:15px" href="${esc(s.invite)}">Join the Discord</a>` : ''}</div>
  <div class="card top" style="max-width:740px;margin:0 auto"><h3 style="margin:0 0 8px">About ${esc(s.siteName)}</h3><p>${esc(site.about[0] || '')}</p></div>`;
}
function about() {
  $('#main').innerHTML = `<h2>About ${esc(site.settings.siteName)}</h2><p class="sub">Who we are and what we run.</p>` + site.about.map(t => `<div class="card"><p>${esc(t)}</p></div>`).join('');
}
function media() {
  $('#main').innerHTML = `<h2>Media</h2><p class="sub">Screenshots and clips from the community. Submit yours in Discord with /submitmedia.</p>` +
    (site.media.length ? `<div class="grid">${site.media.map(m => m.type === 'video'
      ? `<video class="shot" controls preload="metadata" src="/media/${esc(m.file)}"></video>`
      : `<img class="shot" loading="lazy" alt="${esc(m.caption || 'Media')}" src="/media/${esc(m.file)}">`).join('')}</div>`
      : '<div class="card"><p>No media yet. Be the first to submit one.</p></div>');
}
function staff() {
  $('#main').innerHTML = `<h2 style="text-align:center">Staff directory</h2><p class="sub" style="text-align:center">View our staff below.</p>` +
    site.staff.map(t => `<div class="tier">${esc(t.n)}</div><div class="people">${(t.people || []).map(p => `<div class="person"><div class="av"></div><b>${esc(p.name)}</b><small>${esc(p.handle)}</small><span class="tag">${esc(p.tag)}</span></div>`).join('')}</div>`).join('');
}
function roster(d) {
  return (d.tiers || []).map(t => `<div class="tier2">${esc(t.n)}</div><div class="rtw"><table class="rt"><thead><tr><th>Rank</th><th>Name</th><th>Callsign</th><th>Status</th></tr></thead><tbody>` +
    (t.rows || []).map(x => {
      const v = x.s === 'Vacant' || x.s === 'Needs R/A';
      return `<tr><td>${esc(x.r)}</td><td>${v ? `<i class="vac">${esc(x.s)}</i>` : esc(x.p)}</td><td>${v || !x.c ? '' : `<code>${esc(x.c)}</code>`}</td><td>${v ? '' : `<span class="st${x.s === 'Active' ? ' act' : ''}">● ${esc(x.s)}</span>`}</td></tr>`;
    }).join('') + '</tbody></table></div>').join('');
}
function dept(i) {
  const d = site.departments[i];
  if (!d) return home();
  const apply = d.o && /^https:\/\//.test(d.link || '') ? `<a class="btn p" href="${esc(d.link)}">Apply</a>` : '';
  $('#main').innerHTML = `<h2>${esc(d.n)}${d.a ? ' (' + esc(d.a) + ')' : ''}</h2><p class="sub">${d.o ? 'Applications open' : 'Applications closed'}</p><div class="card"><p>${esc(d.d)}</p></div>${apply}${roster(d)}`;
}
function contact() {
  if (!me) { $('#main').innerHTML = `<div style="max-width:560px;margin:0 auto"><h2>Contact a member</h2><p class="sub">Sign in with Discord to send a message.</p><a class="btn p" href="/auth/login?to=contact">Sign in with Discord</a></div>`; return; }
  $('#main').innerHTML = `<div style="max-width:560px;margin:0 auto"><h2>Contact a member</h2><p class="sub">Signed in as ${esc(me.name)}.</p><div class="card top">
    <label>WHO IS THIS FOR?</label><input id="c1" placeholder="Name or email"><label>SUBJECT</label><input id="c2"><label>MESSAGE</label><textarea id="c3"></textarea>
    <div style="margin-top:18px"><button class="btn p" id="c4">Send</button> <span class="note" id="cn"></span></div></div></div>`;
  $('#c4').onclick = async () => {
    try { await api('/api/contact', 'POST', { to: $('#c1').value, subject: $('#c2').value, message: $('#c3').value }); $('#cn').textContent = 'Sent.'; ['c1', 'c2', 'c3'].forEach(i => $('#' + i).value = ''); }
    catch (e) { $('#cn').textContent = e.message; }
  };
}

// ---------- Staff portal ----------
function portal() {
  const box = (t, p, a) => `<div style="max-width:420px;margin:40px auto;text-align:center"><h2>${t}</h2><p class="sub">${p}</p>${a}</div>`;
  if (!me) { $('#main').innerHTML = box('Staff portal', 'Sign in with Discord. Only members with a staff role get in.', '<a class="btn p" style="padding:12px 24px" href="/auth/login?to=portal">Sign in with Discord</a>'); return; }
  if (!me.staff) { $('#main').innerHTML = box('Staff portal', "Your Discord account doesn't have a staff role.", '<a class="btn" href="/auth/logout">Sign out</a>'); return; }
  $('#main').innerHTML = `<div class="portal"><div class="side">${[['embed', 'Embed builder'], ['media', 'Media'], ['about', 'About editor'], ['depts', 'Departments'], ['dir', 'Staff directory']].map(([k, l]) => `<button data-t="${k}" onclick="tab('${k}')">${l}</button>`).join('')}<a class="btn" style="margin-top:14px;display:block;text-align:center" href="/auth/logout">Sign out</a></div><div id="pt"></div></div>`;
  tab('embed');
}
function tab(k) {
  document.querySelectorAll('.side button').forEach(b => b.classList.toggle('on', b.dataset.t === k));
  ({ embed: tEmbed, media: tMedia, about: tAbout, depts: tDepts, dir: tDir })[k]();
}
async function save(url) {
  try { await api(url, 'PUT', D); await reload(); $('#sn').textContent = 'Saved.'; } catch (e) { $('#sn').textContent = e.message; }
}
const saveBar = url => `<button class="btn p" onclick="save('${url}')">Save changes</button> <span class="note" id="sn"></span>`;

async function tEmbed() {
  let ch = []; try { ch = await api('/api/channels'); } catch (e) {}
  $('#pt').innerHTML = `<h2>Embed builder</h2><p class="sub">Build a message and send it through the bot.</p><div class="two"><div>
    <label>CHANNEL</label><select id="e0">${ch.map(c => `<option value="${esc(c.id)}">#${esc(c.name)}</option>`).join('')}</select>
    <label>TITLE</label><input id="e1"><label>DESCRIPTION</label><textarea id="e2"></textarea><label>FOOTER</label><input id="e3">
    <label>IMAGE URL (OPTIONAL, HTTPS)</label><input id="e5"><label>COLOR</label><input id="e4" type="color" value="#3b82f6" style="height:40px;padding:4px">
    <div style="margin-top:16px"><button class="btn p" id="es">Send message</button> <span class="note" id="en"></span></div></div>
    <div class="disc"><div class="who">Bot</div><div class="emb" id="ep"><h4 id="p1"></h4><p id="p2"></p><small id="p3"></small></div></div></div>`;
  const pv = () => { $('#p1').textContent = $('#e1').value; $('#p2').textContent = $('#e2').value; $('#p3').textContent = $('#e3').value; $('#ep').style.borderLeftColor = $('#e4').value; };
  ['e1', 'e2', 'e3', 'e4'].forEach(id => $('#' + id).oninput = pv); pv();
  $('#es').onclick = async () => {
    try { await api('/api/embed', 'POST', { channelId: $('#e0').value, title: $('#e1').value, description: $('#e2').value, footer: $('#e3').value, color: $('#e4').value, image: $('#e5').value }); $('#en').textContent = 'Sent.'; }
    catch (e) { $('#en').textContent = e.message; }
  };
}
function tMedia() {
  $('#pt').innerHTML = `<h2>Media</h2><p class="sub">Approved submissions. New ones are approved or denied in your Discord review channel.</p>` +
    (site.media.map(m => `<div class="q card"><div class="i"><b>${esc(m.caption || m.file)}</b><br><small>From ${esc(m.by || 'member')}</small></div><button class="btn" onclick="rmMedia('${esc(m.id)}')">Remove</button></div>`).join('') || '<div class="card"><p>Nothing yet.</p></div>');
}
async function rmMedia(id) { await api('/api/media/' + id, 'DELETE'); await reload(); tMedia(); }

function tAbout() { D = JSON.parse(JSON.stringify(site.about)); drawAbout(); }
function drawAbout() {
  $('#pt').innerHTML = `<h2>About editor</h2><p class="sub">The first paragraph also shows on the home page.</p>` +
    D.map((t, i) => `<div class="card"><textarea oninput="D[${i}]=this.value">${esc(t)}</textarea><button class="btn" style="margin-top:8px" onclick="D.splice(${i},1);drawAbout()">Remove</button></div>`).join('') +
    `<button class="btn" onclick="D.push('');drawAbout()">Add paragraph</button> ${saveBar('/api/about')}`;
}

function tDepts() { D = JSON.parse(JSON.stringify(site.departments)); drawDepts(); }
function drawDepts() {
  $('#pt').innerHTML = `<h2>Departments</h2><p class="sub">Changes update the nav dropdown and each department page.</p>` + D.map((d, i) => `<div class="card">
    <div class="two"><div><label>NAME</label><input value="${esc(d.n)}" oninput="D[${i}].n=this.value"></div><div><label>ABBREVIATION</label><input value="${esc(d.a)}" oninput="D[${i}].a=this.value"></div></div>
    <label>DESCRIPTION</label><textarea oninput="D[${i}].d=this.value">${esc(d.d)}</textarea>
    <label>APPLICATION LINK (HTTPS, OPTIONAL)</label><input value="${esc(d.link || '')}" oninput="D[${i}].link=this.value">
    <label><input type="checkbox" style="width:auto;margin-right:6px" ${d.o ? 'checked' : ''} onchange="D[${i}].o=this.checked"> Applications open</label>
    <label style="margin-top:20px">ROSTER</label>${rosterEd(i)}
    <div style="margin-top:14px"><button class="btn" onclick="D.splice(${i},1);drawDepts()">Delete department</button></div></div>`).join('') +
    `<button class="btn" onclick="D.push({n:'New department',a:'',o:true,d:'',link:'',tiers:[]});drawDepts()">Add department</button> ${saveBar('/api/departments')}`;
}
function rosterEd(i) {
  return (D[i].tiers || []).map((t, ti) => {
    const B = `D[${i}].tiers[${ti}]`;
    return `<div class="card" style="background:var(--bg2)"><label>TIER NAME</label><input value="${esc(t.n)}" oninput="${B}.n=this.value">` +
      (t.rows || []).map((x, ri) => {
        const b = `${B}.rows[${ri}]`;
        return `<div class="rrow"><input placeholder="Rank" value="${esc(x.r)}" oninput="${b}.r=this.value"><input placeholder="Name" value="${esc(x.p)}" oninput="${b}.p=this.value"><input placeholder="Callsign" value="${esc(x.c)}" oninput="${b}.c=this.value"><select onchange="${b}.s=this.value">${['Active', 'Inactive', 'Vacant', 'Needs R/A'].map(o => `<option${o === x.s ? ' selected' : ''}>${o}</option>`).join('')}</select><button class="btn" aria-label="Remove rank" onclick="${B}.rows.splice(${ri},1);drawDepts()">✕</button></div>`;
      }).join('') +
      `<div style="margin-top:10px;display:flex;gap:8px"><button class="btn" onclick="${B}.rows.push({r:'',p:'',c:'',s:'Vacant'});drawDepts()">Add rank</button><button class="btn" onclick="D[${i}].tiers.splice(${ti},1);drawDepts()">Remove tier</button></div></div>`;
  }).join('') + `<button class="btn" onclick="D[${i}].tiers.push({n:'New tier',rows:[]});drawDepts()">Add tier</button>`;
}

function tDir() { D = JSON.parse(JSON.stringify(site.staff)); drawDir(); }
function drawDir() {
  $('#pt').innerHTML = `<h2>Staff directory</h2><p class="sub">Shown on the public Staff page.</p>` + D.map((t, ti) => `<div class="card"><label>TIER NAME</label><input value="${esc(t.n)}" oninput="D[${ti}].n=this.value">` +
    (t.people || []).map((p, pi) => `<div class="rrow" style="grid-template-columns:1.3fr 1fr 1fr auto"><input placeholder="Name" value="${esc(p.name)}" oninput="D[${ti}].people[${pi}].name=this.value"><input placeholder="@discord" value="${esc(p.handle)}" oninput="D[${ti}].people[${pi}].handle=this.value"><input placeholder="Role tag" value="${esc(p.tag)}" oninput="D[${ti}].people[${pi}].tag=this.value"><button class="btn" aria-label="Remove person" onclick="D[${ti}].people.splice(${pi},1);drawDir()">✕</button></div>`).join('') +
    `<div style="margin-top:10px;display:flex;gap:8px"><button class="btn" onclick="D[${ti}].people.push({name:'',handle:'',tag:''});drawDir()">Add person</button><button class="btn" onclick="D.splice(${ti},1);drawDir()">Remove tier</button></div></div>`).join('') +
    `<button class="btn" onclick="D.push({n:'New tier',people:[]});drawDir()">Add tier</button> ${saveBar('/api/staff-directory')}`;
}

// ---------- Owner ----------
async function owner() {
  if (!me || !me.owner) {
    $('#main').innerHTML = `<div style="max-width:420px;margin:40px auto;text-align:center"><h2>Owner sign in</h2><p class="sub">Only the website owner's Discord account can sign in here.</p>` +
      (me ? `<p class="sub">You're signed in, but not as the owner.</p><p class="sub">Your Discord ID is <b>${esc(me.id)}</b>. If this is the owner account, put that number in OWNER_ID in your .env file and restart the server.</p><a class="btn" href="/auth/logout">Sign out</a>` : `<a class="btn p" style="padding:12px 24px" href="/auth/login?to=owner">Sign in with Discord</a>`) + `</div>`;
    return;
  }
  const s = await api('/api/settings');
  $('#main').innerHTML = `<div style="max-width:560px;margin:0 auto"><h2>Owner panel</h2><p class="sub">Settings only the owner can change. To copy a role ID, turn on Developer Mode in Discord, then right-click the role.</p><div class="card top">
    <label>SERVER NAME</label><input id="o1" value="${esc(s.siteName)}"><label>TAGLINE</label><input id="o2" value="${esc(s.tagline)}">
    <label>DISCORD INVITE (HTTPS)</label><input id="o3" value="${esc(s.invite)}">
    <label>STAFF ROLE IDS (COMMA SEPARATED)</label><input id="o4" value="${esc(s.staffRoles.join(', '))}">
    <label>MEDIA APPROVER ROLE IDS (COMMA SEPARATED)</label><input id="o5" value="${esc(s.approverRoles.join(', '))}">
    <div style="margin-top:16px"><button class="btn p" id="os">Save changes</button> <span class="note" id="osn"></span></div></div></div>`;
  $('#os').onclick = async () => {
    try { await api('/api/settings', 'PUT', { siteName: $('#o1').value, tagline: $('#o2').value, invite: $('#o3').value, staffRoles: $('#o4').value, approverRoles: $('#o5').value }); await reload(); $('#osn').textContent = 'Saved.'; }
    catch (e) { $('#osn').textContent = e.message; }
  };
}

init();
