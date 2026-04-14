const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { buildVocPanelOpenerPayload } = require('../../utils/voice-room-panel');
const { getPrivateRoomVoiceMeta, resolvePrivateRoomConfig } = require('../../utils/private-voice-rooms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voc-panel')
        .setDescription(
            '[Admin] Publie un accès au panneau d’un vocal privé (interface visible en privé pour chaque membre).'
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption((opt) =>
            opt
                .setName('vocal')
                .setDescription(
                    'Optionnel : un salon précis (créateur/staff). Sans ça : chacun ouvre le panneau de **son** salon.'
                )
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: 'Utilise cette commande sur un serveur.',
                flags: 64,
            });
        }

        const postChannel = interaction.channel;
        if (!postChannel || typeof postChannel.send !== 'function') {
            return interaction.reply({
                content: 'Utilise cette commande dans un salon où le bot peut **envoyer des messages**.',
                flags: 64,
            });
        }

        const cfg = await resolvePrivateRoomConfig(interaction.client, interaction.guild);
        if (!cfg.enabled) {
            return interaction.reply({
                content: 'Les salons vocaux privés ne sont pas configurés sur ce serveur.',
                flags: 64,
            });
        }

        const voiceOpt = interaction.options.getChannel('vocal');
        if (voiceOpt) {
            if (!voiceOpt.isVoiceBased?.()) {
                return interaction.reply({ content: 'Choisis un salon **vocal** valide.', flags: 64 });
            }
            if (String(voiceOpt.parentId || '') !== String(cfg.voiceCategoryId)) {
                return interaction.reply({
                    content: 'Ce salon n’est pas un vocal privé géré par le bot (mauvaise catégorie).',
                    flags: 64,
                });
            }
            const meta = getPrivateRoomVoiceMeta(interaction.client, voiceOpt.id);
            if (!meta || meta.guildId !== interaction.guild.id) {
                return interaction.reply({
                    content: 'Ce salon n’est pas un vocal privé enregistré par le bot (créé via le lobby).',
                    flags: 64,
                });
            }
        }

        await interaction.deferReply({ flags: 64 });

        try {
            await postChannel.send(buildVocPanelOpenerPayload(voiceOpt?.id ?? null));
        } catch (e) {
            return interaction.editReply({
                content: `Impossible d’envoyer le message : ${e?.message || 'erreur'}. Vérifie les permissions du bot dans ce salon.`,
            });
        }

        return interaction.editReply({
            content: voiceOpt
                ? 'Message publié. **Créateur / staff** : panneau pour ce salon vocal, en éphémère au clic.'
                : 'Message publié. Chaque membre clique sur **Ouvrir mon panneau** : son propre salon vocal, en éphémère (pas besoin d’être dans le vocal).',
        });
    },
};
