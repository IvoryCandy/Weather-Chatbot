const { promisify } = require('util');
const request = promisify(require('request'));
const parser = new require('xml2js').Parser({charkey: 'C$', attrkey: 'A$', explicitArray: true});

const parseString = promisify(parser.parseString);
const today = new Date();
const requestUrl = 'http://weather.service.msn.com/find.aspx?src=outlook&weadegreetype=F&culture=en-US&weasearchstr=';


async function main(params) {
  let query = params.query;
  let queryList = query.split('=')[1].split('|');
  if (queryList[1] == '') {
    queryList[1] = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  }

  let retrievedXML;
  try {
    console.log('executing weather request for ' + queryList[0] + ' on ' + queryList[1] + '.');
    retrievedXML = await request(requestUrl + queryList[0]);
    retrievedXML = retrievedXML.body;

    if(retrievedXML.indexOf('<') !== 0) {
      if (retrievedXML.search(/not found/i) !== -1) {
        console.log('error in retrieving the body, return null');
        return null;
      }
      return new Error('invalid body content');
    }
  } catch (err) {
    return Promise.reject({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Error processing your request' }
    });
  }

  let parsedJSON = {};
  try {
    console.log('parsing xml to json');
    parsedJSON = await parseString(retrievedXML);
  } catch (err) {
    return Promise.reject({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Error converting xml to json' }
    });
  }
  let finalJSON = processJSON(parsedJSON);
  
  return generateResponse(queryList, finalJSON);
}


function processJSON(parsedJSON) {
  let finalJSON = [];
  console.log(parsedJSON.weatherdata.weather.length + ' different result found');  
  for (let i = 0; i < parsedJSON.weatherdata.weather.length; i++) {
    if (typeof parsedJSON.weatherdata.weather[i]['A$'] !== 'object')
      continue;

      
    // Init weather item
    let weatherItem = {
      location: {
        name: parsedJSON.weatherdata.weather[i]['A$']['weatherlocationname'],
        zipcode: parsedJSON.weatherdata.weather[i]['A$']['zipcode'],
        lat: parsedJSON.weatherdata.weather[i]['A$']['lat'],
        long: parsedJSON.weatherdata.weather[i]['A$']['long'],
        timezone: parsedJSON.weatherdata.weather[i]['A$']['timezone'],
        alert: parsedJSON.weatherdata.weather[i]['A$']['alert'],
        degreetype: parsedJSON.weatherdata.weather[i]['A$']['degreetype'],
        imagerelativeurl: parsedJSON.weatherdata.weather[i]['A$']['imagerelativeurl']
      },
      current: null,
      forecast: null
    };

    if (parsedJSON.weatherdata.weather[i]['current'] instanceof Array && parsedJSON.weatherdata.weather[i]['current'].length > 0) {
      if (typeof parsedJSON.weatherdata.weather[i]['current'][0]['A$'] === 'object') {
        weatherItem.current = parsedJSON.weatherdata.weather[i]['current'][0]['A$'];
        weatherItem.current.imageUrl = weatherItem.location.imagerelativeurl + 'law/' + weatherItem.current.skycode + '.gif';
      }
    }

    if (parsedJSON.weatherdata.weather[i]['forecast'] instanceof Array) {
      weatherItem.forecast = [];
      for (let k = 0; k < parsedJSON.weatherdata.weather[i]['forecast'].length; k++) {
        if (typeof parsedJSON.weatherdata.weather[i]['forecast'][k]['A$'] === 'object')
          weatherItem.forecast.push(parsedJSON.weatherdata.weather[i]['forecast'][k]['A$']);
      }
    }
    finalJSON.push(weatherItem);
  }
  return finalJSON;
}


function generateResponse(queryList, finalJSON) {
  let weatherInfo;    
  let forecastingToday = queryList[1].split('-')[2] == today.getDate();
  if (typeof finalJSON[0] !== 'undefined') {  //successfully print weather forecast
    let current = finalJSON[0].current;
    let forecast = finalJSON[0].forecast[0];
    let location = finalJSON[0].location;

    for (let i = 0; i < finalJSON[0].forecast.length; i++) {
      let day = finalJSON[0].forecast[i].date.split('-')[2];  //get day token
      
      if (day == queryList[1]) {  //if the day has been found, remember the array ID in forecast[]
        forecast = finalJSON[0].forecast[i];
        break;
      }
    }

    weatherInfo = 'On ' + queryList[1] + ' temperature in ' + location.name +
        ' is ' + forecast.low + 'F - ' + forecast.high + 'F.\n' +
        'It will be ' + forecast.skytextday + '.' + 
        (forecastingToday ? '\nAlso, right now the wind speed is ' + current.winddisplay + '.' : '');
  } else {  //location unrecognised
    weatherInfo = 'Sorry, but I can\'t recognize ' + queryList[0] + ' as a city.';
  }
  return {weatherInfo};
}


exports.main = main;
