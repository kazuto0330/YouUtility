const DEFAULT_SETTINGS = {
  isPinned: true,
  position: 'top-right',
  size: 500,
  theme: 'system',
  pinMode: 'corner',
  freePosition: { top: 100, left: 100 },
  autoResolution: false,
  mainResolution: 'hd1080',
  fallbackResolutions: ['hd720', 'large'],
  playlistResolution: 'hd720'
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
    currentPosition: 'Current Position',
    resolutionSettings: 'Resolution',
    mainResolution: 'Main Resolution',
    fallbackResolutions: 'Fallback Resolutions (Priority order)',
    playlistResolution: 'Playlist Resolution'
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
    currentPosition: '現在の座標',
    resolutionSettings: '解像度',
    mainResolution: 'メインの解像度',
    fallbackResolutions: 'フォールバック解像度 (優先順)',
    playlistResolution: 'リスト再生時の解像度'
  }
};

const RES_LABELS = {
  'hd2160': '2160p (4K)',
  'hd1440': '1440p (2K)',
  'hd1080': '1080p (HD)',
  'hd720': '720p (HD)',
  'large': '480p',
  'medium': '360p',
  'small': '240p',
  'tiny': '144p'
};

let currentFallbackList = [];

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const pinToggle = document.getElementById('pin-toggle');
  const langSelect = document.getElementById('lang-select');
  const themeSelect = document.getElementById('theme-select');
  const sizeInput = document.getElementById('size-input');
  const sizeSlider = document.getElementById('size-slider');
  const posBtns = document.querySelectorAll('.pos-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const positionGrid = document.getElementById('position-grid');
  const freeCoordsDisplay = document.getElementById('free-coords-display');
  const coordX = document.getElementById('coord-x');
  const coordY = document.getElementById('coord-y');

  const autoResToggle = document.getElementById('auto-res-toggle');
  const mainResSelect = document.getElementById('main-res-select');
  const playlistResSelect = document.getElementById('playlist-res-select');
  const resSettingsContent = document.getElementById('res-settings-content');
  const fallbackResList = document.getElementById('fallback-res-list');
  const addResSelect = document.getElementById('add-res-select');
  const addResBtn = document.getElementById('add-res-btn');

  // Load Settings
  chrome.storage.local.get(['isPinned', 'position', 'size', 'theme', 'lang', 'pinMode', 'freePosition', 'autoResolution', 'mainResolution', 'fallbackResolutions', 'playlistResolution'], (result) => {
    let lang = result.lang;
    if (!lang) {
      const browserLang = navigator.language || navigator.userLanguage; 
      lang = browserLang.startsWith('ja') ? 'ja' : 'en';
    }

    const settings = { ...DEFAULT_SETTINGS, lang, ...result };
    if (!result.lang) chrome.storage.local.set({ lang });
    
    pinToggle.checked = settings.isPinned;
    langSelect.value = settings.lang;
    themeSelect.value = settings.theme;
    sizeInput.value = settings.size;
    sizeSlider.value = settings.size;
    updatePositionUI(settings.position);
    updateModeUI(settings.pinMode, settings.freePosition);

    // Resolution UI
    autoResToggle.checked = settings.autoResolution;
    mainResSelect.value = settings.mainResolution;
    playlistResSelect.value = settings.playlistResolution;
    currentFallbackList = settings.fallbackResolutions || [];
    renderFallbackList();
    updateResolutionUI(settings.autoResolution);
    
    applyTheme(settings.theme);
    applyLanguage(settings.lang);
  });

  // Event Listeners
  pinToggle.addEventListener('change', () => saveAndSync({ isPinned: pinToggle.checked }));
  langSelect.addEventListener('change', () => {
    applyLanguage(langSelect.value);
    saveAndSync({ lang: langSelect.value });
  });
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    saveAndSync({ theme: themeSelect.value });
  });

  sizeInput.addEventListener('change', () => {
    const val = parseInt(sizeInput.value);
    sizeSlider.value = val;
    saveAndSync({ size: val });
  });
  sizeSlider.addEventListener('input', () => {
    const val = parseInt(sizeSlider.value);
    sizeInput.value = val;
    saveAndSync({ size: val });
  });

  posBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      updatePositionUI(btn.dataset.pos);
      saveAndSync({ position: btn.dataset.pos });
    });
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      chrome.storage.local.get(['freePosition'], (res) => {
          const fp = res.freePosition || DEFAULT_SETTINGS.freePosition;
          updateModeUI(mode, fp);
          saveAndSync({ pinMode: mode });
      });
    });
  });

  // Resolution Listeners
  autoResToggle.addEventListener('change', () => {
    updateResolutionUI(autoResToggle.checked);
    saveAndSync({ autoResolution: autoResToggle.checked });
  });
  mainResSelect.addEventListener('change', () => saveAndSync({ mainResolution: mainResSelect.value }));
  playlistResSelect.addEventListener('change', () => saveAndSync({ playlistResolution: playlistResSelect.value }));

  addResBtn.addEventListener('click', () => {
    const res = addResSelect.value;
    if (!currentFallbackList.includes(res)) {
      currentFallbackList.push(res);
      renderFallbackList();
      saveAndSync({ fallbackResolutions: currentFallbackList });
    }
  });

  function renderFallbackList() {
    fallbackResList.innerHTML = '';
    currentFallbackList.forEach((res, index) => {
      const item = document.createElement('div');
      item.className = 'fallback-item';
      item.draggable = true;
      item.dataset.index = index;
      item.dataset.value = res;

      item.innerHTML = `
        <span class="drag-handle">☰</span>
        <span class="res-name">${RES_LABELS[res] || res}</span>
        <button class="remove-res-btn" title="Remove">&times;</button>
      `;

      item.querySelector('.remove-res-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        currentFallbackList.splice(index, 1);
        renderFallbackList();
        saveAndSync({ fallbackResolutions: currentFallbackList });
      });

      // Drag and Drop Events
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('drop', handleDrop);
      item.addEventListener('dragend', handleDragEnd);
      item.addEventListener('dragenter', e => e.preventDefault());

      fallbackResList.appendChild(item);
    });
  }

  let dragSourceItem = null;

  function handleDragStart(e) {
    dragSourceItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
  }

  function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    
    if (dragSourceItem !== this) {
      const fromIndex = parseInt(dragSourceItem.dataset.index);
      const toIndex = parseInt(this.dataset.index);
      
      const movedItem = currentFallbackList.splice(fromIndex, 1)[0];
      currentFallbackList.splice(toIndex, 0, movedItem);
      
      renderFallbackList();
      saveAndSync({ fallbackResolutions: currentFallbackList });
    }
    return false;
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    dragSourceItem = null;
  }

  function updateResolutionUI(enabled) {
    if (enabled) resSettingsContent.classList.remove('disabled');
    else resSettingsContent.classList.add('disabled');
  }

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
    } else body.setAttribute('data-theme', theme);
  }

  function applyLanguage(lang) {
    const texts = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (texts[key]) el.textContent = texts[key];
    });
  }

  function saveAndSync(data) {
    chrome.storage.local.set(data);
    chrome.tabs.query({ url: "*://www.youtube.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: "updateSettings", settings: data });
      });
    });
  }
});
