// Initialize settings
const DEFAULT_SETTINGS = {
  isPinned: true,
  position: 'top-right',
  size: 500
};

// Apply settings on load
chrome.storage.local.get(['isPinned', 'position', 'size'], (result) => {
  const settings = { ...DEFAULT_SETTINGS, ...result };
  applySettings(settings);
});

// Listen for updates from options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings") {
    chrome.storage.local.get(['isPinned', 'position', 'size'], (result) => {
       const settings = { ...DEFAULT_SETTINGS, ...result, ...request.settings };
       applySettings(settings);
    });
  }
});

function applySettings(settings) {
  const root = document.documentElement;
  
  // 1. Apply Size (px)
  root.style.setProperty('--yu-width', `${settings.size}px`);

  // 2. Apply Position
  const margin = '20px';
  root.style.setProperty('--yu-top', 'auto');
  root.style.setProperty('--yu-bottom', 'auto');
  root.style.setProperty('--yu-left', 'auto');
  root.style.setProperty('--yu-right', 'auto');

  switch (settings.position) {
    case 'top-left':
      root.style.setProperty('--yu-top', margin);
      root.style.setProperty('--yu-left', margin);
      break;
    case 'top-right':
      root.style.setProperty('--yu-top', margin);
      root.style.setProperty('--yu-right', margin);
      break;
    case 'bottom-left':
      root.style.setProperty('--yu-bottom', margin);
      root.style.setProperty('--yu-left', margin);
      break;
    case 'bottom-right':
      root.style.setProperty('--yu-bottom', margin);
      root.style.setProperty('--yu-right', margin);
      break;
  }

  // 3. Apply Pin State
  togglePinState(settings.isPinned);
}

function togglePinState(shouldPin) {
  const player = document.querySelector("#movie_player");
  if (!player) return;

  const isCurrentlyPinned = player.classList.contains("you-utility-pinned");

  if (shouldPin && !isCurrentlyPinned) {
    // Pin: Move to body
    const placeholder = document.createElement("div");
    placeholder.id = "you-utility-placeholder";
    placeholder.style.display = "none";
    player.parentNode.insertBefore(placeholder, player);
    document.body.appendChild(player);
    player.classList.add("you-utility-pinned");
  } else if (!shouldPin && isCurrentlyPinned) {
    // Unpin: Restore
    const placeholder = document.getElementById("you-utility-placeholder");
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(player, placeholder);
      placeholder.remove();
    }
    player.classList.remove("you-utility-pinned");
  }
}