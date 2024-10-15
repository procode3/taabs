export async function displayTabs(tabs, selectedTabIds, selectedCountDisplay) {
    const template = document.getElementById('li_template');
    const elements = new Set();
    let checkedTabs = 0;
  
      document.querySelector(".listoftabs").innerHTML = ""; // Clear current list
  
    for (const tab of tabs) {
      const element = template.content.firstElementChild.cloneNode(true);
  
      const title = tab.title.split('-')[0].trim();
      const path = tab.url.split('//')[1];
      const pathname = path.includes('www') ? path.split('www.')[1] : path;
  
          element.querySelector(".title").textContent = title;
          element.querySelector(".pathname").textContent = pathname;
          element.querySelector("a").addEventListener("click", async () => {
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
      document.querySelector(".listoftabs").append(...elements);
      updateSelectedCount();
  }
  