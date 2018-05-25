/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var watson = require('watson-developer-cloud'); // watson sdk
var weather = require('weather-js');

var app = express();

var weatherInfo;
var today = new Date().getDate();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper

var assistant = new watson.AssistantV1({
  // If unspecified here, the ASSISTANT_USERNAME and ASSISTANT_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  username: process.env.ASSISTANT_USERNAME || '<username>',
  password: process.env.ASSISTANT_PASSWORD || '<password>',
  version: '2018-02-16'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the assistant service
  assistant.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Assistant service
 * @param  {Object} response The response from the Assistant service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;

  if (!response.output) {
    response.output = {};
    if (response.intents && response.intents[0]) {
      var intent = response.intents[0];
      if (intent.confidence >= 0.75) {
        responseText = 'I understood your intent was ' + intent.intent;
      } else if (intent.confidence >= 0.5) {
        responseText = 'I think your intent was ' + intent.intent;
      } else {
        responseText = 'I did not understand your intent';
      }
    }
    response.output.text = responseText;
    return response;
  } else {
    var responseOutputText = String(response.output.text);
    var responseContainsRequest = responseOutputText.includes('REQUEST=');
    if (responseContainsRequest) {  // deal with the request
      processRequest(responseOutputText);
      console.log(weatherInfo);
      response.output.text = weatherInfo;
      return response;
      // }, 1000);
    } else {  // no request, regular response 
      return response;
    }
  }
}

/**
 * process the request in the response message
 * @param {String} responseOutputText the in message
 * @return {String} 
 */
function processRequest(responseOutputText) {
  var requestInfo = responseOutputText.split('=')[1].split('|');
  var forecastingToday = requestInfo[1].split('-')[2] == today;
  getWeather(requestInfo, forecastingToday);
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
      weatherInfo = "Sorry, but I can't recognize '" + requestInfo[0] + "' as a city.";
    }
  });
  console.log(weatherInfo);
}

module.exports = app;
