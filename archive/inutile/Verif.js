const { Client, GatewayIntentBits, Events } = require('discord.js');
require('dotenv').config();

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Role IDs and Channel ID
const EXCLUDE_ROLE_ID = '1400457387911155823'; // Role that excludes members from getting the new role
const ASSIGN_ROLE_ID = '1400457540386422916';  // Role to assign to members
const PROGRESS_CHANNEL_ID = '1343196193421000704'; // Channel to send progress messages

// When the client is ready, run this code and start role assignment
client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    
    // Get the first guild (server) - modify if you have multiple servers
    const guild = readyClient.guilds.cache.first();
    
    if (!guild) {
        console.error('No guild found! Make sure the bot is added to a server.');
        return;
    }
    
    console.log(`Starting role assignment for guild: ${guild.name}`);
    
    // Start role assignment process automatically
    await assignRolesToMembers(guild);
    
    console.log('Bot is ready and role assignment completed!');
});

// Function to assign roles to existing members without the exclude role (batch processing)
async function assignRolesToMembers(guild) {
    try {
        console.log('Starting role assignment process for existing members...');
        
        // Get progress channel
        const progressChannel = guild.channels.cache.get(PROGRESS_CHANNEL_ID);
        if (!progressChannel) {
            console.error(`Progress channel with ID ${PROGRESS_CHANNEL_ID} not found!`);
        } else {
            await progressChannel.send('Demarrage de l\'attribution des roles...');
        }
        
        // Fetch all members
        const members = await guild.members.fetch();
        console.log(`Found ${members.size} members in the guild.`);
        
        // Get the roles
        const excludeRole = guild.roles.cache.get(EXCLUDE_ROLE_ID);
        const assignRole = guild.roles.cache.get(ASSIGN_ROLE_ID);
        
        if (!excludeRole) {
            console.error(`Exclude role with ID ${EXCLUDE_ROLE_ID} not found!`);
            return;
        }
        
        if (!assignRole) {
            console.error(`Assign role with ID ${ASSIGN_ROLE_ID} not found!`);
            return;
        }
        
        console.log(`Exclude role: ${excludeRole.name}`);
        console.log(`Assign role: ${assignRole.name}`);
        
        // Filter members who need the role
        const eligibleMembers = members.filter(member => {
            // Skip bots
            if (member.user.bot) return false;
            
            // Skip if has exclude role
            if (member.roles.cache.has(EXCLUDE_ROLE_ID)) return false;
            
            // Skip if already has assign role
            if (member.roles.cache.has(ASSIGN_ROLE_ID)) return false;
            
            return true;
        });
        
        console.log(`Found ${eligibleMembers.size} eligible members for role assignment.`);
        
        if (eligibleMembers.size === 0) {
            console.log('No members need role assignment.');
            if (progressChannel) {
                await progressChannel.send('Aucun mbr n\'a besoin d\'attribution de role.');
            }
            return;
        }
        
        if (progressChannel) {
            await progressChannel.send(`${eligibleMembers.size} membres trouves pr l'attribution de role.`);
        }
        
        // Convert to array for batch processing
        const membersArray = Array.from(eligibleMembers.values());
        const batchSize = 50;
        let assignedCount = 0;
        let errorCount = 0;
        let lastReportedPercentage = 0;
        
        // Process in batches of 50
        for (let i = 0; i < membersArray.length; i += batchSize) {
            const batch = membersArray.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(membersArray.length / batchSize);
            
            console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} members)...`);
            
            // Process current batch
            for (const member of batch) {
                try {
                    await member.roles.add(ASSIGN_ROLE_ID);
                    console.log(`✅ Assigned role to ${member.user.tag}`);
                    assignedCount++;
                    
                    // Calculate percentage and send progress message every 5%
                    const currentPercentage = Math.floor((assignedCount / membersArray.length) * 100);
                    if (currentPercentage >= lastReportedPercentage + 5 && currentPercentage <= 100) {
                        lastReportedPercentage = Math.floor(currentPercentage / 5) * 5; // Round to nearest 5%
                        if (progressChannel && lastReportedPercentage > 0) {
                            await progressChannel.send(`Progression: ${lastReportedPercentage}% termine (${assignedCount}/${membersArray.length} mbrs)`);
                        }
                    }
                    
                    // Small delay between each member in batch
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                } catch (error) {
                    console.error(`❌ Failed to assign role to ${member.user.tag}:`, error.message);
                    errorCount++;
                }
            }
            
            // Longer delay between batches to reduce CPU load
            if (i + batchSize < membersArray.length) {
                console.log(`Waiting 2 seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log('\n=== Role Assignment Complete ===');
        console.log(`✅ Successfully assigned: ${assignedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📊 Total eligible members: ${membersArray.length}`);
        
        // Send completion message
        if (progressChannel) {
            const successRate = Math.round((assignedCount / membersArray.length) * 100);
            await progressChannel.send(`Attribution des roles terminee !\n${assignedCount} roles attribues avec succes\n${errorCount} erreurs\nTaux de reussite: ${successRate}%`);
        }
        
    } catch (error) {
        console.error('Error in role assignment process:', error);
        const progressChannel = guild.channels.cache.get(PROGRESS_CHANNEL_ID);
        if (progressChannel) {
            await progressChannel.send(`Erreur lors de l'attribution des roles: ${error.message}`);
        }
    }
}

// No command system - role assignment starts automatically when bot starts

// No automatic role assignment for new members - only existing members

// Error handling
client.on(Events.Error, error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord with your app's token from environment variable
client.login(process.env.BOT_TOKEN);