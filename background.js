chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab's status is complete and the URL is valid
  if (changeInfo.status === 'complete' && tab.favIconUrl) {
    chrome.storage.local.get(['lazyLoadingEnabled'], function (result) {
      if (result.lazyLoadingEnabled) {
        if (!tab.active) {
          chrome.tabs.discard(tabId, () => {
            console.log(`Tab with ID ${tabId} has been suspended.`);
          });
        } else {
          console.log(`Tab with ID ${tabId} is active; not suspending.`);
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle_lazy_loading') {
    // Store the lazy loading state in local storage
    chrome.storage.local.set({ lazyLoadingEnabled: request.enabled }, () => {
      console.log(`Lazy loading ${request.enabled ? 'enabled' : 'disabled'}`);
      sendResponse({
        status: `Lazy loading ${request.enabled ? 'enabled' : 'disabled'}`,
      });
    });
  }

  // Return true to indicate an async response
  return true;
});

//clear chrome storage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clear_storage') {
    chrome.storage.local.set({ lazyLoadingEnabled: false }, () => {
      sendResponse({ status: 'Chrome storage cleared' });
    });
  }

  // Return true to indicate an async response
  return true;
});
