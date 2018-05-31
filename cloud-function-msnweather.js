const { promisify } = require('util');
const request = promisify(require('request'));
const parser = new require('xml2js').Parser({charkey: 'C$', attrkey: 'A$', explicitArray: true});
const parseString= promisify(parser.parseString);
const today = new Date();
const requestUrl = 'http://weather.service.msn.com/find.aspx?src=outlook&weadegreetype=F&culture=en-US&weasearchstr=';
let result = [];

async function main() {
  const params = {
    query: "Request=Boston|2018-05-30|"
  }
  let query = params.query;
  let requestInfo = query.split('=')[1].split('|');
  if (requestInfo[1] == '') {
    requestInfo[1] = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  }

  let weatherResult;
  try {
    console.log('executing weather request for ' + requestInfo[0] + ' on ' + requestInfo[1] + '.');
    weatherResult = await request(requestUrl + requestInfo[0]);
  } catch (err) {
    return Promise.reject({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Error processing your request' },
    });
  }
  
  // Check body content
  if(weatherResult.body.indexOf('<') !== 0) {
    if (weatherResult.body.search(/not found/i) !== -1) {
      console.log('error in retrieving the body, return null')
      return null;
    }
    return new Error('invalid body content');
  }
  
  // Parse body
  // let weatherJSON = parser.parseString(weatherResult.body, function (err, result) {
  //   console.log(JSON.stringify(result));
  // });

  xmlToJs(weatherResult.body, function(err, result) {
    if (err) {
      console.log(err);
    }
    console.log('now data is in json format');
    weatherJSON = result;
  });

  let weatherInfo;    
  let forecastingToday = requestInfo[1].split('-')[2] == today.getDate();
  if (typeof result[0] !== 'undefined') {  //successfully print weather forecast
    let current = result[0].current;
    let forecast = result[0].forecast[0];
    let location = result[0].location;

    for (let i = 0; i < result[0].forecast.length; i++) {
      let day = result[0].forecast[i].date.split('-')[2];  //get day token
      
      if (day == requestInfo[1]) {  //if the day has been found, remember the array ID in forecast[]
        forecast = result[0].forecast[i];
        break;
      }
    }

    weatherInfo = 'On ' + requestInfo[1] + ' temperature in ' + location.name +
        ' is ' + forecast.low + 'F - ' + forecast.high + 'F.\n' +
        'It will be ' + forecast.skytextday + '.' + 
        (forecastingToday ? '\nAlso, right now the wind speed is ' + current.winddisplay + '.' : '');
  } else {  //location unrecognised
    weatherInfo = 'Sorry, but I can\'t recognize ' + requestInfo[0] + '\ as a city.';
  }
  return weatherInfo;
}


function xmlToJs(body, callback) {
  console.log('parsing xml to json');
  
  if (typeof callback !== 'function') {
    callback = function callback(err, result) { return err || result; };
  }

  // Check body content
  if(body.indexOf('<') !== 0) {
    if(body.search(/not found/i) !== -1) {
      return callback(null, result);
    }
    return callback(new Error('invalid body content'));
  }
  // console.log(body);
  // Parse body
  parser.parseString(body, function(err, resultJSON) {
    if(err) {return callback(err);}

    if(!resultJSON || !resultJSON.weatherdata || !resultJSON.weatherdata.weather) {
      return callback(new Error('failed to parse weather data'));
    }

    if(resultJSON.weatherdata.weather['A$'] && resultJSON.weatherdata.weather['A$'].errormessage) {
      return callback(resultJSON.weatherdata.weather['A$'].errormessage);
    }

    if(!(resultJSON.weatherdata.weather instanceof Array)) {
      return callback(new Error('missing weather info'));
    }
    
    // Iterate over weather data
    let weatherLen = resultJSON.weatherdata.weather.length;
    console.log(weatherLen + ' different result found');  
    let weatherItem;
    for (let i = 0; i < weatherLen; i++) {
      if (typeof resultJSON.weatherdata.weather[i]['A$'] !== 'object')
        continue;

      // Init weather item
      weatherItem = {
        location: {
          name: resultJSON.weatherdata.weather[i]['A$']['weatherlocationname'],
          zipcode: resultJSON.weatherdata.weather[i]['A$']['zipcode'],
          lat: resultJSON.weatherdata.weather[i]['A$']['lat'],
          long: resultJSON.weatherdata.weather[i]['A$']['long'],
          timezone: resultJSON.weatherdata.weather[i]['A$']['timezone'],
          alert: resultJSON.weatherdata.weather[i]['A$']['alert'],
          degreetype: resultJSON.weatherdata.weather[i]['A$']['degreetype'],
          imagerelativeurl: resultJSON.weatherdata.weather[i]['A$']['imagerelativeurl']
        },
        current: null,
        forecast: null
      };

      if( resultJSON.weatherdata.weather[i]['current'] instanceof Array && resultJSON.weatherdata.weather[i]['current'].length > 0) {
        if (typeof resultJSON.weatherdata.weather[i]['current'][0]['A$'] === 'object') {
          weatherItem.current = resultJSON.weatherdata.weather[i]['current'][0]['A$'];
          weatherItem.current.imageUrl = weatherItem.location.imagerelativeurl + 'law/' + weatherItem.current.skycode + '.gif';
        }
      }

      if (resultJSON.weatherdata.weather[i]['forecast'] instanceof Array) {
        weatherItem.forecast = [];
        for (let k = 0; k < resultJSON.weatherdata.weather[i]['forecast'].length; k++) {
          if (typeof resultJSON.weatherdata.weather[i]['forecast'][k]['A$'] === 'object')
            weatherItem.forecast.push(resultJSON.weatherdata.weather[i]['forecast'][k]['A$']);
        }
      }

      // Push weather item into result
      result.push(weatherItem);
    }
    return callback(null, result);
  });
}

exports.main = main;
main();
