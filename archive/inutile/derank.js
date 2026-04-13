require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.BOT_TOKEN;
const TEMPORARY_DURATION = 60000; // 1 minute en millisecondes

client.on('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!selfderanktemp') {
    const member = message.member;
    const originalRoles = Array.from(member.roles.cache.values());

    // Retirer tous les rôles
    for (const role of originalRoles) {
      await member.roles.remove(role);
    }

    message.channel.send(`${member.user.tag}, tous vos rôles ont été retirés temporairement.`);

    // Réattribuer les rôles après une minute
    setTimeout(async () => {
      for (const role of originalRoles) {
        await member.roles.add(role);
      }
      message.channel.send(`${member.user.tag}, vos rôles ont été réattribués.`);
    }, TEMPORARY_DURATION);
  }
});

client.login(TOKEN);
