const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('support')
        .setDescription('Get support server and contact information'),
    securityToken: COMMAND_SECURITY_TOKEN,

    async execute(interaction) {
        if (!shiva || !shiva.validateCore || !shiva.validateCore()) {
            const embed = new EmbedBuilder()
                .setDescription('❌ System core offline - Command unavailable')
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
        }

        interaction.shivaValidated = true;
        interaction.securityToken = COMMAND_SECURITY_TOKEN;

        try {
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Support & Contact')
                .setColor(0x1DB954)
                .setDescription(
                    'Need help or have questions? Join our official support server:\n' +
                    '[Support Server](https://discord.gg/M4Xv5MvdF8)\n\n' +
                    'For direct inquiries, contact: **Dominator**\n\n'
                )
                .setTimestamp()
                .setFooter({ text: 'Ultimate Music Bot • Developed by Domi' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Support command error:', error);
            await interaction.reply({ content: '❌ An error occurred while fetching support information.', ephemeral: true });
        }
    }
};
