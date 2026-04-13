
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/database');
const { handleCommandError } = require('../utils/error-handler');

// Objectifs prédéfinis de quête (synchronisé avec start-serveur-quete.js)
const QUEST_OBJECTIVES = {
    messages: { name: 'Envoyer 200 000 messages', target: 200000, icon: '💬' },
    counting: { name: 'Compter 70 000 nombres', target: 70000, icon: '🔢' },
    starss: { name: 'Mettre 150 000 000 starss en circulation', target: 150000000, icon: '⭐' },
    xp: { name: 'Mettre 100 000 XP en circulation', target: 100000, icon: '📈' }
};

// Générer une barre de progression visuelle
function createProgressBar(current, target, length = 20) {
    const percentage = Math.min(100, (current / target) * 100);
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;

    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);

    return `${filledBar}${emptyBar} ${percentage.toFixed(1)}%`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avancement-quete-serveur')
        .setDescription('Voir l\'avancement de la quête de serveur en cours.'),
    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Récupérer la quête active
            const getQuestStmt = db.prepare('SELECT * FROM server_quests WHERE status = ?');
            const quest = getQuestStmt.get('active');

            if (!quest) {
                // Vérifier s'il y a une quête en vote
                const votingQuest = getQuestStmt.get('voting');

                if (votingQuest) {
                    const questConfig = QUEST_OBJECTIVES[votingQuest.objective];
                    const success = votingQuest.progress >= votingQuest.target;

                    const embed = new EmbedBuilder()
                        .setTitle('🗳️ Vote en cours !')
                        .setDescription(success
                            ? '✅ La quête a été **RÉUSSIE** ! Le vote pour la récompense est en cours.'
                            : '❌ La quête a **échoué**. Aucune récompense ne sera distribuée.')
                        .setColor(success ? '#00FF00' : '#FF0000')
                        .addFields(
                            {
                                name: '📋 Objectif',
                                value: `${questConfig.icon} **${questConfig.name}**`,
                                inline: false
                            },
                            {
                                name: '📊 Résultat final',
                                value: `**${votingQuest.progress.toLocaleString('fr-FR')}** / ${votingQuest.target.toLocaleString('fr-FR')}`,
                                inline: false
                            }
                        )
                        .setTimestamp();

                    if (success) {
                        embed.addFields({
                            name: '⏰ Distribution des récompenses',
                            value: '<t:' + Math.floor((votingQuest.end_time + (24 * 60 * 60 * 1000)) / 1000) + ':R>',
                            inline: false
                        });
                    }

                    return interaction.editReply({ embeds: [embed] });
                }

                return interaction.editReply({
                    content: '❌ Il n\'y a pas de quête de serveur en cours actuellement.',
                });
            }

            const questConfig = QUEST_OBJECTIVES[quest.objective];
            const progressPercent = Math.min(100, (quest.progress / quest.target) * 100);
            const progressBar = createProgressBar(quest.progress, quest.target);

            // Calculer le temps restant
            const now = Date.now();
            const timeRemaining = quest.end_time - now;
            const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            // Déterminer la couleur en fonction de la progression
            let color = '#FF0000'; // Rouge si < 50%
            if (progressPercent >= 50 && progressPercent < 75) {
                color = '#FFA500'; // Orange
            } else if (progressPercent >= 75 && progressPercent < 100) {
                color = '#FFFF00'; // Jaune
            } else if (progressPercent >= 100) {
                color = '#00FF00'; // Vert
            }

            const embed = new EmbedBuilder()
                .setTitle('🎯 Quête de Serveur - Avancement')
                .setDescription(`Travaillons ensemble pour atteindre l'objectif !`)
                .setColor(color)
                .addFields(
                    {
                        name: '📋 Objectif de la saison',
                        value: `${questConfig.icon} **${questConfig.name}**`,
                        inline: false
                    },
                    {
                        name: '📊 Progression actuelle',
                        value: `\`\`\`${progressBar}\`\`\`\n**${quest.progress.toLocaleString('fr-FR')}** / **${quest.target.toLocaleString('fr-FR')}**`,
                        inline: false
                    },
                    {
                        name: '⏰ Temps restant',
                        value: `**${daysRemaining}** jours et **${hoursRemaining}** heures\nFin : <t:${Math.floor(quest.end_time / 1000)}:F>`,
                        inline: false
                    },
                    {
                        name: '🎁 Récompenses possibles',
                        value: '🎁 **Coffre au Trésor Légendaire**\n⭐ **2 000 000 Starss**\n📈 **30 000 XP**\n🎉 **Mega Giveaway**',
                        inline: false
                    }
                )
                .setFooter({ text: 'Continuez vos efforts ! 💪' })
                .setTimestamp();

            // Ajouter un message de motivation selon la progression
            if (progressPercent < 25) {
                embed.addFields({
                    name: '💡 Statut',
                    value: '🔴 Allez, on peut faire mieux ! Tout le monde doit participer !',
                    inline: false
                });
            } else if (progressPercent < 50) {
                embed.addFields({
                    name: '💡 Statut',
                    value: '🟠 Bon début ! Continuez comme ça !',
                    inline: false
                });
            } else if (progressPercent < 75) {
                embed.addFields({
                    name: '💡 Statut',
                    value: '🟡 Excellent progrès ! On y est presque !',
                    inline: false
                });
            } else if (progressPercent < 100) {
                embed.addFields({
                    name: '💡 Statut',
                    value: '🟢 Plus que quelques efforts ! La victoire est proche !',
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '💡 Statut',
                    value: '✅ **OBJECTIF ATTEINT !** Félicitations à tous ! 🎉',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            if (error.code !== 10062) {
                await handleCommandError(interaction, error, interaction.client);
            }
        }
    }
};
