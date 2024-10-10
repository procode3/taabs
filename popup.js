import { initNavigation } from "./controllers/nav.js";
import { autoGroup } from "./controllers/group.js";
import { filterTabs } from "./controllers/search.js";

// Initialize the navigation
initNavigation();

let selectedTabIds = new Set(); // Store selected tab IDs
const selectedCountDisplay = document.querySelector(".selected-count"); // Element to display the count

async function displayTabs(tabs) {
	const template = document.getElementById("li_template");
	const elements = new Set();

	document.querySelector(".listoftabs").innerHTML = ""; // Clear current list

	for (const tab of tabs) {
		const element = template.content.firstElementChild.cloneNode(true);

		const title = tab.title.split("-")[0].trim();
		const pathname = new URL(tab.url).pathname.slice("/docs".length);

		element.querySelector(".title").textContent = title;
		element.querySelector(".pathname").textContent = pathname;
		element.querySelector("a").addEventListener("click", async () => {
			await chrome.tabs.update(tab.id, { active: true });
			await chrome.windows.update(tab.windowId, { focused: true });
		});

		// Add event listener to the checkbox to select/unselect tabs
		const checkbox = element.querySelector(".tab-checkbox");
		checkbox.addEventListener("change", () => {
			updateSelectedCount();
			if (checkbox.checked) {
				selectedTabIds.add(tab.id); // Add tab ID to selected list
			} else {
				selectedTabIds.delete(tab.id); // Remove tab ID from selected list
			}
		});

		// Close tab when 'X' button is clicked
		const deleteButton = element.querySelector(".delete-button");
		deleteButton.addEventListener("click", async () => {
			await chrome.tabs.remove(tab.id); // Close the tab
			element.remove(); // Remove the tab element from the DOM
		});

		elements.add(element);
	}

	document.querySelector(".listoftabs").append(...elements);
	updateSelectedCount();
}

// Query all tabs initially
let tabs = await chrome.tabs.query({
	url: ["https://*/*"], // Example: only query tabs matching certain URLs
});

// Sort tabs alphabetically by title
const collator = new Intl.Collator();
tabs.sort((a, b) => collator.compare(a.title, b.title));

// Display all tabs initially
displayTabs(tabs);

// Search functionality
const searchInput = document.querySelector(".tab-input");

// Add a debounced search input handler
let debounceTimeout;
searchInput.addEventListener("input", () => {
	const searchValue = searchInput.value.toLowerCase();

	// Debounce logic: only execute search after user stops typing for 300ms
	clearTimeout(debounceTimeout);
	debounceTimeout = setTimeout(async () => {
		const filteredTabs = await filterTabs(tabs, searchValue);
		await displayTabs(filteredTabs);
	}, 400); // Adjust the debounce delay if needed
});

