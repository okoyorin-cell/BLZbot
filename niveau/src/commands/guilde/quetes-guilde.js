const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getGuildOfUser } = require('../../utils/db-guilds');
const { getGuildQuestsWithProgress } = require('../../utils/guild/guild-quests');
const { handleCommandError } = require('../../utils/error-handler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quetes-guilde')
        .setDescription('Affiche toutes les quêtes de guilde avec leur progression'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guild = getGuildOfUser(userId);

            if (!guild) {
                const errorText = new TextDisplayBuilder().setContent("❌ Vous n'êtes pas dans une guilde.");
                const container = new ContainerBuilder().addTextDisplayComponents(errorText);
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            const quests = getGuildQuestsWithProgress(guild.id);

            // Grouper par type
            const questsByType = {
                treasury: [],
                level: [],
                war_win: [],
                war_win_70: [],
                war_win_80: [],
                war_win_90: [],
                upgrade: [],
                prestige: []
            };

            quests.forEach(quest => {
                if (questsByType[quest.type]) {
                    questsByType[quest.type].push(quest);
                }
            });

            let questContent = `# 📜 Quêtes de Guilde - ${guild.emoji} ${guild.name}\n` +
                `Complétez des objectifs pour débloquer des récompenses pour tous les membres !\n`;

            // Ajouter chaque catégorie
            const categories = [
                { key: 'treasury', name: '💰 Quêtes de Trésorerie' },
                { key: 'level', name: '⭐ Quêtes de Niveau' },
                { key: 'war_win', name: '⚔️ Quêtes de Guerre' },
                { key: 'upgrade', name: '🔼 Quêtes d\'Amélioration' },
                { key: 'prestige', name: '👑 Quête de Prestige' }
            ];

            for (const category of categories) {
                let questsInCategory = questsByType[category.key];

                // Pour les guerres, regrouper toutes les sous-catégories
                if (category.key === 'war_win') {
                    questsInCategory = [
                        ...questsByType.war_win,
                        ...questsByType.war_win_70,
                        ...questsByType.war_win_80,
                        ...questsByType.war_win_90
                    ];
                }

                if (questsInCategory.length > 0) {
                    questContent += `\n### ${category.name}\n`;

                    questsInCategory.forEach(quest => {
                        const status = quest.completed ? '✅' : '⏳';
                        const rarityEmojis = {
                            'Commun': '⚪',
                            'Rare': '🔵',
                            'Épique': '🟣',
                            'Légendaire': '🟠',
                            'Mythique': '🔴',
                            'Goatesque': '🌟'
                        };
                        const rarityEmoji = rarityEmojis[quest.rarity] || '⭐';

                        let rewardText = '';
                        if (quest.reward_type === 'xp') {
                            rewardText = `${quest.reward_amount.toLocaleString('fr-FR')} EXP`;
                        } else if (quest.reward_type === 'stars') {
                            rewardText = `${quest.reward_amount.toLocaleString('fr-FR')} starss`;
                        } else if (quest.reward_type === 'unlock') {
                            rewardText = 'Déblocage';
                        } else if (quest.reward_type === 'role') {
                            rewardText = 'Rôles de prestige';
                        }

                        questContent += `${status} ${rarityEmoji} **${quest.description}**\n└ Récompense: ${rewardText}\n`;
                    });
                }
            }

            questContent += `\n*Les quêtes se complètent automatiquement et distribuent les récompenses à tous les membres !*`;

            const questText = new TextDisplayBuilder().setContent(questContent);
            const container = new ContainerBuilder().addTextDisplayComponents(questText);

            await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });

        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};
