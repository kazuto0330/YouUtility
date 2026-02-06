chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "togglePin") {
    const player = document.querySelector("#movie_player");
    if (player) {
      player.classList.toggle("you-utility-pinned");
    }
  }
});
