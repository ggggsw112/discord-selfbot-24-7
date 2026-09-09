const { Client, GatewayIntentBits, ActivityType, ChannelType, EmbedBuilder } = require('discord.js');
const { DISCORD_TOKEN, VOICE_CHANNEL_ID, SPOTIFY_TRACK, SPOTIFY_ARTIST, AUTO_DEAFEN } = require('./config');

class SelfBot extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      // Anti-ban: Hide online status and presence
      presence: {
        status: 'invisible',
      },
    });
    this.voiceConnection = null;
    this.guild = null;
    this.deafened = AUTO_DEAFEN;
    this.commandCount = 0;
    this.lastCommandTime = 0;
  }

  // Anti-ban: Random delay to mimic human behavior
  getRandomDelay() {
    return Math.random() * (2000 - 500) + 500; // 500-2000ms
  }

  // Anti-ban: Delete message FAST (50-200ms)
  async deleteMessageSafely(message) {
    try {
      const delay = Math.random() * 150 + 50; // 50-200ms fast delete
      setTimeout(() => {
        message.delete().catch(() => {});
      }, delay);
    } catch {}
  }

  // Anti-ban: Rate limiting to avoid detection
  async checkRateLimit() {
    const now = Date.now();
    if (now - this.lastCommandTime < 1500) {
      // If commands too frequent, wait
      await new Promise(resolve => setTimeout(resolve, 1500 - (now - this.lastCommandTime)));
    }
    this.lastCommandTime = Date.now();
  }

  async connectToVoice(channelId = null) {
    try {
      await this.checkRateLimit();
      
      const targetChannelId = channelId || VOICE_CHANNEL_ID;
      const channel = await this.channels.fetch(targetChannelId);
      if (!channel) {
        console.log(`❌ Channel ${targetChannelId} not found!`);
        return;
      }

      if (channel.type !== ChannelType.GuildVoice) {
        console.log(`❌ ${channel.name} is not a voice channel!`);
        return;
      }

      // Disconnect if already connected
      if (this.voiceConnection) {
        this.voiceConnection.destroy();
      }

      // Anti-ban: Random delay before connecting
      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));

      // Connect to voice channel
      const { joinVoiceChannel } = require('@discordjs/voice');
      this.voiceConnection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: AUTO_DEAFEN,
        selfMute: false,
      });

      this.guild = channel.guild;
      console.log(`✅ Connected to ${channel.name}`);

      // Auto-deafen if enabled
      if (AUTO_DEAFEN) {
        await this.setDeafen(true);
        console.log('🔇 Auto-deafened');
      }
    } catch (error) {
      console.log(`❌ Failed to connect to voice: ${error}`);
    }
  }

  async setDeafen(deafen) {
    try {
      await this.checkRateLimit();
      
      if (this.guild) {
        const me = await this.guild.members.fetch(this.user.id);
        if (me) {
          // Anti-ban: Random delay before deafening
          await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
          
          await me.voice.setDeaf(deafen);
          this.deafened = deafen;
          const status = deafen ? '🔇 Deafened' : '🔊 Undeafened';
          console.log(status);
        }
      }
    } catch (error) {
      console.log(`❌ Failed to change deafen status: ${error}`);
    }
  }

  async updateSpotifyStatus(track, artist) {
    try {
      await this.checkRateLimit();
      
      // Anti-ban: Random delay before status update
      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
      
      await this.user.setActivity(`${track} - ${artist}`, {
        type: ActivityType.Listening,
      });
      console.log(`🎵 Spotify status set to: ${track} - ${artist}`);
    } catch (error) {
      console.log(`❌ Failed to update status: ${error}`);
    }
  }

  async sendHelpEmbed(message) {
    try {
      const artAscii = `
⠀⠀⢀⠀⠀⠀⠀⢠⠀⠀⢠⠀⠀⠀⠀⠀
⠀⠀⠱⡀⠀⠀⡇⢸⠀⠀⢀⢠⠀⢠⠀⠀
⠀⠀⠀⠘⢦⡀⣇⢸⠀⠀⠀⡠⠖⠀⠀⠀`;

      const helpEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setDescription(`
\`\`\`
${artAscii}
\`\`\`

🙏🏻 **.help** - Show this menu
🙏🏻 **.ping** - Check latency
🙏🏻 **.join** <channel_id> - Join voice channel
🙏🏻 **.status** <song> - <artist> - Set Spotify status
🙏🏻 **.leave** - Leave voice channel
🙏🏻 **.deafen** - Deafen yourself
🙏🏻 **.undeafen** - Undeafen yourself
🙏🏻 **.rejoin** - Rejoin default channel

🛡️ **Anti-ban Mode Active** | Only you can see this
`)
        .setFooter({ text: '🤖 Selfbot v1.0' })
        .setTimestamp();

      // Send ephemeral message (only visible to user)
      await message.reply({ embeds: [helpEmbed], ephemeral: true }).catch(() => {
        // Fallback if reply fails
        message.author.send({ embeds: [helpEmbed] }).catch(() => {});
      });

      console.log('✅ Help menu sent (ephemeral)');
    } catch (error) {
      console.log(`❌ Failed to send help: ${error}`);
    }
  }
}

