const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, EmbedBuilder } = require('discord.js');
const logger = require('./logger');
const { creerIssueGitHub } = require('./github-issues');

/**
 * Gère les erreurs de commandes avec un système de rapport de bug via GitHub Issues
 * @param {Interaction} interaction - L'interaction Discord
 * @param {Error} error - L'erreur survenue
 * @param {Client} client - Le client Discord (optionnel, sera récupéré depuis interaction.client)
 */
async function handleCommandError(interaction, error, client = null) {
    const discordClient = client || interaction.client;
    const bugId = `bug-${Date.now()}`;
    logger.error(`[ERREUR ${bugId}] Une erreur est survenue lors de l'exécution de la commande '${interaction.commandName}':`, error);

    const reportButton = new ButtonBuilder()
        .setCustomId(`report_bug_${bugId}`)
        .setLabel('Signaler le bug')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🐛');

    const row = new ActionRowBuilder().addComponents(reportButton);

    const replyOptions = {
        content: `❌ Oups ! Une erreur est survenue. Si le problème persiste, vous pouvez le signaler au développeur. (ID Erreur: ${bugId})`,
        embeds: [],
        components: [row],
        ephemeral: true
    };

    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(replyOptions);
        } else {
            await interaction.reply(replyOptions);
        }
    } catch (e) {
        // Ignorer silencieusement si l'interaction a expiré (10062)
        if (e.code !== 10062) {
            logger.error(`[ERREUR ${bugId}] Impossible de répondre à l'interaction pour signaler l'erreur:`, e);
        }
    }

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.customId === `report_bug_${bugId}` && i.user.id === interaction.user.id,
        time: 60000 // 1 minute
    });

    collector.on('collect', async i => {
        try {
            const commandOptions = interaction.options.data.map(opt => `  - ${opt.name}: ${opt.value}`).join('\n');

            const issueTitle = `🐛 [Auto] Erreur sur /${interaction.commandName} (${bugId})`;
            const issueBody = [
                `### Bug Report Automatique`,
                '',
                `**ID du Bug**`,
                bugId,
                '',
                `**Utilisateur**`,
                `${interaction.user.tag} (${interaction.user.id})`,
                '',
                `**Commande**`,
                `\`/${interaction.commandName}\``,
                '',
                `**Options**`,
                commandOptions.length > 0 ? `\`\`\`\n${commandOptions}\n\`\`\`` : 'Aucune',
                '',
                `**Message d'erreur**`,
                `\`\`\`\n${error.message}\n\`\`\``,
                '',
                `**Stack Trace**`,
                `\`\`\`\n${error.stack.substring(0, 1500)}\n\`\`\``,
            ].join('\n');

            await creerIssueGitHub({ title: issueTitle, body: issueBody });
            await i.update({ content: '✅ Votre rapport de bug a été envoyé au développeur via GitHub. Merci !', components: [] });
        } catch (issueError) {
            logger.error(`[ERREUR ${bugId}] Impossible de créer l'issue GitHub:`, issueError);
            await i.update({ content: '❌ Impossible de créer le rapport de bug. Veuillez contacter le développeur manuellement.', components: [] });
        }
        collector.stop();
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            // Si le bouton n'a pas été cliqué, on le retire du message pour éviter les erreurs futures
            interaction.editReply({ components: [] }).catch(() => { });
        }
    });
}

module.exports = { handleCommandError };

