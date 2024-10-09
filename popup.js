import { initNavigation } from './controllers/nav.js';
import { autoGroup } from './controllers/group.js';
import { filterTabs } from './controllers/search.js';

// Initialize the navigation
initNavigation();

let selectedTabIds = new Set(); // Store selected tab IDs
const selectedCountDisplay = document.querySelector('.selected-count'); // Element to display the count

async function displayTabs(tabs) {
  const template = document.getElementById('li_template');
  const elements = new Set();

  document.querySelector('.listoftabs').innerHTML = ''; // Clear current list

  for (const tab of tabs) {
    const element = template.content.firstElementChild.cloneNode(true);

    const title = tab.title.split('-')[0].trim();
    const pathname = new URL(tab.url).pathname.slice('/docs'.length);

    element.querySelector('.title').textContent = title;
    element.querySelector('.pathname').textContent = pathname;
    element.querySelector('a').addEventListener('click', async () => {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    });

    // Add event listener to the checkbox to select/unselect tabs
    const checkbox = element.querySelector('.tab-checkbox');
    checkbox.addEventListener('change', () => {
      updateSelectedCount();
      if (checkbox.checked) {
        selectedTabIds.add(tab.id); // Add tab ID to selected list
      } else {
        selectedTabIds.delete(tab.id); // Remove tab ID from selected list
      }
    });

    // Close tab when 'X' button is clicked
    const deleteButton = element.querySelector('.delete-button');
    deleteButton.addEventListener('click', async () => {
      await chrome.tabs.remove(tab.id); // Close the tab
      element.remove(); // Remove the tab element from the DOM
    });

    elements.add(element);
  }

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

    displayTabs(tabs);
    // Refresh the tabs list
  }
});

// Function to update the displayed count of selected tabs
function updateSelectedCount() {
  console.log(selectedTabIds.size);
  selectedCountDisplay.textContent = `${selectedTabIds.size} selected`;
}

const button = document.querySelector('.group-btn');
button.addEventListener('click', async () => {
  const tabIds = tabs.map(({ id }) => id);
  if (tabIds.length) {
    const group = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(group, { title: 'DOCS' });
  }
});

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

// Function to display the tab groups in the listofgroups section
async function displayTabGroups() {
  try {
    // Query all tab groups
    const groups = await chrome.tabGroups.query({});

    if (!groups || groups.length === 0) {
      console.log('No tab groups found');
      return;
    }

    // Get the container where groups will be displayed
    const groupContainer = document.querySelector('.listofgroups');
    groupContainer.innerHTML = ''; // Clear the container to avoid duplicates

    groups.forEach((group) => {
      // Create a new list item for each group
      const li = document.createElement('li');
      li.classList.add('groupelement');
      li.textContent = group.title || `Group ${group.id}`; // Use group title or ID as fallback

      // Add event listener to focus the group when clicked
      li.addEventListener('click', async () => {
        const tabsInGroup = await chrome.tabs.query({ groupId: group.id });
        if (tabsInGroup.length > 0) {
          // Focus the first tab in the group and bring the window to the foreground
          await chrome.tabs.update(tabsInGroup[0].id, { active: true });
          await chrome.windows.update(tabsInGroup[0].windowId, {
            focused: true,
          });
        }
      });

      // Append the group item to the container
      groupContainer.appendChild(li);
    });

    console.log('Tab groups displayed successfully');
  } catch (error) {
    console.error('Error displaying tab groups:', error);
  }
}

// Call the function to display the groups when the page loads
displayTabGroups();
