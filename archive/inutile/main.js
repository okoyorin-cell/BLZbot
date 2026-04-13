// main.js

// Gestion des erreurs globales
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const { fork } = require('child_process');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');
require('dotenv').config();

// Vérification du token
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("Erreur : BOT_TOKEN n'est pas défini dans le fichier .env.");
  process.exit(1);
}

// Constantes fixes
const APPLICATION_ID = '1317275021017612340'; // ID de l'application (fourni)
const GUILD_ID = '1097110036192448656';       // Guild ID
const ALLOWED_ROLE_ID = '1335390733003259964';  // Rôle autorisé
const NOTIFICATION_CHANNEL_ID = '1343196193421000704'; // Canal de notifications

console.log("Démarrage du bot...");

// Création du client Discord
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Définition des scripts à lancer
const scriptsToRun = [
  { name: 'votes.js', description: 'Gère les votes', status: 'inactive' },
  { name: 'niveau/src/index.js', description: 'Gère la V4.5', status: 'inactive' },
  { name: 'deban.js', description: 'Gère les débannissements', status: 'inactive' },
  { name: 'ban_link.js', description: 'Gère les liens de bannissement', status: 'inactive' },
  { name: 'snipe.js', description: 'Gère les snipes', status: 'inactive' },
  { name: 'linkScanner.js', description: 'Scan les liens', status: 'inactive' },
  { name: 'index.js', description: 'Script principal', status: 'inactive' },
];

// Stockage des processus lancés
const scriptProcesses = {};

// Met à jour le statut d'un script dans le tableau
function updateScriptStatus(scriptName, newStatus) {
  const script = scriptsToRun.find(s => s.name === scriptName);
  if (script) {
    script.status = newStatus;
  }
}

// Envoi d'une notification dans le canal de notifications
function notifyScriptStatus(scriptName, status) {
  const channel = client.channels.cache.get(NOTIFICATION_CHANNEL_ID);
  if (channel) {
    channel.send(`Le script \`${scriptName}\` a été \`${status}\`.`).catch(console.error);
  } else {
    console.warn("Canal de notifications introuvable.");
  }
}

// Lance un script enfant via fork
function runScript(scriptObj) {
  const scriptName = scriptObj.name;
  console.log(`Lancement du script ${scriptName}...`);
  const scriptPath = path.join(__dirname, scriptName);
  const proc = fork(scriptPath, [], { stdio: ['inherit', 'pipe', 'pipe', 'ipc'] });
  scriptProcesses[scriptName] = proc;
  updateScriptStatus(scriptName, 'running');

  proc.stdout.on('data', (data) => {
    console.log(`[${scriptName}] STDOUT: ${data.toString().trim()}`);
  });
  proc.stderr.on('data', (data) => {
    console.error(`[${scriptName}] STDERR: ${data.toString().trim()}`);
  });
  proc.on('message', (msg) => {
    if (msg.action === 'shutdown') {
      console.log(`[${scriptName}] Message "shutdown" reçu.`);
      proc.kill();
    } else if (msg.action === 'reboot') {
      console.log(`[${scriptName}] Message "reboot" reçu. Redémarrage...`);
      proc.kill();
      setTimeout(() => runScript(scriptObj), 3000);
    }
  });
  proc.on('exit', (code, signal) => {
    if (signal) {
      updateScriptStatus(scriptName, 'stopped');
      notifyScriptStatus(scriptName, `arrêté avec signal ${signal}`);
      console.log(`[${scriptName}] Processus terminé avec le signal ${signal}.`);
    } else if (code !== 0) {
      updateScriptStatus(scriptName, 'error');
      notifyScriptStatus(scriptName, `arrêté avec code ${code}`);
      console.error(`[${scriptName}] Processus terminé avec le code ${code}.`);
    } else {
      updateScriptStatus(scriptName, 'stopped');
      console.log(`[${scriptName}] Processus terminé normalement.`);
    }
  });
  proc.on('error', (err) => {
    console.error(`[${scriptName}] Erreur dans le processus :`, err);
    updateScriptStatus(scriptName, 'error');
    notifyScriptStatus(scriptName, 'error');
  });
}

