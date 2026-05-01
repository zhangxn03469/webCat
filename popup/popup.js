document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const toggleLabel = document.getElementById('toggleLabel');
  const settingsContainer = document.getElementById('settingsContainer');
  const workDuration = document.getElementById('workDuration');
  const restDuration = document.getElementById('restDuration');
  const customImage = document.getElementById('customImage');
  const imageUploadArea = document.getElementById('imageUploadArea');
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const removeImage = document.getElementById('removeImage');
  const saveSettings = document.getElementById('saveSettings');
  const testRest = document.getElementById('testRest');
  const currentStatus = document.getElementById('currentStatus');

  let currentImageData = null;
  let messageElement = null;

  loadSettings();

  extensionToggle.addEventListener('change', () => {
    const isEnabled = extensionToggle.checked;
    toggleLabel.textContent = isEnabled ? '已开启' : '已关闭';
    settingsContainer.style.display = isEnabled ? 'flex' : 'none';
    
    chrome.storage.local.set({ isEnabled }, () => {
      if (isEnabled) {
        chrome.storage.local.get(['workDuration', 'restDuration'], (settings) => {
          if (settings.workDuration && settings.restDuration && settings.workDuration > 0) {
            chrome.runtime.sendMessage({
              action: 'startTimer',
              workDuration: settings.workDuration,
              restDuration: settings.restDuration
            });
          }
        });
      } else {
        chrome.runtime.sendMessage({ action: 'stopTimer' });
      }
    });
  });

  workDuration.addEventListener('input', () => {
    const value = parseInt(workDuration.value, 10);
    if (!isNaN(value) && value >= 1) {
      clearMessage();
    }
  });

  restDuration.addEventListener('input', () => {
    const value = parseInt(restDuration.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 10) {
      clearMessage();
    }
  });

  function loadSettings() {
    chrome.storage.local.get(['isEnabled', 'workDuration', 'restDuration', 'customImage'], (result) => {
      const isEnabled = result.isEnabled || false;
      extensionToggle.checked = isEnabled;
      toggleLabel.textContent = isEnabled ? '已开启' : '已关闭';
      settingsContainer.style.display = isEnabled ? 'flex' : 'none';

      if (result.workDuration && result.workDuration > 0) {
        workDuration.value = result.workDuration;
      } else {
        workDuration.value = 60;
      }

      if (result.restDuration && result.restDuration >= 1 && result.restDuration <= 10) {
        restDuration.value = result.restDuration;
      } else {
        restDuration.value = 5;
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

    if (!settings.workDuration || !settings.restDuration || settings.workDuration < 1) {
      currentStatus.textContent = '当前状态：请保存设置以启用休息提醒';
      return;
    }

    currentStatus.textContent = `当前状态：工作 ${settings.workDuration} 分钟，休息 ${settings.restDuration} 分钟`;
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
    const workMin = parseInt(workDuration.value, 10);
    const restMin = parseInt(restDuration.value, 10);
    
    if (isNaN(workMin) || workMin < 1) {
      showMessage('工作时长必须大于0分钟');
      return;
    }

    if (isNaN(restMin) || restMin < 1 || restMin > 10) {
      showMessage('休息时长必须在1-10分钟之间');
      return;
    }

    const settings = {
      isEnabled: true,
      workDuration: workMin,
      restDuration: restMin
    };

    if (currentImageData) {
      settings.customImage = currentImageData;
    }

    chrome.storage.local.remove('customImage', () => {
      chrome.storage.local.set(settings, () => {
        showMessage('设置已保存');
        updateStatusDisplay(settings);
        
        chrome.runtime.sendMessage({
          action: 'startTimer',
          workDuration: workMin,
          restDuration: restMin
        });
      });
    });
  });

  testRest.addEventListener('click', () => {
    const restMin = parseInt(restDuration.value, 10);
    const validRestMin = (isNaN(restMin) || restMin < 1 || restMin > 10) ? 1 : restMin;
    const endTime = Date.now() + (validRestMin * 60 * 1000);
    
    showMessage('正在显示休息遮罩...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showOverlay',
          restEndTime: endTime,
          restDuration: validRestMin
        }).catch((err) => {
          console.error('Failed to send message to tab:', err);
          showMessage('遮罩层发送失败，请刷新页面后重试');
        });
      }
    });
    
    chrome.runtime.sendMessage({
      action: 'testRest',
      restDuration: validRestMin
    }).catch((err) => {
      console.error('Failed to send message to background:', err);
    });
  });

  function showMessage(text) {
    clearMessage();
    
    messageElement = document.createElement('div');
    messageElement.className = 'save-success';
    messageElement.textContent = text;
    document.body.appendChild(messageElement);
  }

  function clearMessage() {
    if (messageElement && messageElement.parentNode) {
      messageElement.remove();
      messageElement = null;
    }
  }
});