const db = require('../../database/database');
const logger = require('../logger');
const { grantResources } = require('../db-users');

/**
 * Récupère toutes les quêtes de guilde depuis la DB
 */
function getAllGuildQuests() {
    return db.prepare('SELECT * FROM guild_quests ORDER BY id').all();
}

/**
 * Récupère les quêtes d'une guilde avec leur progression
 */
function getGuildQuestsWithProgress(guildId) {
    const quests = getAllGuildQuests();
    const progress = db.prepare('SELECT * FROM guild_quest_progress WHERE guild_id = ?').all(guildId);

    return quests.map(quest => {
        const questProgress = progress.find(p => p.quest_id === quest.id);
        return {
            ...quest,
            completed: questProgress ? questProgress.completed : 0,
            completed_at: questProgress ? questProgress.completed_at : 0
        };
    });
}

/**
 * Vérifie et complète automatiquement les quêtes d'une guilde
 * @param {Object} client - Le client Discord
 * @param {Object} guild - La guilde à vérifier
 * @param {string} triggerType - Le type de trigger ('treasury', 'level', 'upgrade', 'war_win', etc.)
 */
async function checkAndCompleteGuildQuests(client, guild, triggerType) {
    try {
        const quests = getAllGuildQuests().filter(q => q.type === triggerType);

        for (const quest of quests) {
            // Vérifier si la quête est déjà complétée
            const progress = db.prepare('SELECT * FROM guild_quest_progress WHERE guild_id = ? AND quest_id = ?')
                .get(guild.id, quest.id);

            if (progress && progress.completed) {
                continue; // Déjà complétée
            }

            // Vérifier si la quête est complétée
            let isCompleted = false;

            switch (quest.type) {
                case 'treasury':
                    isCompleted = guild.treasury >= quest.target;
                    break;
                case 'level':
                    isCompleted = guild.level >= quest.target;
                    break;
                case 'upgrade':
                    isCompleted = guild.upgrade_level >= quest.target;
                    break;
                case 'war_win':
                    isCompleted = guild.wars_won >= quest.target;
                    break;
                case 'war_win_70':
                    isCompleted = guild.wars_won_70 >= quest.target;
                    break;
                case 'war_win_80':
                    isCompleted = guild.wars_won_80 >= quest.target;
                    break;
                case 'war_win_90':
                    isCompleted = guild.wars_won_90 >= quest.target;
                    break;
                case 'prestige':
                    // Guilde pleine (tous les slots remplis) + Upgrade X (10)
                    const memberCount = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?')
                        .get(guild.id).count;
                    isCompleted = memberCount >= guild.member_slots && guild.upgrade_level >= 10;
                    break;
            }

            if (isCompleted) {
                await completeGuildQuest(client, guild, quest);
            }
        }
    } catch (error) {
        logger.error('Erreur lors de la vérification des quêtes de guilde:', error);
    }
}

/**
 * Complète une quête de guilde et distribue les récompenses
 */
async function completeGuildQuest(client, guild, quest) {
    try {
        // Marquer la quête comme complétée
        db.prepare('INSERT OR REPLACE INTO guild_quest_progress (guild_id, quest_id, completed, completed_at) VALUES (?, ?, 1, ?)')
            .run(guild.id, quest.id, Date.now());

        logger.info(`Quête de guilde complétée: ${quest.description} pour ${guild.name}`);

        // Distribuer les récompenses selon le type
        if (quest.reward_type === 'xp' || quest.reward_type === 'stars') {
            await distributeRewardsToMembers(client, guild, quest);
        } else if (quest.reward_type === 'role' && quest.type === 'prestige') {
            await grantPrestigeRoles(client, guild);
        }

        // Envoyer une notification dans le salon de guilde si disponible
        await sendQuestCompletionNotification(client, guild, quest);
    } catch (error) {
        logger.error('Erreur lors de la complétion de quête de guilde:', error);
    }
}

/**
 * Distribue les récompenses à tous les membres de la guilde
 */
async function distributeRewardsToMembers(client, guild, quest) {
    try {
        const members = db.prepare('SELECT user_id FROM guild_members WHERE guild_id = ?').all(guild.id);

        for (const member of members) {
            const rewardData = {};
            if (quest.reward_type === 'xp') {
                rewardData.xp = quest.reward_amount;
                rewardData.source = 'guild_quest';
            } else if (quest.reward_type === 'stars') {
                rewardData.stars = quest.reward_amount;
                rewardData.source = 'guild_quest';
            }

            // Utiliser grantResources pour distribuer (await car asynchrone)
            await grantResources(client, member.user_id, rewardData);
        }

        logger.info(`Récompenses distribuées à ${members.length} membres de ${guild.name}`);
    } catch (error) {
        logger.error('Erreur lors de la distribution des récompenses:', error);
    }
}

