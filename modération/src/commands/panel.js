const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');

/**
 * Serveur de test où tout le monde peut faire une demande de deban (bypass du check ban).
 * Sur tous les autres serveurs, la vérif ban normale s'applique.
 */
const TEST_DEBAN_BYPASS_GUILD_ID = '1493276404643532810';

function buildPanelPayload(debanChannelId) {
    const embed = new EmbedBuilder()
        .setTitle("📋 Formulaire de débannissement")
        .setDescription(
            "Cliquez sur le bouton ci-dessous pour commencer votre demande de débannissement.\n\n" +
            "⚠️ **Conditions requises :**\n" +
            "- Vous devez être banni du serveur principal\n" +
            "- Votre ban doit dater d'au moins 3 mois pour que le vote soit lancé immédiatement\n" +
            "- Si votre ban date de moins de 3 mois, votre demande sera mise en attente"
        )
        .setColor('#FFD700');

    // Encode le salon de destination directement dans le customId du bouton : pas besoin
    // de JSON persistant, chaque panel sait où envoyer ses demandes.
    const button = new ButtonBuilder()
        .setCustomId(`launch_form_${debanChannelId}`)
        .setLabel('🚀 Lancer le formulaire')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return { embeds: [embed], components: [row] };
}

module.exports = {
    // Exposé pour d'autres modules (handler) qui ont besoin de connaître le serveur de bypass
    TEST_DEBAN_BYPASS_GUILD_ID,

    data: new SlashCommandBuilder()
        .setName('panel-deban')
        .setDescription('Affiche le panneau de demande de débannissement dans le salon choisi.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addChannelOption(option =>
            option
                .setName('salon-deban')
                .setDescription('Salon où les demandes et votes de débannissement seront envoyés.')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName('salon')
                .setDescription('Salon où poster le panel (par défaut : salon courant)')
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement,
                    ChannelType.PublicThread,
                    ChannelType.PrivateThread,
                    ChannelType.AnnouncementThread,
                )
                .setRequired(false)
        )
        .toJSON(),

    async execute(interaction) {
        const debanChannel = interaction.options.getChannel('salon-deban');
        const target = interaction.options.getChannel('salon') || interaction.channel;

        if (!target?.isTextBased?.()) {
            return interaction.reply({
                content: '❌ Le salon ciblé pour le panel doit être un salon textuel.',
                ephemeral: true,
            });
        }

        if (!debanChannel?.isTextBased?.()) {
            return interaction.reply({
                content: '❌ Le salon de destination des demandes (`salon-deban`) doit être un salon textuel.',
                ephemeral: true,
            });
        }

        // Vérifie que le bot peut effectivement envoyer dans le salon de deban choisi, sinon
        // le flow explosera à la soumission finale (salon inaccessible côté bot).
        try {
            const botMember = interaction.guild?.members?.me;
            if (botMember && debanChannel.permissionsFor) {
                const perms = debanChannel.permissionsFor(botMember);
                if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
                    return interaction.reply({
                        content: `❌ Je n'ai pas les permissions pour poster les demandes dans ${debanChannel}. Il me faut **Voir le salon** et **Envoyer des messages**.`,
                        ephemeral: true,
                    });
                }
            }
        } catch { /* on laisse passer si on peut pas vérifier — Discord renverra une erreur à l'usage */ }

        const payload = buildPanelPayload(debanChannel.id);

        // Cas 1 : poster dans le salon courant → reply direct (plus simple, pas de perm à vérifier)
        if (target.id === interaction.channel?.id) {
            try {
                await interaction.reply(payload);
            } catch (err) {
                console.error('[Panel] Erreur lors du reply panel:', err?.code, err?.message);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: `❌ Impossible de poster le panel (code ${err?.code ?? 'inconnu'}).`,
                        ephemeral: true,
                    });
                }
            }
            return;
        }

        // Cas 2 : poster dans un autre salon → envoyer via channel.send puis confirmer
        try {
            const botMember = interaction.guild?.members?.me;
            if (botMember && target.permissionsFor) {
                const perms = target.permissionsFor(botMember);
                if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
                    return interaction.reply({
                        content: `❌ Je n'ai pas les permissions pour poster dans ${target}. Il me faut **Voir le salon** et **Envoyer des messages**.`,
                        ephemeral: true,
                    });
                }
            }

            const sent = await target.send(payload);
            await interaction.reply({
                content: `✅ Panel posté dans ${target} (${sent.url}).\n📬 Les demandes seront envoyées dans ${debanChannel}.`,
                ephemeral: true,
            });
        } catch (err) {
            console.error(`[Panel] Erreur lors de l'envoi dans ${target?.id}:`, err?.code, err?.message, err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ Erreur lors du post du panel (code ${err?.code ?? 'inconnu'} : ${err?.message ?? 'inconnue'}).`,
                    ephemeral: true,
                });
            }
        }
    },
};
