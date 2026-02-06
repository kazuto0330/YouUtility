const DEFAULT_SETTINGS = {
  isPinned: true,
  position: 'top-right',
  size: 500,
  theme: 'system'
};

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const pinToggle = document.getElementById('pin-toggle');
  const themeSelect = document.getElementById('theme-select');
  const sizeInput = document.getElementById('size-input');
  const sizeSlider = document.getElementById('size-slider');
  const posBtns = document.querySelectorAll('.pos-btn');

  // Load Settings
  chrome.storage.local.get(['isPinned', 'position', 'size', 'theme'], (result) => {
    const settings = { ...DEFAULT_SETTINGS, ...result };
    
    // Apply to UI
    pinToggle.checked = settings.isPinned;
    themeSelect.value = settings.theme;
    sizeInput.value = settings.size;
    sizeSlider.value = settings.size;
    updatePositionUI(settings.position);
    
    // Apply Theme immediately
    applyTheme(settings.theme);
  });

  // Event Listeners
  pinToggle.addEventListener('change', () => saveAndSync({ isPinned: pinToggle.checked }));
  
  themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value;
    applyTheme(theme);
    saveAndSync({ theme });
  });

  // Sync Input and Slider
  sizeInput.addEventListener('change', () => {
    const val = parseInt(sizeInput.value);
    sizeSlider.value = val;
    saveAndSync({ size: val });
  });

  sizeSlider.addEventListener('input', () => {
    const val = parseInt(sizeSlider.value);
    sizeInput.value = val;
    saveAndSync({ size: val }); // Real-time preview could be nice, but might spam
  });

  posBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const position = btn.dataset.pos;
      updatePositionUI(position);
      saveAndSync({ position });
    });
  });

  function updatePositionUI(position) {
    posBtns.forEach(btn => {
      if (btn.dataset.pos === position) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function applyTheme(theme) {
    const body = document.body;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      body.setAttribute('data-theme', theme);
    }
  }

  function saveAndSync(data) {
    chrome.storage.local.set(data);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes("youtube.com")) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: data
        });
      }
    });
  }
});
