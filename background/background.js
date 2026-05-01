let isTimerRunning = false;
let isResting = false;
let restEndTime = null;
let countdownInterval = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isEnabled: false,
    intervalType: 'hourly',
    restDuration: 5
  });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.isEnabled) {
    if (changes.isEnabled.newValue) {
      chrome.storage.local.get(['intervalType', 'restDuration'], (settings) => {
        if (settings.intervalType && settings.restDuration) {
          startTimer(settings.intervalType, settings.restDuration);
        }
      });
    } else {
      stopTimer();
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startTimer':
      startTimer(request.intervalType, request.restDuration);
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
        restDuration: request.restDuration || 5
      });
      break;
    default:
      sendResponse({ status: 'unknown action' });
  }
  return true;
});

function startTimer(intervalType, restDuration) {
  if (isTimerRunning) {
    stopTimer();
  }

  isTimerRunning = true;
  
  const intervalMinutes = intervalType === 'hourly' ? 60 : 30;
  
  chrome.alarms.create('workTimer', {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes
  });

  console.log(`Timer started: ${intervalType} interval, ${restDuration} minute rest`);
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'workTimer') {
    startRestPeriod();
  } else if (alarm.name === 'restTimer') {
    endRestPeriod();
  }
});

function startRestPeriod() {
  chrome.storage.local.get(['restDuration'], (settings) => {
    const restMinutes = settings.restDuration || 5;
    
    isResting = true;
    restEndTime = Date.now() + (restMinutes * 60 * 1000);
    
    chrome.alarms.create('restTimer', {
      delayInMinutes: restMinutes
    });
    
    startCountdown();
    
    notifyAllTabs({
      action: 'showOverlay',
      restEndTime: restEndTime,
      restDuration: restMinutes
    });
    
    console.log(`Rest period started for ${restMinutes} minutes`);
  });
}

function endRestPeriod() {
  isResting = false;
  restEndTime = null;
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  notifyAllTabs({ action: 'hideOverlay' });
  
  console.log('Rest period ended');
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