'use strict';

const weather = require('weather-js');

/**
 * get the weather from weather-js lib
 * @param {String} outputMessage 
 * @param {object} requestInfo 
 * @param {boolean} forecastingToday 
 */
function getWeather(requestInfo, forecastingToday, response, res) {
  weather.find({search: requestInfo[0], degreeType: 'F' }, function(err, result) {
    if (err) {
      console.log(err);
    }
    let weatherInfo;
    if (typeof result[0] !== 'undefined') {  //successfully print weather forecast
      let current = result[0].current;
      let forecast = result[0].forecast[0];
      let location = result[0].location;
      let locationInfo = [location.lat, location.long];

      for (let i = 0; i < result[0].forecast.length; i++) {
        let day = result[0].forecast[i].date.split('-')[2];  //get day token
        
        if (day == requestInfo[1]) {  //if the day has been found, remember the array ID in forecast[]
          forecast = result[0].forecast[i];
          break;
        }
      }

      weatherInfo = 'On ' + forecast.day + ' temperature in ' + location.name +
        ' is ' + forecast.low + 'F - ' + forecast.high + 'F.\n' +
        'It will be ' + forecast.skytextday + '.' + 
        (forecastingToday ? '\nAlso, right now the wind speed is ' + current.winddisplay + '.' : '');
    } else {  //location unrecognised
      weatherInfo = 'Sorry, but I can\'t recognize ' + requestInfo[0] + '\ as a city.';
    }
    // console.log(weatherInfo);
    // return [weatherInfo, locationInfo];
    response.output.text = weatherInfo;
    res.json(response);
  });
}

module.exports = {
  getWeather
};