//function to search for tab

export const tabSearch = async () => {
  const query = document.getElementById('search').value;
  const tabs = await chrome.tabs.query({ title: query });
  const elements = new Set();

  for (const tab of tabs) {
    const element = document.createElement('li');
    element.innerHTML = `
        <img src="${tab.favIconUrl}" alt="Favicon" />
        <div>
            <h2 class="title">${tab.title}</h2>
            <p class="pathname">${tab.url}</p>
            <a href="#">Focus Tab</a>
        </div>
        `;

    element.querySelector('a').addEventListener('click', async () => {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    });

    elements.add(element);
  }

  document.querySelector('ul').innerHTML = '';
  document.querySelector('ul').append(...elements);
};
