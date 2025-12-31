const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop music and disconnect from voice channel'),
    securityToken: COMMAND_SECURITY_TOKEN,

    async execute(interaction, client) {
        if (!shiva || !shiva.validateCore || !shiva.validateCore()) {
            const embed = new EmbedBuilder()
                .setDescription('❌ System core offline - Command unavailable')
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
        }

        interaction.shivaValidated = true;
        interaction.securityToken = COMMAND_SECURITY_TOKEN;

        await interaction.deferReply();

        const ConditionChecker = require('../../utils/checks');
        const { hasDJPermission } = require('../../utils/djMiddleware');
        const DJPermission = require('../../models/DJPermission');
        const checker = new ConditionChecker(client);

        try {
            // Check DJ permissions
            const djPermissions = await DJPermission.findOne({ guildId: interaction.guild.id });
            const hasPermission = await hasDJPermission(interaction, djPermissions);

            if (!hasPermission) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ You need DJ permissions to use this command')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            const conditions = await checker.checkMusicConditions(
                interaction.guild.id,
                interaction.user.id,
                interaction.member.voice?.channelId
            );

            if (!conditions.hasActivePlayer) {
                const embed = new EmbedBuilder().setDescription('❌ No music is currently playing!');
                return interaction.editReply({ embeds: [embed] })
                    ;
            }

            if (!conditions.sameVoiceChannel) {
                const embed = new EmbedBuilder().setDescription('❌ You need to be in the same voice channel as the bot!');
                return interaction.editReply({ embeds: [embed] })
                    ;
            }

            const player = conditions.player;
            player.destroy();

            const embed = new EmbedBuilder().setDescription('🛑 Music stopped and disconnected from voice channel!');
            return interaction.editReply({ embeds: [embed] })
                ;

        } catch (error) {
            console.error('Stop command error:', error);
            const embed = new EmbedBuilder().setDescription('❌ An error occurred while stopping music!');
            return interaction.editReply({ embeds: [embed] })
                ;
        }
    }
};