const client = new SelfBot();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.username}`);
  console.log(`🎙️ Username: ${client.user.username}#${client.user.discriminator}`);
  console.log(`🛡️ Anti-ban mode: ACTIVE (Invisible status, human patterns)`);

  // Connect to voice channel
  await client.connectToVoice();

  // Update Spotify status immediately
  await client.updateSpotifyStatus(SPOTIFY_TRACK, SPOTIFY_ARTIST);

  // Update Spotify status every 10 seconds with human-like variation
  setInterval(async () => {
    const randomDelay = Math.random() * 5000 + 5000; // 5-10 second variation
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    await client.updateSpotifyStatus(SPOTIFY_TRACK, SPOTIFY_ARTIST);
  }, 15000);

  // Maintain voice connection every 30 seconds with anti-ban checks
  setInterval(async () => {
    try {
      if (!client.voiceConnection || client.voiceConnection.state.status === 'disconnected') {
        console.log('⚠️ Voice connection lost, reconnecting...');
        await client.connectToVoice();
      }
    } catch (error) {
      console.log(`❌ Error maintaining voice connection: ${error}`);
    }
  }, 30000);
});

client.on('messageCreate', async (message) => {
  if (message.author.id !== client.user.id) return;

  const content = message.content.toLowerCase().trim();

  // Help command
  if (content === '.help') {
    await client.sendHelpEmbed(message);
    await client.deleteMessageSafely(message);
  }
  // Ping command
  else if (content === '.ping') {
    const latency = client.ws.ping;
    console.log(`⏱️ Pong! Latency: ${latency}ms`);
    await client.deleteMessageSafely(message);
  }
  // Join voice channel by ID command
  else if (content.startsWith('.join ')) {
    const channelId = content.substring(6).trim();
    if (channelId) {
      await client.connectToVoice(channelId);
      console.log(`✅ Joined channel: ${channelId}`);
    }
    await client.deleteMessageSafely(message);
  }
  // Deafen command
  else if (content === '.deafen') {
    await client.setDeafen(true);
    await client.deleteMessageSafely(message);
  }
  // Undeafen command
  else if (content === '.undeafen') {
    await client.setDeafen(false);
    await client.deleteMessageSafely(message);
  }
  // Rejoin voice channel
  else if (content === '.rejoin') {
    await client.connectToVoice();
    await client.deleteMessageSafely(message);
  }
  // Leave voice channel
  else if (content === '.leave') {
    if (client.voiceConnection) {
      await client.checkRateLimit();
      client.voiceConnection.destroy();
      console.log('👋 Left voice channel');
    }
    await client.deleteMessageSafely(message);
  }
  // Set Spotify track
  else if (content.startsWith('.status ')) {
    const parts = message.content.substring(8).split(' - ');
    if (parts.length === 2) {
      const [track, artist] = parts;
      await client.updateSpotifyStatus(track, artist);
    }
    await client.deleteMessageSafely(message);
  }
});

// Anti-ban: Randomize reconnection attempts to avoid pattern detection
client.on('error', error => {
  console.log(`⚠️ Client error: ${error}`);
  setTimeout(() => {
    client.login(DISCORD_TOKEN).catch(err => console.log(`❌ Login failed: ${err}`));
  }, Math.random() * 10000 + 5000); // 5-15 second random reconnect
});

client.on('shardDisconnect', () => {
  console.log('⚠️ Shard disconnected, attempting reconnect...');
});

client.login(DISCORD_TOKEN);
