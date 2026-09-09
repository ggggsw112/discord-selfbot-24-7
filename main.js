const { Client, GatewayIntentBits, ActivityType, ChannelType } = require('discord.js');
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
    });
    this.voiceConnection = null;
    this.guild = null;
    this.deafened = AUTO_DEAFEN;
  }

  // Anti-ban: Delete message immediately after command
  async deleteMessageSafely(message) {
    try {
      setTimeout(() => {
        message.delete().catch(() => {});
      }, 100); // Delete after 100ms to avoid detection
    } catch {}
  }

  async connectToVoice(channelId = null) {
    try {
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
      if (this.guild) {
        const me = await this.guild.members.fetch(this.user.id);
        if (me) {
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
      await this.user.setActivity(`${track} - ${artist}`, {
        type: ActivityType.Listening,
      });
      console.log(`🎵 Spotify status set to: ${track} - ${artist}`);
    } catch (error) {
      console.log(`❌ Failed to update status: ${error}`);
    }
  }
}

const client = new SelfBot();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.username}`);
  console.log(`🎙️ Username: ${client.user.username}#${client.user.discriminator}`);

  // Connect to voice channel
  await client.connectToVoice();

  // Update Spotify status immediately
  await client.updateSpotifyStatus(SPOTIFY_TRACK, SPOTIFY_ARTIST);

  // Update Spotify status every 10 seconds
  setInterval(async () => {
    await client.updateSpotifyStatus(SPOTIFY_TRACK, SPOTIFY_ARTIST);
  }, 10000);

  // Maintain voice connection every 30 seconds
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

  // Join voice channel by ID command
  if (content.startsWith('.join ')) {
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
      client.voiceConnection.destroy();
      console.log('👋 Left voice channel');
    }
    await client.deleteMessageSafely(message);
  }
  // Set Spotify track
  else if (content.startsWith('.spotify ')) {
    const parts = message.content.substring(9).split(' - ');
    if (parts.length === 2) {
      const [track, artist] = parts;
      await client.updateSpotifyStatus(track, artist);
    }
    await client.deleteMessageSafely(message);
  }
});

client.login(DISCORD_TOKEN);
