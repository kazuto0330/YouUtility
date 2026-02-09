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
  
  // Pin if:
  // 1. Feature enabled
  // 2. Element is NOT intersecting (out of view)
  // 3. Element is ABOVE the viewport (top < 0) - meaning we scrolled down
  
  const isScrolledPast = entry.boundingClientRect.top < 0;

  if (currentSettings.isPinned && !entry.isIntersecting && isScrolledPast) {
    pinPlayer();
  } else {
    // If it comes back into view (or we scroll up), unpin
    unpinPlayer();
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
  
  isPinnedActive = true;
  window.dispatchEvent(new Event('resize'));
}

function unpinPlayer() {
  if (!isPinnedActive && !document.querySelector('.you-utility-pinned')) return;
  if (!playerReference || !parentReference) return;

  // 1. Move player back to parent
  // We insert it before placeholder (or just append if placeholder is only child)
  // Best to just append to parent, then remove placeholder.
  // BUT: Original position matters? usually player is the main child.
  // We will insert before placeholder to be safe.
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