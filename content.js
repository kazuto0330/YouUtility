// Initialize settings
const DEFAULT_SETTINGS = {
  isPinned: true,
  position: 'top-right',
  size: 500,
  pinMode: 'corner',
  freePosition: { top: 100, left: 100 },
  lang: 'en',
  autoResolution: false,
  mainResolution: 'hd1080',
  fallbackResolutions: ['hd720', 'large'],
  playlistResolution: 'hd720',
  enablePlaylistResolution: false,
  miniPlayerResolution: 'medium',
  enableMiniPlayerResolution: false,
  enableVolumeWheel: true,
  volumeStep: 5
};

const UI_TRANSLATIONS = {
  en: {
    save: 'Save Settings',
    saved: 'Saved!',
    modeToFree: 'To Free Position Mode',
    modeToCorner: 'To Corner Mode',
    close: 'Close Mini Player'
  },
  ja: {
    save: '設定を保存',
    saved: '保存しました',
    modeToFree: '自由な位置モードへ',
    modeToCorner: '端に固定モードへ',
    close: 'ミニ動画プレイヤーを閉じる'
  }
};

let currentSettings = { ...DEFAULT_SETTINGS };
let observer = null;
let placeholder = null;

let isPinnedActive = false;
let playerReference = null;
let parentReference = null;
let userClosed = false;
let closeButton = null;
let saveButton = null;
let modeToggleButton = null;
let saveTimeout = null;
let resizeHandles = [];

let dragData = {
    isDragging: false,
    isResizing: false,
    resizeCorner: null,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    initialWidth: 0,
    initialHeight: 0,
    hasMoved: false,
    isClickSuppressed: false
};

function syncSettingsToMainWorld(settings) {
    const detail = { ...settings, isMiniPlayerActive: isPinnedActive };
    window.dispatchEvent(new CustomEvent('YouUtilitySettingsUpdate', { detail: detail }));
}

// Apply settings on load
chrome.storage.local.get(['isPinned', 'position', 'size', 'theme', 'lang', 'pinMode', 'freePosition', 'autoResolution', 'mainResolution', 'fallbackResolutions', 'playlistResolution', 'enablePlaylistResolution', 'miniPlayerResolution', 'enableMiniPlayerResolution', 'enableVolumeWheel', 'volumeStep'], (result) => {
  currentSettings = { ...DEFAULT_SETTINGS, ...result };
  applySettings(currentSettings);
  syncSettingsToMainWorld(currentSettings);
  
  setTimeout(() => {
    initObserver();
  }, 1000); 
});

// Listen for updates from options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings") {
    currentSettings = { ...currentSettings, ...request.settings };
    applySettings(currentSettings);
    syncSettingsToMainWorld(currentSettings);
    
    if (!currentSettings.isPinned) {
        cleanupObserver();
        unpinPlayer();
    } else {
        initObserver();
    }
  }
});

function applySettings(settings) {
  const root = document.documentElement;
  root.style.setProperty('--yu-width', `${settings.size}px`);

  const baseMargin = 20;
  const headerMargin = 80;

  root.style.setProperty('--yu-top', 'auto');
  root.style.setProperty('--yu-bottom', 'auto');
  root.style.setProperty('--yu-left', 'auto');
  root.style.setProperty('--yu-right', 'auto');

  if (settings.pinMode === 'free') {
    root.style.setProperty('--yu-top', `${settings.freePosition.top}px`);
    root.style.setProperty('--yu-left', `${settings.freePosition.left}px`);
  } else {
    switch (settings.position) {
      case 'top-left':
        root.style.setProperty('--yu-top', `${headerMargin}px`);
        root.style.setProperty('--yu-left', `${baseMargin}px`);
        break;
      case 'top-right':
        root.style.setProperty('--yu-top', `${headerMargin}px`);
        root.style.setProperty('--yu-right', `${baseMargin}px`);
        break;
      case 'bottom-left':
        root.style.setProperty('--yu-bottom', `${baseMargin}px`);
        root.style.setProperty('--yu-left', `${baseMargin}px`);
        break;
      case 'bottom-right':
        root.style.setProperty('--yu-bottom', `${baseMargin}px`);
        root.style.setProperty('--yu-right', `${baseMargin}px`);
        break;
    }
  }
}

