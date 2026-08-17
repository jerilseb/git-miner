document.addEventListener('DOMContentLoaded', () => {
  const reposApiUrl = "https://api.github.com/search/repositories";
  const miningResultKey = "last_mining_result_v2";
  const miningTimeKey = "last_mining_time_v2";
  const refreshDuration = 180; //minutes
  let requestCount = 0;
  let trendingRequest = false;
  let perPage = 30;

  // Language filter elements
  const languageFilterButton = document.getElementById('language-filter-button');
  const languageFilterDropdown = document.getElementById('language-filter-dropdown');
  const languageOptions = [
    "C", "C#", "C++", "Clojure", "CSS", "Erlang", "Elixir", "Elm", "Go", "HTML",
    "Haskell", "Java", "JavaScript", "Jupyter Notebook", "Kotlin", "Lua", "Python",
    "PHP", "Ruby", "Rust", "R", "Scala", "Swift", "TypeScript"
  ];
  let selectedLanguages = [];

  // Function to create and populate the language filter dropdown
  function createLanguageFilter() {

    languageOptions.forEach(language => {
      const listItem = document.createElement('li');
      const label = document.createElement('label');
      label.classList.add('checkbox', 'language-option');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = language;
      input.addEventListener('change', (event) => {
        if (event.target.checked) {
          selectedLanguages.push(event.target.value)
        } else {
          selectedLanguages = selectedLanguages.filter(item => item !== language)
        }

        // Update only the text part of the button
        const buttonTextSpan = languageFilterButton.querySelector('span');
        if (buttonTextSpan) {
          buttonTextSpan.textContent = selectedLanguages.length > 0 ? selectedLanguages.join(', ') : "All Languages";
        }
        // Save the updated languages to storage
        setOptionsToStorage({ selectedLanguages: selectedLanguages });
        handleFilterChange();

      })
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + language));
      listItem.appendChild(label);
      languageFilterDropdown.appendChild(listItem);
    });

    // Toggle dropdown visibility
    languageFilterButton.addEventListener('click', () => {
      const isHidden = languageFilterDropdown.classList.toggle('hidden');
      languageFilterButton.setAttribute('aria-expanded', String(!isHidden));
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!languageFilterButton.contains(event.target) && !languageFilterDropdown.contains(event.target)) {
        languageFilterDropdown.classList.add('hidden');
        languageFilterButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Function to get options from synced storage
  async function getOptionsFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ["per-page", "selectedLanguages", "dateJump"],
        (result) => {
          resolve(result);
        }
      );
    });
  }

  // Function to set options to synced storage
  async function setOptionsToStorage(options) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(options, () => {
        resolve();
      });
    });
  }

  // Generic function to populate filter selections
  async function populateFilter(filterId, selectedValue) {
    const element = document.getElementById(filterId);
    if (element) {
      if (element.tagName === "SELECT") {
        Array.from(element.options).forEach((option) => {
          if (option.value === selectedValue) {
            option.selected = true;
          }
        });
      } else if (element.type === "text") {
        element.value = selectedValue;
      }
    }
  }

  // Populate saved filters
  async function populateFilters() {
    const options = await getOptionsFromStorage();
    // Check if options exist, otherwise set defaults
    perPage = options["per-page"] || '30';
    const savedDateJump = options.dateJump || 'day';
    selectedLanguages = options.selectedLanguages || [];

    await populateFilter("per-page", perPage);
    await populateFilter("date-jump", savedDateJump);

    // Set selected languages from storage
    document.querySelectorAll('#language-filter-dropdown input[type="checkbox"]').forEach(checkbox => {
      if (selectedLanguages.includes(checkbox.value)) {
        checkbox.checked = true;
      }
    });

    //update languageFilterButton text span
    const buttonTextSpan = languageFilterButton.querySelector('span');
    if (buttonTextSpan) {
      buttonTextSpan.textContent = selectedLanguages.length > 0 ? selectedLanguages.join(', ') : "All Languages";
    }

  }


  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function compactNumber(value) {
    return Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value || 0);
  }

  function languageColor(language) {
    const colors = {
      "C": "#555555",
      "C#": "#178600",
      "C++": "#f34b7d",
      "Clojure": "#db5855",
      "CSS": "#563d7c",
      "Erlang": "#b83998",
      "Elixir": "#6e4a7e",
      "Elm": "#60b5cc",
      "Go": "#00add8",
      "HTML": "#e34c26",
      "Haskell": "#5e5086",
      "Java": "#b07219",
      "JavaScript": "#f1e05a",
      "Jupyter Notebook": "#da5b0b",
      "Kotlin": "#a97bff",
      "Lua": "#000080",
      "Python": "#3572a5",
      "PHP": "#4f5d95",
      "Ruby": "#701516",
      "Rust": "#dea584",
      "R": "#198ce7",
      "Scala": "#c22d40",
      "Swift": "#f05138",
      "TypeScript": "#3178c6",
    };

    return colors[language] || "#94a3b8";
  }

  async function generateReposHtml(repositories, lowerDate, upperDate) {
    const visibleRepositories = repositories.slice(0, perPage);
    let html = "";

    if (visibleRepositories.length === 0) {
      html = `
        <div class="no-results">
          <strong>No repositories found</strong>
          Try widening the time range, clearing the search query, or choosing fewer languages.
        </div>
      `;
    }

    visibleRepositories.forEach(repository => {
      const repoName = escapeHtml(repository.name);
      const ownerName = escapeHtml(repository.owner.login);
      const description = repository.description ? escapeHtml(repository.description) : "No description provided yet.";
      const language = repository.language || "Unknown";
      const safeLanguage = escapeHtml(language);
      const createdAt = timeAgo(repository.created_at);
      const repoUrl = escapeHtml(repository.html_url);
      const avatarUrl = escapeHtml(repository.owner.avatar_url);
      const avatarAlt = escapeHtml(`${repository.owner.login} avatar`);

      html += `
        <a href="${repoUrl}" class="repo-card content-item" target="_blank" rel="noopener noreferrer">
          <div class="repo-card__top">
            <div class="owner-pill" title="${ownerName}">
              <img src="${avatarUrl}" alt="${avatarAlt}" class="avatar-img" width="26" height="26">
              <span>${ownerName}</span>
            </div>
            <span class="external-link" aria-hidden="true">↗</span>
          </div>

          <h2 class="repo-card__title">${repoName}</h2>
          <p class="repo-description">${description}</p>

          <div class="repo-card__meta">
            <span class="meta-pill meta-pill--stars">★ ${compactNumber(repository.stargazers_count)}</span>
            <span class="meta-pill"><span class="language-dot" style="--language-color: ${languageColor(language)}"></span>${safeLanguage}</span>
            <span class="meta-pill">◷ ${createdAt}</span>
          </div>
        </a>
      `;
    });

    const humanDate = timeAgo(lowerDate);

    const finalHtml = `
      <div class="content-batch">
        <h1 class="date-head" data-date="${lowerDate}">
          <span class="date-pill">From ${humanDate} · ${formatDate(lowerDate)} – ${formatDate(upperDate)}</span>
        </h1>
        <div class="content-grid">
          ${html}
        </div>
      </div>
    `;

    return finalHtml;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const month = date.toLocaleString('default', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor(Math.abs(now - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;

  }



  async function getNextDateRange() {
    const dateJumpSelect = document.getElementById("date-jump");
    // Find all date headers
    const dateHeads = document.querySelectorAll(".date-head");
    let dateRange = {};
    let dateJump = dateJumpSelect.value;
    let multiplier = 1;

    if (dateJump.startsWith("bi")) {
      dateJump = dateJump.slice(2);
      multiplier *= 2;
    } else if (dateJump.startsWith("tri")) {
      dateJump = dateJump.slice(3);
      multiplier *= 3;
    } else if (dateJump.startsWith("half")) {
      dateJump = dateJump.slice(4);
      multiplier *= 0.5;
    }

    const dateUnits = {
      day: 1,
      week: 7,
      month: 30, // Approximation
      year: 365 // Approximation
    };

    if (dateHeads.length > 0) {
      // Get the last date-head element
      const lastDateHead = dateHeads[dateHeads.length - 1];
      // Extract the lower date from the data-date attribute
      const lastLowerDate = lastDateHead.dataset.date;

      // Use this as the upper date for the new range
      dateRange.upper = lastLowerDate;

      // Calculate new lower date by subtracting from the upper date
      const upperDate = new Date(lastLowerDate);
      const lowerDate = new Date(upperDate);
      lowerDate.setDate(upperDate.getDate() - (multiplier * dateUnits[dateJump]));

      dateRange.lower = lowerDate.toISOString().split('T')[0];
    } else {
      // First load - start from today
      const today = new Date();
      dateRange.upper = today.toISOString().split('T')[0];

      const lowerDate = new Date(today);
      lowerDate.setDate(today.getDate() - (multiplier * dateUnits[dateJump]));

      dateRange.lower = lowerDate.toISOString().split('T')[0];
    }

    return dateRange;
  }


  async function getApiFilters() {
    const dateRange = await getNextDateRange();
    const searchQuery = document.getElementById("search-query").value;
    let langCondition = searchQuery ? searchQuery + "+" : "";

    // Use selectedLanguages array directly
    selectedLanguages.forEach(language => {
      langCondition += `language:"${language}"+`;
    });

    let apiToken = "";

    return {
      queryParams: `?sort=stars&order=desc&q=${langCondition}created:${dateRange.lower}..${dateRange.upper}${apiToken}`,
      dateRange: dateRange,
    };
  }


  async function saveMiningResult() {
    const huntResults = document.querySelector(".main-content").innerHTML;
    if (!huntResults) {
      return false;
    }

    localStorage.setItem(miningResultKey, huntResults);
    localStorage.setItem(miningTimeKey, new Date().toISOString().split('T')[0] + " " + new Date().toISOString().split('T')[1].split('.')[0]);

  }


  async function shouldRefresh() {
    if (requestCount !== 0) {
      return true;
    }

    const lastHuntResult = localStorage.getItem(miningResultKey);
    const lastHuntTime = localStorage.getItem(miningTimeKey);


    if (!lastHuntResult || !lastHuntTime || lastHuntResult.trim() === "undefined") {
      return true;
    }

    const now = new Date();
    const then = new Date(lastHuntTime);

    const diffInMilliseconds = now.getTime() - then.getTime();
    const diffInMinutes = diffInMilliseconds / (1000 * 60);


    if (diffInMinutes >= refreshDuration) {
      return true;
    }

    document.querySelector(".main-content").innerHTML = lastHuntResult;
    requestCount++;
    return false;
  }


  async function fetchTrendingRepos() {
    if (trendingRequest !== false || document.querySelector(".error-quote")) {
      return false;
    }

    if (!(await shouldRefresh())) {
      return false;
    }

    const filters = await getApiFilters();
    const url = reposApiUrl + filters.queryParams;

    trendingRequest = true;
    document.querySelector(".loading-more").classList.remove("hidden");

    try {
      const response = await fetch(url);
      if (!response.ok) {

        const errorText = await response.text();
        let errorMessage = `Network response was not ok. Status: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += `\nMessage: ${errorJson.message}`;
          if (errorJson.errors && Array.isArray(errorJson.errors)) {
            errorJson.errors.forEach(err => {
              errorMessage += `\n- ${err.message || err.code}`;
            });
          }

        } catch (parseError) {
          errorMessage += `\nRaw error text: ${errorText}`
        }

        throw new Error(errorMessage);

      }
      const data = await response.json();
      const finalHtml = await generateReposHtml(
        data.items,
        filters.dateRange.lower,
        filters.dateRange.upper
      );
      document.querySelector(".main-content").insertAdjacentHTML("beforeend", finalHtml);
      trendingRequest = false;
      document.querySelector(".loading-more").classList.add("hidden");
      await saveMiningResult();
    } catch (error) {
      console.error("Fetch Error:", error.message);
      let errorMessage = error.message;

      let errorContent = '<div class="quote-item error-quote"><strong>Oops! Failed to fetch</strong>GitHub did not return repository results. Please try again in a moment.</div>';

      if (errorMessage.includes("rate limit")) {
        errorContent = '<div class="quote-item error-quote"><strong>GitHub rate limit exceeded</strong>Wait another hour for GitHub to refresh your rate limit.</div>';
      }
      document.querySelector(".main-content").innerHTML = errorContent;

      trendingRequest = false;
      document.querySelector(".loading-more").classList.add("hidden");
    }
  }


  async function handleFilterChange() {
    requestCount++;
    document.querySelector(".main-content").innerHTML = ""; // Clear existing repos
    await fetchTrendingRepos(); // Fetch with new filters
  }

  function bindUI() {

    window.addEventListener("scroll", async () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        await fetchTrendingRepos();
      }
    });

    // Event listener for filter changes
    document.getElementById("date-jump").addEventListener("change", async () => {
      const selectedValue = document.getElementById("date-jump").value;
      await setOptionsToStorage({ dateJump: selectedValue });
      await handleFilterChange()
    });

    const searchInput = document.getElementById("search-query");
    const searchClear = document.getElementById("search-clear");
    let searchDebounce;

    function syncSearchClear() {
      searchClear.classList.toggle("hidden", searchInput.value === "");
    }

    searchInput.addEventListener("input", () => {
      syncSearchClear();
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => handleFilterChange(), 450);
    });

    // Escape clears the query without waiting for the debounce
    searchInput.addEventListener("keydown", async (event) => {
      if (event.key === "Escape" && searchInput.value !== "") {
        event.preventDefault();
        await clearSearch();
      }
    });

    searchClear.addEventListener("click", clearSearch);

    async function clearSearch() {
      clearTimeout(searchDebounce);
      searchInput.value = "";
      syncSearchClear();
      searchInput.focus();
      await handleFilterChange();
    }

    syncSearchClear();

    if (document.getElementById("per-page")) {
      document.getElementById("per-page").addEventListener("change", async () => {
        perPage = document.getElementById("per-page").value; // Update perPage
        await setOptionsToStorage({ "per-page": perPage });
        const notice = document.querySelector(".quote-item");
        if (notice) {
          notice.textContent = "Changes will take effect from the next fetch";
        }
      });
    }
  }

  async function init() {
    bindUI();
    createLanguageFilter();
    await populateFilters();

    if (location.pathname.includes("gitminer.html")) {
      await fetchTrendingRepos();
    }

  }

  init(); // Call the init function to start everything

});