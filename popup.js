import { initNavigation } from './controllers/nav.js';

import {
  displayTabGroups,
  deleteSelectedGroup,
  createGroupElement,
  autoGroup,
  addGroup,
} from './controllers/group.js';

import {
  filterTabs,
  searchRecentlyClosedTabs,
  searchBookmarks,
} from './controllers/search.js';

// Initialize the navigation
initNavigation();

let selectedTabIds = new Set(); // Store selected tab IDs
let selectedGroupIds = new Set(); // Store selected group IDs
const selectedCountDisplay = document.querySelector('.selected-count'); // Element to display the count

async function displayTabs(tabs) {
  const template = document.getElementById('li_template');
  const elements = new Set();
  let checkedTabs = 0;

  document.querySelector('.listoftabs').innerHTML = ''; // Clear current list

  for (const tab of tabs) {
    const element = template.content.firstElementChild.cloneNode(true);

    const title = tab.title.split('-')[0].trim();
    const path = tab.url.split('//')[1];
    const pathname = path.includes('www') ? path.split('www.')[1] : path;

    element.querySelector('.title').textContent = title;
    element.querySelector('.pathname').textContent = pathname;
    element.querySelector('a').addEventListener('click', async () => {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    });

    const icon = element.querySelector('.tabs-icon');
    icon.src = tab.favIconUrl || 'images/icon-128.png';
    // Add event listener to the checkbox to select/unselect tabs
    const checkbox = element.querySelector('.tab-checkbox');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedTabIds.add(tab.id);
        checkedTabs += 1; // Add tab ID to selected list
      } else {
        selectedTabIds.delete(tab.id); // Remove tab ID from selected list
        checkedTabs -= 1;
      }
      selectedCountDisplay.textContent = `${checkedTabs} selected`;
    });
    selectedCountDisplay.textContent = `${checkedTabs} selected`;
    // Close tab when 'X' button is clicked
    const deleteButton = element.querySelector('.delete-button');
    deleteButton.addEventListener('click', async () => {
      await chrome.tabs.remove(tab.id); // Close the tab
      element.remove(); // Remove the tab element from the DOM
      //refresh the count of selected tabs
    });

    elements.add(element);
  }

  document.querySelector('.listoftabs').append(...elements);
  document.querySelector('.listoftabs').append(...elements);
  updateSelectedCount();
}

// Query all tabs initially
let tabs = await chrome.tabs.query({
  url: ['https://*/*'], // Example: only query tabs matching certain URLs
});

// Sort tabs alphabetically by title
const collator = new Intl.Collator();
tabs.sort((a, b) => collator.compare(a.title, b.title));

// Display all tabs initially
displayTabs(tabs);

// Search functionality
const searchInput = document.querySelector('.tab-input');

// Add a debounced search input handler
let debounceTimeout;
searchInput.addEventListener('input', () => {
  const searchValue = searchInput.value.toLowerCase();

  // Debounce logic: only execute search after user stops typing for 300ms
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(async () => {
    const filteredTabs = await filterTabs(tabs, searchValue);
    const bookmarks = await searchBookmarks(searchValue);
    const recentTabs = await searchRecentlyClosedTabs(searchValue);

    await displayTabs(filteredTabs);
  }, 400); // Adjust the debounce delay if needed
});

// Add event listener for the "Close Selected Tabs" button
const closeSelectedButton = document.querySelector('.delete-icon');
closeSelectedButton.addEventListener('click', async () => {
  if (selectedTabIds.size > 0) {
    // Convert Set to array and close all selected tabs
    const tabIdsToClose = Array.from(selectedTabIds);
    await chrome.tabs.remove(tabIdsToClose); // Close selected tabs

    // Filter out the closed tabs from the list
    tabs = tabs.filter((tab) => !tabIdsToClose.includes(tab.id));
    selectedTabIds.clear(); // Clear the selection after closing
    selectedCountDisplay.textContent = '0 selected'; // Reset the count
    const searchValue = searchInput.value.toLowerCase();
    const filteredTabs = await filterTabs(tabs, searchValue);
    await displayTabs(filteredTabs);
  }
  // Filter out the closed tabs from the list
  tabs = tabs.filter((tab) => !tabIdsToClose.includes(tab.id));
  selectedTabIds.clear(); // Clear the selection after closing

  displayTabs(tabs);
  // Refresh the tabs list
});

// Function to update the displayed count of selected tabs
function updateSelectedCount() {
  selectedCountDisplay.textContent = `${selectedTabIds.size} selected`;
}

const button = document.querySelector('.group-btn');
button.addEventListener('click', autoGroup);

// On page load, get the current state of lazy loading from storage
chrome.storage.local.get(['lazyLoadingEnabled'], (result) => {
  document.getElementById('lazyLoadingToggle').checked =
    result.lazyLoadingEnabled || false;
});

// Save the state of the checkbox when it is changed
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

// Make sure to call displayTabGroups() when your popup loads
displayTabGroups(selectedGroupIds);

const addGroupButton = document.getElementById('add-group-button');
const deleteSelectedButton = document.getElementById('delete-selected-button');

// Function to add a new, empty group

// Attach event listeners to the buttons
addGroupButton.addEventListener('click', () => addGroup(selectedGroupIds));
deleteSelectedButton.addEventListener('click', () =>
  deleteSelectedGroup(selectedGroupIds)
);