function getUIText(key) {
    const lang = currentSettings.lang || 'en';
    const texts = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS['en'];
    return texts[key] || '';
}

function initObserver() {
  if (!currentSettings.isPinned) return;
  if (observer) return;

  const player = document.querySelector("#movie_player");
  if (!player) {
    setTimeout(initObserver, 1000);
    return;
  }
  
  playerReference = player;
  parentReference = player.parentNode;

  if (!placeholder) {
    placeholder = document.createElement("div");
    placeholder.id = "you-utility-placeholder";
    placeholder.style.width = "100%";
    placeholder.style.height = "100%"; 
  }

  observer = new IntersectionObserver(handleIntersect, {
    threshold: 0,
    rootMargin: "-60px 0px 0px 0px" 
  });

  observer.observe(parentReference);
}

function cleanupObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function handleIntersect(entries) {
  const entry = entries[0];
  const isScrolledPast = entry.boundingClientRect.top < 0;

  if (entry.isIntersecting) {
      userClosed = false;
      unpinPlayer();
  } else if (currentSettings.isPinned && !entry.isIntersecting && isScrolledPast && !userClosed) {
    pinPlayer();
  } else {
    if (userClosed) unpinPlayer();
  }
}

function createCloseButton() {
    const btn = document.createElement('div');
    btn.className = 'you-utility-close-btn';
    btn.innerHTML = '&times;';
    btn.title = getUIText('close');
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        userClosed = true;
        unpinPlayer();
    });
    return btn;
}

function createModeToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'you-utility-mode-toggle-btn';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentSettings.pinMode = currentSettings.pinMode === 'corner' ? 'free' : 'corner';
        if (currentSettings.pinMode === 'free') {
            const rect = playerReference.getBoundingClientRect();
            currentSettings.freePosition = { top: rect.top, left: rect.left };
        }
        applySettings(currentSettings);
        updateModeToggleButtonText();
        showSaveButton();
    });
    document.body.appendChild(btn);
    return btn;
}

function updateModeToggleButtonText() {
    if (!modeToggleButton) return;
    const isCorner = currentSettings.pinMode === 'corner';
    modeToggleButton.textContent = isCorner ? getUIText('modeToFree') : getUIText('modeToCorner');
}

function createSaveButton() {
    const btn = document.createElement('button');
    btn.className = 'you-utility-save-btn';
    btn.textContent = getUIText('save');
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveSettings();
    });
    document.body.appendChild(btn);
    return btn;
}

function hideSaveButton() {
    if (saveButton) saveButton.classList.remove('visible');
    if (modeToggleButton) modeToggleButton.classList.remove('visible');
}

function showSaveButton() {
    if (!saveButton) return;
    if (!playerReference) return;

    if (!modeToggleButton) modeToggleButton = createModeToggleButton();
    updateModeToggleButtonText();

    const rect = playerReference.getBoundingClientRect();
    const btnRect = saveButton.getBoundingClientRect();
    const modeBtnRect = modeToggleButton.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let btnTop, btnLeft;
    const margin = 12;
    const gap = 8;
    const isTopHalf = (rect.top + rect.height / 2) < (winHeight / 2);

    if (isTopHalf) btnTop = rect.bottom + margin;
    else btnTop = rect.top - btnRect.height - margin;

    const isLeftHalf = (rect.left + rect.width / 2) < (winWidth / 2);
    const totalWidth = btnRect.width + gap + modeBtnRect.width;

    if (isLeftHalf) btnLeft = rect.left;
    else btnLeft = rect.right - totalWidth;

    saveButton.style.top = `${btnTop}px`;
    saveButton.style.left = `${btnLeft}px`;
    saveButton.classList.add('visible');
    saveButton.textContent = getUIText('save');
    
    modeToggleButton.style.top = `${btnTop}px`;
    modeToggleButton.style.left = `${btnLeft + btnRect.width + gap}px`;
    modeToggleButton.classList.add('visible');
    
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(hideSaveButton, 5000);
}

