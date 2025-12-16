const darkBtn = document.getElementById("dark-mode-toggle");

// SVG icons
const sunIcon = `<svg class="feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="5"></circle>
  <line x1="12" y1="1" x2="12" y2="3"></line>
  <line x1="12" y1="21" x2="12" y2="23"></line>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
  <line x1="1" y1="12" x2="3" y2="12"></line>
  <line x1="21" y1="12" x2="23" y2="12"></line>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
</svg>`;

const moonIcon = `<svg class="feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
</svg>`;

// Initialize theme - default to dark if no preference is saved
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  
  if (savedTheme === "light") {
    setTheme("light");
  } else {
    // Default to dark theme
    setTheme("dark");
  }
}

function setTheme(mode) {
  if (mode === "light") {
    document.getElementById("darkModeStyle").disabled = true;
    document.getElementById("dark-mode-toggle").innerHTML = moonIcon;
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    localStorage.setItem("theme", "light");
  } else {
    document.getElementById("darkModeStyle").disabled = false;
    document.getElementById("dark-mode-toggle").innerHTML = sunIcon;
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    localStorage.setItem("theme", "dark");
  }
}

function toggleTheme() {
  const currentTheme = localStorage.getItem("theme");
  
  if (currentTheme === "dark") {
    setTheme("light");
  } else {
    setTheme("dark");
  }
}

// Initialize theme on page load
initTheme();