// Add event listener for the "Close Selected Tabs" button
const closeSelectedButton = document.querySelector(".delete-icon");
closeSelectedButton.addEventListener("click", async () => {
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

const button = document.querySelector(".group-btn");
button.addEventListener("click", async () => {
	const tabIds = tabs.map(({ id }) => id);
	if (tabIds.length) {
		const group = await chrome.tabs.group({ tabIds });
		await chrome.tabGroups.update(group, { title: "DOCS" });
	}
});

// On page load, get the current state of lazy loading from storage
chrome.storage.local.get(["lazyLoadingEnabled"], (result) => {
	document.getElementById("lazyLoadingToggle").checked =
		result.lazyLoadingEnabled || false;
});

// Save the state of the checkbox when it is changed
document
	.getElementById("lazyLoadingToggle")
	.addEventListener("change", function () {
		const isEnabled = this.checked;

		// Store the new state in chrome.storage.local
		chrome.storage.local.set({ lazyLoadingEnabled: isEnabled }, () => {
			console.log(`Lazy loading ${isEnabled ? "enabled" : "disabled"}`);
		});

		// Notify the background script to enable/disable lazy loading
		chrome.runtime.sendMessage(
			{ action: "toggle_lazy_loading", enabled: isEnabled },
			function (response) {
				if (chrome.runtime.lastError) {
					console.error("Error: ", chrome.runtime.lastError.message);
				} else {
					console.log(response?.status);
				}
			}
		);
	});
async function displayTabGroups() {
  try {
    const tabGroups = await chrome.tabGroups.query({});
    const template = document.getElementById("group_template");
    const groupContainer = document.querySelector(".listofgroups");
    groupContainer.innerHTML = ''; // Clear existing groups

    for (const group of tabGroups) {
      const groupElement = await createGroupElement(group, template);
      groupContainer.appendChild(groupElement);
    }
  } catch (error) {
    console.error("Error displaying tab groups:", error);
  }
}


async function createGroupElement(group, template) {
	if (!template) {
		console.error("Template not found");
		return null; // Exit if the template is not found
	}

	const groupElement = template.content.cloneNode(true);
	const groupTitleElement = groupElement.querySelector(".group-title");
	const tabsListElement = groupElement.querySelector(".group-tabs-list");

	if (!groupTitleElement || !tabsListElement) {
		console.error("Group title or tabs list element not found");
		return null; // Exit if essential elements are not found
	}

	// Set the group title and ID
	groupTitleElement.textContent = group.title || "Unnamed Group";
	tabsListElement.dataset.groupId = group.id;

	// Add event listener to toggle the accordion
	groupElement
		.querySelector(".toggle-button")
		.addEventListener("click", function () {
			const isVisible = tabsListElement.style.display === "flex";
			tabsListElement.style.display = isVisible ? "none" : "flex";
			this.textContent = isVisible ? "+" : "-";
		});

	// Add event listener for editing group title
	groupTitleElement.addEventListener("click", function () {
		this.contentEditable = true;
		this.focus();
	});

	groupTitleElement.addEventListener("blur", async function () {
		await updateGroupTitle(group.id, this.textContent);
		this.contentEditable = false;
	});

	groupTitleElement.addEventListener("keydown", async function (e) {
		if (e.key === "Enter") {
			e.preventDefault();
			await updateGroupTitle(group.id, this.textContent);
			this.contentEditable = false;
			this.blur();
		}
	});

	// Get all tabs in the current group
	const tabs = await chrome.tabs.query({ groupId: group.id });

	for (const tab of tabs) {
		const tabElement = createTabElement(tab);
		tabsListElement.appendChild(tabElement);
	}

	// Make the tabs list element droppable
	tabsListElement.addEventListener("dragover", allowDrop);
	tabsListElement.addEventListener("drop", drop);

	return groupElement.firstElementChild; // Return the actual element
}


function createTabElement(tab) {
  const tabElement = document.createElement("li");
  tabElement.classList.add("tabitem");
  tabElement.setAttribute("draggable", true);
  tabElement.dataset.tabId = tab.id;
  tabElement.dataset.groupId = tab.groupId;

  tabElement.innerHTML = `
    <div class="tabcontent">
      <div class="tabcontentcontent">
        <img class="tabfavicon" src="${tab.favIconUrl || ""}" alt="favicon" />
        <span class="tabtitle">${tab.title}</span>
      </div>
      <button class="tabclosebutton">x</button>
    </div>
  `;

  tabElement.querySelector(".tabclosebutton").addEventListener("click", async function (e) {
    e.stopPropagation(); // Prevent the tab from being activated when closing
    await chrome.tabs.remove(tab.id);
    tabElement.remove();
  });

  // Add event listener to activate the tab when clicked
  tabElement.addEventListener("click", async () => {
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
		document.getElementById("group_template")
	);
	if (updatedGroupElement) {
		groupElement.replaceWith(updatedGroupElement);
	}
}

function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  ev.dataTransfer.setData("text/plain", ev.target.closest('.tabitem').dataset.tabId);
}

async function drop(ev) {
  ev.preventDefault();
  const tabId = parseInt(ev.dataTransfer.getData("text"));
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
		console.error("Error moving tab to new group:", error);
	}finally{
    await displayTabGroups();
  }
}

async function updateGroupTitle(groupId, newTitle) {
  try {
    await chrome.tabGroups.update(groupId, { title: newTitle });
  } catch (error) {
    console.error("Error updating group title:", error);
  }
}

// Make sure to call displayTabGroups() when your popup loads
displayTabGroups();