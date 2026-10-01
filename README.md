# Community website + Discord bot

One Node.js project that runs:
- the public website (Home, About, Media, Staff, Departments with rosters, Contact a member)
- a staff portal (embed builder, About/Departments/Staff editors, media removal), behind Discord sign-in
- an owner panel (footer link "Owners sign in"), only your Discord account
- a Discord bot with `/submitmedia` and Approve/Deny buttons

Requires Node.js 18 or newer.

## 1. Create the Discord application
1. Go to https://discord.com/developers/applications and click **New Application**.
2. **Bot** tab: click **Reset Token** and copy it (this is `DISCORD_TOKEN`). No privileged intents are needed.
3. **General Information**: copy the **Application ID** (`CLIENT_ID`).
4. **OAuth2** tab: copy the **Client Secret** (`CLIENT_SECRET`). Under **Redirects**, add `BASE_URL/auth/callback`, for example `http://localhost:3000/auth/callback` while testing. When you go live, add your real address too.
5. **OAuth2 > URL Generator**: tick `bot` and `applications.commands`, then under bot permissions tick View Channels, Send Messages, Embed Links, Attach Files. Open the generated link and add the bot to your server.

## 2. Get your IDs
In Discord, turn on Developer Mode (User Settings > Advanced). Then right-click to Copy ID for:
- your server (`GUILD_ID`)
- your own profile (`OWNER_ID`)
- the private channel where submissions should be reviewed (`REVIEW_CHANNEL_ID`)
- the channel where "Contact a member" messages should land (`CONTACT_CHANNEL_ID`)

Make sure the bot can see and post in both channels, and that only your approvers can see the review channel.

## 3. Run it
```
cp .env.example .env     # then fill in the values
npm install
npm start
```
Open http://localhost:3000.

## 4. First-time setup in the site
1. Click **Owners sign in** (footer) and sign in with Discord.
2. Fill in the server name, tagline, Discord invite, and the role IDs:
   - **Staff role IDs**: members with these roles can open the staff portal.
   - **Media approver role IDs**: members with these roles can press Approve/Deny on submissions. Administrators and the owner can always do both.
3. Use the staff portal to edit About, Departments (with rosters), and the Staff directory.

Role changes take effect the next time someone signs in.

## How media works
Members run `/submitmedia` and attach a photo or video (up to 24 MB). The bot posts it in the review channel with Approve/Deny buttons. Approve saves it to the Media page; Deny deletes it and DMs the member.

## Putting it online
Use any host that runs Node.js continuously (a VPS, Render, Railway, Fly.io, and so on).
- Set the same environment variables there, and set `BASE_URL` to your public https address.
- Add `BASE_URL/auth/callback` to the Redirects list in the Developer Portal.
- Keep the `data/` and `uploads/` folders on persistent storage. They hold all your site content and approved media. Back them up.

## Notes
- Sign-in sessions are kept in memory, so everyone is signed out whenever the server restarts.
- "Contact a member" posts to your contact channel in Discord; it does not send email.
- Content is stored in `data/site.json`.
"# My-NEW-website" 
