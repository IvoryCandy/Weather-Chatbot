/*-----------------------------------------------------------------------------
This Bot demonstrates how to use a waterfall to prompt the user with a series
of questions and then answer using previously gathered answers. You can interact 
with this bot using CLI where node app is ran.

# RUN THE BOT:

    Run the bot from the command line using "node index.js" (first install Node.js
    download link: https://nodejs.org/en/
    and then install botbuilder using "npm i botbuilder" ) and then type "hello"
    to wake the bot up.
    
-----------------------------------------------------------------------------*/


var builder = require('botbuilder')
var weather = require('weather-js')

var todayDate = new Date();

var inMemoryStorage = new builder.MemoryBotStorage()

// Setup bot and root waterfall
var connector = new builder.ConsoleConnector().listen()
var bot = new builder.UniversalBot(connector, [

    function (session) {
        builder.Prompts.text(session, "Which city would you like me to lookup?")
    },

    function (session, results) {
        session.userData.location = results.response
        builder.Prompts.choice(session, 'Display forecast for: ', [
            'Today',
            'Tomorrow',
            'Day after tomorrow'
        ])
    },

    function (session, results, next) {
        session.userData.day = results.response.entity
        session.send(
            '\n\nFetching forecast data for ' 
            + session.userData.day 
            + ' in ' 
            + session.userData.location 
            + '...\n\n'
        );
        next();
    },

    function(session, results) {
        var forecastingToday = false;
        var today = todayDate.getDate();
        var forecastDay = new Date(todayDate);
        switch (session.userData.day) {
            //if it would be april 30th, then Tomorrow has to be 1.
            case 'Today':
                forecastDay.setDate(todayDate.getDate());
                break;
            case 'Tomorrow':
                forecastDay.setDate(todayDate.getDate() + 1);
                break;
            case 'Day after tomorrow':
                forecastDay.setDate(todayDate.getDate() + 2);
                break;
            default:
                console.log('Forecast selection set is out of bounds');
                break;
        }
        forecastDay = forecastDay.getDate();
        if (forecastDay == today) forecastingToday = true;
        

        weather.find({ search: session.userData.location, degreeType: 'C' }, function (err, result) {
            if (err) console.log(err);

            if (typeof result[0] !== 'undefined') {
                //successfully print weather forecast
                
                var forecast = result[0].forecast[0];
                var current = result[0].current;
                var location = result[0].location;

                for (var i = 0; i < result[0].forecast.length; i++) {
                    var day = result[0].forecast[i].date.split('-')[2];  //get day token
                    
                    if (day == forecastDay) {
                        //if the day has been found, remember the array ID in forecast[]
                        forecast = result[0].forecast[i];
                        break;
                    }
                }
                

                session.send(
                    'Got it!\n' 
                    + 'On ' 
                    + forecast.day 
                    + ' temperature in ' 
                    + location.name 
                    + ' is ' 
                    + forecast.low 
                    + 'C - ' 
                    + forecast.high 
                    + 'C.\n' 
                    + 'It will be ' 
                    + forecast.skytextday 
                    + '.' 
                    + (forecastingToday ?   //extra information if forecasting today
                        '\n\nAlso, right now in ' +
                        current.observationpoint +
                        ' wind speed is ' +
                        current.winddisplay +
                        '.' 
                        :
                        '')
                )
            } else {
                //location unrecognised
                session.send(
                    "Sorry, but I can't recognise '" +
                    session.userData.location +
                    "' as a city."
                    )
            }
            
        });
        

    }
]).set('storage', inMemoryStorage) // Register in memory storage





