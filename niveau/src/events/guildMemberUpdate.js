const { Events } = require('discord.js');
const logger = require('../utils/logger');
const roleConfig = require('../config/role.config.json');

const BOOSTER_ROLE_ID = '1170361439345704962';

const VIP_ROLE_ID = roleConfig.specialRoles?.vip?.id || roleConfig.roleIds?.vip;
const VIP_ALIASES = roleConfig.roleIds?.vipAliases || [];
const ALL_VIP_IDS = [VIP_ROLE_ID, ...VIP_ALIASES].filter(Boolean);

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        try {
            // Vérifier si le statut de boost a changé
            const wasBoosting = oldMember.premiumSince !== null;
            const isBoosting = newMember.premiumSince !== null;

            // Si le membre vient de commencer à boost
            if (!wasBoosting && isBoosting) {
                logger.info(`${newMember.user.tag} a commencé à boost le serveur`);
                
                // Ajouter le rôle de booster
                try {
                    await newMember.roles.add(BOOSTER_ROLE_ID);
                    logger.info(`Rôle booster ajouté à ${newMember.user.tag}`);
                } catch (error) {
                    logger.error(`Erreur lors de l'ajout du rôle booster à ${newMember.user.tag}:`, error);
                }
            }
            
            // Si le membre a arrêté de boost
            if (wasBoosting && !isBoosting) {
                logger.info(`${newMember.user.tag} a arrêté de boost le serveur`);
                
                // Retirer le rôle de booster
                try {
                    await newMember.roles.remove(BOOSTER_ROLE_ID);
                    logger.info(`Rôle booster retiré de ${newMember.user.tag}`);
                } catch (error) {
                    logger.error(`Erreur lors du retrait du rôle booster de ${newMember.user.tag}:`, error);
                }
            }

            // --- Vérifier si le membre a perdu son rôle VIP ---
            const hadVip = ALL_VIP_IDS.some(id => oldMember.roles.cache.has(id));
            const hasVip = ALL_VIP_IDS.some(id => newMember.roles.cache.has(id));

            if (hadVip && !hasVip) {
                logger.info(`[VIP-Role] ${newMember.user.tag} a perdu son rôle VIP, suppression du rôle personnalisé...`);
                try {
                    const { removeVipCustomRole } = require('../utils/vip-role-handler');
                    await removeVipCustomRole(newMember.guild, newMember.id);
                } catch (error) {
                    logger.error(`[VIP-Role] Erreur lors de la suppression du rôle VIP personnalisé de ${newMember.user.tag}:`, error);
                }
            }
        } catch (error) {
            logger.error('Erreur dans guildMemberUpdate:', error);
        }
    }
};
