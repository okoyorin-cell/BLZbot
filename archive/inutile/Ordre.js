require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    ChannelType,
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const channelIds = [
    "1180905287532695593",
    "1323250755632631848",
    "1323250792697696336"
];

const categoryId = "1323250666545746002";
const roleId = "1172237685763608579";
const banRoleId = "1338916685343756431";

const lastNumbers = {};
const incorrectAttempts = {};
const messageCounts = {};
const lastWarningTimes = {};

function getCurrentTimestamp() {
    return new Date().toISOString();
}

function cleanUpOldAttempts(userId) {
    const now = Date.now();
    if (incorrectAttempts[userId]) {
        incorrectAttempts[userId] = incorrectAttempts[userId].filter(tp => now - tp <= 2000);
    }
}

function incrementMessageCount(userId) {
    const currentSecond = Math.floor(Date.now() / 1000);
    if (!messageCounts[userId]) messageCounts[userId] = {};
    if (!messageCounts[userId][currentSecond]) {
        messageCounts[userId][currentSecond] = 0;
    }
    messageCounts[userId][currentSecond]++;
}

function cleanUpMessageCounts(userId) {
    const currentSecond = Math.floor(Date.now() / 1000);
    if (messageCounts[userId]) {
        for (const sec in messageCounts[userId]) {
            if (currentSecond - sec > 2) {
                delete messageCounts[userId][sec];
            }
        }
    }
}

function getTotalMessageCount(userId) {
    cleanUpMessageCounts(userId);
    if (!messageCounts[userId]) return 0;
    return Object.values(messageCounts[userId]).reduce((a, b) => a + b, 0);
}

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag} [Comptage]`);
    console.log('Bot de comptage en ligne.');

    const guildId = process.env.GUILD_ID;
    const guild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();

    if (!guild) {
        console.error('Aucun serveur trouvé pour l\'enregistrement des commandes. Assurez-vous que GUILD_ID est défini dans .env ou que le bot est dans un serveur.');
        return;
    }

    // Définition de la commande slash /set-nummer
    const setNummerCommand = new SlashCommandBuilder()
        .setName('set-nummer')
        .setDescription('Définit le prochain nombre attendu pour un salon de comptage.')
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Le salon de comptage dont le nombre doit être défini.')
                .addChannelTypes(ChannelType.GuildText) // Restreindre aux salons textuels
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Le nombre à définir comme prochain nombre attendu.')
                .setRequired(true));

    try {
        // Vérifier si la commande existe déjà et n'a pas changé
        const existingCommands = await guild.commands.fetch();
        const existing = existingCommands.find(cmd => cmd.name === 'set-nummer');
        const cmdJson = setNummerCommand.toJSON();

        if (existing) {
            const remoteOpts = JSON.stringify(existing.options?.map(o => o.toJSON ? o.toJSON() : o) || []);
            const localOpts = JSON.stringify(cmdJson.options || []);
            if (existing.description === cmdJson.description && remoteOpts === localOpts) {
                console.log('⏭️ /set-nummer : inchangée, skip.');
                return;
            }
        }

        await guild.commands.create(setNummerCommand);
        console.log(`${existing ? '🔄' : '✨'} /set-nummer ${existing ? 'mise à jour' : 'créée'}.`);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la commande /set-nummer :', error);
    }
});

// ----------------- Événement de réception de messages -----------------

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!channelIds.includes(message.channel.id)) return;

    if (message.content && message.content.trim() !== '') {
        const content = message.content.trim();
        const number = parseInt(content, 10);

        // Si le contenu est un nombre
        if (!isNaN(number)) {
            // S'il n'y a PAS de nombre enregistré pour ce salon,
            // on accepte le premier nombre envoyé comme base.
            if (lastNumbers[message.channel.id] === undefined) {
                lastNumbers[message.channel.id] = number;
                // Réinitialisation des compteurs pour cet utilisateur
                incorrectAttempts[message.author.id] = [];
                messageCounts[message.author.id] = {};
                console.log(`${getCurrentTimestamp()} Base établie dans le salon ${message.channel.id} avec ${number} par ${message.author.tag}.`);
                return;
            }

            // S'il y a déjà un nombre enregistré, on vérifie la progression attendue.
            const previousNumber = lastNumbers[message.channel.id];
            if (number === previousNumber + 1) {
                // Nombre correct → mise à jour et réinitialisation du suivi pour l'utilisateur
                lastNumbers[message.channel.id] = number;
                incorrectAttempts[message.author.id] = [];
                messageCounts[message.author.id] = {};
            } else {
                // Nombre incorrect → suppression du message
                await message.delete();
                console.log(`${getCurrentTimestamp()} Nombre incorrect (${number}) envoyé par ${message.author.tag} dans le salon ${message.channel.id}.`);

                // Tentative d'envoi d'un MP explicatif à l'utilisateur
                try {
                    await message.author.send(`❌ Nombre incorrect : votre nombre est ${number} au lieu de ${previousNumber + 1}.`);
                    console.log(`${getCurrentTimestamp()} MP envoyé à ${message.author.tag}.`);
                } catch (error) {
                    console.error(`${getCurrentTimestamp()} Impossible d'envoyer un MP à ${message.author.tag}: ${error.message}`);
                }

                const now = Date.now();
                if (!incorrectAttempts[message.author.id]) {
                    incorrectAttempts[message.author.id] = [];
                }
                incorrectAttempts[message.author.id].push(now);
                cleanUpOldAttempts(message.author.id);

                incrementMessageCount(message.author.id);
                cleanUpMessageCounts(message.author.id);

                // Si au moins 2 messages incorrects dans la même seconde
                if (getTotalMessageCount(message.author.id) >= 2) {
                    // Vérification d'une récidive rapide (< 60 sec après l'avertissement)
                    if (lastWarningTimes[message.author.id] && now - lastWarningTimes[message.author.id] < 60000) {
                        try {
                            const member = await message.guild.members.fetch(message.author.id);
                            await member.roles.add(banRoleId, "Réitération d'erreur après avertissement.");
                            console.log(`${getCurrentTimestamp()} ${member.user.tag} a été sanctionné (rôle ajouté) pour récurrence.`);
                            await message.channel.send(`${message.author}, vous avez été banni du comptage pour avoir envoyé trop d'erreurs.`);
                        } catch (err) {
                            console.error(`Erreur lors de la sanction de ${message.author.tag}:`, err);
                        }
                        // Réinitialisation des compteurs
                        incorrectAttempts[message.author.id] = [];
                        messageCounts[message.author.id] = {};
                        lastWarningTimes[message.author.id] = 0;
                    } else {
                        // Sinon, émission d'un avertissement temporaire et blocage de "everyone"
                        try {
                            // Bloquer everyone en modifiant les permissions du rôle everyone (son ID est message.guild.id)
                            await message.channel.permissionOverwrites.edit(message.guild.id, {
                                deny: [PermissionFlagsBits.SendMessages],
                            });
                            let warningMessage = await message.channel.send(
                                `Attention ${message.author}, veuillez entrer le nombre **${previousNumber + 1}**. Tout le monde est bloqué pendant 5 secondes.`
                            );
                            // Enregistrer l'heure de l'avertissement pour cet utilisateur
                            lastWarningTimes[message.author.id] = now;

                            // Après 5 secondes, rétablir la permission d'envoi et supprimer l'avertissement
                            setTimeout(async () => {
                                await message.channel.permissionOverwrites.edit(message.guild.id, {
                                    deny: [],
                                });
                                await warningMessage.delete();
                                console.log(`${getCurrentTimestamp()} Avertissement terminé pour ${message.author.tag}.`);
                            }, 5000);
                        } catch (err) {
                            console.error(`Erreur lors de l'émission de l'avertissement pour ${message.author.tag}:`, err);
                        }
                    }
                }
            }
        } else {
            console.log(`${getCurrentTimestamp()} Contenu non valide (pas un nombre) reçu : ${message.content}`);
        }
    }
});

