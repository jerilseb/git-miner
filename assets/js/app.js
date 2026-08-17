const themeKey = "theme_preference";
const systemThemeQuery = matchMedia("(prefers-color-scheme: dark)");

function systemTheme() {
  return systemThemeQuery.matches ? "dark" : "light";
}

// Runs at parse time rather than on DOMContentLoaded so the theme is on <html>
// before the body is painted, which is also why the choice lives in
// localStorage: chrome.storage is async and would flash the wrong theme.
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

// Nothing stored means "follow the OS", so the OS is read but not persisted.
applyTheme(localStorage.getItem(themeKey) || systemTheme());

const railWidthKey = "rail_width";
const railWidthDefault = 440;
const railWidthMin = 260;
const railWidthMax = 900;

function clampRailWidth(width, max = railWidthMax) {
  return Math.min(Math.max(width, railWidthMin), max);
}

// One variable on <html> drives every batch's column split, so a single drag
// resizes all the date windows at once.
function applyRailWidth(width) {
  document.documentElement.style.setProperty("--rail-width", `${Math.round(width)}px`);
}

// Applied at parse time, like the theme, so a batch restored from cache doesn't
// paint at the default width and then jump.
const storedRailWidth = Number(localStorage.getItem(railWidthKey));
if (storedRailWidth > 0) {
  applyRailWidth(clampRailWidth(storedRailWidth));
}

