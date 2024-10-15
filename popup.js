import { initNavigation } from './controllers/nav.js';
import { filterTabs } from './controllers/search.js';

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
    //reset the selected tabs
    selectedCountDisplay.textContent = '0 selected';
    await displayTabs(filteredTabs);
  }, 400);
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

async function autoGroup() {
  try {
    const tabs = await chrome.tabs.query({});
    const groups = {};

    for (const tab of tabs) {
      const hostname = new URL(tab.url).hostname;

      // Remove subdomains (like 'www') and TLDs (like '.com')
      const domain = hostname?.split('.').slice(-2, -1)[0] || 'Unnamed Group'; // Extract the second-to-last part of the hostname

      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(tab.id);
    }

    for (const domain in groups) {
      const tabIds = groups[domain];
      const group = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(group, {
        title: domain || 'Unnamed Group',
        collapsed: true,
      });
    }
  } catch (error) {
    console.error('Error grouping tabs:', error);
  } finally {
    await displayTabGroups(); // Refresh tab groups after grouping
  }
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

async function displayTabGroups(openedGroupId = []) {
  try {
    let selectedGroupsCount = 0;
    selectedGroupIds.clear();
    const tabGroups = await chrome.tabGroups.query({});
    const template = document.getElementById('group_template');
    const groupContainer = document.querySelector('.listofgroups');
    const actionsTitle = document.querySelector('.actions-title');
    groupContainer.innerHTML = ''; // Clear existing groups

    for (const group of tabGroups) {
      const groupElement = await createGroupElement(group, template);
      const checkbox = groupElement.querySelector('.group-checkbox');

      checkbox.addEventListener('change', (event) => {
        const groupId = parseInt(group.id);
        if (checkbox.checked) {
          selectedGroupIds.add(groupId);
          selectedGroupsCount += 1; // Add tab ID to selected list
        } else {
          selectedGroupIds.delete(groupId); // Remove tab ID from selected list
          selectedGroupsCount -= 1;
        }
        actionsTitle.textContent = `${selectedGroupsCount} selected`;
      });
      actionsTitle.textContent = `${selectedGroupsCount} selected`;

      if (openedGroupId.includes(group.id)) {
        groupElement.querySelector('.group-tabs-list').style.display = 'flex';
      }

      groupContainer.appendChild(groupElement);
    }
    print('groupContainer', groupContainer);
  } catch (error) {
    console.error('Error displaying tab groups:', error);
  }
}

function toggleGroup() {
  const tabsList =
    this.closest('.group-item').querySelector('.group-tabs-list');
  const isVisible = tabsList.style.display === 'flex';
  tabsList.style.display = isVisible ? 'none' : 'flex';
  this.textContent = isVisible ? '+' : '-'; // Change button icon
}

let expandTimeout;
let isGroupItemsExpanded = false;

function dragOverGroup(event) {
  //   event.preventDefault();

  if (!isGroupItemsExpanded) {
    // Set the flag to indicate mouse is over the group
    isGroupItemsExpanded = true;

    const tabsList = event.currentTarget.querySelector('.group-tabs-list');

    // Set timeout to expand the group
    expandTimeout = setTimeout(() => {
      tabsList.style.display = 'flex';
      console.log(event.type, event.currentTarget);
    }, 300);
  }
}

// Handle leaving the group item
function dragLeaveGroup(event) {
  if (isGroupItemsExpanded && event.target.classList.contains('groupelement')) {
    const tabsList = event.currentTarget.querySelector('.group-tabs-list');
    isGroupItemsExpanded = false;
    clearTimeout(expandTimeout);

    setTimeout(() => {
      tabsList.style.display = 'none';
      console.log(event.type, event.target);
    }, 200);
  }
}

async function createGroupElement(group, template) {
  if (!template) {
    console.error('Template not found');
    return null; // Exit if the template is not found
  }

  const tabs = await chrome.tabs.query({ groupId: group.id });

  const groupElement = template.content.cloneNode(true);
  const groupItem = groupElement.querySelector('.groupelement');
  groupItem.addEventListener('dragover', dragOverGroup);
  groupItem.addEventListener('dragleave', dragLeaveGroup);
  const groupTitleElement = groupElement.querySelector('.group-title');
  const tabsListElement = groupElement.querySelector('.group-tabs-list');
  const tabsCountElement = groupElement.querySelector('.tabs-count');

  if (!groupTitleElement || !tabsListElement) {
    console.error('Group title or tabs list element not found');
    return null; // Exit if essential elements are not found
  }

  // Set the group title and ID
  groupTitleElement.textContent = group.title || 'Unnamed Group';
  tabsListElement.dataset.groupId = group.id;

  // Display the tab count inside the group
  tabsCountElement.textContent = `${tabs.length} ${
    tabs.length === 1 ? 'tab' : 'tabs'
  }`;

  // Add event listener to toggle the accordion
  groupElement
    .querySelector('.toggle-button')
    .addEventListener('click', toggleGroup);

  // Add event listener for editing group title
  const editIcon = groupElement.querySelector('.group-edit-img');
  if (!groupTitleElement || !tabsListElement) {
    console.error('Group title or tabs list element not found');
    return null; // Exit if essential elements are not found
  }

  // Set the group title and ID
  groupTitleElement.textContent = group.title || 'Unnamed Group';
  tabsListElement.dataset.groupId = group.id;
  editIcon.addEventListener('click', function () {
    groupTitleElement.contentEditable = true;
    groupTitleElement.focus();

    // Temporarily remove ellipsis while editing
    groupTitleElement.style.whiteSpace = 'normal';
    groupTitleElement.style.overflow = 'visible';
    groupTitleElement.style.textOverflow = 'unset';
  });

  groupTitleElement.addEventListener('blur', async function () {
    await updateGroupTitle(group.id, this.textContent);
    this.contentEditable = false;

    groupTitleElement.style.whiteSpace = 'nowrap';
    groupTitleElement.style.overflow = 'hidden';
    groupTitleElement.style.textOverflow = 'ellipsis';
  });

  groupTitleElement.addEventListener('keydown', async function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      await updateGroupTitle(group.id, this.textContent);
      this.contentEditable = false;
      this.blur();

      groupTitleElement.style.whiteSpace = 'nowrap';
      groupTitleElement.style.overflow = 'hidden';
      groupTitleElement.style.textOverflow = 'ellipsis';
    }
  });

  // Set the background color of the color-div to the group's color
  const groupInfo = await chrome.tabGroups.get(group.id);

  for (const tab of tabs) {
    const tabElement = createTabElement(tab);
    tabsListElement.appendChild(tabElement);
  }

  // Make the tabs list element droppable
  tabsListElement.addEventListener('dragover', allowDrop);
  tabsListElement.addEventListener('drop', drop);

  return groupElement.firstElementChild; // Return the actual element
}

