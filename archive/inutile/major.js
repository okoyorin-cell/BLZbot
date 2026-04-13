// charge les variables d'environnement
require('dotenv').config();

// importe les modules nécessaires
const { Client, IntentsBitField, Partials, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { exec, execSync } = require('child_process');
const fs = require('fs');

// crée une nouvelle instance du client Discord avec les intents nécessaires
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages
    ],
    partials: [Partials.Channel]
});

// ID du client et de la guilde (serveur)
const clientId = '123456789012345678'; // Remplace par ton client ID
const guildId = '876543210987654321'; // Remplace par ton guild ID

// définition de la commande slash /vital-info
const commands = [
    new SlashCommandBuilder()
        .setName('vital-info')
        .setDescription('Affiche l\'état des scripts et permet de redémarrer les scripts inactifs.')
]
    .map(command => command.toJSON());

// fonction asynchrone pour enregistrer les commandes
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

    try {
        console.log('Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        console.log('Commandes enregistrées avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes :', error);
    }
}

// appelle la fonction pour enregistrer les commandes
registerCommands();

// quand le bot est prêt
client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
});

// fonction pour vérifier si un script est en cours d'exécution
function isScriptRunning(scriptName) {
    try {
        const output = execSync(`pgrep -f ${scriptName}`);
        return output.toString().trim() !== '';
    } catch (error) {
        return false;
    }
}

// gestion des interactions (commandes slash et boutons)
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        // si la commande est /vital-info
        if (interaction.commandName === 'vital-info') {
            // vérifie si l'utilisateur est administrateur
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: 'Désolé, tu n\'as pas la permission d\'utiliser cette commande.', ephemeral: true });
            }

            // vérifie l'état des scripts
            const scripts = ['index.js', 'linkScanner.js', 'AdminCommands.js', 'snipe.js', 'Ordre.js', 'Ping.js'];
            let statusMessage = '**État des scripts :**\n';

            scripts.forEach(script => {
                const isRunning = isScriptRunning(script);
                statusMessage += `• \`${script}\` : ${isRunning ? 'En cours d\'exécution' : 'Non démarré'}\n`;
            });

            // crée le bouton pour redémarrer les scripts inactifs
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('restart_inactive')
                        .setLabel('Redémarrer les scripts inactifs')
                        .setStyle(ButtonStyle.Primary),
                );

            // envoie le message avec l'état des scripts et le bouton
            await interaction.reply({ content: statusMessage, components: [row] });
        }
    } else if (interaction.isButton()) {
        // si le bouton est "redémarrer les scripts inactifs"
        if (interaction.customId === 'restart_inactive') {
            // vérifie si l'utilisateur est administrateur
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: 'Désolé, tu n\'as pas la permission d\'utiliser ce bouton.', ephemeral: true });
            }

            // évite d'interagir si déjà traité
            if (interaction.replied || interaction.deferred) {
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            // redémarre les scripts inactifs
            const scripts = ['index.js', 'linkScanner.js', 'AdminCommands.js', 'snipe.js', 'Ordre.js', 'Ping.js'];
            let restarted = [];

            scripts.forEach(script => {
                const isRunning = isScriptRunning(script);
                if (!isRunning) {
                    exec(`node ${script}`, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Erreur lors du démarrage de ${script}:`, error);
                        }
                    });
                    restarted.push(script);
                }
            });

            // envoie le résultat
            await interaction.followUp({ content: `Les scripts suivants ont été redémarrés : ${restarted.join(', ')}` });
        }
    }
});

// connecte le bot à Discord
client.login(process.env.BOT_TOKEN);
