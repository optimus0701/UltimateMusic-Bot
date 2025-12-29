const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PlaylistManager = require('../../utils/playlistManager');
const shiva = require('../../shiva');

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
        if (!shiva || !shiva.validateCore || !shiva.validateCore()) {
            const embed = new EmbedBuilder()
                .setDescription('❌ System core offline - Command unavailable')
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }

        interaction.shivaValidated = true;
        interaction.securityToken = COMMAND_SECURITY_TOKEN;

        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const playlistManager = new PlaylistManager();

            const playlists = await playlistManager.getUserPlaylists(
                targetUser.id,
                interaction.guild.id
            );

            if (playlists.length === 0) {
                const embed = new EmbedBuilder()
                    .setDescription(`📭 ${targetUser.id === interaction.user.id ? 'You have' : `${targetUser.username} has`} no playlists yet!`)
                    .setColor('#1DB954');
                
                return interaction.editReply({ embeds: [embed] })
                    ;
            }

            // Create embed with playlist list
            const embed = new EmbedBuilder()
                .setTitle(`🎵 ${targetUser.username}'s Playlists`)
                .setColor('#1DB954')
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: `Total: ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}` })
                .setTimestamp();

            // Add each playlist as a field
            let description = '';
            
            playlists.forEach((playlist, index) => {
                const songCount = playlist.songs.length;
                const createdDate = new Date(playlist.createdAt).toLocaleDateString();
                
                description += `**${index + 1}. ${playlist.name}**\n`;
                description += `└ 📊 ${songCount} song${songCount !== 1 ? 's' : ''} • 📅 ${createdDate}\n\n`;
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

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Playlists command error:', error);
            const embed = new EmbedBuilder()
                .setDescription(`❌ ${error.message || 'An error occurred while fetching playlists!'}`)
                .setColor('#FF0000');
            
            return interaction.editReply({ embeds: [embed] })
                ;
        }
    }
};
