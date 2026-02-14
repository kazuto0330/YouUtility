// Initialize settings
const DEFAULT_SETTINGS = {
  isPinned: true,
  position: 'top-right',
  size: 500
};

let currentSettings = { ...DEFAULT_SETTINGS };
let observer = null;
let placeholder = null; // Used to hold space when pinned

let isPinnedActive = false;
let playerReference = null; // Cache the player element
let parentReference = null; // Cache the parent
let userClosed = false; // Track if user manually closed the pinned player
let closeButton = null;
let saveButton = null;
let saveTimeout = null;
let resizeHandles = [];

let dragData = {
    isDragging: false,
    isResizing: false,
    resizeCorner: null, // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    initialWidth: 0,
    initialHeight: 0,
    hasMoved: false,
    isClickSuppressed: false
};

// Apply settings on load
chrome.storage.local.get(['isPinned', 'position', 'size'], (result) => {
  currentSettings = { ...DEFAULT_SETTINGS, ...result };
  applySettings(currentSettings);
  // Give YT a moment to load the player
  setTimeout(initObserver, 1000); 
});

// Listen for updates from options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings") {
    currentSettings = { ...currentSettings, ...request.settings };
    applySettings(currentSettings);
    // Re-check observer state
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
  
  // 1. Apply Size (px)
  root.style.setProperty('--yu-width', `${settings.size}px`);

  // 2. Apply Position & Header Margin
  const baseMargin = 20;
  const headerMargin = 80; // 56px header + spacing

  root.style.setProperty('--yu-top', 'auto');
  root.style.setProperty('--yu-bottom', 'auto');
  root.style.setProperty('--yu-left', 'auto');
  root.style.setProperty('--yu-right', 'auto');

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

function initObserver() {
  if (!currentSettings.isPinned) return;
  if (observer) return; // Already observing

  const player = document.querySelector("#movie_player");
  if (!player) {
    // Retry if not found yet
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
    // We don't append it yet.
  }

  // Observe the PARENT container
  // We use a threshold of 0 (triggers when even 1px is out/in)
  // We want to know when it leaves the viewport completely.
  observer = new IntersectionObserver(handleIntersect, {
    threshold: 0,
    rootMargin: "-60px 0px 0px 0px" // Trigger when it scrolls past the header
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
      // Reset userClosed when player comes back into view
      userClosed = false;
      unpinPlayer();
  } else if (currentSettings.isPinned && !entry.isIntersecting && isScrolledPast && !userClosed) {
    pinPlayer();
  } else {
    // If scrolled past but userClosed is true, ensure it's unpinned
    if (userClosed) unpinPlayer();
  }
}

function createCloseButton() {
    const btn = document.createElement('div');
    btn.className = 'you-utility-close-btn';
    btn.innerHTML = '&times;';
    btn.title = 'ピン留め解除';
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag or other clicks
        userClosed = true;
        unpinPlayer();
    });
    return btn;
}

function createSaveButton() {
    const btn = document.createElement('button');
    btn.className = 'you-utility-save-btn';
    btn.textContent = '設定を保存';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveSettings();
    });
    // Append to body instead of player to avoid clipping
    document.body.appendChild(btn);
    return btn;
}

function hideSaveButton() {
    if (saveButton) {
        saveButton.classList.remove('visible');
    }
}

function showSaveButton() {
    if (!saveButton) return;
    if (!playerReference) return;

    // Calculate position relative to the pinned player
    const rect = playerReference.getBoundingClientRect();
    const btnRect = saveButton.getBoundingClientRect(); // Get button dimensions
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let btnTop, btnLeft;
    const margin = 12;

    // Determine Vertical Position (Top/Bottom)
    // If player is in the top half, button goes below.
    // If player is in the bottom half, button goes above.
    const isTopHalf = (rect.top + rect.height / 2) < (winHeight / 2);

    if (isTopHalf) {
        // Place below
        btnTop = rect.bottom + margin;
    } else {
        // Place above
        btnTop = rect.top - btnRect.height - margin;
    }

    // Determine Horizontal Position (Left/Right)
    // If player is in the left half, align left.
    // If player is in the right half, align right.
    const isLeftHalf = (rect.left + rect.width / 2) < (winWidth / 2);

    if (isLeftHalf) {
        // Align Left
        btnLeft = rect.left;
    } else {
        // Align Right
        btnLeft = rect.right - btnRect.width;
    }

    // Apply Styles
    saveButton.style.top = `${btnTop}px`;
    saveButton.style.left = `${btnLeft}px`;
    
    saveButton.classList.add('visible');
    saveButton.textContent = '設定を保存'; // Reset text
    
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveButton.classList.remove('visible');
    }, 5000);
}

