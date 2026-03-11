/**
 * Ultimate Music Bot 
 * Comprehensive Discord Bot
 * 
 * @fileoverview Core application
 * @version 1.0.0
 * @author Domi
 */

const EnvironmentVariableConfigurationLoader = require('dotenv');
// Initialize environment variable configuration subsystem
EnvironmentVariableConfigurationLoader.config();

const DiscordClientFramework = require('discord.js').Client;
const DiscordGatewayIntentBitsRegistry = require('discord.js').GatewayIntentBits;
const DiscordCollectionFramework = require('discord.js').Collection;
const RiffyAudioProcessingFramework = require('riffy').Riffy;
const FileSystemOperationalInterface = require('fs');
const SystemPathResolutionUtility = require('path');
const SystemConfigurationManager = require('./config');
const DatabaseConnectionEstablishmentService = require('./database/connection');
const AudioPlayerManagementHandler = require('./utils/player');
const ApplicationStatusManagementService = require('./utils/statusManager');
const MemoryGarbageCollectionOptimizer = require('./utils/garbageCollector');
const shiva = require('./shiva');

/**
 * Discord Client Runtime Management System
 * Implements comprehensive client lifecycle management with advanced intent configuration
 */
/**
 * Lavalink node log helper — auto-prepends timestamp
 */
function nodeLog(level, msg) {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const icons = { info: '📡', warn: '🟡', error: '🔴', success: '🟢' };
    console.log(`[${ts}] ${icons[level] || '📡'} [Lavalink] ${msg}`);
}

class DiscordClientRuntimeManager {
    constructor() {
        this.initializeClientConfiguration();
        this.initializeRuntimeSubsystems();
        // Audio infrastructure is initialized async in executeApplicationBootstrap
        this.initializeApplicationBootstrapProcedures();
    }

    /**
     * Initialize primary Discord client
     * Implements comprehensive gateway intent management for optimal resource utilization
     */
    initializeClientConfiguration() {
        this.clientRuntimeInstance = new DiscordClientFramework({
            intents: [
                DiscordGatewayIntentBitsRegistry.Guilds,
                DiscordGatewayIntentBitsRegistry.GuildMessages,
                DiscordGatewayIntentBitsRegistry.GuildVoiceStates,
                DiscordGatewayIntentBitsRegistry.GuildMessageReactions,
                DiscordGatewayIntentBitsRegistry.MessageContent,
                DiscordGatewayIntentBitsRegistry.DirectMessages,
                DiscordGatewayIntentBitsRegistry.GuildPresences
            ]
        });

        // Initialize command collection management subsystems
        this.clientRuntimeInstance.commands = new DiscordCollectionFramework();
        this.clientRuntimeInstance.slashCommands = new DiscordCollectionFramework();
        this.clientRuntimeInstance.mentionCommands = new DiscordCollectionFramework();
    }

    /**
     * Initialize core runtime subsystem managers with dependency injection pattern
     * Ensures proper initialization order for optimal system performance
     */
    initializeRuntimeSubsystems() {
        // Dependency injection pattern for status management subsystem
        this.statusManagementSubsystem = new ApplicationStatusManagementService(this.clientRuntimeInstance);
        this.clientRuntimeInstance.statusManager = this.statusManagementSubsystem;

        // Dependency injection pattern for audio player management subsystem  
        this.audioPlayerManagementSubsystem = new AudioPlayerManagementHandler(this.clientRuntimeInstance);
        this.clientRuntimeInstance.playerHandler = this.audioPlayerManagementSubsystem;
    }

    /**
     * Initialize advanced audio processing infrastructure with Riffy framework integration
     * Implements Lavalink node configuration and management
     */
    async initializeAudioProcessingInfrastructure() {
        const audioNodeConfigurationRegistry = await this.fetchLavalinkNodes();

        this.audioProcessingRuntimeInstance = new RiffyAudioProcessingFramework(
            this.clientRuntimeInstance,
            audioNodeConfigurationRegistry,
            {
                send: (audioPayloadTransmissionData) => {
                    const guildContextResolution = this.clientRuntimeInstance.guilds.cache
                        .get(audioPayloadTransmissionData.d.guild_id);
                    if (guildContextResolution) {
                        guildContextResolution.shard.send(audioPayloadTransmissionData);
                    }
                },
                defaultSearchPlatform: "ytmsearch",
                restVersion: "v4"
            }
        );

        this.clientRuntimeInstance.riffy = this.audioProcessingRuntimeInstance;

        // Expose reconnect method on client for player.js to call on-demand
        this.clientRuntimeInstance.reconnectLavalink = async (excludeNode) => {
            return this._reconnectToBestNode(excludeNode);
        };

        // Expose switchToNode method on client for /change_nodes command
        this.clientRuntimeInstance.switchToNode = async (nodeConfig) => {
            return this._switchToSpecificNode(nodeConfig);
        };
    }

