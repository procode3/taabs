import { initNavigation } from './controllers/nav.js';
import { autoGroup } from './controllers/group.js';
import { initSearch } from './controllers/search.js';

// Initialize the navigation
initNavigation();

const tabs = await chrome.tabs.query({
  url: ['https://*/*'],
});

const collator = new Intl.Collator();
tabs.sort((a, b) => collator.compare(a.title, b.title));

const template = document.getElementById('li_template');
const elements = new Set();
for (const tab of tabs) {
  const element = template.content.firstElementChild.cloneNode(true);

  const title = tab.title.split('-')[0].trim();
  const pathname = new URL(tab.url).pathname.slice('/docs'.length);

  element.querySelector('.title').textContent = title;
  element.querySelector('.pathname').textContent = pathname;
  element.querySelector('a').addEventListener('click', async () => {
    // need to focus window as well as the active tab
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  });

  elements.add(element);
}
document.querySelector('.listoftabs').append(...elements);

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

    groups.forEach(group => {
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
          await chrome.windows.update(tabsInGroup[0].windowId, { focused: true });
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


