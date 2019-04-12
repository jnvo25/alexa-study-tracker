/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const DataManager = require('./DataManager.js');

function toSSML (phrase) {
  return `<voice name="Emma"><lang xml:lang="en-GB"><prosody pitch="+0%">${phrase}</prosody></lang></voice>`;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'Welcome back. What can I do for you today?';

    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .reprompt(speechText)
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

// Record time starting and save into attributes
const StartSessionIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'StartSessionIntent';
  },
  async handle(handlerInput) {

    // Retrieve UNIX
    console.log("Retrieving UNIX time...");
    const moment = require('moment');
    const start = moment().format("X");

    // See if user gave subject
    var subject = handlerInput.requestEnvelope.request.intent.slots.subject.value || null;

    // Load existing attributes to edit
    console.log("Initializing DataManager...");
    myDataManager = new DataManager();
    await myDataManager.initialize(handlerInput);
    const startSuccess = await myDataManager.startSession(start);
    
    var speechText;
    if(startSuccess) {
      if(subject) {
        await myDataManager.setSubject(subject);
        speechText = `Okay, session started for ${subject}`;
      } else {
        speechText = 'Okay, study session started.';
      }
    } else {
      speechText = 'There is already a session active.';
    }

    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

const StopSessionIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'StopSessionIntent';
  },
  async handle(handlerInput) {
    
    // Create data manager
    console.log("Initializing DataManager...");
    myDataManager = new DataManager();
    await myDataManager.initialize(handlerInput);

    // See if user gave subject
    console.log("Check for subject...");
    var subject = handlerInput.requestEnvelope.request.intent.slots.subject.value || null;
    // Set subject if not already set
    if(subject) {
      await myDataManager.setSubject(subject); 
    } else {
      // If subject is missing, check data manager
      console.log("Subject not passed. Checking attributes...");
      // If subject missing from data manager, ask for subject
      if(!myDataManager.hasSubject()) {
        console.log("Reprompting for subject");
        return handlerInput.responseBuilder
          .addDelegateDirective(handlerInput.requestEnvelope.request.intent)
          .getResponse();
      } else {
        console.log("There is already a session subject recorded...");
      }
    }
    
    // Retrieve UNIX
    console.log("Retrieving UNIX time...");
    const moment = require('moment');
    const nowUNIX = moment().format("X");
    
    console.log("Stopping session...");    
    const stopSuccess = await myDataManager.stopSession(nowUNIX);
    
    var speechText;
    if(stopSuccess) {
      speechText = (subject) ? `Okay, study session stopped for ${subject}` : "Okay, study session stopped.";
    } else {
      speechText = 'Unable to stop session. An error occured.';
    }

    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

const GetRecordsIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'GetRecordsIntent';
  },
  async handle(handlerInput) {
        

    // Retrieve UNIX
    console.log("Retrieving UNIX time...");
    const moment = require('moment');
    const currentTime = moment().format("X");

    // See if user gave subject
    const subject = handlerInput.requestEnvelope.request.intent.slots.subject.value || null;
    const period = handlerInput.requestEnvelope.request.intent.slots.period.value || null;
    var timeSeconds;
    if(period) {
      timeSeconds = handlerInput.requestEnvelope.request.intent.slots.period.resolutions.resolutionsPerAuthority[0].values[0].value.id || null;
    } else {
      timeSeconds = null;
    }

    // Load existing attributes to edit
    console.log("Initializing DataManager...");
    myDataManager = new DataManager();
    await myDataManager.initialize(handlerInput);
    console.log("Getting records...");
    var time = await myDataManager.getRecords(subject, timeSeconds, currentTime);
    console.log(time);
    console.log("Creating time string...");
    var timeString = `${(time>60) ? Math.floor(time/60) + " minutes" : time + " seconds"}. `;
    console.log(timeString);
    var speechText;
    console.log("Choosing speech text pathway...");
    if(subject) {
      if(period) {
        speechText = `You have been studying ${subject} ${period} for ${timeString}. `;
      } else {
        speechText =  `You have studying ${subject} for ${timeString}. `;
      }
    } else if(period) {
      speechText = `You have studying ${period} for ${timeString}. `;
    } else {
      speechText = `You have studied for ${timeString}. `;
    }
    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

const CurrentSessionIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'CurrentSessionIntent';
  },
  async handle(handlerInput) {
    // Get or create attributes
    const attributesManager = handlerInput.attributesManager;
    const attributes = await attributesManager.getPersistentAttributes() || null;

    // Check if there is session active
    var speechText = "";
    if(attributes.startTime) {
      // Retrieve UNIX
      const moment = require('moment');
      // Initialize duration formatter
      var momentDurationFormatSetup = require("moment-duration-format");
      momentDurationFormatSetup(moment);

      const currentSession = moment().format("X") - attributes.startTime;

      // Format duration
      const currentDuration = moment.duration(currentSession, "seconds"). format("h [ hours,] m [minutes and ] s [ seconds]");
      
      speechText = `You have been studying ${(attributes.currentSubject) ? attributes.currentSubject : ""}\
                    for ${currentDuration}. `;

      var index = attributes.history.findIndex(x => x.subjectName == attributes.currentSubject);
      if(index != -1) {
        // Attach time
        var currentRecord = attributes.history[index];
        const toStudy = moment.duration(currentRecord.timeLeftToStudy-currentSession, "seconds").format("h [ hours and ] m [ minutes.]");
        if(currentRecord.timeLeftToStudy-currentSession > 0) {
          speechText += `You have ${toStudy} left to study. `;
        } else {
          speechText += `Your ${attributes.currentSubject} study requirement has been fulfilled for today`;
        }
      }

    } else {
      // You have no active sessions
      speechText = "Active session not found.";
    }

    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

const CancelSessionIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'CancelSessionIntent';
  },
  async handle(handlerInput) {
 
    // Load existing attributes to edit
    console.log("Importing DataManager...");
    const DataManager = require('./DataManager');
    // Once loaded attributes, check if session can be started and start if possible
    var speechText = await DataManager(handlerInput).then(manager => {
      if(manager.startTime == null) {
        throw 'THERE ARE NO SESSIONS TO CANCEL';
      }
      var attributes = manager;
      // Check if there is a session active
      if(!attributes.sessionActive) { // If no session is active
        throw 'There is no session active.';
      }

      // Check for user confirmation
      if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'NONE') {
        throw 'CONFIRMATION ERROR';
      } else if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'DENIED') {
        throw 'CONFIRMATION DENIED';
      }

      // Create speech text
      var speechText = "";
      if(attributes.currentSubject) {
        speechText = `Okay, cancelling your study session for ${attributes.currentSubject}. `;
        var index = attributes.history.findIndex(x => x.subjectName == attributes.currentSubject);
        if(index != -1) {
          if(attributes.history[index].timeLeftToStudy > 0) 
            {speechText += `You have ${attributes.history[index].timeLeftToStudy} left to study!`
          } else {
            speechText += `You have finished studying ${attributes.currentSubject} for today. `;
          }
        }
      } else {
        speechText = `Okay, cancelling your study session. `
      }
      

      // Reset current statistics
      attributes.startTime = null;
      attributes.currentSubject = null;
      attributes.sessionActive = false;
      
      // Save attributes
      handlerInput.attributesManager.setPersistentAttributes(attributes);
      handlerInput.attributesManager.savePersistentAttributes();

      return speechText;
      
    }).catch(err => {
      console.log("An error was thrown: " + err);
      if(err == 'CONFIRMATION ERROR' || err == 'CONFIRMATION DENIED') {return err;}
      return `I cannot end your session. ${err}. `;
    });

    if(speechText == 'CONFIRMATION ERROR') {
      return handlerInput.responseBuilder
        .speak(toSSML("You sure you want to stop?"))
        .reprompt(toSSML("Are you sure?"))
        .addConfirmIntentDirective()
        .getResponse();
    } else if(speechText == 'CONFIRMATION DENIED') {
      const speechText = "Okay, cancelling your request to end.";
      return handlerInput.responseBuilder
        .speak(toSSML(speechText))
        .withSimpleCard('My Studies', speechText)
        .getResponse();
    }

    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'I am your academic assistant. You can tell me to start, \
                        stop, or cancel study sessions to keep track of your academic \
                        pursuits. I can also tell your total study times if you ask \
                        for your records.';

    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .reprompt(speechText)
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = "Bye bye";

    return handlerInput.responseBuilder
      .speak(toSSML(speechText))
      .withSimpleCard('My Studies', speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak(toSSML('Sorry, I can\'t understand the command. Please say again.'))
      .reprompt(toSSML('Sorry, I can\'t understand the command. Please say again.'))
      .getResponse();
  },
};

const skillBuilder = Alexa.SkillBuilders.standard();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    StartSessionIntentHandler,
    StopSessionIntentHandler,
    GetRecordsIntentHandler,
    CurrentSessionIntentHandler,
    CancelSessionIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withTableName('my-studies-data')
  .withAutoCreateTable(true)
  .lambda();
