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
let dragData = {
    isDragging: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
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

function onMouseDown(e) {
    if (!isPinnedActive) return;
    // Check if clicking controls
    // Prevent dragging if interacting with controls
    if (e.target.closest('.ytp-chrome-bottom') || 
        e.target.closest('.ytp-chrome-top') ||
        e.target.closest('.ytp-gradient-bottom') ||
        e.target.closest('.ytp-gradient-top') ||
        e.target.closest('.ytp-popup') || 
        e.target.closest('.you-utility-close-btn')) {
        return;
    }

    dragData.isDragging = true;
    dragData.hasMoved = false; // Reset move flag
    dragData.isClickSuppressed = false; // Reset suppression
    dragData.startX = e.clientX;
    dragData.startY = e.clientY;
    
    const rect = playerReference.getBoundingClientRect();
    dragData.initialLeft = rect.left;
    dragData.initialTop = rect.top;

    // Prevent text selection
    e.preventDefault();
}

function onMouseMove(e) {
    if (!dragData.isDragging) return;

    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;

    // Only start moving if dragged more than 5px to prevent accidental micro-moves
    if (!dragData.hasMoved && Math.hypot(dx, dy) < 5) return;
    
    dragData.hasMoved = true;

    // Set styles directly with !important to override class styles during drag
    playerReference.style.setProperty('top', `${dragData.initialTop + dy}px`, 'important');
    playerReference.style.setProperty('left', `${dragData.initialLeft + dx}px`, 'important');
    playerReference.style.setProperty('bottom', 'auto', 'important');
    playerReference.style.setProperty('right', 'auto', 'important');
}

function onMouseUp(e) {
    if (!dragData.isDragging) return;
    
    // If we moved, suppress the subsequent click event
    if (dragData.hasMoved) {
        dragData.isClickSuppressed = true;
        
        // Calculate quadrant
        const rect = playerReference.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let newPosition = '';
        if (centerY < winHeight / 2) {
            // Top
            newPosition = (centerX < winWidth / 2) ? 'top-left' : 'top-right';
        } else {
            // Bottom
            newPosition = (centerX < winWidth / 2) ? 'bottom-left' : 'bottom-right';
        }

        // Update settings
        currentSettings.position = newPosition;
        chrome.storage.local.set({ position: newPosition });

        // Remove inline styles to let applySettings take over
        playerReference.style.removeProperty('top');
        playerReference.style.removeProperty('left');
        playerReference.style.removeProperty('bottom');
        playerReference.style.removeProperty('right');
        
        applySettings(currentSettings);
    }
    
    dragData.isDragging = false;
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

  // Check if video is loaded to prevent sizing issues
  const videoElement = playerReference.querySelector('video');
  if (videoElement && videoElement.readyState === 0) {
    return;
  }

  // 1. Insert placeholder to maintain height
  // We set explicit height based on current player height
  const rect = playerReference.getBoundingClientRect();
  placeholder.style.height = `${rect.height}px`;
  // Insert placeholder where player is to preserve layout order
  parentReference.insertBefore(placeholder, playerReference);

  // 2. Move player to body
  document.body.appendChild(playerReference);
  playerReference.classList.add("you-utility-pinned");
  
  // 3. Add Close Button
  if (!closeButton) closeButton = createCloseButton();
  playerReference.appendChild(closeButton);

  // 4. Add Drag Listeners
  playerReference.addEventListener('mousedown', onMouseDown);
  // Use capture phase for click to intercept it before YouTube handles it
  playerReference.addEventListener('click', onClick, true); 
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  isPinnedActive = true;
  window.dispatchEvent(new Event('resize'));
}

function unpinPlayer() {
  if (!isPinnedActive && !document.querySelector('.you-utility-pinned')) return;
  if (!playerReference || !parentReference) return;

  // 1. Remove Drag Listeners
  playerReference.removeEventListener('mousedown', onMouseDown);
  playerReference.removeEventListener('click', onClick, true);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);

  // 2. Remove Close Button
  if (closeButton && closeButton.parentNode) {
      closeButton.remove();
  }

  // 3. Clean up any inline styles from drag
  playerReference.style.removeProperty('top');
  playerReference.style.removeProperty('left');
  playerReference.style.removeProperty('bottom');
  playerReference.style.removeProperty('right');

  // 4. Move player back to parent
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