function saveSettings() {
    // Save current settings to storage
    chrome.storage.local.set({
        size: currentSettings.size,
        position: currentSettings.position
    }, () => {
        if (saveButton) {
            saveButton.textContent = '保存しました';
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveButton.classList.remove('visible');
            }, 1000);
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

    // Check for resize handle
    if (e.target.classList.contains('you-utility-resize-handle')) {
        dragData.isResizing = true;
        dragData.resizeCorner = e.target.dataset.corner;
    } 
    // Check if clicking controls
    else if (e.target.closest('.ytp-chrome-bottom') || 
        e.target.closest('.ytp-chrome-top') ||
        e.target.closest('.ytp-gradient-bottom') ||
        e.target.closest('.ytp-gradient-top') ||
        e.target.closest('.ytp-popup') || 
        e.target.closest('.you-utility-close-btn') ||
        e.target.closest('.you-utility-save-btn')) {
        return;
    } else {
        dragData.isDragging = true;
    }

    // Hide save button immediately when interaction starts
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

    // Set styles to absolute pixels to allow free drag/resize
    playerReference.style.setProperty('top', `${rect.top}px`, 'important');
    playerReference.style.setProperty('left', `${rect.left}px`, 'important');
    playerReference.style.setProperty('bottom', 'auto', 'important');
    playerReference.style.setProperty('right', 'auto', 'important');
    playerReference.style.setProperty('width', `${rect.width}px`, 'important');

    // Prevent text selection
    e.preventDefault();
}

function onMouseMove(e) {
    if (!dragData.isDragging && !dragData.isResizing) return;

    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;

    // Threshold for move start
    if (!dragData.hasMoved && Math.hypot(dx, dy) < 5) return;
    dragData.hasMoved = true;

    if (dragData.isResizing) {
        let newWidth = dragData.initialWidth;
        let newLeft = dragData.initialLeft;
        let newTop = dragData.initialTop;

        // Aspect Ratio 16:9
        const aspect = 16 / 9;

        // Calculate new width based on corner
        if (dragData.resizeCorner.includes('right')) {
            newWidth = dragData.initialWidth + dx;
        } else if (dragData.resizeCorner.includes('left')) {
            newWidth = dragData.initialWidth - dx;
        }

        // Min width constraint (e.g., 200px)
        if (newWidth < 200) newWidth = 200;

        // Max width constraint (optional, e.g., window width)
        if (newWidth > window.innerWidth - 40) newWidth = window.innerWidth - 40;

        // Adjust Left position if dragging left side
        if (dragData.resizeCorner.includes('left')) {
            newLeft = dragData.initialLeft + (dragData.initialWidth - newWidth);
        }

        // Adjust Top position if dragging top side (to maintain aspect ratio)
        if (dragData.resizeCorner.includes('top')) {
             const newHeight = newWidth / aspect;
             const heightDiff = newHeight - dragData.initialHeight;
             newTop = dragData.initialTop - heightDiff;
        }

        playerReference.style.setProperty('width', `${newWidth}px`, 'important');
        playerReference.style.setProperty('left', `${newLeft}px`, 'important');
        playerReference.style.setProperty('top', `${newTop}px`, 'important');
        // Height is auto (aspect-ratio)

        // Update current setting temporarily for visual feedback if needed, 
        // but main update happens on mouse up.
    } else if (dragData.isDragging) {
        playerReference.style.setProperty('top', `${dragData.initialTop + dy}px`, 'important');
        playerReference.style.setProperty('left', `${dragData.initialLeft + dx}px`, 'important');
    }
}

function onMouseUp(e) {
    if (!dragData.isDragging && !dragData.isResizing) return;
    
    // If we moved/resized
    if (dragData.hasMoved) {
        dragData.isClickSuppressed = true;
        
        // 1. Calculate new Quadrant (Position)
        const rect = playerReference.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let newPosition = '';
        if (centerY < winHeight / 2) {
            newPosition = (centerX < winWidth / 2) ? 'top-left' : 'top-right';
        } else {
            newPosition = (centerX < winWidth / 2) ? 'bottom-left' : 'bottom-right';
        }

        // 2. Update Settings Object (BUT DO NOT SAVE TO STORAGE YET)
        currentSettings.position = newPosition;
        if (dragData.isResizing) {
            currentSettings.size = rect.width;
        }

        // 3. Remove inline styles so applySettings can take over with standard margins
        playerReference.style.removeProperty('top');
        playerReference.style.removeProperty('left');
        playerReference.style.removeProperty('bottom');
        playerReference.style.removeProperty('right');
        playerReference.style.removeProperty('width'); // Remove explicit width to use var
        
        // 4. Apply Settings (Snaps to nearest corner with updated size)
        applySettings(currentSettings);
        
        // 5. Show Save Button (Since it's fixed position, it will calculate based on new position)
        // Give a slight delay for layout to settle
        requestAnimationFrame(() => {
            showSaveButton();
        });
        
        // 6. Trigger Resize Event to fix internal player layout
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
        dragData.isClickSuppressed = false; // Reset after suppressing one click
        return false;
    }
}

function pinPlayer() {
  if (isPinnedActive) return;
  if (!playerReference || !parentReference) return;

  const videoElement = playerReference.querySelector('video');
  if (videoElement && videoElement.readyState === 0) {
    return;
  }

  // 1. Insert placeholder
  const rect = playerReference.getBoundingClientRect();
  placeholder.style.height = `${rect.height}px`;
  parentReference.insertBefore(placeholder, playerReference);

  // 2. Move player to body
  document.body.appendChild(playerReference);
  playerReference.classList.add("you-utility-pinned");
  
  // 3. Add Close Button
  if (!closeButton) closeButton = createCloseButton();
  playerReference.appendChild(closeButton);

  // 4. Add Save Button
  // Only create if not exists
  if (!saveButton) {
      saveButton = createSaveButton();
  }

  // 5. Add Resize Handles
  resizeHandles = createResizeHandles();
  resizeHandles.forEach(handle => playerReference.appendChild(handle));

  // 6. Add Listeners
  playerReference.addEventListener('mousedown', onMouseDown);
  playerReference.addEventListener('click', onClick, true); 
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  isPinnedActive = true;
  window.dispatchEvent(new Event('resize'));
}

function unpinPlayer() {
  if (!isPinnedActive && !document.querySelector('.you-utility-pinned')) return;
  if (!playerReference || !parentReference) return;

  // 1. Remove Listeners
  playerReference.removeEventListener('mousedown', onMouseDown);
  playerReference.removeEventListener('click', onClick, true);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);

  // 2. Remove Elements
  if (closeButton && closeButton.parentNode) closeButton.remove();
  
  // Don't remove save button completely, just hide it, or remove it and recreate next time.
  // Let's remove it to keep DOM clean.
  if (saveButton && saveButton.parentNode) {
      saveButton.remove();
      saveButton = null; // Reset reference so it's recreated
  }
  
  resizeHandles.forEach(handle => {
      if (handle.parentNode) handle.remove();
  });
  resizeHandles = [];

  // 3. Clean up styles
  playerReference.style.removeProperty('top');
  playerReference.style.removeProperty('left');
  playerReference.style.removeProperty('bottom');
  playerReference.style.removeProperty('right');
  playerReference.style.removeProperty('width');

  // 4. Move player back
  if (placeholder.parentNode === parentReference) {
      parentReference.insertBefore(playerReference, placeholder);
      placeholder.remove();
  } else {
      parentReference.appendChild(playerReference);
  }

  playerReference.classList.remove("you-utility-pinned");
  isPinnedActive = false;
  window.dispatchEvent(new Event('resize'));
}
