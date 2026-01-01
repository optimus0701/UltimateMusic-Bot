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
     * Create Now Playing embed
     */
    createNowPlayingEmbed(player, track, thumbnail) {
        const progress = this.getPlayerProgress(player);
        const duration = this.formatDuration(track.info.length);
        const currentTime = this.formatDuration(progress.current);
        const progressBar = this.createProgressBar(progress.current, track.info.length);

        // Calculate percentage
        const percentage = Math.round((progress.current / track.info.length) * 100) || 0;

        // Beautiful gradient color
        const embed = new EmbedBuilder()
            .setColor('#9B59B6') // Purple gradient
            .setAuthor({
                name: '♫ Now Playing',
                iconURL: this.client.user.displayAvatarURL()
            })
            .setTitle(track.info.title.length > 50 ? track.info.title.substring(0, 50) + '...' : track.info.title)
            .setURL(track.info.uri)
            .setDescription(
                `**🎤 ${track.info.author}**\n\n` +
                `\`${currentTime}\` ${progressBar} \`${duration}\`\n` +
                `**${percentage}%** completed`
            )
            .setTimestamp();

        // Add beautiful thumbnail
        if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        // Create compact info fields
        const fields = [];

        // Volume and Queue in one line
        const statusInfo = [];
        statusInfo.push(`🔊 **${player.volume}%**`);
        if (player.queue.size > 0) {
            statusInfo.push(`📋 **${player.queue.size}** queued`);
        }
        if (statusInfo.length > 0) {
            fields.push({
                name: '━━━━━━━━━━━━━━━━━━━',
                value: statusInfo.join(' • '),
                inline: false
            });
        }

        // Loop status if enabled
        if (player.loop && player.loop !== 'none') {
            const loopEmoji = player.loop === 'track' ? '🔂' : '🔁';
            const loopText = player.loop === 'track' ? 'Track Repeat' : 'Queue Repeat';
            fields.push({
                name: `${loopEmoji} Loop Mode`,
                value: `**${loopText}**`,
                inline: true
            });
        }

        // Next track preview
        if (player.queue.size > 0) {
            const nextTrack = player.queue[0];
            const nextTitle = nextTrack.info.title.length > 35
                ? nextTrack.info.title.substring(0, 35) + '...'
                : nextTrack.info.title;
            const nextAuthor = nextTrack.info.author.length > 25
                ? nextTrack.info.author.substring(0, 25) + '...'
                : nextTrack.info.author;
            fields.push({
                name: '⏭️ Up Next',
                value: `**${nextTitle}**\n${nextAuthor}`,
                inline: false
            });
        }

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        // Beautiful footer with requester
        const requesterName = track.info.requester?.username || 'Unknown';
        embed.setFooter({
            text: `Requested by ${requesterName} • Powered by Ultimate Music Bot`,
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
                        .setCustomId('add_to_playlist')
                        .setLabel('Add to Playlist')
                        .setEmoji('➕')
                        .setStyle(ButtonStyle.Success)
                );

            const message = await textChannel.send({ embeds: [embed], components: [row] });

            // Set up real-time progress bar update (every 5 seconds)
            const updateInterval = setInterval(async () => {
                try {
                    // Check if player still exists and is playing
                    const currentPlayer = this.client.riffy.players.get(player.guildId);
                    if (!currentPlayer || !currentPlayer.current || currentPlayer.current.info.uri !== track.info.uri) {
                        // Song changed or player stopped, clear interval
                        this.clearUpdateInterval(player.guildId);
                        return;
                    }

                    // Update embed with current progress
                    const updatedEmbed = this.createNowPlayingEmbed(currentPlayer, track, thumbnail);
                    await message.edit({ embeds: [updatedEmbed] });

                } catch (error) {
                    // If message was deleted or error occurred, clear interval
                    this.clearUpdateInterval(player.guildId);
                }
            }, 5000); // Update every 5 seconds

            // Store interval for cleanup
            this.updateIntervals.set(player.guildId, updateInterval);

            // Auto-clear interval after song duration
            setTimeout(() => {
                this.clearUpdateInterval(player.guildId);
            }, track.info.length + 5000);

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
