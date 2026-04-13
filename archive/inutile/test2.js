const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  'http://localhost' // Pour une application console, sinon utilisez votre URL de redirection
);

// Générer l'URL d'autorisation
const scopes = ['https://www.googleapis.com/auth/drive.file'];
const url = oauth2Client.generateAuthUrl({
  access_type: 'offline', // pour obtenir un refresh token
  scope: scopes,
});

console.log('Ouvrez cette URL dans votre navigateur, puis entrez le code obtenu :\n', url);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question('Entrez le code ici: ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log('Tokens reçus:', tokens);
  rl.close();
});