//function to auto group tabs based on their domain
export const autoGroup = async () => {
  const tabs = await chrome.tabs.query({});
  const groups = new Map();

  for (const tab of tabs) {
    const url = new URL(tab.url);
    const domain = url.hostname;

    if (groups.has(domain)) {
      groups.get(domain).push(tab);
    } else {
      groups.set(domain, [tab]);
    }
  }

  for (const [domain, tabs] of groups) {
    const group = {
      name: domain,
      tabs,
    };

    await saveGroup(group);
  }
};

export const deleteGroup = async () => {};

export const renameGroup = async () => {};
