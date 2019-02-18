/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'Welcome to My Studies, lets get to studying!';

    return handlerInput.responseBuilder
      .speak(speechText)
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
    const moment = require('moment');
    const start = moment().format("X");

    // Get or create attributes
    const attributesManager = handlerInput.attributesManager;
    const attributes = await attributesManager.getPersistentAttributes() || {};
    
    // Check and deny if start time already exists
    var speechText;
    if(attributes.startTime) {
      speechText = "There is already a session active.";
      // TODO:: DO YOU WANT TO CANCEL IT?
    } else {
      // Check if user provided session subject
      attributes.currentSubject = handlerInput.requestEnvelope.request.intent.slots.subject.value || null;
      // Write to file
      attributes.startTime = start;
      attributesManager.setPersistentAttributes(attributes);
      await attributesManager.savePersistentAttributes();
      if(attributes.currentSubject != null) {
        speechText = `Okay, study session for ${attributes.currentSubject}, starting now`;
      } else {
        speechText = `Okay, starting your study session, now`;
      }
    }
    // TODO:: GET TIMEZONE FOR ~ const speechText = `Session start recorded at ${moment().format("h:mm:ss a")}`;

    return handlerInput.responseBuilder
      .speak(speechText)
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
      const speechText = "You have no active sessions."
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('My Studies', speechText)
        .getResponse();
    }

    // Check confirmation
    if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'NONE') {
      return handlerInput.responseBuilder
        .speak("Are you sure you want to end your current session?")
        .reprompt("Are you sure?")
        .addConfirmIntentDirective()
        .getResponse();
    } else if(handlerInput.requestEnvelope.request.intent.confirmationStatus === 'DENIED') {
      const speechText = "Request cancelled, your study session is still active.";
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('My Studies', speechText)
        .getResponse();
    }

    // Retrieve UNIX
    const moment = require('moment');
    const stop = moment().format("X");

    // Check if session subject exists and prompt
    if(attributes.currentSubject == null && handlerInput.requestEnvelope.request.dialogState === 'IN_PROGRESS') {
      return handlerInput.responseBuilder
        .addDelegateDirective(handlerInput.requestEnvelope.request.intent)
        .getResponse();
    }
    attributes.currentSubject = attributes.currentSubject || handlerInput.requestEnvelope.request.intent.slots.subject.value;
    
    // Calculate time studied
    const studyTime = stop - attributes.startTime;

    // Create history array in attributes if nonexistent
    attributes.history = attributes.history || [];
    // Check if current subject has been studied before and create if new
    var index = attributes.history.findIndex(x => x.subjectName == attributes.currentSubject);
    if(index == -1) {
      // Subject record to hold time
      const record = {
        subjectName: attributes.currentSubject,
        totalTime: 0
      }
      attributes.history.push(record);
      index = attributes.history.length-1;
    }
    // Attach time
    attributes.history[index].totalTime += studyTime; 

    // Create speech text
    const speechText = `Okay, stopping your current study session. You have been studying ${attributes.currentSubject} for ${(studyTime>60) ? Math.floor(studyTime/60) + " minutes" : studyTime + " seconds"}.`;

    // Reset current statistics
    attributes.startTime = null;
    attributes.currentSubject = null;

    // Save attributes
    attributesManager.setPersistentAttributes(attributes);
    await attributesManager.savePersistentAttributes();
    
    return handlerInput.responseBuilder
      .speak(speechText)
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
            .speak(speechText)
            .withSimpleCard('My Studies', speechText)
            .getResponse();
    }

    var speechText = "";
    if(handlerInput.requestEnvelope.request.intent.slots.subject.value) {
        var index = attributes.history.findIndex(x => x.subjectName == handlerInput.requestEnvelope.request.intent.slots.subject.value); // TODO:: variablize handler value
        if(index == -1) {
            speechText += `You haven't studied ${handlerInput.requestEnvelope.request.intent.slots.subject.value} yet.`;
        } else {
            const record = attributes.history[index];
            speechText += `You studied ${record.subjectName} for ${(record.totalTime>60) ? Math.floor(record.totalTime/60) + " minutes" : record.totalTime + " seconds"}.`;
        }
    } else {
        speechText += "You have studied "
        for(var i=0; i<attributes.history.length; i++) {
          const record = attributes.history[i];  
          if(i == attributes.history.length-2) {
              speechText += `${record.subjectName} for ${(record.totalTime>60) ? Math.floor(record.totalTime/60) + " minutes" : record.totalTime + " seconds"}, and `; // TODO:: combine with 184 in ternary operator
          } else {
              speechText += `${record.subjectName} for ${(record.totalTime>60) ? Math.floor(record.totalTime/60) + " minutes" : record.totalTime + " seconds"}, `;
          }
        }
    }
  
    return handlerInput.responseBuilder
      .speak(speechText)
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
    const speechText = 'You can say hello to me!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hello World', speechText)
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
    const speechText = 'Goodbye!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hello World', speechText)
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
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
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
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withTableName('my-studies-data')
  .withAutoCreateTable(true)
  .lambda();
