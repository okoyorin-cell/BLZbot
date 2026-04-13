const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { initializeTutorial } = require('../../utils/tutorial-handler');
const { handleCommandError } = require('../../utils/error-handler');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('force-tutoriel')
        .setDescription('Force le démarrage du tutoriel pour un membre (Admin)')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre pour qui lancer le tutoriel')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('membre');
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!member) {
                return interaction.reply({ content: '❌ Impossible de trouver ce membre sur le serveur.', flags: 64 });
            }

            // Vérifier si le canal TUTORIAL_CHANNEL est défini dans .env
            const tutorialChannelId = process.env.TUTORIAL_CHANNEL;
            
            if (!tutorialChannelId) {
                return interaction.reply({ content: '❌ TUTORIAL_CHANNEL non défini dans .env', flags: 64 });
            }

            // Récupérer le canal de tutoriel
            const tutorialChannel = await interaction.guild.channels.fetch(tutorialChannelId).catch(() => null);
            
            if (!tutorialChannel) {
                return interaction.reply({ content: `❌ Canal de tutoriel introuvable: ${tutorialChannelId}`, flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });

            // Créer un fil privé pour le membre
            const thread = await tutorialChannel.threads.create({
                name: `Tutoriel - ${member.user.username}`,
                autoArchiveDuration: 1440, // 24 heures
                reason: `Tutoriel forcé par ${interaction.user.username}`,
                type: 12, // GUILD_PRIVATE_THREAD
            });

            // Ajouter le membre au fil
            await thread.members.add(member.id);

            logger.info(`[TUTORIAL] Fil privé forcé créé pour ${member.user.username} par ${interaction.user.username}`);

            // Initialiser le tutoriel
            await initializeTutorial(member, thread);

            await interaction.editReply({ 
                content: `✅ Tutoriel lancé pour ${member.user.tag} dans le fil <#${thread.id}>` 
            });

        } catch (error) {
            logger.error('[TUTORIAL] Erreur lors du forçage du tutoriel:', error);
            await handleCommandError(interaction, error, interaction.client);
        }
    }
};
