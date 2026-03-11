const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const DJPermission = require('../../models/DJPermission');
const { hasDJPermission } = require('../../utils/djMiddleware');
const config = require('../../config');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('change_nodes')
        .setDescription('Change the active Lavalink node'),
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
            // Check DJ permissions (covers bot owners, server owners, DJ users/roles)
            const guildId = interaction.guild.id;
            const djPermissions = await DJPermission.findOne({ guildId });
            const hasPermission = await hasDJPermission(interaction, djPermissions);

            if (!hasPermission) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ You need DJ or Owner permissions to change Lavalink nodes')
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Defer reply — ephemeral so only the user sees it
            await interaction.deferReply({ ephemeral: true });

            // Ensure no music is playing before allowing node switch
            // Node switching is global and would disconnect all active players
            const activePlayers = Array.from(client.riffy.players.values()).filter(p => p.playing);
            if (activePlayers.length > 0) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ Không thể đổi node khi đang có nhạc đang phát. Vui lòng dừng mọi bài hát đang phát trước khi thực hiện thay đổi này.')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            // Fetch nodes from LAVALINK_NODES_URL
            const url = config.lavalinkNodesUrl;
            if (!url) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ `LAVALINK_NODES_URL` is not configured in `.env`')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            let nodes;
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                nodes = await response.json();
            } catch (fetchError) {
                const embed = new EmbedBuilder()
                    .setDescription(`❌ Failed to fetch nodes: ${fetchError.message}`)
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            if (!nodes || nodes.length === 0) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ No Lavalink nodes available')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            // Sort by ping ascending
            nodes.sort((a, b) => (a.ping || 9999) - (b.ping || 9999));

            // Get current node info
            const currentNode = client.riffy?.nodes?.values()?.next()?.value;
            const currentNodeName = currentNode?.name || 'Unknown';

            // Build select menu — show only name + ping
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('change_nodes_select')
                .setPlaceholder('🔄 Select a Lavalink node')
                .addOptions(
                    nodes.map((node, index) => ({
                        label: node.name || `Node ${index + 1}`,
                        description: `Ping: ${node.ping ?? 'N/A'}ms`,
                        value: String(index),
                        emoji: node.name === currentNodeName ? '🟢' : '📡'
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('🔄 Change Lavalink Node')
                .setDescription(`Current node: **${currentNodeName}**\nSelect a node from the dropdown below:`)
                .setColor('#00AE86')
                .setTimestamp();

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // Collector — 30s timeout, only the command user can interact
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === interaction.user.id,
                time: 30_000,
                max: 1
            });

            collector.on('collect', async (selectInteraction) => {
                await selectInteraction.deferUpdate();

                const selectedIndex = parseInt(selectInteraction.values[0]);
                const selectedNode = nodes[selectedIndex];

                if (!selectedNode) {
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('❌ Invalid node selection')
                        .setColor('#FF0000');
                    return interaction.editReply({ embeds: [errorEmbed], components: [] });
                }

                // Switch to the selected node
                const switchingEmbed = new EmbedBuilder()
                    .setTitle('⏳ Switching Node...')
                    .setDescription(`Connecting to **${selectedNode.name}**...`)
                    .setColor('#FFA500')
                    .setTimestamp();

                await interaction.editReply({ embeds: [switchingEmbed], components: [] });

                const success = await client.switchToNode({
                    name: selectedNode.name,
                    host: selectedNode.host,
                    port: selectedNode.port,
                    password: selectedNode.password,
                    secure: selectedNode.secure || false
                });

                if (success) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Node Changed')
                        .setDescription(
                            `**${currentNodeName}** → **${selectedNode.name}**\n` +
                            `Ping: **${selectedNode.ping ?? 'N/A'}ms**`
                        )
                        .setColor('#00FF00')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } else {
                    const failEmbed = new EmbedBuilder()
                        .setDescription(`❌ Failed to switch to **${selectedNode.name}**`)
                        .setColor('#FF0000');

                    await interaction.editReply({ embeds: [failEmbed], components: [] });
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setDescription('⏰ Node selection timed out')
                        .setColor('#808080');

                    interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => { });
                }
            });

        } catch (error) {
            console.error('Change nodes command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while changing nodes')
                .setColor('#FF0000');

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] }).catch(() => { });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
            }
        }
    }
};
