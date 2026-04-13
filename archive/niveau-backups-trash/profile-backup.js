const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const path = require('node:path');
const { getOrCreateUser } = require('../utils/db-users');
const { getGuildOfUser } = require('../utils/db-guilds');
const { getRankFromPoints, RANKS } = require('../utils/ranks');
const { renderProfileCard } = require('../utils/canvas-profile');
const { getAllUserQuests } = require('../utils/db-quests');
const { QUESTS } = require('../utils/quests');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription("Affiche votre profil ou celui d'un autre membre.")
        .addUserOption(option =>
            option.setName('membre')
                .setDescription("Le membre dont vous voulez voir le profil.")
                .setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('membre') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!member) {
                return interaction.editReply({ content: 'Impossible de trouver ce membre sur le serveur.' });
            }

            const user = getOrCreateUser(targetUser.id, targetUser.username);
            const guild = getGuildOfUser(targetUser.id);
            user.guild_name = guild ? guild.name : 'Aucune';
            user.guild_level = guild ? guild.level : 1;
            user.guild_emoji = guild ? guild.emoji : '🛡️';

            const rank = getRankFromPoints(user.points);

            const userQuestsData = getAllUserQuests(targetUser.id);
            const achievements = [];
            const quests = [];
            for (const questId in QUESTS) {
                const questInfo = QUESTS[questId];
                if (questInfo.rarity === 'Halloween') continue; // Ne pas afficher les quêtes d'événement

                const userProgress = userQuestsData.find(q => q.quest_id === questId);
                if (userProgress && userProgress.completed) {
                    achievements.push(questInfo.name);
                } else {
                    quests.push(questInfo.name);
                }
            }
            if (achievements.length === 0) achievements.push('Top Chatter','Pilier vocal','Réact Hero','Marathonien','Guild MVP');
            if (quests.length === 0) quests.push('Envoyer 200 messages','2h en vocal (cumulé)','Ajouter 50 réactions','10h en vocal','Stay 14h (Mythique)');

            let highestRoleName = 'Membre';
            if (member.roles.highest && member.roles.highest.name !== '@everyone') {
                highestRoleName = member.roles.highest.name;
            }

            const rankIndex = RANKS.findIndex(r => r.name === rank.name);
            const nextRank = (rankIndex < RANKS.length - 1) ? RANKS[rankIndex + 1] : null;
            const rankIconPath = path.resolve(__dirname, '..', '..', 'icones de rangs', `${rankIndex + 1}.png`);

            const png = await renderProfileCard({
                user: user,
                member: member,
                achievements: achievements,
                quests: quests,
                rank: rank,
                nextRank: nextRank,
                highestRoleName: highestRoleName,
                rankIconPath: rankIconPath
            });

            const file = new AttachmentBuilder(png, { name: 'profile.png' });
            await interaction.editReply({ content: null, files: [file] });

        } catch (e) {
            logger.error('Erreur lors de la création de la commande profile:', e);
            try {
                await interaction.editReply({ content: 'Impossible de générer la carte pour le moment.' });
            } catch (editError) {
                // Si editReply échoue, essayer followUp
                await interaction.followUp({ content: 'Impossible de générer la carte pour le moment.' });
            }
        }
    },
};