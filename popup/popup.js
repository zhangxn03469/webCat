document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const toggleLabel = document.getElementById('toggleLabel');
  const settingsContainer = document.getElementById('settingsContainer');
  const intervalMinutes = document.getElementById('intervalMinutes');
  const restDuration = document.getElementById('restDuration');
  const customImage = document.getElementById('customImage');
  const imageUploadArea = document.getElementById('imageUploadArea');
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const removeImage = document.getElementById('removeImage');
  const saveSettings = document.getElementById('saveSettings');
  const currentStatus = document.getElementById('currentStatus');

  let currentImageData = null;

  loadSettings();

  extensionToggle.addEventListener('change', () => {
    const isEnabled = extensionToggle.checked;
    toggleLabel.textContent = isEnabled ? '已开启' : '已关闭';
    settingsContainer.style.display = isEnabled ? 'flex' : 'none';
    
    chrome.storage.local.set({ isEnabled }, () => {
      updateBackgroundWorker(isEnabled);
    });
  });

  function loadSettings() {
    chrome.storage.local.get(['isEnabled', 'intervalMinutes', 'restDuration', 'customImage'], (result) => {
      const isEnabled = result.isEnabled || false;
      extensionToggle.checked = isEnabled;
      toggleLabel.textContent = isEnabled ? '已开启' : '已关闭';
      settingsContainer.style.display = isEnabled ? 'flex' : 'none';

      if (result.intervalMinutes) {
        intervalMinutes.value = result.intervalMinutes;
      }

      if (result.restDuration) {
        restDuration.value = result.restDuration;
      }

      if (result.customImage) {
        currentImageData = result.customImage;
        showImagePreview(result.customImage);
      }

      updateStatusDisplay(result);
    });
  }

  function updateStatusDisplay(settings) {
    if (!settings.isEnabled) {
      currentStatus.textContent = '当前状态：插件已关闭';
      return;
    }

    if (!settings.intervalMinutes || !settings.restDuration) {
      currentStatus.textContent = '当前状态：请保存设置以启用休息提醒';
      return;
    }

    currentStatus.textContent = `当前状态：每${settings.intervalMinutes}分钟休息 ${settings.restDuration} 分钟`;
  }

  function updateBackgroundWorker(isEnabled) {
    if (isEnabled) {
      chrome.storage.local.get(['intervalMinutes', 'restDuration'], (settings) => {
        if (settings.intervalMinutes && settings.restDuration) {
          chrome.runtime.sendMessage({
            action: 'startTimer',
            intervalMinutes: settings.intervalMinutes,
            restDuration: settings.restDuration
          });
        }
      });
    } else {
      chrome.runtime.sendMessage({ action: 'stopTimer' });
    }
  }

  customImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('图片大小不能超过5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        currentImageData = event.target.result;
        showImagePreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  function showImagePreview(imageData) {
    previewImg.src = imageData;
    imagePreview.style.display = 'block';
    imageUploadArea.querySelector('.upload-placeholder').style.display = 'none';
  }

  function hideImagePreview() {
    currentImageData = null;
    customImage.value = '';
    imagePreview.style.display = 'none';
    imageUploadArea.querySelector('.upload-placeholder').style.display = 'block';
  }

  removeImage.addEventListener('click', (e) => {
    e.stopPropagation();
    hideImagePreview();
  });

  imageUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadArea.classList.add('dragover');
  });

  imageUploadArea.addEventListener('dragleave', () => {
    imageUploadArea.classList.remove('dragover');
  });

  imageUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        showMessage('只支持 JPG、PNG、GIF 格式');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showMessage('图片大小不能超过5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        currentImageData = event.target.result;
        showImagePreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  saveSettings.addEventListener('click', () => {
    const interval = parseInt(intervalMinutes.value, 10);
    const duration = parseInt(restDuration.value, 10);
    
    if (isNaN(interval) || interval < 1) {
      showMessage('工作时长必须大于0分钟');
      return;
    }
    
    if (isNaN(duration) || duration < 1 || duration > 10) {
      showMessage('休息时长必须在1-10分钟之间');
      return;
    }

    const settings = {
      isEnabled: true,
      intervalMinutes: interval,
      restDuration: duration
    };

    if (currentImageData) {
      settings.customImage = currentImageData;
    } else {
      chrome.storage.local.remove('customImage');
    }

    chrome.storage.local.set(settings, () => {
      showMessage('设置已保存');
      updateStatusDisplay(settings);
      
      chrome.runtime.sendMessage({
        action: 'startTimer',
        intervalMinutes: interval,
        restDuration: duration
      });
    });
  });

  function showMessage(text) {
    const message = document.createElement('div');
    message.className = 'save-success';
    message.textContent = text;
    document.body.appendChild(message);
    
    setTimeout(() => {
      message.remove();
    }, 2000);
  }
});