// ----------------- Re-publication en cas de suppression du dernier nombre -----------------

client.on('messageDelete', async (message) => {
    if (!channelIds.includes(message.channel.id)) return;
    if (message.author && message.author.bot) return;

    const content = message.content && message.content.trim();
    const deletedNumber = parseInt(content, 10);
    if (isNaN(deletedNumber)) return;

    if (lastNumbers[message.channel.id] === deletedNumber) {
        try {
            // Récupérer ou créer un webhook dans le salon
            let webhooks = await message.channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.name === 'BLZbot');

            if (!webhook) {
                webhook = await message.channel.createWebhook({
                    name: 'BLZbot',
                    avatar: client.user.displayAvatarURL(),
                    reason: 'Webhook pour republication du nombre supprimé'
                });
            }

            // Envoyer via webhook avec le nom et avatar de l'auteur du message supprimé
            await webhook.send({
                content: deletedNumber.toString(),
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL(),
            });

            console.log(`${getCurrentTimestamp()} Le nombre ${deletedNumber} a été republié via webhook dans le salon ${message.channel.id} avec le pseudo et avatar de ${message.author.tag}.`);
        } catch (error) {
            console.error(`${getCurrentTimestamp()} Erreur lors de la republication via webhook du nombre ${deletedNumber}: ${error.message}`);
        }
    }
});


// ----------------- Gestion de la commande slash /set-nummer -----------------

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'set-nummer') {
        const salon = interaction.options.getChannel('salon');
        const nombre = interaction.options.getInteger('nombre');

        // Vérifier que l'utilisateur dispose du rôle requis
        if (!interaction.member.roles.cache.has(roleId)) {
            return interaction.reply({
                content: "❌ Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true,
            });
        }

        // Vérifier que le salon est bien dans la catégorie spécifiée
        if (salon.parentId !== categoryId) {
            return interaction.reply({
                content: "❌ Le salon doit être dans la catégorie spécifiée.",
                ephemeral: true,
            });
        }

        // Mettre à jour le nombre suivi pour le salon
        lastNumbers[salon.id] = nombre;
        interaction.reply({
            content: `✅ Le nombre du salon ${salon} a été défini à **${nombre}**.`,
            ephemeral: true,
        });
        console.log(`${getCurrentTimestamp()} Dans le salon ${salon.id}, le nombre a été défini à ${nombre} par ${interaction.user.tag}.`);
    }
});

// Connexion du bot avec le token défini dans le fichier .env (variable BOT_TOKEN)
client.login(process.env.BOT_TOKEN);
