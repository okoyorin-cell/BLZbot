const { SlashCommandBuilder } = require('discord.js');
const { PROFILE_PREVIEW_BUILD } = require('../../utils/canvas-profile-variants');
const { handleCommandError } = require('../../utils/error-handler');
const { loadFiche2ProfileData, sendProfilV2WithButtons } = require('../../utils/profil-v2-interactive');

/**
 * @param {string} commandName Nom slash Discord (ex. profil-v2, profil)
 * @param {string} description
 * @param {string} attachmentPrefix Préfixe du fichier PNG joint
 */
function buildProfilV2Slash(commandName, description, attachmentPrefix) {
    return {
        data: new SlashCommandBuilder()
            .setName(commandName)
            .setDescription(description)
            .addUserOption((opt) =>
                opt.setName('membre').setDescription('Membre à afficher (défaut : vous)').setRequired(false)
            ),

        async execute(interaction) {
            try {
                await interaction.deferReply();

                const session = await loadFiche2ProfileData(interaction);
                if (session.error) {
                    return interaction.editReply({ content: session.error });
                }

                const hint = session.meta ? `**${session.meta.label}** — _${session.meta.hint}_` : 'fiche_2';
                const headerText = `${hint}\n_build ${PROFILE_PREVIEW_BUILD}_`;

                return sendProfilV2WithButtons(interaction, session, { headerText });
            } catch (error) {
                await handleCommandError(interaction, error, interaction.client);
            }
        },
    };
}

module.exports = { buildProfilV2Slash };
