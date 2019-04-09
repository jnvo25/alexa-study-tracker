
// Function takes handler input and retrieves attributes
// Promise fulfills Attribute slots and returns Manager
// Function returns promise with manager that can be accessed with .then
function DataManager() {

  this.userData = {
    currentSubject: null,
    history: [],
    startTime: null,
    sessionActive: false
  };

}

DataManager.prototype.reset = function() {
  this.userData.currentSubject = null;
  this.userData.startTime = null;
  this.userData.sessionActive = false;
}

DataManager.prototype.initialize = async function (handlerinput) {
  var promise = await new Promise(function (resolve,reject) {
    console.log("Taking in handlerinput...");
    if (handlerinput) {
      resolve(handlerinput);
    } else {
      reject(("Something went wrong pulling up your info from the database. "));
    }
  }).then(handler => {  // Retreive data
      console.log("Getting data from database...");
      // Get or create attributes
      const data = handler.attributesManager.getPersistentAttributes() || {};
      return data;
  }).then(data => { // Check if there is session active
      console.log("Checking if session is active to set time...");
      // Check if session active
      if(data.startTime) {
          console.log("Found active session. Setting start time...");
          this.userData.startTime = data.startTime;
          this.userData.sessionActive = true;
      }
      return data;
    }).then(data => { // Check if subject is passed
      console.log("Check if user passed a subject...");
      if(data.currentSubject) {
        console.log("Subject found. Saving into DataManager...");
        this.userData.currentSubject = data.currentSubject;
      }
      console.log(this.userData.sessionActive);
      return data;
    }).then(data => { // Check if history not empty and return
      console.log("Checking if user has past sessions...");
      if(data.history) {
        console.log("Past sessions found. Adding to DataManager... ");
        this.userData.history = data.history;
      }
      return true;
    }).catch(err => {
      console.log("An error has occured in DataManagerObject: " + err);
      return false;
    });
  this.handlerinput = handlerinput;
  return promise;
}

// Writes to database starting session
DataManager.prototype.startSession = async function(startTime) {
  const sessionStatus = this.userData.sessionActive;
  var promise = await new Promise(function (resolve, reject) {
    console.log("Checking if session active...");
    if (!sessionStatus) {
      resolve(startTime);
    } else {
      reject(("There is a session active. "));
    }
  }).then(startTime => {
    console.log("Session is not active, setting attributes...");
    this.userData.startTime = startTime;
    this.userData.sessionActive = true;
    
    console.log("Saving into database...");
    this.handlerinput.attributesManager.setPersistentAttributes(this.userData);
    this.handlerinput.attributesManager.savePersistentAttributes();

    return true;
  }).catch(err => {
    console.log("An error has occured in start session function: " + err);
    return false;
  });
  return promise;
}

DataManager.prototype.setSubject = async function(subject) {
  const sessionStatus = this.userData.sessionActive;
  var promise = await new Promise(function (resolve, reject) {
    console.log("Checking if session active...");
    if (sessionStatus) {
      resolve(subject);
    } else {
      reject(("There is no session active. "));
    }
  }).then(subject => {
    console.log("Session is active, setting subject...");
    this.userData.currentSubject = subject;
  }).then(() => {

    console.log("Saving into database...");
    this.handlerinput.attributesManager.setPersistentAttributes(this.userData);
    this.handlerinput.attributesManager.savePersistentAttributes();

    return true;
  }).catch(err => {
    console.log("An error has occured in start session function: " + err);
    return false;
  });
  return promise;
}

DataManager.prototype.stopSession = async function(endTime) {
  // Calculate time studied
  console.log("Creating record item...");
  const studyTime = endTime - this.userData.startTime;
  
  if(!this.userData.currentSubject) {
    console.log("An error has occured in stop session function: No subject was given before stopping.");
    return false;
  }

  // Make record item
  const record = {
    studyTime: studyTime,
    date: endTime,
    subject: this.userData.currentSubject
  }

  const sessionStatus = this.userData.sessionActive;
  var promise = await new Promise(function (resolve, reject) {
    console.log("Checking if session active...");
    if (sessionStatus) {
      resolve();
    } else {
      reject(("There is no session active. "));
    }
  }).then(() => {
    // Attach data to userData history
    this.userData.history.push(record);

    this.reset();

  }).then(() => {

    console.log("Saving into database...");
    this.handlerinput.attributesManager.setPersistentAttributes(this.userData);
    this.handlerinput.attributesManager.savePersistentAttributes();

    return true;
  }).catch(err => {
    console.log("An error has occured in stop session function: " + err);
    return false;
  });
  return promise;
}

DataManager.prototype.isSessionActive = function() {
  return this.userData.sessionActive;
}

DataManager.prototype.hasSubject = function() {
  console.log(this.userData.currentSubject);
  if(this.userData.currentSubject) {
    return true;
  } else {
    return false;
  }
}

module.exports = DataManager;
