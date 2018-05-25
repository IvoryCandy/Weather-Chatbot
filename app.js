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

var WatsonConversationSetup = require('./lib/watson-conversation-setup');
var DEFAULT_NAME = 'watson-conversation-slots-intro';
var fs = require('fs'); // file system for loading JSON
var vcapServices = require('vcap_services');
var conversationCredentials = vcapServices.getCredentials('conversation');
var watson = require('watson-developer-cloud'); // watson sdk

var weather = require('weather-js');
var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

var workspaceID; // workspaceID will be set when the workspace is created or validated.
var weatherInfo;
var today = new Date().getDate();
// Create the service wrapper
var conversation = watson.conversation({
  url: conversationCredentials.url,
  username: conversationCredentials.username,
  password: conversationCredentials.password,
  version_date: '2016-07-11',
  version: 'v1'
});

var conversationSetup = new WatsonConversationSetup(conversation);
// var workspaceJson = JSON.parse(fs.readFileSync('data/watson-pizzeria.json'));
// var conversationSetupParams = { default_name: DEFAULT_NAME, workspace_json: workspaceJson };
var conversationSetupParams = {default_name: DEFAULT_NAME};
conversationSetup.setupConversationWorkspace(conversationSetupParams, (err, data) => {
  if (err) {
    //handleSetupError(err);
  } else {
    console.log('Assistant is ready!');
    workspaceID = data;
  }
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {

  if (!workspaceID) {
    return res.json({
      output: {
        text: 'Assistant initialization in progress. Please try again.'
      }
    });
  }

  var payload = {
    workspace_id: workspaceID,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

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
}
module.exports = app;
