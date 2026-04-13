const axios = require('axios');
const querystring = require('querystring');

async function getToken() {
  const response = await axios.post('https://discord.com/api/oauth2/token', querystring.stringify({
    client_id: '1317275021017612340',
    client_secret: 'SIsyJo1mQ6vpSw11z-xwB559bpwTpdHx',
    grant_type: 'authorization_code',
    code: 'ry4H0MmNVmnI2eF8OZAAJLq1481dOt',
    redirect_uri: 'http://localhost'
  }));
  
  console.log(response.data);
}

getToken();