document.addEventListener('DOMContentLoaded', () => {
  const reposApiUrl = "https://api.github.com/search/repositories";
  // Algolia rather than the official Firebase API: one request per window
  // instead of one per story, and it sorts by points for a date range.
  const hnApiUrl = "https://hn.algolia.com/api/v1/search";
  // _v3: the cache holds rendered HTML, so the key has to change whenever the
  // markup does or existing users keep seeing the old layout for up to 3h.
  const miningResultKey = "last_mining_result_v3";
  const miningTimeKey = "last_mining_time_v3";
  const refreshDuration = 180; //minutes
  let requestCount = 0;
  let trendingRequest = false;
  const perPage = 30;
  const hnPerPage = 30;

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
      label.classList.add('language-option');
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
        ["selectedLanguages", "dateJump"],
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

  // Populate saved filters
  async function populateFilters() {
    const options = await getOptionsFromStorage();
    // Check if options exist, otherwise set defaults
    selectedLanguages = options.selectedLanguages || [];

    document.getElementById("date-jump").value = options.dateJump || 'day';

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

  function repoCardHtml(repository) {
    const repoName = escapeHtml(repository.name);
    const ownerName = escapeHtml(repository.owner.login);
    const description = repository.description ? escapeHtml(repository.description) : "No description provided yet.";
    const language = repository.language || "Unknown";
    const safeLanguage = escapeHtml(language);
    const createdAt = timeAgo(repository.created_at);
    const repoUrl = escapeHtml(repository.html_url);
    const avatarUrl = escapeHtml(repository.owner.avatar_url);
    const avatarAlt = escapeHtml(`${repository.owner.login} avatar`);

    return `
      <a href="${repoUrl}" class="repo-card" target="_blank" rel="noopener noreferrer">
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
  }

  function storyDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function hnItemHtml(story) {
    const threadUrl = `https://news.ycombinator.com/item?id=${encodeURIComponent(story.objectID)}`;
    // Ask HN / Show HN text posts have no url at all, so fall back to the thread.
    const title = escapeHtml(story.title || "Untitled");
    const titleUrl = escapeHtml(story.url || threadUrl);
    const domain = escapeHtml(storyDomain(story.url));
    const comments = compactNumber(story.num_comments);

    return `
      <li class="hn-item">
        <a href="${titleUrl}" class="hn-item__title" target="_blank" rel="noopener noreferrer">${title}</a>
        <div class="hn-item__meta">
          <span class="hn-points">▲ ${compactNumber(story.points)}</span>
          ${domain ? `<span class="hn-domain" title="${domain}">${domain}</span>` : ""}
          <a href="${escapeHtml(threadUrl)}" class="hn-comments" target="_blank" rel="noopener noreferrer">${comments} comments</a>
          <span class="hn-time">◷ ${timeAgo(story.created_at)}</span>
        </div>
      </li>
    `;
  }

  // The .error-quote class also latches further fetching, which is what stops
  // infinite scroll from hammering a rate-limited API.
  function repoErrorHtml(error) {
    if (error.message.includes("rate limit")) {
      return `
        <div class="quote-item error-quote">
          <strong>GitHub rate limit exceeded</strong>
          Wait another hour for GitHub to refresh your rate limit.
        </div>
      `;
    }

    return `
      <div class="quote-item error-quote">
        <strong>Oops! Failed to fetch</strong>
        GitHub did not return repository results. Please try again in a moment.
      </div>
    `;
  }

  // repositories === null means the GitHub request failed (see repoError).
  function generateBatchHtml({ repositories, repoError, stories, hnError, lowerDate, upperDate }) {
    let reposHtml;

    if (repositories === null) {
      reposHtml = repoErrorHtml(repoError);
    } else if (repositories.length === 0) {
      reposHtml = `
        <div class="no-results">
          <strong>No repositories found</strong>
          Try widening the time range, clearing the search query, or choosing fewer languages.
        </div>
      `;
    } else {
      reposHtml = repositories.slice(0, perPage).map(repoCardHtml).join("");
    }

    let railBody;

    if (hnError) {
      // Deliberately not .error-quote: that would latch the scroll loop.
      railBody = `<p class="rail-note">Couldn't reach Hacker News.</p>`;
    } else if (stories.length === 0) {
      railBody = `<p class="rail-note">No stories in this window.</p>`;
    } else {
      railBody = `<ol class="hn-list">${stories.map(hnItemHtml).join("")}</ol>`;
    }

    const railHtml = `
      <aside class="hn-rail">
        <h2 class="rail-head">Hacker News</h2>
        ${railBody}
      </aside>
    `;

    const humanDate = timeAgo(lowerDate);

    return `
      <div class="content-batch">
        <h1 class="date-head" data-date="${lowerDate}">
          <span class="date-pill">From ${humanDate} · ${formatDate(lowerDate)} – ${formatDate(upperDate)}</span>
        </h1>
        <div class="batch-body">
          <div class="content-grid">
            ${reposHtml}
          </div>
          <div class="batch-resizer" role="separator" aria-orientation="vertical" tabindex="0"
            aria-label="Resize the Hacker News column"
            title="Drag to resize · double-click to reset"></div>
          ${railHtml}
        </div>
      </div>
    `;
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


  function reposRequestUrl(dateRange) {
    const searchQuery = document.getElementById("search-query").value;
    let langCondition = searchQuery ? searchQuery + "+" : "";

    // Use selectedLanguages array directly
    selectedLanguages.forEach(language => {
      langCondition += `language:"${language}"+`;
    });

    return `${reposApiUrl}?sort=stars&order=desc&q=${langCondition}created:${dateRange.lower}..${dateRange.upper}`;
  }

  function hnRequestUrl(dateRange) {
    // GitHub's created:A..B spans both whole days, so match that. URLSearchParams
    // percent-encodes the > and < in numericFilters, which Algolia requires.
    const lower = Math.floor(new Date(`${dateRange.lower}T00:00:00Z`).getTime() / 1000);
    const upper = Math.floor(new Date(`${dateRange.upper}T23:59:59Z`).getTime() / 1000);

    const params = new URLSearchParams({
      tags: "story",
      numericFilters: `created_at_i>${lower},created_at_i<${upper}`,
      hitsPerPage: String(hnPerPage),
      query: document.getElementById("search-query").value.trim(),
    });

    return `${hnApiUrl}?${params}`;
  }

  async function describeResponseError(response) {
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

    return errorMessage;
  }

  async function fetchRepos(dateRange) {
    const response = await fetch(reposRequestUrl(dateRange));
    if (!response.ok) {
      throw new Error(await describeResponseError(response));
    }

    const data = await response.json();
    return data.items || [];
  }

  async function fetchHnStories(dateRange) {
    const response = await fetch(hnRequestUrl(dateRange));
    if (!response.ok) {
      throw new Error(await describeResponseError(response));
    }

    const data = await response.json();
    return data.hits || [];
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


  async function fetchNextBatch() {
    if (trendingRequest !== false || document.querySelector(".error-quote")) {
      return false;
    }

    if (!(await shouldRefresh())) {
      return false;
    }

    // Read the scroll cursor once so both sources cover the same window.
    const dateRange = await getNextDateRange();

    trendingRequest = true;
    document.querySelector(".loading-more").classList.remove("hidden");

    // Languages narrow the repo query only; the rail always shows the window's
    // top stories. The search box, unlike languages, does apply to both.
    const [repoResult, hnResult] = await Promise.allSettled([
      fetchRepos(dateRange),
      fetchHnStories(dateRange),
    ]);

    if (repoResult.status === "rejected") {
      console.error("GitHub fetch failed:", repoResult.reason.message);
    }
    if (hnResult.status === "rejected") {
      console.error("Hacker News fetch failed:", hnResult.reason.message);
    }

    const finalHtml = generateBatchHtml({
      repositories: repoResult.status === "fulfilled" ? repoResult.value : null,
      repoError: repoResult.status === "rejected" ? repoResult.reason : null,
      stories: hnResult.status === "fulfilled" ? hnResult.value : [],
      hnError: hnResult.status === "rejected" ? hnResult.reason : null,
      lowerDate: dateRange.lower,
      upperDate: dateRange.upper,
    });

    document.querySelector(".main-content").insertAdjacentHTML("beforeend", finalHtml);

    // Only cache a clean batch. Caching a failure would pin the error card or
    // the rail note in place for the 3h TTL, long after the source recovers.
    if (repoResult.status === "fulfilled" && hnResult.status === "fulfilled") {
      await saveMiningResult();
    }

    trendingRequest = false;
    document.querySelector(".loading-more").classList.add("hidden");
  }


  async function handleFilterChange() {
    requestCount++;
    document.querySelector(".main-content").innerHTML = ""; // Clear existing repos
    await fetchNextBatch(); // Fetch with new filters
  }

  function bindUI() {

    window.addEventListener("scroll", async () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        await fetchNextBatch();
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
    bindThemeToggle();
    bindRailResizer();
  }

  function bindRailResizer() {
    const main = document.querySelector(".main-content");
    const minGridWidth = 320;
    let drag = null;

    function currentRailWidth() {
      const width = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--rail-width")
      );
      return width > 0 ? width : railWidthDefault;
    }

    // Widening the rail must always leave the repo grid something to work with.
    // The handle track and the two gaps sit between them and cost width too.
    function maxRailWidth(handle) {
      const body = handle.parentElement;
      const gap = parseFloat(getComputedStyle(body).columnGap) || 0;
      const between = handle.offsetWidth + gap * 2;

      return Math.max(railWidthMin, body.clientWidth - minGridWidth - between);
    }

    function persistRailWidth() {
      localStorage.setItem(railWidthKey, String(Math.round(currentRailWidth())));
    }

    // Delegated: batches arrive later from scrolling and from the HTML cache.
    main.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest(".batch-resizer");
      if (!handle) {
        return;
      }

      drag = {
        startX: event.clientX,
        startWidth: currentRailWidth(),
        max: maxRailWidth(handle),
      };

      // Capture so the drag survives the pointer leaving the 1px handle.
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add("is-resizing");
      event.preventDefault();
    });

    main.addEventListener("pointermove", (event) => {
      if (!drag) {
        return;
      }

      // Dragging left widens the rail.
      applyRailWidth(clampRailWidth(drag.startWidth - (event.clientX - drag.startX), drag.max));
    });

    function endDrag() {
      if (!drag) {
        return;
      }

      drag = null;
      document.body.classList.remove("is-resizing");
      persistRailWidth();
    }

    main.addEventListener("pointerup", endDrag);
    main.addEventListener("pointercancel", endDrag);

    main.addEventListener("keydown", (event) => {
      const handle = event.target.closest(".batch-resizer");
      if (!handle) {
        return;
      }

      const step = event.key === "ArrowLeft" ? 24 : event.key === "ArrowRight" ? -24 : 0;
      if (step === 0) {
        return;
      }

      event.preventDefault();
      applyRailWidth(clampRailWidth(currentRailWidth() + step, maxRailWidth(handle)));
      persistRailWidth();
    });

    main.addEventListener("dblclick", (event) => {
      if (!event.target.closest(".batch-resizer")) {
        return;
      }

      applyRailWidth(railWidthDefault);
      persistRailWidth();
    });
  }

  function bindThemeToggle() {
    const themeToggle = document.getElementById("theme-toggle");

    function syncThemeToggle() {
      const title = document.documentElement.dataset.theme === "dark"
        ? "Dark theme — switch to light"
        : "Light theme — switch to dark";

      themeToggle.title = title;
      themeToggle.setAttribute("aria-label", title);
    }

    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";

      applyTheme(next);
      localStorage.setItem(themeKey, next);
      syncThemeToggle();
    });

    // Keep following the OS until the toggle has been used at least once.
    systemThemeQuery.addEventListener("change", () => {
      if (!localStorage.getItem(themeKey)) {
        applyTheme(systemTheme());
        syncThemeToggle();
      }
    });

    syncThemeToggle();
  }

  async function init() {
    bindUI();
    createLanguageFilter();
    await populateFilters();
    await fetchNextBatch();
  }

  init(); // Call the init function to start everything

});