let isTimerRunning = false;
let isResting = false;
let restEndTime = null;
let countdownInterval = null;
let currentWorkDuration = 60;
let currentRestDuration = 5;

function initializeFromStorage() {
  chrome.storage.local.get(['workDuration', 'restDuration', 'isEnabled'], (result) => {
    if (result.workDuration && result.workDuration > 0) {
      currentWorkDuration = result.workDuration;
    }
    if (result.restDuration && result.restDuration >= 1 && result.restDuration <= 10) {
      currentRestDuration = result.restDuration;
    }
    console.log(`Initialized from storage: work=${currentWorkDuration}min, rest=${currentRestDuration}min`);
  });
}

initializeFromStorage();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isEnabled: false,
    workDuration: 60,
    restDuration: 5
  });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.workDuration && changes.workDuration.newValue > 0) {
      currentWorkDuration = changes.workDuration.newValue;
    }
    if (changes.restDuration && changes.restDuration.newValue >= 1 && changes.restDuration.newValue <= 10) {
      currentRestDuration = changes.restDuration.newValue;
    }
    
    if (changes.isEnabled) {
      if (changes.isEnabled.newValue) {
        chrome.storage.local.get(['workDuration', 'restDuration'], (settings) => {
          if (settings.workDuration && settings.restDuration && settings.workDuration > 0) {
            startTimer(settings.workDuration, settings.restDuration);
          }
        });
      } else {
        stopTimer();
      }
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startTimer':
      startTimer(request.workDuration, request.restDuration);
      sendResponse({ status: 'started' });
      break;
    case 'stopTimer':
      stopTimer();
      sendResponse({ status: 'stopped' });
      break;
    case 'getState':
      sendResponse({
        isTimerRunning,
        isResting,
        restEndTime
      });
      break;
    case 'getRestInfo':
      sendResponse({
        isResting,
        restEndTime,
        restDuration: request.restDuration || currentRestDuration
      });
      break;
    case 'testRest':
      testRestPeriod(request.restDuration);
      sendResponse({ status: 'testing' });
      break;
    default:
      sendResponse({ status: 'unknown action' });
  }
  return true;
});

function startTimer(workDuration, restDuration) {
  if (isTimerRunning) {
    stopTimer();
  }

  isTimerRunning = true;
  currentWorkDuration = workDuration;
  currentRestDuration = restDuration;
  
  chrome.alarms.create('workTimer', {
    delayInMinutes: workDuration,
    periodInMinutes: workDuration
  });

  console.log(`Timer started: work for ${workDuration} minutes, rest for ${restDuration} minutes`);
}

function stopTimer() {
  isTimerRunning = false;
  isResting = false;
  restEndTime = null;
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  chrome.alarms.clear('workTimer');
  chrome.alarms.clear('restTimer');
  
  notifyAllTabs({ action: 'hideOverlay' });
  
  console.log('Timer stopped');
}

function testRestPeriod(restDuration) {
  console.log(`Starting test rest period for ${restDuration} minutes`);
  
  isResting = true;
  restEndTime = Date.now() + (restDuration * 60 * 1000);
  currentRestDuration = restDuration;
  
  startCountdown();
  
  notifyAllTabs({
    action: 'showOverlay',
    restEndTime: restEndTime,
    restDuration: restDuration
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'workTimer') {
    startRestPeriod();
  } else if (alarm.name === 'restTimer') {
    endRestPeriod();
  }
});

function startRestPeriod() {
  isResting = true;
  restEndTime = Date.now() + (currentRestDuration * 60 * 1000);
  
  chrome.alarms.create('restTimer', {
    delayInMinutes: currentRestDuration
  });
  
  startCountdown();
  
  notifyAllTabs({
    action: 'showOverlay',
    restEndTime: restEndTime,
    restDuration: currentRestDuration
  });
  
  console.log(`Rest period started for ${currentRestDuration} minutes`);
}

function endRestPeriod() {
  isResting = false;
  restEndTime = null;
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  notifyAllTabs({ action: 'hideOverlay' });
  
  console.log('Rest period ended, starting next work cycle');
  
  if (isTimerRunning && currentWorkDuration > 0) {
    chrome.alarms.create('workTimer', {
      delayInMinutes: currentWorkDuration,
      periodInMinutes: currentWorkDuration
    });
    console.log(`Next work cycle started: ${currentWorkDuration} minutes`);
  }
}

function startCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  countdownInterval = setInterval(() => {
    if (!isResting || !restEndTime) {
      clearInterval(countdownInterval);
      return;
    }
    
    const remainingTime = restEndTime - Date.now();
    
    if (remainingTime <= 0) {
      endRestPeriod();
      return;
    }
    
    notifyAllTabs({
      action: 'updateCountdown',
      remainingTime: remainingTime
    });
  }, 1000);
}

function notifyAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, message).catch((err) => {
        // Some tabs might not have content script injected, ignore errors
      });
    });
  });
}

chrome.tabs.onCreated.addListener((tab) => {
  if (isResting && restEndTime) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showOverlay',
      restEndTime: restEndTime
    }).catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isResting && restEndTime) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showOverlay',
      restEndTime: restEndTime
    }).catch(() => {});
  }
});