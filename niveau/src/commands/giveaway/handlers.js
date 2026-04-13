const { getSession, deleteSession } = require('./session');
const steps = require('./steps');
const ui = require('./ui');

async function handleGiveawayInteraction(interaction) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const creatorId = parts.pop(); // The last part is always the creator's ID

    // Basic validation that the last part is a Discord ID
    if (!/^\d{17,19}$/.test(creatorId)) return;

    if (interaction.user.id !== creatorId) {
        return interaction.reply({ content: "Vous ne pouvez pas interagir avec les boutons de création d'un giveaway qui ne vous appartient pas.", ephemeral: true });
    }

    const action = parts.join('_');

    // Handle session creation on the very first step
    if (action === 'giveaway_start') {
        const { createSession } = require('./session');
        const session = createSession(creatorId);
        return steps.showInitialConfigModal(interaction, session);
    }

    const session = getSession(creatorId);
    if (!session) {
        return interaction.reply({ content: 'Session expirée ou invalide. Veuillez relancer la commande.', ephemeral: true });
    }

    // Route to the correct step handler
    if (action.startsWith('giveaway_config')) await steps.handleConfigurationStep(interaction, session);
    else if (action === 'giveaway_add_reward') await ui.showRewardSelection(interaction);
    else if (action === 'giveaway_reward_next') await ui.showConditionStep(interaction, session);
    else if (action.startsWith('giveaway_reward')) await steps.handleRewardSelection(interaction, session);
    else if (action === 'giveaway_add_condition') await ui.showConditionSelection(interaction);
    else if (action.startsWith('giveaway_condition_role')) await steps.handleConditionSelection(interaction, session);
    else if (action === 'giveaway_condition_next') await ui.showRepeatStep(interaction, session);
    else if (action.startsWith('giveaway_repeat')) await steps.handleRepeatStep(interaction, session);
    else if (action === 'giveaway_confirm') await steps.confirmAndLaunchGiveaway(interaction, session);
    else if (action === 'giveaway_cancel') {
        deleteSession(creatorId);
        // Use safeUpdate from ui.js to handle expired interactions
        const { safeUpdate } = require('./ui');
        await safeUpdate(interaction, { content: 'Création annulée.', embeds: [], components: [] });
    } else if (action.startsWith('roleMenu')) {
        const originalCustomId = customId.substring(0, customId.lastIndexOf('_')); // Pass the ID without the creatorId to the step handler
        await steps.handleRoleSelection(interaction, session, originalCustomId);
    } else if (action.startsWith('giveaway_role_prev') || action.startsWith('giveaway_role_next')) {
        await steps.handleRolePagination(interaction, session);
    } else if (action.startsWith('giveaway_back')) {
        await steps.handleBackButton(interaction, session);
    }
}

async function handleModalSubmit(interaction) {
    await steps.handleModalSubmit(interaction);
}

module.exports = { handleGiveawayInteraction, handleModalSubmit };