function saveSettings() {
    const snappedSize = Math.round(currentSettings.size / 10) * 10;
    const snappedFreePos = {
        top: Math.round(currentSettings.freePosition.top / 10) * 10,
        left: Math.round(currentSettings.freePosition.left / 10) * 10
    };
    currentSettings.size = snappedSize;
    currentSettings.freePosition = snappedFreePos;
    applySettings(currentSettings);
    chrome.storage.local.set({
        size: currentSettings.size,
        position: currentSettings.position,
        pinMode: currentSettings.pinMode,
        freePosition: currentSettings.freePosition
    }, () => {
        if (saveButton) {
            saveButton.textContent = getUIText('saved');
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(hideSaveButton, 1000);
        }
    });
}

function createResizeHandles() {
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    return corners.map(corner => {
        const handle = document.createElement('div');
        handle.className = `you-utility-resize-handle ${corner}`;
        handle.dataset.corner = corner;
        return handle;
    });
}

function onMouseDown(e) {
    if (!isPinnedActive) return;
    if (e.target.classList.contains('you-utility-resize-handle')) {
        dragData.isResizing = true;
        dragData.resizeCorner = e.target.dataset.corner;
    } else if (e.target.closest('.ytp-chrome-bottom') || e.target.closest('.ytp-chrome-top') || e.target.closest('.ytp-gradient-bottom') || e.target.closest('.ytp-gradient-top') || e.target.closest('.ytp-popup') || e.target.closest('.you-utility-close-btn') || e.target.closest('.you-utility-save-btn')) {
        return;
    } else dragData.isDragging = true;

    hideSaveButton();
    dragData.hasMoved = false; 
    dragData.isClickSuppressed = false;
    dragData.startX = e.clientX;
    dragData.startY = e.clientY;
    
    const rect = playerReference.getBoundingClientRect();
    dragData.initialLeft = rect.left;
    dragData.initialTop = rect.top;
    dragData.initialWidth = rect.width;
    dragData.initialHeight = rect.height;

    playerReference.style.setProperty('top', `${rect.top}px`, 'important');
    playerReference.style.setProperty('left', `${rect.left}px`, 'important');
    playerReference.style.setProperty('bottom', 'auto', 'important');
    playerReference.style.setProperty('right', 'auto', 'important');
    playerReference.style.setProperty('width', `${rect.width}px`, 'important');
    e.preventDefault();
}

function onMouseMove(e) {
    if (!dragData.isDragging && !dragData.isResizing) return;
    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;
    if (!dragData.hasMoved && Math.hypot(dx, dy) < 5) return;
    dragData.hasMoved = true;

    if (dragData.isResizing) {
        let newWidth = dragData.initialWidth;
        let newLeft = dragData.initialLeft;
        let newTop = dragData.initialTop;
        const aspect = 16 / 9;
        if (dragData.resizeCorner.includes('right')) newWidth = dragData.initialWidth + dx;
        else if (dragData.resizeCorner.includes('left')) newWidth = dragData.initialWidth - dx;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > window.innerWidth - 40) newWidth = window.innerWidth - 40;
        if (dragData.resizeCorner.includes('left')) newLeft = dragData.initialLeft + (dragData.initialWidth - newWidth);
        if (dragData.resizeCorner.includes('top')) {
             const newHeight = newWidth / aspect;
             newTop = dragData.initialTop - (newHeight - dragData.initialHeight);
        }
        playerReference.style.setProperty('width', `${newWidth}px`, 'important');
        playerReference.style.setProperty('left', `${newLeft}px`, 'important');
        playerReference.style.setProperty('top', `${newTop}px`, 'important');
    } else if (dragData.isDragging) {
        playerReference.style.setProperty('top', `${dragData.initialTop + dy}px`, 'important');
        playerReference.style.setProperty('left', `${dragData.initialLeft + dx}px`, 'important');
    }
}

