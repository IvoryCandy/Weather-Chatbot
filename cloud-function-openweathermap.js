const { promisify } = require('util');
const request = promisify(require('request'));
const today = new Date();
const requestConfig = {url: 'http://api.openweathermap.org/data/2.5/forecast?q=', 
                       units:'imperial',
                       counts: '10',
                       appid: 'e78940a376dfa844fc7395b6b17244a2'}

async function main(params) {
  let query = params.query;
  let requestInfo = query.split('=')[1].split('|');
  if (requestInfo[1] == '') {
    requestInfo[1] = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  }

  let weatherResult = null;
  try {
    weatherResult = await request(requestConfig.url + requestInfo[0] + '&units=' + requestConfig.units + 
                                  '&cnt=' + requestConfig.counts + '&appid=' + requestConfig.appid);
  } catch (err) {
    return Promise.reject({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Error processing your request' },
    });
  }
  weatherResult.body = JSON.parse(weatherResult.body);
  return weatherResult.body;


}

exports.main = main;