/**
 * Attribue les rôles de prestige (quête ultime)
 */
async function grantPrestigeRoles(client, guild) {
    try {
        const discordGuild = client.guilds.cache.first(); // Assuming bot is in one guild
        if (!discordGuild) {
            logger.warn('Serveur Discord introuvable pour attribuer les rôles de prestige');
            return;
        }
        const roleConfig = require('../../config/role.config.json');
        const { owner: prestigeOwnerRoleName, member: prestigeMemberRoleName } = roleConfig.guildPrestigeRoles;

        // Chercher ou créer le rôle "Créateur de guild ultime"
        let ownerRole = discordGuild.roles.cache.find(r => r.name === prestigeOwnerRoleName);
        if (!ownerRole) {
            ownerRole = await discordGuild.roles.create({
                name: prestigeOwnerRoleName,
                color: '#FFD700', // Or
                reason: 'Quête de prestige de guilde complétée'
            });
            logger.info(`Rôle "${prestigeOwnerRoleName}" créé`);
        }

        // Chercher ou créer le rôle "membre de guild ultime"
        let memberRole = discordGuild.roles.cache.find(r => r.name === prestigeMemberRoleName);
        if (!memberRole) {
            memberRole = await discordGuild.roles.create({
                name: prestigeMemberRoleName,
                color: '#C0C0C0', // Argent
                reason: 'Quête de prestige de guilde complétée'
            });
            logger.info(`Rôle "${prestigeMemberRoleName}" créé`);
        }

        // Attribuer le rôle au chef
        const owner = await discordGuild.members.fetch(guild.owner_id).catch(() => null);
        if (owner) {
            await owner.roles.add(ownerRole);
            logger.info(`Rôle de prestige attribué au chef ${guild.owner_id}`);
        }

        // Attribuer le rôle aux membres
        const members = db.prepare('SELECT user_id FROM guild_members WHERE guild_id = ?').all(guild.id);
        for (const member of members) {
            if (member.user_id === guild.owner_id) continue; // Skip owner (déjà traité)
            const discordMember = await discordGuild.members.fetch(member.user_id).catch(() => null);
            if (discordMember) {
                await discordMember.roles.add(memberRole);
            }
        }

        logger.info(`Rôles de prestige attribués à ${members.length} membres de ${guild.name}`);
    } catch (error) {
        logger.error('Erreur lors de l\'attribution des rôles de prestige:', error);
    }
}

/**
 * Envoie une notification de quête complétée dans le salon de guilde
 */
async function sendQuestCompletionNotification(client, guild, quest) {
    try {
        if (!guild.channel_id) return; // Pas de salon privé

        const channel = await client.channels.fetch(guild.channel_id).catch(() => null);
        if (!channel) return;

        let rewardText = '';
        if (quest.reward_type === 'xp') {
            rewardText = `${quest.reward_amount.toLocaleString('fr-FR')} EXP pour tous les membres`;
        } else if (quest.reward_type === 'stars') {
            rewardText = `${quest.reward_amount.toLocaleString('fr-FR')} starss pour tous les membres`;
        } else if (quest.reward_type === 'unlock') {
            rewardText = 'Nouveau déblocage !';
        } else if (quest.reward_type === 'role') {
            rewardText = 'Rôles de prestige attribués !';
        }

        const rarityEmojis = {
            'Commun': '⚪',
            'Rare': '🔵',
            'Épique': '🟣',
            'Légendaire': '🟠',
            'Mythique': '🔴',
            'Goatesque': '🌟'
        };

        await channel.send({
            content: `## 🎉 Quête de Guilde Complétée !\n\n${rarityEmojis[quest.rarity] || '⭐'} **${quest.rarity}** - ${quest.description}\n\n**Récompense:** ${rewardText}`
        });
    } catch (error) {
        logger.error('Erreur lors de l\'envoi de la notification de quête:', error);
    }
}

/**
 * Force la complétion d'une quête (pour admin/debug)
 */
function forceCompleteQuest(guildId, questId) {
    db.prepare('INSERT OR REPLACE INTO guild_quest_progress (guild_id, quest_id, completed, completed_at) VALUES (?, ?, 1, ?)')
        .run(guildId, questId, Date.now());
    logger.info(`Quête ${questId} forcée pour la guilde ${guildId}`);
}

module.exports = {
    getAllGuildQuests,
    getGuildQuestsWithProgress,
    checkAndCompleteGuildQuests,
    completeGuildQuest,
    distributeRewardsToMembers,
    grantPrestigeRoles,
    forceCompleteQuest
};
