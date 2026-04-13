const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'modalSubmit', // Nom personnalisé (pas un vrai événement Discord.js)
    
    async execute(interaction) {
        // Ce fichier est appelé manuellement depuis index.js pour les modals
        if (interaction.customId.startsWith('rule_modal_')) {
            await handleRuleModal(interaction);
        }
    }
};

/**
 * Traite la soumission d'une règle via modal
 */
async function handleRuleModal(interaction) {
    const parts = interaction.customId.split('_');
    const reglementNom = parts.slice(2, -1).join('_'); // Extraire le nom du règlement
    const ruleIndex = parts[parts.length - 1]; // 'new' ou index

    const ruleTitle = interaction.fields.getTextInputValue('rule_title');
    const ruleContent = interaction.fields.getTextInputValue('rule_content');

    // Boutons pour la suite
    const addAnotherButton = new ButtonBuilder()
        .setCustomId(`add_rule_${reglementNom}`)
        .setLabel('➕ Ajouter une autre règle')
        .setStyle(ButtonStyle.Primary);

    const finishButton = new ButtonBuilder()
        .setCustomId(`finish_reglement_${reglementNom}`)
        .setLabel('✅ Terminer et publier')
        .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(addAnotherButton, finishButton);

    // Répondre IMMÉDIATEMENT pour éviter l'expiration (3 sec max)
    await interaction.reply({
        content: `⏳ Ajout de la règle **${ruleTitle}** en cours...`,
        components: [],
        flags: 64
    }).catch(err => {
        console.error('Erreur lors de la réponse initiale:', err);
        return;
    });

    const reglementCommand = require('../commands/reglement.js');

    try {
        // Ajouter la règle à la base de données
        await reglementCommand.addRule(reglementNom, ruleTitle, ruleContent);

        // Mettre à jour avec le message final
        await interaction.editReply({
            content: `✅ La règle **${ruleTitle}** a été ajoutée au règlement **${reglementNom}**.\n\nVoulez-vous ajouter une autre règle ?`,
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la règle:', error);
        
        // Mettre à jour avec le message d'erreur
        await interaction.editReply({
            content: '❌ Erreur lors de l\'ajout de la règle.',
            components: []
        }).catch(err => console.error('Erreur lors de l\'édition:', err));
    }
}
