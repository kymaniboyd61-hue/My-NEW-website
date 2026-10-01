const {
  Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, Events
} = require('discord.js');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const db = require('./db');
const E = process.env;
const UP = path.join(__dirname, '..', 'uploads');
const PEND = path.join(UP, 'pending'), MEDIA = path.join(UP, 'media');
[PEND, MEDIA].forEach(d => fs.mkdirSync(d, { recursive: true }));
const EPH = MessageFlags.Ephemeral;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const command = new SlashCommandBuilder()
  .setName('submitmedia')
  .setDescription('Submit a photo or video for the website Media page')
  .addAttachmentOption(o => o.setName('file').setDescription('Upload your photo or video').setRequired(true))
  .addStringOption(o => o.setName('caption').setDescription('Short caption (optional)').setMaxLength(100));

client.once(Events.ClientReady, async c => {
  console.log('Bot online as ' + c.user.tag);
  try {
    await new REST({ version: '10' }).setToken(E.DISCORD_TOKEN)
      .post(Routes.applicationGuildCommands(E.CLIENT_ID, E.GUILD_ID), { body: command.toJSON() });
    console.log('Registered /submitmedia');
  } catch (e) { console.error('Could not register commands:', e.message); }
});

client.on(Events.InteractionCreate, async i => {
  try {
    if (i.isChatInputCommand() && i.commandName === 'submitmedia') return await submit(i);
    if (i.isButton() && i.customId.startsWith('media:')) return await review(i);
  } catch (e) {
    console.error(e);
    const msg = { content: 'Something went wrong. Try again.', flags: EPH };
    if (i.deferred || i.replied) i.editReply(msg.content).catch(() => {}); else i.reply(msg).catch(() => {});
  }
});

async function submit(i) {
  const f = i.options.getAttachment('file');
  const type = (f.contentType || '').split('/')[0];
  if (type !== 'image' && type !== 'video') return i.reply({ content: 'Please upload a photo or video.', flags: EPH });
  if (f.size > 24 * 1024 * 1024) return i.reply({ content: 'That file is over 24 MB. Please upload a smaller one.', flags: EPH });
  await i.deferReply({ flags: EPH });

  const id = crypto.randomUUID();
  let ext = path.extname(f.name || '').toLowerCase();
  if (!/^\.[a-z0-9]{1,5}$/.test(ext)) ext = '';
  const file = id + ext;
  const full = path.join(PEND, file);
  fs.writeFileSync(full, Buffer.from(await (await fetch(f.url)).arrayBuffer()));

  try {
    const caption = i.options.getString('caption') || '';
    const ch = await client.channels.fetch(E.REVIEW_CHANNEL_ID);
    const embed = new EmbedBuilder().setTitle('Media submission').setColor(0x3b82f6)
      .setDescription(caption || 'No caption').addFields({ name: 'From', value: `<@${i.user.id}>` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('media:ok:' + id).setLabel('Approve').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('media:no:' + id).setLabel('Deny').setStyle(ButtonStyle.Danger));
    await ch.send({ embeds: [embed], files: [{ attachment: full, name: 'submission' + ext }], components: [row] });
    db.get().pending[id] = { file, user: i.user.id, tag: i.user.username, caption, type };
    db.save();
    await i.editReply('Submitted! Staff will review it.');
  } catch (e) {
    fs.rmSync(full, { force: true });
    throw e;
  }
}

async function review(i) {
  const [, act, id] = i.customId.split(':');
  const has = r => Array.isArray(i.member.roles) ? i.member.roles.includes(r) : i.member.roles.cache.has(r);
  const allowed = i.user.id === E.OWNER_ID || i.memberPermissions.has('Administrator') || db.get().settings.approverRoles.some(has);
  if (!allowed) return i.reply({ content: 'You are not allowed to review submissions.', flags: EPH });

  const p = db.get().pending[id];
  if (!p) return i.update({ content: 'Already handled.', components: [] });
  const src = path.join(PEND, p.file);
  if (act === 'ok') {
    fs.renameSync(src, path.join(MEDIA, p.file));
    db.get().media.unshift({ id, file: p.file, type: p.type, caption: p.caption, by: p.tag, at: Date.now() });
  } else {
    fs.rmSync(src, { force: true });
  }
  delete db.get().pending[id];
  db.save();
  await i.update({ content: (act === 'ok' ? '✅ Approved by ' : '❌ Denied by ') + i.user, components: [] });
  client.users.fetch(p.user)
    .then(u => u.send(act === 'ok' ? 'Your media was approved and is now on the website.' : 'Your media submission was not approved.'))
    .catch(() => {});
}

async function channels() {
  const g = await client.guilds.fetch(E.GUILD_ID);
  const cs = await g.channels.fetch();
  return [...cs.values()].filter(c => c && [0, 5].includes(c.type)).map(c => ({ id: c.id, name: c.name }));
}
async function post(channelId, payload) {
  const g = await client.guilds.fetch(E.GUILD_ID);
  const c = await g.channels.fetch(channelId);
  if (!c || !c.isTextBased()) throw new Error('Bad channel');
  return c.send(Object.assign({ allowedMentions: { parse: [] } }, payload));
}

module.exports = { start: () => client.login(E.DISCORD_TOKEN), channels, post };
