const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');

function buildPanelPayload() {
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

    const button = new ButtonBuilder()
        .setCustomId('launch_form')
        .setLabel('🚀 Lancer le formulaire')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return { embeds: [embed], components: [row] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Affiche le panneau de débannissement dans le salon courant ou le salon choisi.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
        const target = interaction.options.getChannel('salon') || interaction.channel;

        if (!target?.isTextBased?.()) {
            return interaction.reply({
                content: '❌ Le salon ciblé doit être un salon textuel.',
                ephemeral: true,
            });
        }

        const payload = buildPanelPayload();

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
                        content: `❌ Je n'ai pas les permissions pour poster dans ${target}. Il me faut au minimum **Voir le salon** et **Envoyer des messages**.`,
                        ephemeral: true,
                    });
                }
            }

            const sent = await target.send(payload);
            await interaction.reply({
                content: `✅ Panel posté dans ${target} (${sent.url}).`,
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
