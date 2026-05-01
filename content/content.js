let overlayElement = null;
let countdownInterval = null;
let restEndTime = null;

const DEFAULT_CAT_IMAGE = 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif';

function createOverlay() {
  if (overlayElement) {
    return overlayElement;
  }

  overlayElement = document.createElement('div');
  overlayElement.id = 'cat-gatekeeper-overlay';
  overlayElement.className = 'hidden';
  overlayElement.innerHTML = `
    <div class="overlay-content">
      <h1 class="title">该休息一下了 💕</h1>
      <p class="subtitle">让眼睛和大脑放松片刻吧</p>
      <div class="image-container">
        <img id="cat-gatekeeper-image" src="" alt="休息时间">
      </div>
      <div class="countdown-container">
        <p class="countdown-label">休息倒计时</p>
        <div class="countdown-time" id="cat-gatekeeper-countdown">00:00</div>
      </div>
      <div class="tips">
        <p>👀 看向远处，让眼睛得到放松</p>
        <p>🧘 站起来活动一下身体</p>
        <p>💧 喝杯水，保持身体水分</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlayElement);
  return overlayElement;
}

function getCustomImage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['customImage'], (result) => {
      resolve(result.customImage || null);
    });
  });
}

async function showOverlay(endTime) {
  createOverlay();
  restEndTime = endTime;

  const customImage = await getCustomImage();
  const imageElement = document.getElementById('cat-gatekeeper-image');
  
  if (customImage) {
    imageElement.src = customImage;
  } else {
    imageElement.src = DEFAULT_CAT_IMAGE;
  }

  updateCountdown();
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  countdownInterval = setInterval(() => {
    updateCountdown();
  }, 1000);

  overlayElement.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideOverlay() {
  if (overlayElement) {
    overlayElement.classList.add('hidden');
    document.body.style.overflow = '';
  }
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  restEndTime = null;
}

function updateCountdown() {
  if (!restEndTime) {
    return;
  }

  const remainingTime = restEndTime - Date.now();
  
  if (remainingTime <= 0) {
    hideOverlay();
    return;
  }

  const totalSeconds = Math.ceil(remainingTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const countdownElement = document.getElementById('cat-gatekeeper-countdown');
  if (countdownElement) {
    countdownElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

function updateCountdownFromTime(remainingTime) {
  if (remainingTime <= 0) {
    hideOverlay();
    return;
  }

  const totalSeconds = Math.ceil(remainingTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const countdownElement = document.getElementById('cat-gatekeeper-countdown');
  if (countdownElement) {
    countdownElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'showOverlay':
      showOverlay(request.restEndTime);
      sendResponse({ status: 'shown' });
      break;
    case 'hideOverlay':
      hideOverlay();
      sendResponse({ status: 'hidden' });
      break;
    case 'updateCountdown':
      updateCountdownFromTime(request.remainingTime);
      sendResponse({ status: 'updated' });
      break;
    default:
      sendResponse({ status: 'unknown action' });
  }
  return true;
});

window.addEventListener('load', () => {
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response && response.isResting && response.restEndTime) {
      showOverlay(response.restEndTime);
    }
  });
});