function createTabElement(tab) {
  const tabElement = document.createElement('li');
  tabElement.classList.add('tabitem');
  tabElement.setAttribute('draggable', true);
  tabElement.dataset.tabId = tab.id;
  tabElement.dataset.groupId = tab.groupId;

  tabElement.innerHTML = `
    <div class="tabcontent">
      <div class="tabcontentcontent">
        <img class="tabfavicon" src="${tab.favIconUrl || ''}" alt="favicon" />
        <span class="tabtitle">${tab.title}</span>
      </div>
      <button class="tabclosebutton">x</button>
    </div>
  `;

  tabElement
    .querySelector('.tabclosebutton')
    .addEventListener('click', async function (e) {
      e.stopPropagation(); // Prevent the tab from being activated when closing
      await chrome.tabs.remove(tab.id);
      tabElement.remove();
    });

  // Add event listener to activate the tab when clicked
  tabElement.addEventListener('click', async () => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  });

  // Add drag event listeners
  tabElement.addEventListener('dragstart', drag);

  return tabElement;
}

async function updateGroupElement(groupId) {
  const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
  if (!groupElement) {
    console.error(`Group element with ID ${groupId} not found`);
    return; // Exit if the group element is not found
  }

  const group = await chrome.tabGroups.get(groupId);
  const updatedGroupElement = await createGroupElement(
    group,
    document.getElementById('group_template')
  );
  if (updatedGroupElement) {
    groupElement.replaceWith(updatedGroupElement);
  }
}

function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  ev.dataTransfer.setData(
    'text/plain',
    ev.target.closest('.tabitem').dataset.tabId
  );
}

async function drop(ev) {
  ev.preventDefault();
  const tabId = parseInt(ev.dataTransfer.getData('text'));
  const newGroupId = parseInt(ev.currentTarget.dataset.groupId);
  const oldGroupId = parseInt(
    document.querySelector(`[data-tab-id="${tabId}"]`).dataset.groupId
  );

  try {
    // Move the tab to the new group
    await chrome.tabs.group({ tabIds: [tabId], groupId: newGroupId });

    // Update only the affected groups after the tab has been moved
    await updateGroupElement(oldGroupId);
    await updateGroupElement(newGroupId);
  } catch (error) {
    console.error('Error moving tab to new group:', error);
  } finally {
    await displayTabGroups([newGroupId]);
  }
}

async function updateGroupTitle(groupId, newTitle) {
  try {
    await chrome.tabGroups.update(groupId, { title: newTitle });
  } catch (error) {
    console.error('Error updating group title:', error);
  }
}

// Make sure to call displayTabGroups() when your popup loads
displayTabGroups();

const addGroupButton = document.getElementById('add-group-button');
const deleteSelectedButton = document.getElementById('delete-selected-button');

// Function to add a new, empty group
async function addGroup() {
  //create new chrome tab
  await chrome.tabs.create(
    {
      url: 'chrome://newtab',
      active: false,
    },
    async (tab) => {
      await chrome.tabs.group({ tabIds: [tab.id] }, async (groupId) => {
        await chrome.tabGroups.update(groupId, {
          title: 'Unnamed Group',
          collapsed: true,
        });
        await displayTabGroups();
      });
    }
  );
}

// Function to delete the selected group
async function deleteSelectedGroup() {
  try {
    const promises = Array.from(selectedGroupIds).map(async (groupId) => {
      const tabs = await chrome.tabs.query({ currentWindow: true, groupId });
      const tabIds = tabs.map(({ id }) => id);
      return chrome.tabs.remove(tabIds);
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error deleting groups:', error);
  } finally {
    await displayTabGroups(); // Refresh tab groups after deletion
  }
}

// Attach event listeners to the buttons
addGroupButton.addEventListener('click', addGroup);
deleteSelectedButton.addEventListener('click', deleteSelectedGroup);
