const { promisify } = require('util');
const request = promisify(require('request'));
const parser = new require('xml2js').Parser({charkey: 'C$', attrkey: 'A$', explicitArray: true});

const today = new Date();
const requestUrl = 'http://weather.service.msn.com/find.aspx?src=outlook&weadegreetype=F&culture=en-US&weasearchstr=';
let finalJSON = [];


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

  xmlToJs(retrievedXML, function(err, result) {
    if (err) {
      console.log(err);
    }
    console.log('now data is in json format');
    finalJSON = result;
  });

  return generateResponse(queryList, finalJSON);
}


function xmlToJs(body, callback) {
  console.log('parsing xml to json');
  
  if (typeof callback !== 'function') {
    callback = function callback(err, result) { return err || result; };
  }

  // Check body content
  if(body.indexOf('<') !== 0) {
    if(body.search(/not found/i) !== -1) {
      return callback(null, finalJSON);
    }
    return callback(new Error('invalid body content'));
  }
  // console.log(body);
  // Parse body
  parser.parseString(body, function(err, parsedJSON) {
    if(err) {return callback(err);}

    if(!parsedJSON || !parsedJSON.weatherdata || !parsedJSON.weatherdata.weather) {
      return callback(new Error('failed to parse weather data'));
    }

    if(parsedJSON.weatherdata.weather['A$'] && parsedJSON.weatherdata.weather['A$'].errormessage) {
      return callback(parsedJSON.weatherdata.weather['A$'].errormessage);
    }

    if(!(parsedJSON.weatherdata.weather instanceof Array)) {
      return callback(new Error('missing weather info'));
    }
    
    processJSON(parsedJSON);
    
    return callback(null, finalJSON);
  });
}

function processJSON(parsedJSON) {
  finalJSON = [];
  let weatherLen = parsedJSON.weatherdata.weather.length;
  for (let i = 0; i < weatherLen; i++) {
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
