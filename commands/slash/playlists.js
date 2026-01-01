const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PlaylistManager = require('../../utils/playlistManager');
const shiva = require('../../shiva');
const DJPermission = require('../../models/DJPermission');
const { hasDJPermission } = require('../../utils/djMiddleware');
const config = require('../../config');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlists')
        .setDescription('View all playlists')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View playlists of another user (optional)')
                .setRequired(false)
        ),
    securityToken: COMMAND_SECURITY_TOKEN,

    async execute(interaction, client) {
        interaction.shivaValidated = true;
        interaction.securityToken = COMMAND_SECURITY_TOKEN;

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply();
            }
        } catch (err) {
            if (err.code !== 40060) throw err;
        }

        try {
            let targetUser = interaction.options.getUser('user');

            // Permission check if viewing another user's playlists
            if (targetUser && targetUser.id !== interaction.user.id) {
                const djPermissions = await DJPermission.findOne({ guildId: interaction.guild.id });
                const hasPermission = await hasDJPermission(interaction, djPermissions);

                if (!hasPermission) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ You do not have permission to view other users\' playlists! (Requires DJ Role or Owner)')
                        .setColor('#FF0000');
                    return interaction.editReply({ embeds: [embed] });
                }
            } else {
                targetUser = interaction.user;
            }

            const playlistManager = new PlaylistManager();

            // Fetch global playlists (pass null for guildId)
            const playlists = await playlistManager.getUserPlaylists(
                targetUser.id,
                null
            );

            if (playlists.length === 0) {
                const embed = new EmbedBuilder()
                    .setDescription(`📭 ${targetUser.id === interaction.user.id ? 'You have' : `${targetUser.username} has`} no playlists yet!`)
                    .setColor('#1DB954');

                return interaction.editReply({ embeds: [embed] });
            }

            // Create embed with playlist list
            const embed = new EmbedBuilder()
                .setTitle(`🎵 ${targetUser.username}'s Playlists (All Servers)`)
                .setColor('#1DB954')
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: `Total: ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}` })
                .setTimestamp();

            // Add each playlist as a field
            let description = '';

            playlists.forEach((playlist, index) => {
                const songCount = playlist.songs.length;
                const createdDate = new Date(playlist.createdAt).toLocaleDateString();
                // Fetch guild name if possible, or just Show Guild ID
                const guild = client.guilds.cache.get(playlist.guildId);
                const guildName = guild ? guild.name : 'Unknown Server';

                description += `**${index + 1}. ${playlist.name}**\n`;
                description += `└ 📊 ${songCount} songs • 📅 ${createdDate} • 🏠 ${guildName}\n\n`;
            });

            embed.setDescription(description);

            // Add sample songs from first playlist if exists
            if (playlists[0] && playlists[0].songs.length > 0) {
                const firstPlaylist = playlists[0];
                const sampleSongs = firstPlaylist.songs.slice(0, 5);

                let songsPreview = `**Preview of "${firstPlaylist.name}":**\n`;
                sampleSongs.forEach((song, idx) => {
                    songsPreview += `${idx + 1}. ${song.title}\n`;
                });

                if (firstPlaylist.songs.length > 5) {
                    songsPreview += `... and ${firstPlaylist.songs.length - 5} more songs`;
                }

                embed.addFields({
                    name: '🎶 Sample Songs',
                    value: songsPreview,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Playlists command error:', error);
            const embed = new EmbedBuilder()
                .setDescription(`❌ ${error.message || 'An error occurred while fetching playlists!'}`)
                .setColor('#FF0000');

            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (replyError) {
                // Interaction might have expired, ignore
                console.error('Failed to send error message:', replyError.message);
            }
        }
    }
};
