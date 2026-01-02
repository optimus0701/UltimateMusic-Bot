const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot\'s latency and uptime'),
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

        try {
            // Measure latency by recording time before and after reply
            const startTime = Date.now();

            // Send initial reply
            const initialEmbed = new EmbedBuilder()
                .setTitle('📡 Pong!')
                .setColor(0x1DB954)
                .setDescription('🔄 Calculating latency...')
                .setTimestamp();

            await interaction.reply({ embeds: [initialEmbed] });

            // Calculate actual latency
            const latency = Date.now() - startTime;

            // Calculate uptime
            const uptimeSeconds = Math.floor(client.uptime / 1000);
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;

            // Update embed with real latency
            const embed = new EmbedBuilder()
                .setTitle('📡 Pong!')
                .setColor(0x1DB954)
                .setDescription(
                    `• **Latency:** ${latency} ms\n` +
                    `• **API Ping:** ${Math.round(client.ws.ping)} ms\n` +
                    `• **Uptime:** ${hours}h ${minutes}m ${seconds}s`
                )
                .setTimestamp()
                .setFooter({ text: 'Ultimate Music Bot • Developed by Domi' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Ping command error:', error);
            // Only try to reply if we haven't replied yet
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred while checking ping.', ephemeral: true }).catch(() => { });
            }
        }
    }
};
