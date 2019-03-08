
const DataManager = {
    currentSubject: null,
    history: null,
    startTime: null,
    sessionActive: false
}

// Function takes handler input and retrieves attributes
// Promise fulfills Attribute slots and returns Manager
// Function returns promise with manager that can be accessed with .then
async function getManagerPromise(handlerinput) {
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
            DataManager.startTime = data.startTime;
            DataManager.sessionActive = true;
        }
        return data;
      }).then(data => { // Check if subject is passed
        console.log("Check if user passed a subject...");
        if(data.currentSubject) {
          console.log("Subject found. Saving into DataManager...");
          DataManager.currentSubject = data.currentSubject;
        }
        console.log(DataManager.sessionActive);
        return data;
      }).then(data => { // Check if history not empty and return
        console.log("Checking if user has past sessions...");
        if(data.history) {
          console.log("Passed sessions found. Adding to DataManager... ");
          DataManager.history = data.history;
        }
        console.log(DataManager);
        return DataManager;
    });
    return promise;
}

module.exports = getManagerPromise;
