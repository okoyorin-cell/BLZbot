const { Events } = require('discord.js');

module.exports = (client, logger) => {
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        try {
            const member = newState.member || oldState.member;
            if (!member) return;

            // 1. Rejoindre un salon
            if (!oldState.channelId && newState.channelId) {
                await logger.log(
                    member.guild,
                    '🔊 Vocal : Connexion',
                    `<@${member.id}> a rejoint le salon **${newState.channel.name}**`,
                    '#2ecc71', // Green
                    [],
                    member.user
                );
            }
            // 2. Quitter un salon
            else if (oldState.channelId && !newState.channelId) {
                await logger.log(
                    member.guild,
                    '🔇 Vocal : Déconnexion',
                    `<@${member.id}> a quitté le salon **${oldState.channel.name}**`,
                    '#e74c3c', // Red
                    [],
                    member.user
                );
            }
            // 3. Changer de salon
            else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                await logger.log(
                    member.guild,
                    '🔄 Vocal : Déplacement',
                    `<@${member.id}> a changé de salon :\n**Avant :** ${oldState.channel.name}\n**Après :** ${newState.channel.name}`,
                    '#f1c40f', // Yellow
                    [],
                    member.user
                );
            }

            // 4. Stream (Partage d'écran)
            if (!oldState.streaming && newState.streaming) {
                await logger.log(
                    member.guild,
                    '📺 Vocal : Stream commencé',
                    `<@${member.id}> a commencé un partage d'écran dans **${newState.channel.name}**`,
                    '#9b59b6', // Purple
                    [],
                    member.user
                );
            } else if (oldState.streaming && !newState.streaming) {
                await logger.log(
                    member.guild,
                    '📺 Vocal : Stream arrêté',
                    `<@${member.id}> a arrêté son partage d'écran dans **${newState.channel.name}**`,
                    '#95a5a6', // Grey
                    [],
                    member.user
                );
            }

            // 5. Caméra
            if (!oldState.selfVideo && newState.selfVideo) {
                await logger.log(
                    member.guild,
                    '📷 Vocal : Caméra activée',
                    `<@${member.id}> a activé sa caméra dans **${newState.channel.name}**`,
                    '#9b59b6',
                    [],
                    member.user
                );
            } else if (oldState.selfVideo && !newState.selfVideo) {
                await logger.log(
                    member.guild,
                    '📷 Vocal : Caméra désactivée',
                    `<@${member.id}> a désactivé sa caméra dans **${newState.channel.name}**`,
                    '#95a5a6',
                    [],
                    member.user
                );
            }

            // 6. Mute Serveur (Sanction ?)
            if (!oldState.serverMute && newState.serverMute) {
                // Essayer de trouver qui a mute via audit log
                // Note: C'est complexe d'avoir l'executor exact en temps réel sans spam d'API, on log juste le fait
                await logger.log(
                    member.guild,
                    '🙊 Vocal : Mute Serveur',
                    `<@${member.id}> a été rendu muet par un modérateur dans **${newState.channel.name}**`,
                    '#e67e22', // Orange
                    [],
                    member.user
                );
            } else if (oldState.serverMute && !newState.serverMute) {
                await logger.log(
                    member.guild,
                    '🗣️ Vocal : Unmute Serveur',
                    `<@${member.id}> a retrouvé la parole dans **${newState.channel.name}**`,
                    '#2ecc71',
                    [],
                    member.user
                );
            }

            // 7. Deafen Serveur
            if (!oldState.serverDeaf && newState.serverDeaf) {
                await logger.log(
                    member.guild,
                    '🙉 Vocal : Deafen Serveur',
                    `<@${member.id}> a été rendu sourd par un modérateur dans **${newState.channel.name}**`,
                    '#e67e22',
                    [],
                    member.user
                );
            } else if (oldState.serverDeaf && !newState.serverDeaf) {
                await logger.log(
                    member.guild,
                    '👂 Vocal : Undeafen Serveur',
                    `<@${member.id}> a retrouvé l'audition dans **${newState.channel.name}**`,
                    '#2ecc71',
                    [],
                    member.user
                );
            }

        } catch (err) {
            console.error('[ERROR] Error in VoiceStateUpdate log:', err);
        }
    });
};
