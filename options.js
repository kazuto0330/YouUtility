const DEFAULT_SETTINGS = {
  isPinned: true,
  position: 'top-right',
  size: 500,
  theme: 'system',
  pinMode: 'corner',
  freePosition: { top: 100, left: 100 }
};

const TRANSLATIONS = {
  en: {
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    themeSystem: 'System Default',
    themeLight: 'Light',
    themeDark: 'Dark',
    playerAppearance: 'Mini Video Player',
    position: 'Position',
    size: 'Size (Width in px)',
    pinMode: 'Pin Mode',
    modeCorner: 'Corner',
    modeFree: 'Free Position',
    currentPosition: 'Current Position'
  },
  ja: {
    general: '一般',
    language: '言語',
    theme: 'テーマ',
    themeSystem: 'システム設定',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    playerAppearance: 'ミニ動画プレイヤー',
    position: '位置',
    size: 'サイズ (幅 px)',
    pinMode: '固定モード',
    modeCorner: '端に固定',
    modeFree: '自由な位置',
    currentPosition: '現在の座標'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const pinToggle = document.getElementById('pin-toggle');
  const langSelect = document.getElementById('lang-select');
  const themeSelect = document.getElementById('theme-select');
  const sizeInput = document.getElementById('size-input');
  const sizeSlider = document.getElementById('size-slider');
  const posBtns = document.querySelectorAll('.pos-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const positionSetting = document.getElementById('position-setting');
  const positionGrid = document.getElementById('position-grid');
  const freeCoordsDisplay = document.getElementById('free-coords-display');
  const coordX = document.getElementById('coord-x');
  const coordY = document.getElementById('coord-y');

  // Load Settings
  chrome.storage.local.get(['isPinned', 'position', 'size', 'theme', 'lang', 'pinMode', 'freePosition'], (result) => {
    // Determine Language
    let lang = result.lang;
    if (!lang) {
      const browserLang = navigator.language || navigator.userLanguage; 
      lang = browserLang.startsWith('ja') ? 'ja' : 'en';
    }

    const settings = { ...DEFAULT_SETTINGS, lang, ...result };
    // Ensure we save the detected lang if it wasn't there
    if (!result.lang) {
        chrome.storage.local.set({ lang });
    }
    
    // Apply to UI
    pinToggle.checked = settings.isPinned;
    langSelect.value = settings.lang;
    themeSelect.value = settings.theme;
    sizeInput.value = settings.size;
    sizeSlider.value = settings.size;
    updatePositionUI(settings.position);
    updateModeUI(settings.pinMode, settings.freePosition);
    
    // Apply Theme & Lang immediately
    applyTheme(settings.theme);
    applyLanguage(settings.lang);
  });

  // Event Listeners
  pinToggle.addEventListener('change', () => saveAndSync({ isPinned: pinToggle.checked }));
  
  langSelect.addEventListener('change', () => {
    const lang = langSelect.value;
    applyLanguage(lang);
    saveAndSync({ lang });
  });

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
    saveAndSync({ size: val }); // Real-time preview
  });

  posBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const position = btn.dataset.pos;
      updatePositionUI(position);
      saveAndSync({ position });
    });
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      // When switching, get latest freePosition if available
      chrome.storage.local.get(['freePosition'], (res) => {
          const fp = res.freePosition || DEFAULT_SETTINGS.freePosition;
          updateModeUI(mode, fp);
          saveAndSync({ pinMode: mode });
      });
    });
  });

  function updatePositionUI(position) {
    posBtns.forEach(btn => {
      if (btn.dataset.pos === position) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function updateModeUI(mode, freePosition) {
    modeBtns.forEach(btn => {
      if (btn.dataset.mode === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    if (mode === 'free') {
        positionGrid.style.display = 'none';
        freeCoordsDisplay.style.display = 'block';
        if (freePosition) {
            coordX.textContent = Math.round(freePosition.left);
            coordY.textContent = Math.round(freePosition.top);
        }
    } else {
        positionGrid.style.display = 'grid';
        freeCoordsDisplay.style.display = 'none';
    }
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

  function applyLanguage(lang) {
    const texts = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (texts[key]) {
        el.textContent = texts[key];
      }
    });
  }

  function saveAndSync(data) {
    chrome.storage.local.set(data);
    // Send to ALL YouTube tabs
    chrome.tabs.query({ url: "*://www.youtube.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "updateSettings",
          settings: data
        });
      });
    });
  }
});
