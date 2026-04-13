const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadEnvVariables } = require('./config');
const { registerCommands } = require('./commands');
const { loadPoints, savePoints, handlePoints } = require('./points');

loadEnvVariables();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

const CHANNEL_IDS = ['1180905287532695593', '1323250755632631848', '1323250792697696336'];

client.once('ready', async () => {
  console.log('Paramètres principaux opérationnels');
  client.user.setActivity('Bot développé par Richard', { type: 'PLAYING' });

  loadPoints();
  registerCommands(client);
});

client.on('messageCreate', async message => {
  if (!message.author.bot) {
    await handlePoints(message);

    if (CHANNEL_IDS.includes(message.channel.id) && (!message.content.match(/^\d+$/) || message.content.includes('\n'))) {
      await message.delete();
      try {
        await message.author.send('❌ Vous ne pouvez envoyer que des nombres et un par message.\n-# format : "9999" et pas "9 999"');
        console.log(`Un message privé a été envoyé à ${message.author.tag}.`);
      } catch (error) {
        console.error(`Impossible d'envoyer un message privé à ${message.author.tag}.`);
      }
    }
  }
});

client.login(process.env.BOT_TOKEN);
