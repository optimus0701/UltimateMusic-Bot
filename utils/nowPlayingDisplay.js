const { EmbedBuilder } = require('discord.js');

class NowPlayingDisplay {
    constructor(client) {
        this.client = client;
        this.updateIntervals = new Map(); // Store intervals for each guild
    }

    /**
     * Format duration from milliseconds to human readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }

    /**
     * Create progress bar
     */
    createProgressBar(current, total, length = 10) {
        if (total === 0) return '▱'.repeat(length);
        const percentage = Math.min(current / total, 1);
        const filled = Math.round(percentage * length);
        const empty = length - filled;
        const filledChar = '▰';
        const emptyChar = '▱';
        return filledChar.repeat(filled) + emptyChar.repeat(empty);
    }

    /**
     * Get current player progress
     */
    getPlayerProgress(player) {
        if (!player || !player.current) return { current: 0, total: 0 };
        return {
            current: player.position || 0,
            total: player.current.info.length || 0
        };
    }

    /**
     * Create Now Playing embed - Minimalist Design
     */
    createNowPlayingEmbed(player, track, thumbnail) {
        const duration = this.formatDuration(track.info.length);

        // Beautiful gradient color matching lo-fi theme
        const embed = new EmbedBuilder()
            .setColor('#9B59B6') // Purple gradient from background
            .setAuthor({
                name: '♫ Now Playing',
                iconURL: this.client.user.displayAvatarURL()
            })
            .setTitle(track.info.title.length > 50 ? track.info.title.substring(0, 50) + '...' : track.info.title)
            .setURL(track.info.uri)
            .setDescription(
                `🎤 **${track.info.author}**\n\n` +
                `⏱️ Duration: \`${duration}\``
            )
            .setTimestamp();

        // Add large image for album art (instead of small thumbnail)
        if (thumbnail) {
            embed.setImage(thumbnail);
        }

        // Only show loop status if enabled
        const fields = [];
        if (player.loop && player.loop !== 'none') {
            const loopEmoji = player.loop === 'track' ? '🔂' : '🔁';
            const loopText = player.loop === 'track' ? 'Track Repeat' : 'Queue Repeat';
            fields.push({
                name: `${loopEmoji} Loop Mode`,
                value: `**${loopText}**`,
                inline: false
            });
        }

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        // Simplified footer with requester
        const requesterName = track.info.requester?.username || 'Unknown';
        embed.setFooter({
            text: `Requested by ${requesterName}`,
            iconURL: track.info.requester?.displayAvatarURL() || undefined
        });

        return embed;
    }

    /**
     * Clear update interval for a guild
     */
    clearUpdateInterval(guildId) {
        if (this.updateIntervals.has(guildId)) {
            clearInterval(this.updateIntervals.get(guildId));
            this.updateIntervals.delete(guildId);
        }
    }

    /**
     * Send beautiful Now Playing embed to text channel with real-time updates
     */
    async sendNowPlaying(player, track, thumbnail) {
        try {
            const guild = this.client.guilds.cache.get(player.guildId);
            const textChannel = guild?.channels.cache.get(player.textChannel);

            if (!textChannel) return;

            // Clear any existing interval for this guild
            this.clearUpdateInterval(player.guildId);

            // Create and send initial embed
            const embed = this.createNowPlayingEmbed(player, track, thumbnail);

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_volume_down')
                        .setEmoji('🔉')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('music_stop')
                        .setEmoji('⏹️')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('music_skip')
                        .setEmoji('⏭️')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('music_volume_up')
                        .setEmoji('🔊')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('add_to_playlist')
                        .setEmoji('➕')
                        .setStyle(ButtonStyle.Success)
                );

            const message = await textChannel.send({ embeds: [embed], components: [row] });

            // No real-time updates needed for minimalist design (no progress bar)
            // Just send the embed once and keep it static

        } catch (error) {
            console.error('Failed to send Now Playing embed:', error.message);
        }
    }

    /**
     * Cleanup all intervals (call on bot shutdown)
     */
    cleanup() {
        for (const [guildId, interval] of this.updateIntervals) {
            clearInterval(interval);
        }
        this.updateIntervals.clear();
    }
}

module.exports = NowPlayingDisplay;
