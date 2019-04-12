
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

DataManager.prototype.getRecords = async function(subject, period, currentTime) {
  var promise = await new Promise(function (resolve, reject) {
    console.log("Checking if session active...");
    if (currentTime) {
      resolve();
    } else {
      reject(("No time was passed. "));
    }
  }).then(() => {
    var result = 0;
    console.log("Iterating through history...");
    for(var i=0; i<this.userData.history.length; i++) {
      var current = this.userData.history[i];
      // Get desired subject
      console.log("Checking if subject matches...");
      if(!subject || subject == current.subject) {
        // Get desired period
        console.log("Iterating record history...");
        for(var j=0; j<current.recordHistory.length; j++) {
          console.log("Checking if within period...");
          if(!period || currentTime - current.recordHistory[j].date <= period) {
            console.log("Adding to total...");
            result += current.recordHistory[j].studyTime;
          }
        }
      }
    }
    return result;
  }).catch(err => {
    console.log("An error has occured in stop session function: " + err);
    return -9000;
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
  const sessionRecord = {
    studyTime: studyTime,
    date: endTime,
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
    // Check if record exists
    var subjectIndex = -1;
    console.log("Looking through history for records...");
    for(var i=0; i < this.userData.history.length; i++) {
      if(this.userData.history[i].subject == this.userData.currentSubject) {
        subjectIndex = i;
        break;
      }
    }
  
    // If record doesnt exist create new otherwise append    
    if(subjectIndex < 0) {
      console.log("Creating new record...");
      const record = {
        subject: this.userData.currentSubject,
        recordHistory: [sessionRecord],
        total: studyTime
      }
      this.userData.history.push(record);
    } else {
      console.log("Adding to existing record...");
      this.userData.history[subjectIndex].recordHistory.push(sessionRecord);
      this.userData.history[subjectIndex].total += studyTime;
    }

    // Reset session details
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
