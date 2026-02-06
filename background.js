chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("youtube.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "togglePin" });
  }
});
