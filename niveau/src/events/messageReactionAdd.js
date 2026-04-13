const { Events } = require('discord.js');
const { getOrCreateUser, grantResources, updateUserActivityTimestamp } = require('../utils/db-users');
const { checkQuestProgress } = require('../utils/quests');
const { grantRubanForAction } = require('../utils/ruban-rewards');
const { handlePuissance4Reaction } = require('../utils/minigame-handler');
const logger = require('../utils/logger');

// Cooldown (en mémoire)
const reactionCooldown = new Set();

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        // Ignorer les bots
        if (user.bot) {
            return;
        }

        // Vérifier si c'est une réaction pour Puissance 4
        const p4Emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];
        if (p4Emojis.includes(reaction.emoji.name)) {
            try {
                await handlePuissance4Reaction(reaction, user, reaction.client);
                return; // Ne pas donner de récompense pour les réactions de jeu
            } catch (error) {
                logger.error(`Erreur lors du traitement de la réaction Puissance 4:`, error);
            }
        }

        // Vérifier le cooldown
        if (reactionCooldown.has(user.id)) {
            return;
        }

        try {
            // S'assurer que l'utilisateur existe et lui donner sa récompense
            getOrCreateUser(user.id, user.username);
            updateUserActivityTimestamp(user.id);
            grantResources(reaction.client, user.id, { stars: 1, source: 'reaction' });

            // Ruban Noël - Réaction
            grantRubanForAction(user.id, 'reaction');

            // Vérifier les quêtes de réaction
            checkQuestProgress(reaction.client, 'REACTION_ADD', user);

            // Ajouter l'utilisateur au cooldown
            reactionCooldown.add(user.id);
            setTimeout(() => {
                reactionCooldown.delete(user.id);
            }, 20000); // Cooldown de 20 secondes

        } catch (error) {
            logger.error(`Erreur lors de l'attribution de Starss pour une réaction par ${user.username}:`, error);
        }
    },
};