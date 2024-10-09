//Function: filterTabs

export async function filterTabs(tabs, searchValue) {
  return await tabs.filter((tab) => {
    const title = tab.title.toLowerCase();
    const url = tab.url.toLowerCase();
    // Filter based on whether the tab's title or URL contains the search value
    return title.includes(searchValue) || url.includes(searchValue);
  });
}
