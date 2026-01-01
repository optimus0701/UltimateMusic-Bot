const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PlaylistManager = require('../../utils/playlistManager');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Manage your music playlists')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name (max 32 characters)')
                        .setRequired(true)
                        .setMaxLength(32)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name to delete')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a song to playlist')
                .addStringOption(option =>
                    option.setName('playlist')
                        .setDescription('Playlist name')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Song name, URL, or search query (leave empty to add current song)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove-song')
                .setDescription('Remove a song from playlist')
                .addStringOption(option =>
                    option.setName('playlist')
                        .setDescription('Playlist name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('position')
                        .setDescription('Song position to remove')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rename')
                .setDescription('Rename a playlist')
                .addStringOption(option =>
                    option.setName('old-name')
                        .setDescription('Current playlist name')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('new-name')
                        .setDescription('New playlist name')
                        .setRequired(true)
                        .setMaxLength(32)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('Play all songs from a playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name to play')
                        .setRequired(true)
                )
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
            const subcommand = interaction.options.getSubcommand();
            const playlistManager = new PlaylistManager();

            switch (subcommand) {
                case 'create':
                    await this.handleCreate(interaction, playlistManager);
                    break;
                case 'delete':
                    await this.handleDelete(interaction, playlistManager);
                    break;
                case 'add':
                    await this.handleAdd(interaction, playlistManager, client);
                    break;
                case 'remove-song':
                    await this.handleRemoveSong(interaction, playlistManager);
                    break;
                case 'rename':
                    await this.handleRename(interaction, playlistManager);
                    break;
                case 'play':
                    await this.handlePlay(interaction, playlistManager, client);
                    break;
            }
        } catch (error) {
            console.error('Playlist command error:', error);
            const embed = new EmbedBuilder()
                .setDescription(`❌ ${error.message || 'An error occurred!'}`)
                .setColor('#FF0000');

            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (replyError) {
                console.error('Failed to send error message:', replyError.message);
            }
        }
    },

    async handleCreate(interaction, playlistManager) {
        const name = interaction.options.getString('name');

        const playlist = await playlistManager.createPlaylist(
            interaction.user.id,
            interaction.guild.id,
            name
        );

        const embed = new EmbedBuilder()
            .setDescription(`✅ Created playlist **${playlist.name}**!`)
            .setColor('#1DB954');

        return interaction.editReply({ embeds: [embed] });
    },

    async handleDelete(interaction, playlistManager) {
        const name = interaction.options.getString('name');

        const playlist = await playlistManager.deletePlaylist(
            interaction.user.id,
            interaction.guild.id,
            name
        );

        const embed = new EmbedBuilder()
            .setDescription(`🗑️ Deleted playlist **${playlist.name}** (${playlist.songs.length} songs)`)
            .setColor('#1DB954');

        return interaction.editReply({ embeds: [embed] });
    },

    async handleAdd(interaction, playlistManager, client) {
        const playlistName = interaction.options.getString('playlist');
        const query = interaction.options.getString('query');

        let songData;

        if (query) {
            // Search for the song - no need to be in voice channel
            const result = await client.riffy.resolve({ query });

            if (!result || !result.tracks || result.tracks.length === 0) {
                throw new Error('No results found for your query!');
            }

            const track = result.tracks[0];
            songData = {
                title: track.info.title,
                author: track.info.author,
                url: track.info.uri,
                duration: track.info.length
            };
        } else {
            // Get currently playing song
            const player = client.riffy.players.get(interaction.guild.id);

            if (!player || !player.current) {
                throw new Error('No song is currently playing! Please specify a song or play one first.');
            }

            const track = player.current;
            songData = {
                title: track.info.title,
                author: track.info.author,
                url: track.info.uri,
                duration: track.info.length
            };
        }

        await playlistManager.addSong(
            interaction.user.id,
            interaction.guild.id,
            playlistName,
            songData
        );

        const embed = new EmbedBuilder()
            .setDescription(`✅ Added **${songData.title}** to playlist **${playlistName}**!`)
            .setColor('#1DB954');

        return interaction.editReply({ embeds: [embed] });
    },

    async handleRemoveSong(interaction, playlistManager) {
        const playlistName = interaction.options.getString('playlist');
        const position = interaction.options.getInteger('position');

        const result = await playlistManager.removeSong(
            interaction.user.id,
            interaction.guild.id,
            playlistName,
            position
        );

        const embed = new EmbedBuilder()
            .setDescription(`🗑️ Removed **${result.removedSong.title}** from playlist **${playlistName}**!`)
            .setColor('#1DB954');

        return interaction.editReply({ embeds: [embed] });
    },

    async handleRename(interaction, playlistManager) {
        const oldName = interaction.options.getString('old-name');
        const newName = interaction.options.getString('new-name');

        await playlistManager.renamePlaylist(
            interaction.user.id,
            interaction.guild.id,
            oldName,
            newName
        );

        const embed = new EmbedBuilder()
            .setDescription(`✅ Renamed playlist **${oldName}** to **${newName}**!`)
            .setColor('#1DB954');

        return interaction.editReply({ embeds: [embed] });
    },

    async handlePlay(interaction, playlistManager, client) {
        const playlistName = interaction.options.getString('name');

        // Check voice channel conditions
        const ConditionChecker = require('../../utils/checks');
        const checker = new ConditionChecker(client);

        const conditions = await checker.checkMusicConditions(
            interaction.guild.id,
            interaction.user.id,
            interaction.member.voice?.channelId
        );

        const errorMsg = checker.getErrorMessage(conditions, 'play');
        if (errorMsg) {
            throw new Error(errorMsg.replace('❌ ', ''));
        }

        // Get playlist
        const playlist = await playlistManager.getPlaylist(
            interaction.user.id,
            interaction.guild.id,
            playlistName
        );

        if (playlist.songs.length === 0) {
            throw new Error(`Playlist **${playlist.name}** is empty!`);
        }

        // Create player
        const PlayerHandler = require('../../utils/player');
        const playerHandler = new PlayerHandler(client);
        const player = await playerHandler.createPlayer(
            interaction.guild.id,
            interaction.member.voice.channelId,
            interaction.channel.id
        );

        // Add all songs from playlist to queue
        let addedCount = 0;
        for (const song of playlist.songs) {
            try {
                const result = await client.riffy.resolve({ query: song.url });
                if (result && result.tracks && result.tracks.length > 0) {
                    const track = result.tracks[0];
                    track.info.requester = interaction.user;
                    player.queue.add(track);
                    addedCount++;
                }
            } catch (err) {
                console.error(`Failed to add song ${song.title}:`, err);
            }
        }

        if (addedCount === 0) {
            throw new Error('Failed to add any songs from the playlist!');
        }

        if (!player.playing && !player.paused) {
            player.play();
        }

        const embed = new EmbedBuilder()
            .setDescription(`✅ Added **${addedCount}** song${addedCount !== 1 ? 's' : ''} from playlist **${playlist.name}**!`)
            .setColor('#1DB954');

        return interaction.editReply({ embeds: [embed] });
    }
};
