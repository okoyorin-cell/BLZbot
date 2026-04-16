const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { PROFILE_PREVIEW_BUILD } = require('../../utils/canvas-profile-variants');
const { handleCommandError } = require('../../utils/error-handler');
const { renderProfileFichePreviewFromInteraction } = require('../../utils/render-profile-fiche-preview-interaction');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil-v2')
        .setDescription('Profil BLZ (carte 1024×381) : stats, guilde, badges exclusifs, titre staff.')
        .addUserOption((opt) =>
            opt.setName('membre').setDescription('Membre à afficher (défaut : vous)').setRequired(false)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const result = await renderProfileFichePreviewFromInteraction(interaction, 'fiche_2', {
                attachmentPrefix: 'profil-v2',
            });
            if (result.error) {
                return interaction.editReply({ content: result.error });
            }

            const { file, meta } = result;
            const hint = meta ? `**${meta.label}** — _${meta.hint}_` : 'fiche_2';

            return interaction.editReply({
                content: `${hint}\n_build ${PROFILE_PREVIEW_BUILD}_`,
                files: [file],
            });
        } catch (error) {
            await handleCommandError(interaction, error, interaction.client);
        }
    },
};
