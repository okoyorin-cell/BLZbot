const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../config.js');

// Cooldown pour les pings de signalement
let lastPingTime = 0;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signaler')
        .setDescription('Signaler un contenu inapproprié')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à signaler')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison du signalement')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('preuve')
                .setDescription('Capture d\'écran ou preuve (image)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('ID du message signalé (optionnel)')
                .setRequired(false)),

    async execute(interaction) {
        // Vérifier si le système est activé
        if (!CONFIG.REPORTS?.ENABLED) {
            return interaction.reply({
                content: 'Le système de signalement est désactivé.',
                ephemeral: true
            });
        }

        // Vérifier si le salon est configuré
        if (!CONFIG.REPORTS?.CHANNEL_ID) {
            return interaction.reply({
                content: 'Le salon de signalements n\'est pas configuré.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('utilisateur');
        const raison = interaction.options.getString('raison');
        const preuve = interaction.options.getAttachment('preuve');
        const messageId = interaction.options.getString('message_id');

        // Ne pas pouvoir se signaler soi-même
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: 'Tu ne peux pas te signaler toi-même.',
                ephemeral: true
            });
        }

        // Ne pas pouvoir signaler un bot
        if (targetUser.bot) {
            return interaction.reply({
                content: 'Tu ne peux pas signaler un bot.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Récupérer le salon de signalements
            const reportChannel = await interaction.client.channels.fetch(CONFIG.REPORTS.CHANNEL_ID);
            if (!reportChannel) {
                return interaction.editReply({
                    content: 'Le salon de signalements est introuvable.'
                });
            }

            // Créer l'embed de signalement
            const reportEmbed = new EmbedBuilder()
                .setTitle('Nouveau Signalement')
                .setColor(CONFIG.REPORTS.EMBED_COLOR || '#FF6B6B')
                .addFields(
                    { name: 'Signalé par', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                    { name: 'Utilisateur signalé', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
                    { name: 'Salon', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Raison', value: raison, inline: false }
                )
                .setFooter({ text: `ID Signalé: ${targetUser.id} | ID Auteur: ${interaction.user.id}` })
                .setTimestamp();

            // Ajouter l'ID du message si fourni
            if (messageId) {
                reportEmbed.addFields({
                    name: 'Message signalé',
                    value: `[Voir le message](https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${messageId})`,
                    inline: true
                });

                // Essayer de récupérer le contenu du message
                try {
                    const message = await interaction.channel.messages.fetch(messageId);
                    if (message && message.content) {
                        reportEmbed.addFields({
                            name: 'Contenu du message',
                            value: message.content.length > 1000
                                ? message.content.substring(0, 1000) + '...'
                                : message.content,
                            inline: false
                        });
                    }
                } catch {
                    // Message introuvable, pas grave
                }
            }

            // Ajouter la preuve si fournie
            if (preuve) {
                // Vérifier que c'est une image
                if (preuve.contentType && preuve.contentType.startsWith('image/')) {
                    reportEmbed.setImage(preuve.url);
                } else {
                    reportEmbed.addFields({
                        name: 'Pièce jointe',
                        value: `[${preuve.name}](${preuve.url})`,
                        inline: false
                    });
                }
            }

            // Préparer le message de signalement
            const messageOptions = { embeds: [reportEmbed] };

            // Gérer le ping avec cooldown
            const now = Date.now();
            const cooldownMs = CONFIG.REPORTS.PING_COOLDOWN_MS || 30 * 60 * 1000;

            if (CONFIG.REPORTS.PING_ROLE_ID && (now - lastPingTime) >= cooldownMs) {
                messageOptions.content = `<@&${CONFIG.REPORTS.PING_ROLE_ID}>`;
                lastPingTime = now;
            }

            // Envoyer le signalement
            await reportChannel.send(messageOptions);

            await interaction.editReply({
                content: 'Ton signalement a été envoyé avec succès. L\'équipe de modération va l\'examiner.'
            });

        } catch (error) {
            console.error('[Report] Erreur:', error);
            await interaction.editReply({
                content: 'Une erreur est survenue lors de l\'envoi du signalement.'
            });
        }
    }
};
