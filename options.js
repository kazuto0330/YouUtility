const DEFAULT_SETTINGS = {
  isPinned: true,
  position: 'top-right',
  size: 500,
  theme: 'system',
  lang: 'en'
};

const TRANSLATIONS = {
  en: {
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    themeSystem: 'System Default',
    themeLight: 'Light',
    themeDark: 'Dark',
    playerAppearance: 'Player Appearance',
    position: 'Position',
    size: 'Size (Width in px)'
  },
  ja: {
    general: '一般',
    language: '言語',
    theme: 'テーマ',
    themeSystem: 'システム設定',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    playerAppearance: 'プレイヤーの表示',
    position: '位置',
    size: 'サイズ (幅 px)'
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

  // Load Settings
  chrome.storage.local.get(['isPinned', 'position', 'size', 'theme', 'lang'], (result) => {
    const settings = { ...DEFAULT_SETTINGS, ...result };
    
    // Apply to UI
    pinToggle.checked = settings.isPinned;
    langSelect.value = settings.lang;
    themeSelect.value = settings.theme;
    sizeInput.value = settings.size;
    sizeSlider.value = settings.size;
    updatePositionUI(settings.position);
    
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