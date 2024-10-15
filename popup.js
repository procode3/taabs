import { initNavigation } from './controllers/nav.js';

import {
  displayTabGroups,
  deleteSelectedGroup,
  autoGroup,
  addGroup,
  createNewGroupWithSelectedTabs,
} from './controllers/group.js';

import { filterTabs } from './controllers/search.js';

import { displayTabs, mergeAllWindows } from './controllers/tab.js';

// Initialize the navigation
initNavigation();

let selectedTabIds = new Set(); // Store selected tab IDs
let selectedGroupIds = new Set(); // Store selected group IDs
const selectedCountDisplay = document.querySelector('.selected-count'); // Element to display the count

// Query all tabs initially
let tabs = await chrome.tabs.query({
  url: ['https://*/*'], // Example: only query tabs matching certain URLs
});

// Sort tabs alphabetically by title
const collator = new Intl.Collator();
tabs.sort((a, b) => collator.compare(a.title, b.title));

// Display all tabs initially
displayTabs(tabs, selectedTabIds);

// Search functionality
const searchInput = document.querySelector('.tab-input');

// Add a debounced search input handler
let debounceTimeout;
searchInput.addEventListener('input', () => {
  const searchValue = searchInput.value.toLowerCase();

  // Debounce logic: clear timeout before setting a new one
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(async () => {
    const filteredTabs = await filterTabs(tabs, searchValue);
    await displayTabs(filteredTabs, selectedTabIds);
  }, 400);
});

// Add event listener for the "Close Selected Tabs" button
const closeSelectedButton = document.querySelector('.delete-icon');
closeSelectedButton.addEventListener('click', async () => {
  if (selectedTabIds.size > 0) {
    const tabIdsToClose = Array.from(selectedTabIds);
    await chrome.tabs.remove(tabIdsToClose);

    // Filter out the closed tabs from the list
    tabs = tabs.filter((tab) => !tabIdsToClose.includes(tab.id));
    selectedTabIds.clear();
    selectedCountDisplay.textContent = '0 selected';
    const searchValue = searchInput.value.toLowerCase();
    const filteredTabs = await filterTabs(tabs, searchValue);
    await displayTabs(filteredTabs, selectedTabIds);
  }
  // Filter out the closed tabs from the list
  tabs = tabs.filter((tab) => !tabIdsToClose.includes(tab.id));
  selectedTabIds.clear();

  displayTabs(tabs, selectedTabIds);
});

const button = document.querySelector('.autogroup');
button.addEventListener('click', () => autoGroup(selectedGroupIds));

// On page load, get the current state of lazy loading from storage
chrome.storage.local.get(['lazyLoadingEnabled'], (result) => {
  document.getElementById('lazyLoadingToggle').checked =
    result.lazyLoadingEnabled || false;
});

document
  .getElementById('lazyLoadingToggle')
  .addEventListener('change', function () {
    const isEnabled = this.checked;

    // Store the new state in chrome.storage.local
    chrome.storage.local.set({ lazyLoadingEnabled: isEnabled }, () => {
      console.log(`Lazy loading ${isEnabled ? 'enabled' : 'disabled'}`);
    });

    // Notify the background script to enable/disable lazy loading
    chrome.runtime.sendMessage(
      { action: 'toggle_lazy_loading', enabled: isEnabled },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error('Error: ', chrome.runtime.lastError.message);
        } else {
          console.log(response?.status);
        }
      }
    );
  });

displayTabGroups(selectedGroupIds);

const addGroupButton = document.getElementById('add-group-button');
const deleteSelectedButton = document.getElementById('delete-selected-button');

// Attach event listeners to the buttons
addGroupButton.addEventListener('click', () => addGroup(selectedGroupIds));
deleteSelectedButton.addEventListener('click', () =>
  deleteSelectedGroup(selectedGroupIds)
);

//reset the chrome storage
const resetButton = document.querySelector('.reset');
resetButton.addEventListener('click', () => {
  // Send a message to the background script to clear the storage
  chrome.runtime.sendMessage({ action: 'clear_storage' }, (response) => {
    if (response.status === 'Chrome storage cleared') {
      //turn off checkbox
      document.getElementById('lazyLoadingToggle').checked = false;
    }
  });
});

const mergeWindowsButton = document.querySelector('.merge');
mergeWindowsButton.addEventListener('click', mergeAllWindows);

const addToNewGroup = document.querySelector('.group-btn');
addToNewGroup.addEventListener(
  'click',
  async () =>
    await createNewGroupWithSelectedTabs(selectedTabIds, selectedGroupIds)
);
