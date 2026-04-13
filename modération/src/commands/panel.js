const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Affiche le panneau de débannissement.')
        .toJSON(),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("📋 Formulaire de débannissement")
            .setDescription("Cliquez sur le bouton ci-dessous pour commencer votre demande de débannissement.\n\n⚠️ **Conditions requises :**\n- Vous devez être banni du serveur principal\n- Votre ban doit dater d'au moins 3 mois pour que le vote soit lancé immédiatement\n- Si votre ban date de moins de 3 mois, votre demande sera mise en attente")
            .setColor('#FFD700');

        const button = new ButtonBuilder()
            .setCustomId('launch_form')
            .setLabel('🚀 Lancer le formulaire')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