function onMouseUp(e) {
    if (!dragData.isDragging && !dragData.isResizing) return;
    if (dragData.hasMoved) {
        dragData.isClickSuppressed = true;
        const rect = playerReference.getBoundingClientRect();
        if (currentSettings.pinMode === 'free') currentSettings.freePosition = { top: rect.top, left: rect.left };
        else {
            const winWidth = window.innerWidth, winHeight = window.innerHeight;
            if ((rect.top + rect.height / 2) < winHeight / 2) currentSettings.position = (rect.left + rect.width / 2 < winWidth / 2) ? 'top-left' : 'top-right';
            else currentSettings.position = (rect.left + rect.width / 2 < winWidth / 2) ? 'bottom-left' : 'bottom-right';
        }
        if (dragData.isResizing) currentSettings.size = rect.width;
        playerReference.style.removeProperty('top');
        playerReference.style.removeProperty('left');
        playerReference.style.removeProperty('bottom');
        playerReference.style.removeProperty('right');
        playerReference.style.removeProperty('width');
        applySettings(currentSettings);
        requestAnimationFrame(showSaveButton);
        window.dispatchEvent(new Event('resize'));
    }
    dragData.isDragging = false;
    dragData.isResizing = false;
    dragData.resizeCorner = null;
}

function onClick(e) {
    if (dragData.isClickSuppressed) {
        e.preventDefault();
        e.stopPropagation();
        dragData.isClickSuppressed = false;
        return false;
    }
}

function pinPlayer() {
  if (isPinnedActive || !playerReference || !parentReference) return;
  const video = playerReference.querySelector('video');
  if (video && video.readyState === 0) return;

  const rect = playerReference.getBoundingClientRect();
  placeholder.style.height = `${rect.height}px`;
  parentReference.insertBefore(placeholder, playerReference);
  document.body.appendChild(playerReference);
  playerReference.classList.add("you-utility-pinned");
  if (!closeButton) closeButton = createCloseButton();
  playerReference.appendChild(closeButton);
  if (!saveButton) saveButton = createSaveButton();
  if (!modeToggleButton) modeToggleButton = createModeToggleButton();
  resizeHandles = createResizeHandles();
  resizeHandles.forEach(h => playerReference.appendChild(h));
  playerReference.addEventListener('mousedown', onMouseDown);
  playerReference.addEventListener('click', onClick, true); 
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  isPinnedActive = true;
  syncSettingsToMainWorld(currentSettings);
  window.dispatchEvent(new Event('resize'));
}

function unpinPlayer() {
  if (!isPinnedActive && !document.querySelector('.you-utility-pinned')) return;
  playerReference.removeEventListener('mousedown', onMouseDown);
  playerReference.removeEventListener('click', onClick, true);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  if (closeButton?.parentNode) closeButton.remove();
  if (saveButton?.parentNode) { saveButton.remove(); saveButton = null; }
  if (modeToggleButton?.parentNode) { modeToggleButton.remove(); modeToggleButton = null; }
  resizeHandles.forEach(h => h.parentNode?.remove());
  resizeHandles = [];
  playerReference.style.removeProperty('top');
  playerReference.style.removeProperty('left');
  playerReference.style.removeProperty('bottom');
  playerReference.style.removeProperty('right');
  playerReference.style.removeProperty('width');
  if (placeholder.parentNode === parentReference) {
      parentReference.insertBefore(playerReference, placeholder);
      placeholder.remove();
  } else parentReference.appendChild(playerReference);
  playerReference.classList.remove("you-utility-pinned");
  isPinnedActive = false;
  syncSettingsToMainWorld(currentSettings);
  window.dispatchEvent(new Event('resize'));
}
