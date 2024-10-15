//Function: filterTabs
export async function filterTabs(tabs, searchValue) {
  try {
    return await tabs.filter((tab) => {
      const title = tab.title.toLowerCase();
      const url = tab.url.toLowerCase();
      // Filter based on whether the tab's title or URL contains the search value
      return title.includes(searchValue) || url.includes(searchValue);
    });
  } catch (error) {
    console.log(error);
  }
}

export async function searchBookmarks(searchKey) {
  try {
    await chrome.bookmarks.search(searchKey, (result) => {
      console.log(result);
    });
  } catch (error) {
    console.log(error);
  }
}

export async function searchRecentlyClosedTabs(searchKey) {
  try {
    await chrome.sessions.getRecentlyClosed((results) => {
      console.log(results);
    });
  } catch (error) {
    console.log(error);
  }
}