    /**
     * Reconnect to the best available Lavalink node.
     * Called on-demand when a play request fails due to node issues.
     */
    async _reconnectToBestNode(excludeNode) {
        if (excludeNode) {
            nodeLog('warn', `Excluding node: ${excludeNode.name || 'Unknown'} (${excludeNode.host}:${excludeNode.port})`);
        } else {
            nodeLog('info', 'On-demand reconnect triggered — fetching nodes from URL...');
        }

        try {
            const url = SystemConfigurationManager.lavalinkNodesUrl;
            if (!url) throw new Error('LAVALINK_NODES_URL is not set');

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            let servers = await response.json();
            nodeLog('info', `Fetched ${servers.length} node(s) from URL`);

            // Filter out excluded node if provided
            if (excludeNode) {
                const countBefore = servers.length;
                servers = servers.filter(s =>
                    !(s.host === excludeNode.host && s.port === parseInt(excludeNode.port)) &&
                    !(s.name === excludeNode.name)
                );
                if (servers.length < countBefore) {
                    nodeLog('info', `Successfully excluded bad node. ${servers.length} node(s) remaining.`);
                }
            }

            // Sort by ping ascending
            servers.sort((a, b) => (a.ping || 9999) - (b.ping || 9999));
            servers.forEach((s, i) => {
                nodeLog('info', `  #${i + 1} ${s.name} (${s.host}:${s.port}) — ping: ${s.ping ?? 'N/A'}ms`);
            });

            const best = servers[0];
            if (!best) {
                nodeLog('error', 'No alternative nodes available after exclusion!');
                throw new Error('No nodes available after exclusion');
            }

            nodeLog('success', `Reconnecting to "${best.name}" (${best.host}:${best.port}, ping: ${best.ping ?? 'N/A'}ms)`);

            // Re-create Riffy with the new node
            const newNodes = [{
                name: best.name,
                host: best.host,
                password: best.password,
                port: best.port,
                secure: best.secure || false
            }];

            this.audioProcessingRuntimeInstance = new RiffyAudioProcessingFramework(
                this.clientRuntimeInstance,
                newNodes,
                {
                    send: (audioPayloadTransmissionData) => {
                        const guildContextResolution = this.clientRuntimeInstance.guilds.cache
                            .get(audioPayloadTransmissionData.d.guild_id);
                        if (guildContextResolution) {
                            guildContextResolution.shard.send(audioPayloadTransmissionData);
                        }
                    },
                    defaultSearchPlatform: "ytmsearch",
                    restVersion: "v4"
                }
            );

            this.clientRuntimeInstance.riffy = this.audioProcessingRuntimeInstance;
            this.clientRuntimeInstance.riffy.init(this.clientRuntimeInstance.user.id);

            // Re-bind event handlers on new Riffy instance
            this.applicationBootstrapOrchestrator.audioSubsystemIntegrationManager.initializeRiffyBindings();
            this.clientRuntimeInstance.playerHandler.initializeEvents();

            // Wait a bit for the node to connect
            await new Promise(resolve => setTimeout(resolve, 2000));

            nodeLog('success', `Reconnect complete`);
            return true;
        } catch (error) {
            nodeLog('error', `Reconnect failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Switch to a specific Lavalink node chosen by the user.
     * Called by /change_nodes command.
     * @param {Object} nodeConfig - { name, host, port, password, secure }
     */
    async _switchToSpecificNode(nodeConfig) {
        nodeLog('info', `Switching to node: "${nodeConfig.name}" (${nodeConfig.host}:${nodeConfig.port})`);

        try {
            const newNodes = [{
                name: nodeConfig.name,
                host: nodeConfig.host,
                password: nodeConfig.password,
                port: nodeConfig.port,
                secure: nodeConfig.secure || false
            }];

            this.audioProcessingRuntimeInstance = new RiffyAudioProcessingFramework(
                this.clientRuntimeInstance,
                newNodes,
                {
                    send: (audioPayloadTransmissionData) => {
                        const guildContextResolution = this.clientRuntimeInstance.guilds.cache
                            .get(audioPayloadTransmissionData.d.guild_id);
                        if (guildContextResolution) {
                            guildContextResolution.shard.send(audioPayloadTransmissionData);
                        }
                    },
                    defaultSearchPlatform: "ytmsearch",
                    restVersion: "v4"
                }
            );

            this.clientRuntimeInstance.riffy = this.audioProcessingRuntimeInstance;
            this.clientRuntimeInstance.riffy.init(this.clientRuntimeInstance.user.id);

            // Re-bind event handlers on new Riffy instance
            this.applicationBootstrapOrchestrator.audioSubsystemIntegrationManager.initializeRiffyBindings();
            this.clientRuntimeInstance.playerHandler.initializeEvents();

            // Wait for the node to connect
            await new Promise(resolve => setTimeout(resolve, 2000));

            nodeLog('success', `Successfully switched to "${nodeConfig.name}" (${nodeConfig.host}:${nodeConfig.port})`);
            return true;
        } catch (error) {
            nodeLog('error', `Failed to switch node: ${error.message}`);
            return false;
        }
    }

    /**
     * Fetch Lavalink nodes from remote URL (LAVALINK_NODES_URL)
     * Sorts by ping ascending and returns the best node (lowest ping)
     */
    async fetchLavalinkNodes() {
        const url = SystemConfigurationManager.lavalinkNodesUrl;
        if (!url) {
            throw new Error('LAVALINK_NODES_URL is not set in .env!');
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const servers = await response.json();
            nodeLog('info', `Fetched ${servers.length} node(s) from URL`);

            // Sort by ping ascending
            servers.sort((a, b) => (a.ping || 9999) - (b.ping || 9999));

            // Log all available nodes
            servers.forEach((s, i) => {
                nodeLog('info', `  #${i + 1} ${s.name} (${s.host}:${s.port}) — ping: ${s.ping ?? 'N/A'}ms`);
            });

            // Return the best node (lowest ping)
            const best = servers[0];
            nodeLog('success', `Selected node: "${best.name}" (${best.host}:${best.port}, ping: ${best.ping ?? 'N/A'}ms)`);

            return [{
                name: best.name,
                host: best.host,
                password: best.password,
                port: best.port,
                secure: best.secure || false
            }];
        } catch (error) {
            nodeLog('error', `Failed to fetch nodes from URL: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize comprehensive application bootstrap procedures
     * Orchestrates system initialization sequence with error handling and logging
     */
    initializeApplicationBootstrapProcedures() {
        this.applicationBootstrapOrchestrator = new ApplicationBootstrapOrchestrator(
            this.clientRuntimeInstance
        );
    }

    /**
     * Execute complete application runtime initialization sequence
     * Implements error handling and graceful degradation patterns
     */
    async executeApplicationBootstrap() {
        try {
            await this.applicationBootstrapOrchestrator.executeDatabaseConnectionEstablishment();
            await this.applicationBootstrapOrchestrator.executeCommandDiscoveryAndRegistration();
            await this.applicationBootstrapOrchestrator.executeEventHandlerRegistration();
            await this.applicationBootstrapOrchestrator.executeMemoryOptimizationInitialization();
            // Initialize audio infrastructure (async — fetches nodes from URL)
            await this.initializeAudioProcessingInfrastructure();
            // Now bind Riffy event handlers (deferred until Riffy is ready)
            this.applicationBootstrapOrchestrator.audioSubsystemIntegrationManager.initializeRiffyBindings();
            await this.applicationBootstrapOrchestrator.executeAudioSubsystemInitialization();
            await this.applicationBootstrapOrchestrator.executeClientAuthenticationProcedure();

        } catch (applicationBootstrapException) {
            this.handleApplicationBootstrapFailure(applicationBootstrapException);
        }
    }

    /**
     * Handle application bootstrap failure with comprehensive error reporting
     */
    handleApplicationBootstrapFailure(exceptionInstance) {
        console.error('❌ Failed to initialize bot:', exceptionInstance);
        process.exit(1);
    }
}

/**
 * Application Bootstrap Orchestration Service
 * Manages complex initialization sequences with advanced error handling
 */
class ApplicationBootstrapOrchestrator {
    constructor(clientRuntimeInstance) {
        this.clientRuntimeInstance = clientRuntimeInstance;
        this.commandDiscoveryEngine = new CommandDiscoveryEngine();
        this.eventHandlerRegistrationService = new EventHandlerRegistrationService();
        this.audioSubsystemIntegrationManager = new AudioSubsystemIntegrationManager(clientRuntimeInstance);
    }

    /**
     * Execute database connection establishment with connection pooling
     */
    async executeDatabaseConnectionEstablishment() {
        await DatabaseConnectionEstablishmentService();
        console.log('✅ MongoDB connected successfully');
    }

    /**
     * Execute comprehensive command discovery and registration procedures
     */
    async executeCommandDiscoveryAndRegistration() {
        const commandRegistrationResults = await this.commandDiscoveryEngine
            .executeMessageCommandDiscovery(this.clientRuntimeInstance)
            .executeSlashCommandDiscovery(this.clientRuntimeInstance);

        console.log(`✅ Loaded ${commandRegistrationResults.totalCommands} commands`);
    }

    /**
     * Execute event handler registration with advanced event binding
     */
    async executeEventHandlerRegistration() {
        const eventRegistrationResults = await this.eventHandlerRegistrationService
            .executeEventDiscovery()
            .bindEventHandlers(this.clientRuntimeInstance);

        console.log(`✅ Loaded ${eventRegistrationResults.totalEvents} events`);
    }

    /**
     * Execute memory optimization subsystem initialization
     */
    async executeMemoryOptimizationInitialization() {
        MemoryGarbageCollectionOptimizer.init();
    }

    /**
     * Execute audio processing subsystem initialization with event binding
     */
    async executeAudioSubsystemInitialization() {
        this.clientRuntimeInstance.playerHandler.initializeEvents();
        //console.log('🎵 Player events initialized');
    }

    /**
     * Execute Discord client authentication and connectivity establishment
     */
    async executeClientAuthenticationProcedure() {
        const authenticationCredential = SystemConfigurationManager.discord.token ||
            process.env.TOKEN;

        await this.clientRuntimeInstance.login(authenticationCredential);
    }
}

/**
 * Command Discovery and Registration Engine
 * Implements advanced filesystem scanning and module resolution
 */
class CommandDiscoveryEngine {
    constructor() {
        this.discoveredMessageCommands = 0;
        this.discoveredSlashCommands = 0;
    }

    /**
     * Execute message command discovery with filesystem traversal
     */
    executeMessageCommandDiscovery(clientInstance) {
        const messageCommandDirectoryPath = SystemPathResolutionUtility.join(__dirname, 'commands', 'message');

        if (FileSystemOperationalInterface.existsSync(messageCommandDirectoryPath)) {
            const discoveredCommandFiles = FileSystemOperationalInterface
                .readdirSync(messageCommandDirectoryPath)
                .filter(fileEntity => fileEntity.endsWith('.js'));

            for (const commandFile of discoveredCommandFiles) {
                const commandModuleInstance = require(SystemPathResolutionUtility.join(messageCommandDirectoryPath, commandFile));
                clientInstance.commands.set(commandModuleInstance.name, commandModuleInstance);
                this.discoveredMessageCommands++;
            }
        }

        return this;
    }

    /**
     * Execute slash command discovery with advanced module resolution
     */
    executeSlashCommandDiscovery(clientInstance) {
        const slashCommandDirectoryPath = SystemPathResolutionUtility.join(__dirname, 'commands', 'slash');

        if (FileSystemOperationalInterface.existsSync(slashCommandDirectoryPath)) {
            const discoveredCommandFiles = FileSystemOperationalInterface
                .readdirSync(slashCommandDirectoryPath)
                .filter(fileEntity => fileEntity.endsWith('.js'));

            for (const commandFile of discoveredCommandFiles) {
                const commandModuleInstance = require(SystemPathResolutionUtility.join(slashCommandDirectoryPath, commandFile));
                clientInstance.slashCommands.set(commandModuleInstance.data.name, commandModuleInstance);
                this.discoveredSlashCommands++;
            }
        }

        return {
            totalCommands: this.discoveredMessageCommands + this.discoveredSlashCommands
        };
    }
}

/**
 * Event Handler Registration Service
 * Manages advanced event binding with lifecycle management
 */
class EventHandlerRegistrationService {
    constructor() {
        this.discoveredEventHandlers = [];
        this.boundEventHandlers = 0;
    }

    /**
     * Execute event handler discovery with filesystem traversal
     */
    executeEventDiscovery() {
        const eventHandlerDirectoryPath = SystemPathResolutionUtility.join(__dirname, 'events');
        const discoveredEventFiles = FileSystemOperationalInterface
            .readdirSync(eventHandlerDirectoryPath)
            .filter(fileEntity => fileEntity.endsWith('.js'));

        this.discoveredEventHandlers = discoveredEventFiles.map(eventFile => {
            return require(SystemPathResolutionUtility.join(eventHandlerDirectoryPath, eventFile));
        });

        return this;
    }

    /**
     * Bind discovered event handlers with advanced lifecycle management
     */
    bindEventHandlers(clientInstance) {
        for (const eventHandlerInstance of this.discoveredEventHandlers) {
            if (eventHandlerInstance.once) {
                clientInstance.once(eventHandlerInstance.name, (...eventArguments) =>
                    eventHandlerInstance.execute(...eventArguments, clientInstance));
            } else {
                clientInstance.on(eventHandlerInstance.name, (...eventArguments) =>
                    eventHandlerInstance.execute(...eventArguments, clientInstance));
            }
            this.boundEventHandlers++;
        }

        return {
            totalEvents: this.boundEventHandlers
        };
    }
}

/**
 * Audio Subsystem Integration Manager
 * Manages Riffy framework integration with advanced event handling
 */
class AudioSubsystemIntegrationManager {
    constructor(clientInstance) {
        this.clientRuntimeInstance = clientInstance;
        // Store channelId per guild from VOICE_STATE_UPDATE for Lavalink v4 compatibility
        this._voiceChannelMap = new Map();
        this.initializeAudioEventHandlers();
    }

    /**
     * Initialize comprehensive audio event handling subsystem
     * Only registers raw event here; Riffy bindings are deferred until Riffy is ready
     */
    initializeAudioEventHandlers() {
        this.clientRuntimeInstance.on('raw', (gatewayEventPayload) => {
            this.processGatewayVoiceStateEvent(gatewayEventPayload);
        });
    }

    /**
     * Bind Riffy event handlers — must be called AFTER Riffy is initialized
     */
    initializeRiffyBindings() {
        if (this.clientRuntimeInstance.riffy) {
            this.bindRiffyEventHandlers();
        }
    }

    /**
     * Process Discord gateway voice state events with validation
     * Patches channelId into voice state for Lavalink v4 compatibility
     */
    processGatewayVoiceStateEvent(eventPayload) {
        // Guard: skip if Riffy is not initialized yet
        if (!this.clientRuntimeInstance.riffy) return;

        const validVoiceStateEvents = ['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE'];

        if (!validVoiceStateEvents.includes(eventPayload.t)) return;

        // Track channelId from VOICE_STATE_UPDATE for Lavalink v4
        if (eventPayload.t === 'VOICE_STATE_UPDATE' && eventPayload.d) {
            const { guild_id, channel_id, user_id } = eventPayload.d;
            if (guild_id && user_id === this.clientRuntimeInstance.user?.id) {
                if (channel_id) {
                    this._voiceChannelMap.set(guild_id, channel_id);
                } else {
                    this._voiceChannelMap.delete(guild_id);
                }
            }
        }

        // Patch VOICE_SERVER_UPDATE to include channelId required by Lavalink v4
        if (eventPayload.t === 'VOICE_SERVER_UPDATE' && eventPayload.d) {
            const guildId = eventPayload.d.guild_id;
            const channelId = this._voiceChannelMap.get(guildId);
            if (channelId) {
                eventPayload = {
                    ...eventPayload,
                    d: { ...eventPayload.d, channel_id: channelId }
                };
            }
        }

        this.clientRuntimeInstance.riffy.updateVoiceState(eventPayload);
    }

    /**
     * Bind Riffy framework event handlers with comprehensive logging
     */
    bindRiffyEventHandlers() {
        console.log(`[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] 📡 [Internal] Binding Riffy events (Instance: ${this.clientRuntimeInstance.user?.id || 'Pending'})`);
        this.clientRuntimeInstance.riffy.on('nodeConnect', (audioNodeInstance) => {
            nodeLog('success', `Connected to "${audioNodeInstance.name}" (${audioNodeInstance.host}:${audioNodeInstance.port})`);
        });

        this.clientRuntimeInstance.riffy.on('nodeError', (audioNodeInstance, nodeErrorException) => {
            nodeLog('error', `Node "${audioNodeInstance.name}" (${audioNodeInstance.host}:${audioNodeInstance.port}) error: ${nodeErrorException.message}`);
        });

        this.clientRuntimeInstance.riffy.on('nodeDisconnect', (disconnectedNode, reason) => {
            const reasonStr = typeof reason === 'object' ? JSON.stringify(reason) : (reason || 'unknown');
            nodeLog('warn', `Node "${disconnectedNode.name}" (${disconnectedNode.host}:${disconnectedNode.port}) disconnected. Reason: ${reasonStr}`);
            nodeLog('info', 'Will reconnect to a new node when next play request is made.');
        });

        this.clientRuntimeInstance.riffy.on('nodeReconnect', (audioNodeInstance) => {
            nodeLog('info', `Node "${audioNodeInstance.name}" reconnecting...`);
        });
    }
}


const enterpriseApplicationManager = new DiscordClientRuntimeManager();
enterpriseApplicationManager.executeApplicationBootstrap();


module.exports = enterpriseApplicationManager.clientRuntimeInstance;
// shiva.initialize(enterpriseApplicationManager.clientRuntimeInstance);