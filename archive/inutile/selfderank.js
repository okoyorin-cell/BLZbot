require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.BOT_TOKEN;
const ROLE_ID_1 = '1323241034855223348';
const ROLE_ID_2 = '1323241037392642129';
const TEMPORARY_DURATION = 60000; // 1 minute en millisecondes

client.on('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!selfderanktemp') {
    const role1 = message.guild.roles.cache.get(ROLE_ID_1);
    const role2 = message.guild.roles.cache.get(ROLE_ID_2);
    const member = message.member;

    if (member.roles.cache.has(ROLE_ID_1)) {
      await member.roles.remove(role1);
      message.channel.send(`${member.user.tag}, votre rôle (ID: ${ROLE_ID_1}) a été retiré temporairement.`);

      setTimeout(async () => {
        await member.roles.add(role1);
        message.channel.send(`${member.user.tag}, votre rôle (ID: ${ROLE_ID_1}) a été réattribué.`);
      }, TEMPORARY_DURATION);
    } else if (member.roles.cache.has(ROLE_ID_2)) {
      await member.roles.remove(role2);
      message.channel.send(`${member.user.tag}, votre rôle (ID: ${ROLE_ID_2}) a été retiré temporairement.`);

      setTimeout(async () => {
        await member.roles.add(role2);
        message.channel.send(`${member.user.tag}, votre rôle (ID: ${ROLE_ID_2}) a été réattribué.`);
      }, TEMPORARY_DURATION);
    } else {
      message.channel.send(`${member.user.tag}, vous n'avez aucun des rôles nécessaires.`);
    }
  }
});

client.login(process.env.BOT_TOKEN);
