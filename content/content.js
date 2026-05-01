let overlayElement = null;
let countdownInterval = null;
let countdownRAFId = null;
let restEndTime = null;
let walkingCats = [];
let catAnimationId = null;
let sleepZoneElement = null;

const DEFAULT_CAT_IMAGE = 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif';
const CAT_GIFS = [
  'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif',
  'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
  'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif',
  'https://media.giphy.com/media/3o7TKqnN334sKq8MFO/giphy.gif'
];

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

function createWalkingCat(index) {
  const cat = document.createElement('div');
  cat.className = 'walking-cat';
  cat.id = `walking-cat-${index}`;
  
  const img = document.createElement('img');
  img.src = CAT_GIFS[index % CAT_GIFS.length];
  img.alt = 'Walking Cat';
  cat.appendChild(img);
  
  document.body.appendChild(cat);
  
  return {
    element: cat,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    speed: 1 + Math.random() * 2,
    direction: 1,
    isMoving: true,
    pauseTime: 0,
    pauseDuration: 0
  };
}

function initWalkingCats() {
  const numCats = 3 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < numCats; i++) {
    const cat = createWalkingCat(i);
    resetCatPosition(cat, true);
    walkingCats.push(cat);
  }
}

function resetCatPosition(cat, randomSide = false) {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  if (randomSide) {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:
        cat.x = -100;
        cat.y = Math.random() * (screenHeight - 100);
        cat.direction = 1;
        cat.targetX = screenWidth + 100;
        cat.targetY = cat.y + (Math.random() - 0.5) * 200;
        break;
      case 1:
        cat.x = screenWidth + 100;
        cat.y = Math.random() * (screenHeight - 100);
        cat.direction = -1;
        cat.targetX = -100;
        cat.targetY = cat.y + (Math.random() - 0.5) * 200;
        break;
      case 2:
        cat.x = Math.random() * (screenWidth - 100);
        cat.y = -100;
        cat.direction = Math.random() > 0.5 ? 1 : -1;
        cat.targetX = cat.x + (Math.random() - 0.5) * 200;
        cat.targetY = screenHeight + 100;
        break;
      case 3:
        cat.x = Math.random() * (screenWidth - 100);
        cat.y = screenHeight + 100;
        cat.direction = Math.random() > 0.5 ? 1 : -1;
        cat.targetX = cat.x + (Math.random() - 0.5) * 200;
        cat.targetY = -100;
        break;
    }
  }
  
  updateCatPosition(cat);
}

function updateCatPosition(cat) {
  cat.element.style.left = `${cat.x}px`;
  cat.element.style.top = `${cat.y}px`;
  
  if (cat.direction < 0) {
    cat.element.classList.add('flipped');
  } else {
    cat.element.classList.remove('flipped');
  }
}

function animateCats() {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  walkingCats.forEach(cat => {
    if (cat.pauseTime > 0) {
      cat.pauseTime -= 16;
      return;
    }
    
    if (Math.random() < 0.005) {
      cat.pauseTime = Math.random() * 2000 + 500;
      return;
    }
    
    if (Math.random() < 0.01) {
      cat.direction *= -1;
    }
    
    const dx = cat.targetX - cat.x;
    const dy = cat.targetY - cat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < cat.speed * 2) {
      resetCatPosition(cat, true);
      return;
    }
    
    const vx = (dx / distance) * cat.speed;
    const vy = (dy / distance) * cat.speed;
    
    cat.x += vx;
    cat.y += vy;
    
    if (vx > 0.5) {
      cat.direction = 1;
    } else if (vx < -0.5) {
      cat.direction = -1;
    }
    
    updateCatPosition(cat);
    
    if (Math.random() < 0.02) {
      createCatParticle(cat.x + 40, cat.y + 40);
    }
  });
  
  catAnimationId = requestAnimationFrame(animateCats);
}

function createCatParticle(x, y) {
  const particle = document.createElement('div');
  particle.className = 'cat-particle';
  
  const colors = ['#FFD700', '#FFA500', '#FF69B4', '#87CEEB', '#98FB98'];
  particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
  particle.style.left = `${x + (Math.random() - 0.5) * 30}px`;
  particle.style.top = `${y}px`;
  
  document.body.appendChild(particle);
  
  setTimeout(() => {
    particle.remove();
  }, 2000);
}

function createSleepZone() {
  sleepZoneElement = document.createElement('div');
  sleepZoneElement.className = 'cat-sleep-zone';
  
  const numSleepingCats = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numSleepingCats; i++) {
    const sleepingCat = document.createElement('div');
    sleepingCat.className = 'sleeping-cat';
    sleepingCat.style.animationDelay = `${i * 0.5}s`;
    
    const img = document.createElement('img');
    img.src = CAT_GIFS[i % CAT_GIFS.length];
    img.alt = 'Sleeping Cat';
    img.style.width = '60px';
    img.style.height = '60px';
    
    const zzz = document.createElement('span');
    zzz.className = 'zzz';
    zzz.textContent = 'Z';
    zzz.style.animationDelay = `${i * 0.3}s`;
    
    sleepingCat.appendChild(img);
    sleepingCat.appendChild(zzz);
    sleepZoneElement.appendChild(sleepingCat);
  }
  
  document.body.appendChild(sleepZoneElement);
}

function stopCatAnimations() {
  if (catAnimationId) {
    cancelAnimationFrame(catAnimationId);
    catAnimationId = null;
  }
  
  walkingCats.forEach(cat => {
    if (cat.element && cat.element.parentNode) {
      cat.element.remove();
    }
  });
  walkingCats = [];
  
  if (sleepZoneElement) {
    sleepZoneElement.remove();
    sleepZoneElement = null;
  }
}

function updateCountdownRAF() {
  if (!restEndTime) {
    return;
  }

  const remainingTime = restEndTime - Date.now();
  
  if (remainingTime <= 0) {
    hideOverlay();
    return;
  }

  countdownRAFId = requestAnimationFrame(updateCountdownRAF);
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

  initWalkingCats();
  createSleepZone();
  animateCats();

  updateCountdown();
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  if (countdownRAFId) {
    cancelAnimationFrame(countdownRAFId);
  }
  
  countdownInterval = setInterval(() => {
    updateCountdown();
  }, 1000);

  countdownRAFId = requestAnimationFrame(updateCountdownRAF);

  overlayElement.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideOverlay() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  if (countdownRAFId) {
    cancelAnimationFrame(countdownRAFId);
    countdownRAFId = null;
  }
  
  restEndTime = null;
  
  if (overlayElement) {
    overlayElement.classList.add('hidden');
    document.body.style.overflow = '';
  }
  
  const overlayById = document.getElementById('cat-gatekeeper-overlay');
  if (overlayById) {
    overlayById.classList.add('hidden');
  }
  
  try {
    stopCatAnimations();
  } catch (e) {
    console.error('Error stopping cat animations:', e);
  }
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

  const totalSeconds = Math.max(1, Math.ceil(remainingTime / 1000));
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

  const totalSeconds = Math.max(1, Math.ceil(remainingTime / 1000));
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