// Lance tous les scripts avec un délai entre chacun (10 secondes)
function runAllScripts() {
  let delayIncrement = 0;
  const delayBetween = 10000;
  scriptsToRun.forEach((scriptObj) => {
    setTimeout(() => {
      runScript(scriptObj);
    }, delayIncrement);
    delayIncrement += delayBetween;
  });
}

// Enregistre les commandes slash sur le serveur
async function registerCommands() {
  const commands = [
    {
      name: 'settings',
      description: 'Gérer les scripts',
      options: [
        {
          name: 'action',
          description: 'Action à effectuer (shutdown, reboot, start)',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: 'shutdown', value: 'shutdown' },
            { name: 'reboot', value: 'reboot' },
            { name: 'start', value: 'start' },
          ],
        },
        {
          name: 'script',
          description: 'Nom du script ou "all"',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'settings-view',
      description: "Voir l'état des scripts",
    },
  ];

  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

  console.log("Enregistrement des commandes...");

  try {
    const endpoint = Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID);
    const result = await rest.put(endpoint, { body: commands });
    console.log("Commandes enregistrées avec succès :", result);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes :", error);
    throw error; // Pour stopper l'initialisation si nécessaire
  }
}

// Gestion des interactions (slash commandes)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  // Vérifie les permissions de l'utilisateur (Administrateur ou rôle autorisé)
  if (
    !interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
    !interaction.member.roles.cache.has(ALLOWED_ROLE_ID)
  ) {
    return interaction.reply("Vous n'avez pas la permission d'utiliser cette commande.");
  }

  if (commandName === 'settings') {
    const action = options.getString('action');
    const scriptArg = options.getString('script');

    if (action === 'shutdown') {
      if (scriptArg === 'all') {
        Object.keys(scriptProcesses).forEach((name) => {
          console.log(`Arrêt du script ${name}`);
          scriptProcesses[name].kill();
        });
        return interaction.reply("Tous les scripts ont été arrêtés.");
      } else if (scriptProcesses[scriptArg]) {
        console.log(`Arrêt du script ${scriptArg}`);
        scriptProcesses[scriptArg].kill();
        return interaction.reply(`Le script ${scriptArg} a été arrêté.`);
      } else {
        return interaction.reply("Script non trouvé ou déjà arrêté.");
      }
    } else if (action === 'reboot') {
      if (scriptArg === 'all') {
        Object.keys(scriptProcesses).forEach((name) => scriptProcesses[name].kill());
        setTimeout(runAllScripts, 3000);
        return interaction.reply("Tous les scripts ont été redémarrés.");
      } else if (scriptProcesses[scriptArg]) {
        scriptProcesses[scriptArg].kill();
        const scriptObj = scriptsToRun.find((s) => s.name === scriptArg);
        if (scriptObj) {
          setTimeout(() => runScript(scriptObj), 3000);
        }
        return interaction.reply(`Le script ${scriptArg} a été redémarré.`);
      } else {
        return interaction.reply("Script non trouvé ou déjà arrêté.");
      }
    } else if (action === 'start') {
      if (scriptArg === 'all') {
        runAllScripts();
        return interaction.reply("Tous les scripts ont été démarrés.");
      } else {
        if (scriptProcesses[scriptArg]) {
          return interaction.reply(`Le script ${scriptArg} fonctionne déjà.`);
        }
        const scriptObj = scriptsToRun.find((s) => s.name === scriptArg);
        if (scriptObj) {
          runScript(scriptObj);
          return interaction.reply(`Le script ${scriptArg} a été démarré.`);
        } else {
          return interaction.reply("Script non trouvé.");
        }
      }
    } else {
      return interaction.reply("Action inconnue.");
    }
  } else if (commandName === 'settings-view') {
    const embed = new EmbedBuilder()
      .setTitle("État des Scripts")
      .setDescription("Liste des scripts et leur état actuel")
      .setColor(0x00ae86);
    scriptsToRun.forEach((script) => {
      embed.addFields({
        name: script.name,
        value: `Description : ${script.description}\nÉtat : ${script.status}`,
      });
    });
    return interaction.reply({ embeds: [embed] });
  }
});

// Connexion du bot
client.login(BOT_TOKEN);
