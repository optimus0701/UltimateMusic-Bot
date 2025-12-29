const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show current playing song'),
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
        
        const ConditionChecker = require('../../utils/checks');
        const checker = new ConditionChecker(client);
        
        try {
            const conditions = await checker.checkMusicConditions(
                interaction.guild.id, 
                interaction.user.id, 
                interaction.member.voice?.channelId
            );

            if (!conditions.hasActivePlayer || !conditions.currentTrack) {
                const embed = new EmbedBuilder().setDescription('❌ No music is currently playing!');
                return interaction.editReply({ embeds: [embed] })
                    ;
            }

            const track = conditions.currentTrack;
            const player = conditions.player;
            
            const duration = formatDuration(track.info.length);
            const position = formatDuration(player.position);
            const statusEmoji = player.paused ? '⏸️' : '▶️';
            const loopEmoji = getLoopEmoji(player.loop);

            const embed = new EmbedBuilder().setDescription(
                `${statusEmoji} **${track.info.title}**\n` +
                `By: ${track.info.author}\n` +
                `⏰ ${position} / ${duration}\n` +
                `👤 <@${track.info.requester.id}>\n` +
                `🔊 Volume: ${player.volume || 50}%\n` +
                `🔁 Loop: ${loopEmoji} ${player.loop || 'Off'}\n` +
                `📜 Queue: ${player.queue.size} songs`
            );

            return interaction.editReply({ embeds: [embed] })
                ;

        } catch (error) {
            console.error('Now playing command error:', error);
            const embed = new EmbedBuilder().setDescription('❌ An error occurred while fetching current song!');
            return interaction.editReply({ embeds: [embed] })
                ;
        }
    }
};

function formatDuration(duration) {
    if (!duration) return '0:00';
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getLoopEmoji(loopMode) {
    switch (loopMode) {
        case 'track': return '🔂';
        case 'queue': return '🔁';
        default: return '➡️';
    }
}
