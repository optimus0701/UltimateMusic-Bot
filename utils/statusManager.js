const { ActivityType } = require('discord.js');

class StatusManager {
    constructor(client) {
        this.client = client;
        this.currentInterval = null;
        this.isPlaying = false;
        this.voiceChannelData = new Map();
    }

    _getTimestamp() {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    _log(msg) {
        console.log(`[${this._getTimestamp()}] ${msg}`);
    }

    _error(msg, error) {
        console.error(`[${this._getTimestamp()}] ${msg}`, error || '');
    }


    async updateStatusAndVoice(guildId, track = null) {
        try {
            // Use track info directly if provided to avoid library state lag (player.playing might be false at start)
            if (track && track.info) {
                await this.setPlayingStatus(track.info.title);
                await this.setVoiceChannelStatus(guildId, track.info.title);
                return;
            }

            const playerInfo = this.client.playerHandler.getPlayerInfo(guildId);

            if (playerInfo && playerInfo.playing) {
                await this.setPlayingStatus(playerInfo.title);
                await this.setVoiceChannelStatus(guildId, playerInfo.title);
            } else {
                await this.setDefaultStatus();
                await this.clearVoiceChannelStatus(guildId);
            }
        } catch (error) {
            this._error('❌ Error updating status and voice channel:', error);
        }
    }


    async setPlayingStatus(trackTitle) {
        this.stopCurrentStatus();
        this.isPlaying = true;

        const activity = `🎵 ${trackTitle}`;

        await this.client.user.setPresence({
            activities: [{
                name: activity,
                type: ActivityType.Listening
            }],
            status: 'online'
        });


        this.currentInterval = setInterval(async () => {
            if (this.isPlaying) {
                await this.client.user.setPresence({
                    activities: [{
                        name: activity,
                        type: ActivityType.Listening
                    }],
                    status: 'online'
                });
                this._log(`🔄 Status refreshed: ${activity}`);
            }
        }, 30000);

        this._log(`✅ Status locked to: ${activity}`);
    }


    async setVoiceChannelStatus(guildId, trackTitle) {
        try {
            const player = this.client.riffy.players.get(guildId);
            if (!player || !player.voiceChannel) return;

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const voiceChannel = guild.channels.cache.get(player.voiceChannel);
            if (!voiceChannel) return;


            if (!this.voiceChannelData.has(voiceChannel.id)) {
                this.voiceChannelData.set(voiceChannel.id, {
                    originalName: voiceChannel.name,
                    originalTopic: voiceChannel.topic
                });
            }


            const botMember = guild.members.me;
            const permissions = voiceChannel.permissionsFor(botMember);

            if (!permissions?.has('ManageChannels')) {
                console.warn(`⚠️ Bot lacks 'Manage Channels' permission in ${voiceChannel.name}`);
                return;
            }

            const statusText = `🎵 ${trackTitle}`;


            let success = await this.createVoiceStatusAPI(voiceChannel.id, statusText);
            if (success) return;

            success = await this.createChannelTopic(voiceChannel, trackTitle);
            if (success) return;

            await this.createChannelName(voiceChannel, trackTitle);

        } catch (error) {
            this._error(`❌ Voice channel status creation failed: ${error.message}`);
        }
    }


    async clearVoiceChannelStatus(guildId) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;


            const botMember = guild.members.me;
            let voiceChannel = null;


            const player = this.client.riffy.players.get(guildId);
            if (player && player.voiceChannel) {
                voiceChannel = guild.channels.cache.get(player.voiceChannel);
            }


            if (!voiceChannel && botMember.voice.channelId) {
                voiceChannel = guild.channels.cache.get(botMember.voice.channelId);
            }


            if (!voiceChannel) {
                for (const channel of guild.channels.cache.values()) {
                    if (channel.type === 2 && this.voiceChannelData.has(channel.id)) { // Voice channel
                        voiceChannel = channel;
                        break;
                    }
                }
            }

            if (!voiceChannel) return;


            const permissions = voiceChannel.permissionsFor(botMember);
            if (!permissions?.has('ManageChannels')) {
                console.warn(`⚠️ Bot lacks 'Manage Channels' permission in ${voiceChannel.name}`);
                return;
            }


            let success = await this.deleteVoiceStatusAPI(voiceChannel.id);
            if (success) return;

            success = await this.deleteChannelTopic(voiceChannel);
            if (success) return;

            await this.deleteChannelName(voiceChannel);

        } catch (error) {
            this._error(`❌ Voice channel status clearing failed: ${error.message}`);
        }
    }


    async createVoiceStatusAPI(channelId, statusText) {
        try {
            await this.client.rest.put(`/channels/${channelId}/voice-status`, {
                body: { status: statusText }
            });
            this._log(`✅ Voice status created: ${statusText}`);
            return true;
        } catch (error) {
            // Quiet log for API unavailability
            return false;
        }
    }


    async deleteVoiceStatusAPI(channelId) {
        try {

            await this.client.rest.put(`/channels/${channelId}/voice-status`, {
                body: { status: null }
            });
            this._log(`✅ Voice status cleared`);
            return true;
        } catch (error) {
            try {

                await this.client.rest.delete(`/channels/${channelId}/voice-status`);
                this._log(`✅ Voice status deleted`);
                return true;
            } catch (deleteError) {
                return false;
            }
        }
    }


    async createChannelTopic(voiceChannel, trackTitle) {
        try {
            const topicText = `🎵 Now Playing: ${trackTitle}`;
            await voiceChannel.setTopic(topicText);
            this._log(`✅ Voice channel topic created: ${topicText}`);
            return true;
        } catch (error) {
            return false;
        }
    }


    async deleteChannelTopic(voiceChannel) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const originalTopic = originalData?.originalTopic || null;

            await voiceChannel.setTopic(originalTopic);
            this._log(`✅ Voice channel topic restored`);
            return true;
        } catch (error) {
            return false;
        }
    }


    async createChannelName(voiceChannel, trackTitle) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const baseName = originalData?.originalName || voiceChannel.name.replace(/🎵.*$/, '').trim();

            const shortTitle = trackTitle.length > 15
                ? trackTitle.substring(0, 15) + '...'
                : trackTitle;
            const newName = `🎵 ${baseName}`;

            if (newName !== voiceChannel.name && newName.length <= 100) {
                await voiceChannel.setName(newName);
                this._log(`✅ Voice channel name created: ${newName}`);
            }
            return true;
        } catch (error) {
            return false;
        }
    }


    async deleteChannelName(voiceChannel) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const originalName = originalData?.originalName;

            if (originalName && originalName !== voiceChannel.name) {
                await voiceChannel.setName(originalName);
                this._log(`✅ Voice channel name restored: ${originalName}`);


                this.voiceChannelData.delete(voiceChannel.id);
            }
            return true;
        } catch (error) {
            return false;
        }
    }


    async setDefaultStatus() {
        this.stopCurrentStatus();
        this.isPlaying = false;

        const defaultActivity = `🎵 Ready for music!`;

        await this.client.user.setPresence({
            activities: [{
                name: defaultActivity,
                type: ActivityType.Watching
            }],
            status: 'online'
        });

        this._log(`✅ Status reset to: ${defaultActivity}`);
    }


    stopCurrentStatus() {
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
    }


    async setServerCountStatus(serverCount) {
        if (!this.isPlaying) {
            await this.client.user.setPresence({
                activities: [{
                    name: `Youtube Music`,
                    type: ActivityType.Playing
                }],
                status: 'online'
            });
            //console.log(`✅ Status set: Playing Youtube Music`);
        }
    }


    async onTrackStart(guildId, track = null) {
        await this.updateStatusAndVoice(guildId, track);
    }


    async onTrackEnd(guildId) {
        setTimeout(async () => {
            await this.updateStatusAndVoice(guildId);
        }, 1000);
    }


    async onPlayerDisconnect(guildId = null) {
        await this.setDefaultStatus();

        if (guildId) {

            await this.clearVoiceChannelStatus(guildId);
        } else {

            for (const guild of this.client.guilds.cache.values()) {
                await this.clearVoiceChannelStatus(guild.id);
            }
        }
    }


    async testVoiceChannelCRUD(guildId, testText = 'Test Song') {
        this._log(`🧪 Testing Voice Channel CRUD for guild ${guildId}`);

        const results = [];


        await this.setVoiceChannelStatus(guildId, testText);
        results.push(`[${this._getTimestamp()}] ✅ CREATE: Status set`);

        await new Promise(resolve => setTimeout(resolve, 3000));


        const player = this.client.riffy.players.get(guildId);
        if (player?.voiceChannel) {
            const guild = this.client.guilds.cache.get(guildId);
            const voiceChannel = guild?.channels.cache.get(player.voiceChannel);
            if (voiceChannel) {
                results.push(`[${this._getTimestamp()}] 📖 READ: Channel name: ${voiceChannel.name}`);
                results.push(`[${this._getTimestamp()}] 📖 READ: Channel topic: ${voiceChannel.topic || 'None'}`);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));


        await this.clearVoiceChannelStatus(guildId);
        results.push(`[${this._getTimestamp()}] 🗑️ DELETE: Status cleared`);

        return results.join('\n');
    }
}

module.exports = StatusManager;
