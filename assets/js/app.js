document.addEventListener('DOMContentLoaded', () => {
    const reposApiUrl = "https://api.github.com/search/repositories";
    const huntResultKey = "last_hunt_result";
    const huntTimeKey = "last_hunt_time";
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
        const link = document.createElement('a');
        link.href = "#";
        const label = document.createElement('label');
        label.classList.add('checkbox');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = language;
        input.addEventListener('change', (event) => {
          if(event.target.checked) {
              selectedLanguages.push(event.target.value)
          } else {
              selectedLanguages = selectedLanguages.filter(item => item !== language)
          }
  
          languageFilterButton.innerText = selectedLanguages.length > 0? selectedLanguages.join(', ') : "All Languages";
          handleFilterChange();
  
        })
        label.appendChild(input);
        label.appendChild(document.createTextNode(" "+ language));
        link.appendChild(label);
        listItem.appendChild(link);
        languageFilterDropdown.appendChild(listItem);
      });
  
      // Toggle dropdown visibility
      languageFilterButton.addEventListener('click', () => {
        languageFilterDropdown.classList.toggle('hidden');
      });
  
      // Close dropdown when clicking outside
      document.addEventListener('click', (event) => {
        if (!languageFilterButton.contains(event.target) && !languageFilterDropdown.contains(event.target)) {
          languageFilterDropdown.classList.add('hidden');
        }
      });
    }
  
      // Function to get options from synced storage
    async function getOptionsFromStorage() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(
          ["githunt_token", "per-page", "selectedLanguages", "dateJump"],
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
      const token = options.githunt_token || '';
      perPage = options["per-page"] || '30';
      const savedDateJump = options.dateJump || 'day';
      selectedLanguages = options.selectedLanguages || [];
  
      await populateFilter("githunt_token", token);
      await populateFilter("per-page", perPage);
      await populateFilter("date-jump", savedDateJump);
  
      // Set selected languages from storage
      document.querySelectorAll('#language-filter-dropdown input[type="checkbox"]').forEach(checkbox => {
          if (selectedLanguages.includes(checkbox.value)) {
          checkbox.checked = true;
          }
      });
  
      //update languageFilterButton text
      languageFilterButton.innerText = selectedLanguages.length > 0? selectedLanguages.join(', ') : "All Languages";
  
      }
  
  
    async function generateReposHtml(repositories, lowerDate, upperDate) {
      let html = "";
  
      repositories = repositories.slice(0, perPage);
  
      repositories.forEach(repository => {
          const repFullName = document.createElement("div").textContent = repository.name;
          let repFullDesc = repository.description ? (document.createElement("div").textContent = repository.description) : "<i>No description or website provided</i>";
          const createdAt = timeAgo(repository.created_at);
  
        html += `
                  <a href="${repository.html_url}" class="content-item block transition duration-150 ease-in-out">
                      <div class="header text-lg font-bold text-blue-400 truncate">${repFullName}</div>
                      <p class="tagline text-sm mt-1">${repFullDesc}</p>
                      <div class="footer">
                          <span class="footer-stat text-yellow-400"><i class="fa fa-star-o"></i> ${repository.stargazers_count}</span>
                          <span class="footer-stat text-green-400"><i class="fa fa-code-fork"></i> ${repository.forks_count}</span>
                          <span class="footer-stat text-purple-400"><i class="fa fa-code"></i> ${repository.language || 'Unknown'}</span>
                          <span class="created-at"><i class="fa fa-clock-o"></i> ${createdAt}</span>
                      </div>
                  </a>
              `;
      });
  
      const humanDate = timeAgo(lowerDate);
  
      const finalHtml = `
              <div class="content-batch">
                  <h1 class="date-head text-lg font-semibold my-4" data-date="${lowerDate}">From ${humanDate} - ${formatDate(lowerDate)} – ${formatDate(upperDate)}</h1>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
  
  
      const options = await getOptionsFromStorage();
      const token = (options && options.githunt_token) ? options.githunt_token.trim() : "";
      let apiToken = "";
  
      if (token) {
        apiToken = `&access_token=${token}`;
      }
  
      return {
        queryParams: `?sort=stars&order=desc&q=${langCondition}created:${dateRange.lower}..${dateRange.upper}${apiToken}`,
        dateRange: dateRange,
      };
    }
  
  
  
    async function saveHuntResult() {
      const huntResults = document.querySelector(".main-content").innerHTML;
      if (!huntResults) {
        return false;
      }
  
      localStorage.setItem(huntResultKey, huntResults);
      localStorage.setItem(huntTimeKey, new Date().toISOString().split('T')[0] + " " +new Date().toISOString().split('T')[1].split('.')[0] );
  
    }
  
  
    async function shouldRefresh() {
      if (requestCount !== 0) {
        return true;
      }
  
      const lastHuntResult = localStorage.getItem(huntResultKey);
      const lastHuntTime = localStorage.getItem(huntTimeKey);
  
  
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
  
          } catch(parseError) {
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
        await saveHuntResult();
      } catch (error) {
        console.error("Fetch Error:", error.message);
        let errorMessage = error.message;
  
        let errorContent = '<h4 class="quote-item error-quote">Oops! Failed to fetch</h4>';
  
        if (errorMessage.includes("Bad credentials")) {
            errorContent = '<h3 class="quote-item error-quote">Oops! Seems to be a problem with your API token. Could you verify the API token you entered in extension options.</h3>';
            // Reset token in storage.
            await setOptionsToStorage({ githunt_token: "" });
        } else if(errorMessage.includes("rate limit")) {
            errorContent = '<h3 class="quote-item error-quote">Oops! Seems like you did not set the API token or your token has expired. Wait another hour for github to refresh your rate limit or better add a token in `Githunt Options` to hunt more.</h3>';
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
  
      document.getElementById("search-query").addEventListener("change", async() => await handleFilterChange());
  
      if(document.querySelector(".save-token")) {
          document.querySelector(".save-token").addEventListener("click", async (e) => {
            e.preventDefault();
            const token = document.querySelector(".githunt_token").value;
            await setOptionsToStorage({ githunt_token: token });
            document.querySelector(".quote-item").textContent =
              "Woohoo! Token saved, happy hunting.";
          });
      }
  
      if(document.getElementById("per-page")){
          document.getElementById("per-page").addEventListener("change", async () => {
              perPage = document.getElementById("per-page").value; // Update perPage
              await setOptionsToStorage({ "per-page": perPage });
              document.querySelector(".quote-item").textContent = "Changes will take effect from the next fetch";
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