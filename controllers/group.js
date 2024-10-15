let expandTimeout;
let isGroupItemsExpanded = false;

// Function to delete the selected group
export async function deleteSelectedGroup(selectedGroupIds) {
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
    await displayTabGroups(selectedGroupIds); // Refresh tab groups after deletion
  }
}

// Function to display all tab groups
export async function displayTabGroups(selectedGroupIds, openedGroupId = []) {
  try {
    let selectedGroupsCount = 0;
    selectedGroupIds.clear();
    const tabGroups = await chrome.tabGroups.query({});
    const template = document.getElementById('group_template');
    const groupContainer = document.querySelector('.listofgroups');
    const actionsTitle = document.querySelector('.actions-title');
    groupContainer.innerHTML = ''; // Clear existing groups

    for (const group of tabGroups) {
      const groupElement = await createGroupElement(
        group,
        template,
        selectedGroupIds
      );
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
  } catch (error) {
    console.error('Error displaying tab groups:', error);
  }
}

// Function to create a group element
export async function createGroupElement(group, template, selectedGroupIds) {
  if (!template) {
    console.error('Template not found');
    return null; // Exit if the template is not found
  }

  try {
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
    tabsListElement.addEventListener('drop', (event) => {
      drop(event, selectedGroupIds);
    });

    return groupElement.firstElementChild; // Return the actual element
  } catch (error) {
    console.error('Error creating group element:', error);
  }
}

// Handle dragging over the group item
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

// Function to toggle the group arcordion
function toggleGroup() {
  const tabsList =
    this.closest('.group-item').querySelector('.group-tabs-list');
  const isVisible = tabsList.style.display === 'flex';
  tabsList.style.display = isVisible ? 'none' : 'flex';
  this.textContent = isVisible ? '+' : '-'; // Change button icon
}

// Function to create a tab element
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
  try {
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
  } catch (error) {
    console.error('Error creating tab element:', error);
  }
}

// Function to group all tabs by domain
export async function autoGroup(selectedGroupIds) {
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
    await displayTabGroups(selectedGroupIds); // Refresh tab groups after grouping
  }
}

// Function to move the selected tabs to the selected group
function drag(ev) {
  ev.dataTransfer.setData(
    'text/plain',
    ev.target.closest('.tabitem').dataset.tabId
  );
}

// Function to allow dropping the tab
function allowDrop(ev) {
  ev.preventDefault();
}

// Function to drop the tab into the group
async function drop(ev, selectedGroupIds) {
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
    await updateGroupElement(oldGroupId, selectedGroupIds);
    await updateGroupElement(newGroupId, selectedGroupIds);
  } catch (error) {
    console.error('Error moving tab to new group:', error);
  } finally {
    await displayTabGroups(selectedGroupIds, [newGroupId]);
  }
}

// Function to update the group title
async function updateGroupTitle(groupId, newTitle) {
  try {
    await chrome.tabGroups.update(groupId, { title: newTitle });
  } catch (error) {
    console.error('Error updating group title:', error);
  }
}

// Function to add a new group
export async function addGroup(selectedGroupIds) {
  //create new chrome tab
  try {
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
          await displayTabGroups(selectedGroupIds);
        });
      }
    );
  } catch (error) {
    console.error('Error adding new group:', error);
  }
}

// Function to update the group element
async function updateGroupElement(groupId, selectedGroupIds) {
  const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
  if (!groupElement) {
    return; // Exit if the group element is not found
  }
  try {
    const group = await chrome.tabGroups.get(groupId);
    if (!group) {
      return; // Exit if the group is not found
    }
    const updatedGroupElement = await createGroupElement(
      group,
      document.getElementById('group_template'),
      selectedGroupIds
    );
    if (updatedGroupElement) {
      groupElement.replaceWith(updatedGroupElement);
    }
  } catch (error) {}
}

export async function createNewGroupWithSelectedTabs(selectedTabIds) {
  try {
    await chrome.tabs.group({ tabIds: selectedTabIds }, async (groupId) => {
      await chrome.tabGroups.update(groupId, {
        title: 'Unnamed Group',
        collapsed: true,
      });
    });
  } catch (error) {
    console.error('Error creating new group:', error);
  }
}
