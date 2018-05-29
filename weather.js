'use strict';

var weather = require('weather-js');
const today = new Date().getDate();

/**
 * process the request in the response message
 * @param {String} responseOutputText the in message
 * @return {String} 
 */
function processWeatherRequest(responseOutputText) {
  var requestInfo = responseOutputText.split('=')[1].split('|');
  var forecastingToday = requestInfo[1].split('-')[2] == today;
  return getWeather(requestInfo, forecastingToday);
}


/**
 * get the weather from weather-js lib
 * @param {String} outputMessage 
 * @param {object} requestInfo 
 * @param {boolean} forecastingToday 
 */
function getWeather(requestInfo, forecastingToday) {
  weather.find({search: requestInfo[0], degreeType: 'F' }, function (err, result) {
    if (err) {
      console.log(err);
    }

    var weatherInfo;
    if (typeof result[0] !== 'undefined') {  //successfully print weather forecast
      var current = result[0].current;
      var forecast = result[0].forecast[0];
      var location = result[0].location;

      for (var i = 0; i < result[0].forecast.length; i++) {
        var day = result[0].forecast[i].date.split('-')[2];  //get day token
        
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
    console.log(weatherInfo);
    return weatherInfo;
  });
}

module.exports = {
  processWeatherRequest
};