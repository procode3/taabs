export async function displayTabs(tabs, selectedTabIds) {
  const selectedCountDisplay = document.querySelector('.selected-count'); // Element to display the count
  const template = document.getElementById('li_template');
  const elements = new Set();

  // Reset the checked tabs count based on `selectedTabIds`
  let checkedTabs = selectedTabIds.size;

  // Clear the current list of tabs
  const listOfTabs = document.querySelector('.listoftabs');
  listOfTabs.innerHTML = ''; // Clear current list once

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

    // Handle the checkbox for selecting/unselecting tabs
    const checkbox = element.querySelector('.tab-checkbox');
    checkbox.checked = selectedTabIds.has(tab.id); // Maintain selection state
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

    // Handle tab removal
    const deleteButton = element.querySelector('.delete-button');
    deleteButton.addEventListener('click', async () => {
      await chrome.tabs.remove(tab.id); // Close the tab
      element.remove(); // Remove the tab element from the DOM
      checkedTabs = selectedTabIds.size;
      selectedCountDisplay.textContent = `${checkedTabs} selected`; // Update the count
    });

    elements.add(element);
  }

  // Append all the tab elements at once
  listOfTabs.append(...elements);

  // Display the number of selected tabs
  selectedCountDisplay.textContent = `${selectedTabIds.size} selected`;
}

export async function mergeAllWindows() {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const allWindows = await chrome.windows.getAll({ populate: true });

    const promises = [];

    for (const window of allWindows) {
      if (window.id !== currentWindow.id) {
        const tabIds = window.tabs.map((tab) => tab.id);

        // Move tabs and capture the promise
        promises.push(
          chrome.tabs.move(tabIds, { windowId: currentWindow.id, index: -1 })
        );

        // Capture the promise to close the window after moving tabs
        promises.push(chrome.windows.remove(window.id));
      }
    }

    // Resolve all promises at once
    await Promise.all(promises);

    console.log('All windows merged into the current one');
  } catch (error) {
    console.error('Error merging windows:', error);
  }
}
