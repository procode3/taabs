import { initNavigation } from './controllers/nav.js';
import { autoGroup } from './controllers/group.js';

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
  const tabUrl = new URL(tab.url);
	const pathname = `${tabUrl.hostname}${tabUrl.pathname}`;

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
// Function to display the tab groups in the listofgroups section
async function displayTabGroups() {
  try {
    const tabGroups = await chrome.tabGroups.query({});
    const template = document.getElementById("group_template");
    const groupContainer = document.querySelector(".listofgroups");

    for (const group of tabGroups) {
      const groupElement = template.content.cloneNode(true);
      const groupTitleElement = groupElement.querySelector(".group-title");
      
      // Set the group title
      groupTitleElement.textContent = group.title || "Unnamed Group";

      // Add event listener to toggle the accordion
      groupElement
        .querySelector(".toggle-button")
        .addEventListener("click", function () {
          const tabsList =
            this.closest(".group-item").querySelector(".group-tabs-list");
          const isVisible = tabsList.style.display === "flex";
          tabsList.style.display = isVisible ? "none" : "flex";
          this.textContent = isVisible ? "+" : "-"; // Change button icon
        });

      // Add event listener for editing group title
      groupTitleElement.addEventListener("click", function () {
        this.contentEditable = true; // Make it editable
        this.focus(); // Focus on the title
      });

      // Handle title change on blur (when the user clicks away) or Enter key press
      groupTitleElement.addEventListener("blur", async function () {
        await updateGroupTitle(group.id, this.textContent); // Save the new title
        this.contentEditable = false; // Disable editing
      });

      groupTitleElement.addEventListener("keydown", async function (e) {
        if (e.key === "Enter") {
          e.preventDefault(); // Prevent new line
          await updateGroupTitle(group.id, this.textContent); // Save the new title
          this.contentEditable = false; // Disable editing
          this.blur(); // Remove focus
        }
      });

      // Get all tabs in the current group
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const tabsListElement = groupElement.querySelector(".group-tabs-list");

      for (const tab of tabs) {
        const tabElement = document.createElement("li");

        // Apply tab-specific class for styling
        tabElement.classList.add("tabitem");

        // Set the tab title and add other details like favicon or close button
        tabElement.innerHTML = `
          <div class="tabcontent">
            <div class="tabcontentcontent">
              <img class="tabfavicon" src="${tab.favIconUrl || ""}" alt="favicon" />
              <span class="tabtitle">${tab.title}</span>
            </div>
            <button class="tabclosebutton">x</button>
          </div>
        `;

        // Optional: Add event listener to handle tab actions (e.g., close tab)
        tabElement
          .querySelector(".tabclosebutton")
          .addEventListener("click", async function () {
            await chrome.tabs.remove(tab.id); // Close the tab
            tabElement.remove(); // Remove it from the list
          });

        tabsListElement.appendChild(tabElement);
      }

      groupContainer.appendChild(groupElement);
    }
  } catch (error) {
    console.error("Error displaying tab groups:", error);
  }
}

// Function to update the group title
async function updateGroupTitle(groupId, newTitle) {
  try {
    await chrome.tabGroups.update(groupId, { title: newTitle });
    console.log(`Updated group ${groupId} to title: ${newTitle}`);
  } catch (error) {
    console.error("Error updating group title:", error);
  }
}

displayTabGroups();



