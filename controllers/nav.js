// Function to initialize the navigation functionality
const homeIcon = document.querySelector('.home-icon');
const groupIcon = document.querySelector('.group-icon');
const settingsIcon = document.querySelector('.settings-icon');

const homeSection = document.querySelector('.lazy-section');
const groupSection = document.querySelector('.group-section');
const settingsSection = document.querySelector('.settings-section');

export function initNavigation() {
  groupSection.style.display = 'none';
  settingsSection.style.display = 'none';

  // Function to switch between sections

  homeIcon.addEventListener('click', () => switchSection(homeSection));
  groupIcon.addEventListener('click', () => switchSection(groupSection));
  settingsIcon.addEventListener('click', () => switchSection(settingsSection));
}

export function switchSection(sectionToShow) {
  homeSection.style.display = 'none';
  groupSection.style.display = 'none';
  settingsSection.style.display = 'none';

  sectionToShow.style.display = 'flex';
}
