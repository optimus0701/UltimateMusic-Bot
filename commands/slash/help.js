const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List all available commands'),
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
            // Define command categories
            const categories = {
                'Music': ['play', 'pause', 'skip', 'stop', 'queue', 'loop', 'shuffle', 'volume', 'nowplaying', 'join', 'leave', 'lyrics', 'playlist'],
                'Utility': ['help', 'ping', 'dashboard', 'invite', 'support', 'stats']
            };

            const slashCommandsPath = path.join(__dirname, '..', 'slash');
            const slashFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));

            const commands = [];
            for (const file of slashFiles) {
                const cmd = require(path.join(slashCommandsPath, file));
                if (cmd.data) {
                    commands.push({
                        name: cmd.data.name,
                        description: cmd.data.description
                    });
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('📖 Ultimate Music Bot - User Guide')
                .setColor(0x1DB954)
                .setDescription(`**🌐 Bot Status:** Active in **${client.guilds.cache.size}** servers.\nHere are the commands you can use:`)
                .setFooter({ text: 'Developed by Domi | https://glaceyt.com' })
                .setTimestamp();

            // Add fields for categories
            for (const [category, cmdNames] of Object.entries(categories)) {
                const categoryCommands = commands.filter(cmd => cmdNames.includes(cmd.name));
                if (categoryCommands.length > 0) {
                    const commandList = categoryCommands.map(cmd => `\`/${cmd.name}\`\n*${cmd.description}*`).join('\n\n');
                    embed.addFields({
                        name: `${category === 'Music' ? '🎵' : '🛠️'} ${category} Commands`,
                        value: commandList,
                        inline: true
                    });
                }
            }

            // Catch-all for uncategorized commands
            const categorizedNames = Object.values(categories).flat();
            const otherCommands = commands.filter(cmd => !categorizedNames.includes(cmd.name));

            if (otherCommands.length > 0) {
                const otherList = otherCommands.map(cmd => `\`/${cmd.name}\`\n*${cmd.description}*`).join('\n\n');
                embed.addFields({
                    name: '📂 Other Commands',
                    value: otherList,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Help command error:', error);
            await interaction.reply({ content: '❌ An error occurred while fetching commands.', ephemeral: true });
        }
    }
};
