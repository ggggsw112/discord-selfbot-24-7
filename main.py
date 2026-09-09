import discord
import asyncio
import json
from discord.ext import tasks, commands
from config import DISCORD_TOKEN, VOICE_CHANNEL_ID, SPOTIFY_TRACK, SPOTIFY_ARTIST, AUTO_DEAFEN

class SelfBot(discord.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.voice_client = None
        self.guild = None
        self.deafened = AUTO_DEAFEN

    async def on_ready(self):
        print(f"✅ Logged in as {self.user}")
        print(f"🎙️ Username: {self.user.name}#{self.user.discriminator}")
        
        # Start background tasks
        if not self.maintain_voice.is_running():
            self.maintain_voice.start()
        if not self.update_spotify_status.is_running():
            self.update_spotify_status.start()
        
        # Connect to voice channel
        await self.connect_to_voice()

    async def connect_to_voice(self):
        """Connect to the specified voice channel"""
        try:
            channel = self.get_channel(VOICE_CHANNEL_ID)
            if not channel:
                print(f"❌ Channel {VOICE_CHANNEL_ID} not found!")
                return
            
            if not isinstance(channel, discord.VoiceChannel):
                print(f"❌ {channel} is not a voice channel!")
                return
            
            # Disconnect if already connected
            if self.voice_client and self.voice_client.is_connected():
                await self.voice_client.disconnect()
            
            # Connect to voice channel
            self.voice_client = await channel.connect()
            self.guild = channel.guild
            print(f"✅ Connected to {channel.name}")
            
            # Auto-deafen if enabled
            if AUTO_DEAFEN:
                await self.set_deafen(True)
                print("🔇 Auto-deafened")
        
        except Exception as e:
            print(f"❌ Failed to connect to voice: {e}")

    async def set_deafen(self, deafen: bool):
        """Deafen or undeafen the bot"""
        try:
            if self.guild:
                me = self.guild.get_member(self.user.id)
                if me:
                    await me.edit(deafen=deafen)
                    self.deafened = deafen
                    status = "🔇 Deafened" if deafen else "🔊 Undeafened"
                    print(f"{status}")
        except Exception as e:
            print(f"❌ Failed to change deafen status: {e}")

    async def on_message(self, message):
        """Handle commands"""
        if message.author != self.user:
            return
        
        content = message.content.lower().strip()
        
        # Deafen command
        if content == ".deafen":
            await self.set_deafen(True)
            try:
                await message.add_reaction("✅")
            except:
                pass
        
        # Undeafen command
        elif content == ".undeafen":
            await self.set_deafen(False)
            try:
                await message.add_reaction("✅")
            except:
                pass
        
        # Rejoin voice channel
        elif content == ".rejoin":
            await self.connect_to_voice()
            try:
                await message.add_reaction("✅")
            except:
                pass
        
        # Leave voice channel
        elif content == ".leave":
            if self.voice_client:
                await self.voice_client.disconnect()
                print("👋 Left voice channel")
            try:
                await message.add_reaction("✅")
            except:
                pass
        
        # Set Spotify track
        elif content.startswith(".spotify "):
            parts = message.content[9:].split(" - ")
            if len(parts) == 2:
                track, artist = parts
                import config
                config.SPOTIFY_TRACK = track
                config.SPOTIFY_ARTIST = artist
                print(f"🎵 Spotify status set to: {track} - {artist}")
                try:
                    await message.add_reaction("✅")
                except:
                    pass

    @tasks.loop(seconds=30)
    async def maintain_voice(self):
        """Keep the bot connected to voice channel"""
        try:
            if not self.voice_client or not self.voice_client.is_connected():
                print("⚠️ Voice connection lost, reconnecting...")
                await self.connect_to_voice()
        except Exception as e:
            print(f"❌ Error maintaining voice connection: {e}")

    @tasks.loop(seconds=10)
    async def update_spotify_status(self):
        """Update the bot's status to show Spotify track"""
        try:
            activity = discord.Activity(
                type=discord.ActivityType.listening,
                name=f"{SPOTIFY_TRACK} - {SPOTIFY_ARTIST}"
            )
            await self.change_presence(activity=activity)
        except Exception as e:
            print(f"❌ Failed to update status: {e}")

    @maintain_voice.before_loop
    async def before_maintain_voice(self):
        await self.wait_until_ready()

    @update_spotify_status.before_loop
    async def before_update_spotify_status(self):
        await self.wait_until_ready()

def main():
    if DISCORD_TOKEN == "YOUR_TOKEN_HERE":
        print("❌ Please set your Discord token in config.py")
        return
    
    if VOICE_CHANNEL_ID == 0:
        print("❌ Please set your Voice Channel ID in config.py")
        return
    
    intents = discord.Intents.default()
    intents.message_content = True
    
    client = SelfBot(intents=intents)
    client.run(DISCORD_TOKEN)

if __name__ == "__main__":
    main()
