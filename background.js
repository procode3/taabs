chrome.tabs.onCreated.addListener(function (tab) {
  // Check if lazy loading is enabled
  chrome.storage.local.get(['lazyLoadingEnabled'], function (result) {
    if (result.lazyLoadingEnabled) {
      setTimeout(() => {
        chrome.tabs.discard(tab.id, function () {
          console.log(`Tab ${tab.id} created and discarded.`);
        });
      }, 1000);
    }
  });
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
