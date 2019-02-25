/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');

const MY_SCHEDULE = {
  MAT1: [1,3,5],
  MAT3: [1,3],
  BIO1: [2,4],
  CSC18: [3],
  GUITAR: [7]
}

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
    
    // Load existing attributes to edit
    console.log("Importing DataManager...");
    const DataManager = require('./DataManager');
    // Once loaded attributes, check if session can be started and start if possible
    var speechText = await DataManager(handlerInput).then(manager => {
      var attributes = manager;
      // Check if session active
      console.log("Checking session if active...");
      console.log(attributes.sessionActive);
      if(!attributes.sessionActive) {
        console.log("Session not active, setting attributes...");
        attributes.currentSubject = handlerInput.requestEnvelope.request.intent.slots.subject.value;
        attributes.startTime = start;
        // Save into database
        console.log("Saving to database...");
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        handlerInput.attributesManager.savePersistentAttributes();
      } else {
        console.log("Active session exists. Throwing...");
        throw `There is already an active session${(attributes.currentSubject) ? ` for ${attributes.currentSubject} ` : ""}`;
        // TODO:: DO YOU WANT TO CANCEL IT?
      }
  
      // Tell user success
      console.log("Checking current subject...");
      if(attributes.currentSubject) {
        console.log("Current subject was given. Updating speechText...");
        return `Okay, study session for ${attributes.currentSubject}, starting now`;
      } else {
        console.log("Current subject not found. Setting speech text...");
        return `Okay, study session, starting now`;
      }

    }).catch(err => {
      console.log("An error occured: " + err);
      return `I cannot start a new session. ${err}. `;
    });

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
        
    // Get or create attributes
    const attributesManager = handlerInput.attributesManager;
    const attributes = await attributesManager.getPersistentAttributes() || {};

    // Check if there is session active
    if(!attributes.startTime) {
      const speechText = "Active session not found.";
      return handlerInput.responseBuilder
        .speak(toSSML(speechText))
        .withSimpleCard('My Studies', speechText)
        .getResponse();
    }

    // Check confirmation
    if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'NONE') {
      return handlerInput.responseBuilder
        .speak(toSSML("You sure you want to stop?"))
        .reprompt(toSSML("Are you sure?"))
        .addConfirmIntentDirective()
        .getResponse();
    } else if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'DENIED') {
      const speechText = "Okay, cancelling your request to end.";
      return handlerInput.responseBuilder
        .speak(toSSML(speechText))
        .withSimpleCard('My Studies', speechText)
        .getResponse();
    }

    // Retrieve UNIX
    const moment = require('moment');
    const nowUNIX = moment().format("X");
    
    // Initialize duration formatter
    var momentDurationFormatSetup = require("moment-duration-format");
    momentDurationFormatSetup(moment);

    // Check if session subject exists and prompt
    if(attributes.currentSubject == null && handlerInput.requestEnvelope.request.dialogState === 'IN_PROGRESS') {
      return handlerInput.responseBuilder
        .addDelegateDirective(handlerInput.requestEnvelope.request.intent)
        .getResponse();
    }
    attributes.currentSubject = attributes.currentSubject || handlerInput.requestEnvelope.request.intent.slots.subject.value;
    
    var subjectReference;
    if(attributes.currentSubject == "java") {
      subjectReference = MY_SCHEDULE.CSC18;
    } else if(attributes.currentSubject == "calculus") {
      subjectReference = MY_SCHEDULE.MAT1;
    } else if(attributes.currentSubject == "linear algebra") {
      subjectReference = MY_SCHEDULE.MAT3;
    } else if(attributes.currentSubject == "biology") {
      subjectReference = MY_SCHEDULE.BIO1;
    } else if(attributes.currentSubject == "guitar") {
      subjectReference = MY_SCHEDULE.GUITAR;
    } else {
      // Ask for subject again
    }

    // Calculate time studied
    const studyTime = nowUNIX - attributes.startTime;

    // Create history array in attributes if nonexistent
    attributes.history = attributes.history || [];
    // Check if current subject has been studied before and create if new
    var index = attributes.history.findIndex(x => x.subjectName == attributes.currentSubject);
    if(index == -1) {
      // Subject record to hold time
      const record = {
        subjectName: attributes.currentSubject,
        totalTime: 0,
        lastTimeUpdated: nowUNIX,
        timeLeftToStudy: 0
      }
      attributes.history.push(record);
      index = attributes.history.length-1;
    }
    // Attach time
    var currentRecord = attributes.history[index];
    currentRecord.totalTime += studyTime; 

    // If different day that last time updated, calculate classes in between
    var nowMoment = moment.unix(nowUNIX);
    var lastMoment = moment.unix(currentRecord.lastTimeUpdated);
    if(nowMoment.diff(lastMoment, 'days') != 0) {
      console.log(nowMoment.diff(lastMoment, 'days'));
      require('moment-weekday-calc');
      classes = nowMoment.weekdayCalc(lastMoment, subjectReference);

      // If today same day as class, remove class
      if(subjectReference.indexOf(nowMoment.isoWeekday()) != -1) {
        --classes;
      }
      currentRecord.timeLeftToStudy += classes * 2 * 3600 - studyTime;
    }

    currentRecord.timeLeftToStudy = (currentRecord.timeLeftToStudy < studyTime) ? 0 : currentRecord.timeLeftToStudy - studyTime;


    // Format durations
    const studyDuration = moment.duration(studyTime, "seconds"). format("h [ hours,] m [minutes and ] s [ seconds]");
    const toStudy = moment.duration(currentRecord.timeLeftToStudy, "seconds").format("h [ hours and ] m [ minutes.]");

    // Create speech text
    var speechText = `Okay, stopping your study session. You have been studying ${attributes.currentSubject} \
                       for ${studyDuration}. `;
    if(currentRecord.timeLeftToStudy > 0) {speechText += `You have ${toStudy} left to study!`} else {
      speechText += `You have finished studying ${attributes.currentSubject} for today. `;
    };

    // Reset current statistics
    attributes.startTime = null;
    attributes.currentSubject = null;
    attributes.sessionActive = false;
    currentRecord.lastTimeUpdated = nowUNIX;

    // Save attributes
    attributesManager.setPersistentAttributes(attributes);
    await attributesManager.savePersistentAttributes();
    
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
        
    // Get or create attributes
    const attributesManager = handlerInput.attributesManager;
    const attributes = await attributesManager.getPersistentAttributes() || null;

    // Check if attributes empty
    if(attributes == null || !attributes.history) {
        const speechText = "You have not started a study session yet.";
        return handlerInput.responseBuilder
            .speak(toSSML(speechText))
            .withSimpleCard('My Studies', speechText)
            .getResponse();
    }

    var speechText = "";
    const passedSubject = handlerInput.requestEnvelope.request.intent.slots.subject.value;
    if(passedSubject) {
        var index = attributes.history.findIndex(x => x.subjectName == passedSubject);
        if(index == -1) {
            speechText += `You haven't studied ${passedSubject} yet.`;
        } else {
            const record = attributes.history[index];
            speechText += `You studied ${record.subjectName} for \
                          ${(record.totalTime>60) ? Math.floor(record.totalTime/60) + " minutes" : record.totalTime + " seconds"}.`;
        }
    } else {
        speechText += "You have studied ";
        for(var i=0; i<attributes.history.length; i++) {
          const record = attributes.history[i];  
          speechText += `${record.subjectName} for ${(record.totalTime>60) ? Math.floor(record.totalTime/60) + " minutes" : record.totalTime + " seconds"}\
                          ${(i != attributes.history.length-2) ? (i == attributes.history.length-1) ? '. ' : ', ' : ', and '}`;
        }
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

    // Get or create attributes
    const attributesManager = handlerInput.attributesManager;
    const attributes = await attributesManager.getPersistentAttributes() || null;
    
    // Check if there is a current session
    if(!attributes.startTime) {
      return handlerInput.responseBuilder
        .speak(toSSML("There is no active session to cancel."))
        .withSimpleCard('My Studies', "There are no sessions to cancel.")
        .getResponse();
    }

    // Confirm intent
    if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'NONE') {
      const speechText = `Are you sure you want to cancel your session${(attributes.currentSubject) ? ` for ${attributes.currentSubject}` : ""}?`;
      return handlerInput.responseBuilder
        .speak(toSSML(speechText))
        .reprompt(toSSML("Are you sure you want to cancel?"))
        .addConfirmIntentDirective()
        .getResponse();
    } else if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'DENIED') {
      const speechText = "Okay, I won't cancel your session.";
      return handlerInput.responseBuilder
        .speak(toSSML(speechText))
        .withSimpleCard('My Studies', speechText)
        .getResponse();
    }

    // Reset current statistics
    attributes.startTime = null;
    attributes.currentSubject = null;

    // Save attributes
    attributesManager.setPersistentAttributes(attributes);
    await attributesManager.savePersistentAttributes();

    const speechText = "Okay, I cancelled your session. You currently have no active sessions.";

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
