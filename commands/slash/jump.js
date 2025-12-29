const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jump')
        .setDescription('Jump to a specific song in queue')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Queue position to jump to')
                .setRequired(true)
                .setMinValue(1)
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
        
        const position = interaction.options.getInteger('position');

        const ConditionChecker = require('../../utils/checks');
        const checker = new ConditionChecker(client);
        
        try {
            const conditions = await checker.checkMusicConditions(
                interaction.guild.id, 
                interaction.user.id, 
                interaction.member.voice?.channelId
            );

            if (!conditions.hasActivePlayer || conditions.queueLength === 0) {
                const embed = new EmbedBuilder().setDescription('❌ Queue is empty!');
                return interaction.editReply({ embeds: [embed] })
                    ;
            }

            if (position > conditions.queueLength) {
                const embed = new EmbedBuilder().setDescription(`❌ Invalid position! Queue has only ${conditions.queueLength} songs.`);
                return interaction.editReply({ embeds: [embed] })
                    ;
            }

            const player = conditions.player;
            for (let i = 0; i < position - 1; i++) {
                player.queue.remove(0);
            }

            player.stop();

            const embed = new EmbedBuilder().setDescription(`⏭️ Jumped to position ${position} in queue!`);
            return interaction.editReply({ embeds: [embed] })
                ;

        } catch (error) {
            console.error('Jump command error:', error);
            const embed = new EmbedBuilder().setDescription('❌ An error occurred while jumping in queue!');
            return interaction.editReply({ embeds: [embed] })
                ;
        }
    }
};
