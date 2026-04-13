require('dotenv').config();
const { REST, Routes } = require('discord.js');
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Suppression de toutes les commandes spécifiques à votre bot');

    // Supprime les commandes globales de votre bot
    const globalCommands = await rest.get(
      Routes.applicationCommands(process.env.CLIENT_ID)
    );

    if (globalCommands.length > 0) {
      const globalPromises = globalCommands.map(cmd => 
        rest.delete(
          Routes.applicationCommand(process.env.CLIENT_ID, cmd.id)
        )
      );

      await Promise.all(globalPromises);
      console.log('Toutes les commandes globales de votre bot ont été supprimées');
    } else {
      console.log('Aucune commande globale à supprimer');
    }

    // Supprime les commandes spécifiques à la guilde de votre bot
    const guildCommands = await rest.get(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    );

    if (guildCommands.length > 0) {
      const guildPromises = guildCommands.map(cmd => 
        rest.delete(
          Routes.applicationGuildCommand(process.env.CLIENT_ID, process.env.GUILD_ID, cmd.id)
        )
      );

      await Promise.all(guildPromises);
      console.log('Toutes les commandes spécifiques à la guilde de votre bot ont été supprimées');
    } else {
      console.log('Aucune commande spécifique à la guilde à supprimer');
    }
  } catch (error) {
    console.error(error);
  }
})();
