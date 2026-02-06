chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "togglePin") {
    const player = document.querySelector("#movie_player");
    if (!player) return;

    if (player.classList.contains("you-utility-pinned")) {
      // Unpin: Restore to original location
      const placeholder = document.getElementById("you-utility-placeholder");
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(player, placeholder);
        placeholder.remove();
      }
      player.classList.remove("you-utility-pinned");
    } else {
      // Pin: Move to body to escape stacking context
      const placeholder = document.createElement("div");
      placeholder.id = "you-utility-placeholder";
      placeholder.style.display = "none"; // Keep it hidden but present in DOM structure if needed, or just a marker
      
      // Insert placeholder before moving
      player.parentNode.insertBefore(placeholder, player);
      
      document.body.appendChild(player);
      player.classList.add("you-utility-pinned");
    }
  }
});
