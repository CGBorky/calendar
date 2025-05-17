let currentDate = new Date();
let currentToken = null;
let selectedDay = null;
let cachedEvents = [];

function getMonthName(index) {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2000, index));
}

function setupMonthPicker() {
  const monthPicker = document.getElementById("month-picker");
  monthPicker.innerHTML = "";

  for (let i = 0; i < 12; i++) {
    const btn = document.createElement("button");
    btn.textContent = getMonthName(i).substr(0, 3);
    btn.dataset.index = i;
    btn.addEventListener("click", () => {
      currentDate.setMonth(i);
      loadAndRenderCalendar();
    });
    monthPicker.appendChild(btn);
  }
}

function setupYearPicker() {
  const yearPicker = document.getElementById("year-picker");
  yearPicker.innerHTML = "";

  for (let y = 1970; y <= 2100; y++) {
    const btn = document.createElement("button");
    btn.textContent = y;
    btn.dataset.year = y;
    btn.addEventListener("click", () => {
      currentDate.setFullYear(parseInt(btn.dataset.year));
      loadAndRenderCalendar();
    });
    yearPicker.appendChild(btn);
  }
}

function scrollToCurrentYear() {
  const yearPicker = document.getElementById("year-picker");
  const currentYear = currentDate.getFullYear();
  const btn = yearPicker.querySelector(`button[data-year="${currentYear}"]`);
  if (btn) {
    const offsetTop = btn.offsetTop;
    const containerHeight = yearPicker.clientHeight;
    yearPicker.scrollTop = offsetTop - containerHeight / 2 + btn.offsetHeight / 2;
  }
}

function highlightSelected() {
  document.querySelectorAll("#month-picker button").forEach(btn =>
    btn.classList.toggle("selected", parseInt(btn.dataset.index) === currentDate.getMonth())
  );
  document.querySelectorAll("#year-picker button").forEach(btn =>
    btn.classList.toggle("selected", parseInt(btn.dataset.year) === currentDate.getFullYear())
  );
}

function checkIfLoggedIn(callback) {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (chrome.runtime.lastError || !token) {
      callback(null);
    } else {
      callback(token);
    }
  });
}

function getTokenInteractive(callback) {
  chrome.runtime.sendMessage({ type: "getAuthToken" }, (res) => {
    if (res?.token) {
      currentToken = res.token;
      callback(currentToken);
    } else {
      alert("Google authentication failed.");
    }
  });
}

function fetchUserInfo(token) {
  return fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: "Bearer " + token }
  }).then(res => res.json());
}

function fetchEventsForMonth(token, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();

  return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime`, {
    headers: { Authorization: "Bearer " + token }
  }).then(res => res.json()).then(data => data.items || []);
}

function createEvent(token, date, title, time) {
  const tz = "Europe/Bratislava";
  const event = {
    summary: title,
    start: {},
    end: {}
  };

  if (time) {
    event.start.dateTime = `${date}T${time}:00`;
    event.end.dateTime = `${date}T${time}:59`;
  } else {
    event.start.dateTime = `${date}T00:00:00`;
    event.end.dateTime = `${date}T23:59:59`;
  }

  event.start.timeZone = tz;
  event.end.timeZone = tz;

  return fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event)
  });
}

function generateCalendar(date, events = []) {
  const calendarBody = document.getElementById("calendar-body");
  const month = date.getMonth();
  const year = date.getFullYear();
  const today = new Date();

  document.getElementById("toggle-picker").textContent = `${getMonthName(month)} ${year}`;
  calendarBody.innerHTML = "";

  const firstJsDay = new Date(year, month, 1).getDay();
  const firstDay = (firstJsDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let dateCount = 1;

  for (let i = 0; i < 6; i++) {
    const row = document.createElement("tr");

    for (let j = 0; j < 7; j++) {
      const cell = document.createElement("td");
      cell.classList.add("date-cell");

      if (i === 0 && j < firstDay) {
        cell.innerHTML = "";
      } else if (dateCount > daysInMonth) {
        cell.innerHTML = "";
      } else {
        const fullDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(dateCount).padStart(2, "0")}`;

        const wrapper = document.createElement("div");
        wrapper.className = "cell-content";

        const numberSpan = document.createElement("span");
        numberSpan.textContent = dateCount;

        const isToday =
          dateCount === today.getDate() &&
          year === today.getFullYear() &&
          month === today.getMonth();

        if (isToday) {
          cell.classList.add("today");
        }

        const matchingEvents = events.filter(e =>
          e.start?.date === fullDate || (e.start?.dateTime && e.start.dateTime.startsWith(fullDate))
        );

        wrapper.appendChild(numberSpan);

        if (matchingEvents.length) {
          const dot = document.createElement("div");
          dot.className = "event-dot";
          dot.title = matchingEvents.map(e => e.summary).join(", ");
          wrapper.appendChild(dot);
        }

        cell.appendChild(wrapper);

        cell.addEventListener("click", () => {
          selectedDay = fullDate;
          document.getElementById("event-popup").classList.remove("hidden");
          document.getElementById("event-title").value = "";
          document.getElementById("event-time").value = "";
        });

        dateCount++;
      }

      row.appendChild(cell);
    }

    calendarBody.appendChild(row);
  }
  document.querySelectorAll(".date-cell").forEach(cell => {
    const bottomZone = document.createElement("div");
    bottomZone.classList.add("bottom-zone");
    bottomZone.innerHTML = "+";
    bottomZone.style.display = "none";
    bottomZone.style.position = "absolute";
    bottomZone.style.bottom = "5px";
    bottomZone.style.right = "5px";
    bottomZone.style.cursor = "pointer";
    bottomZone.style.color = "#4caf50";

    cell.appendChild(bottomZone);

    cell.addEventListener("mouseenter", () => {
      bottomZone.style.display = "block";
    });

    cell.addEventListener("mouseleave", () => {
      bottomZone.style.display = "none";
    });

    bottomZone.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedDay = cell.getAttribute("data-date");
      document.getElementById("event-popup").classList.remove("hidden");
      document.getElementById("event-title").value = "";
      document.getElementById("event-time").value = "";
    });
  });

  highlightSelected();
}


function loadAndRenderCalendar() {
  if (!currentToken) {
    generateCalendar(currentDate, []);
  } else {
    fetchEventsForMonth(currentToken, currentDate).then(events => {
      cachedEvents = events;
      generateCalendar(currentDate, events);
    });
  }
}

function loadTheme() {
  chrome.storage.local.get("theme", (result) => {
    const isDark = result.theme === "dark";
    document.body.classList.toggle("dark", isDark);

    const themeToggle = document.getElementById("theme-toggle");
    themeToggle.textContent = isDark ? "🌙" : "🌞";
  });
}


function toggleTheme() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  chrome.storage.local.set({ theme: isDark ? "dark" : "light" });

  const themeToggle = document.getElementById("theme-toggle");
  themeToggle.textContent = isDark ? "🌙" : "🌞";
}


function updateGreeting(name) {
  const usernameSpan = document.getElementById("username");
  if (name) {
    usernameSpan.textContent = name;
  } else {
    const btn = document.createElement("button");
    btn.textContent = "Log In";
    btn.addEventListener("click", () => {
      getTokenInteractive(() => location.reload());
    });
    usernameSpan.innerHTML = "";
    usernameSpan.appendChild(btn);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const monthPicker = document.getElementById("month-picker");
  const yearPicker = document.getElementById("year-picker");

  if (!monthPicker || !yearPicker) {
    console.error("Elementy 'month-picker' alebo 'year-picker' neexistujú!");
    return;
  }

  setupMonthPicker();
  setupYearPicker();
  scrollToCurrentYear();
  loadTheme();

  checkIfLoggedIn(token => {
    if (token) {
      currentToken = token;
      fetchUserInfo(token).then(profile => {
        updateGreeting(profile.given_name || "User");
      });
      fetchEventsForMonth(token, currentDate).then(events => {
        cachedEvents = events;
        generateCalendar(currentDate, events);
      });
    } else {
      updateGreeting(null);
      generateCalendar(currentDate, []);
    }
  });

  document.getElementById("prev-month").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadAndRenderCalendar();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadAndRenderCalendar();
  });

  document.getElementById("today-btn").addEventListener("click", () => {
    currentDate = new Date();
    loadAndRenderCalendar();
  });

  document.getElementById("toggle-picker").addEventListener("click", () => {
    const wrapper = document.getElementById("picker-wrapper");
    wrapper.style.display = wrapper.style.display === "flex" ? "none" : "flex";
    scrollToCurrentYear();
  });

  document.getElementById("theme-toggle").addEventListener("click", () => {
    toggleTheme();

    const themeToggle = document.getElementById("theme-toggle");
    const isDark = document.body.classList.contains("dark");
    themeToggle.textContent = isDark ? "🌙" : "🌞";
  });

  document.getElementById("event-cancel").addEventListener("click", () => {
    document.getElementById("event-popup").classList.add("hidden");
  });

  document.getElementById("event-save").addEventListener("click", () => {
    const title = document.getElementById("event-title").value.trim();
    const time = document.getElementById("event-time").value;
    if (!title) return alert("Please enter an event title.");

    if (!currentToken) {
      getTokenInteractive(token => {
        if (token) {
          createEvent(token, selectedDay, title, time).then(() => {
            document.getElementById("event-popup").classList.add("hidden");
            loadAndRenderCalendar();
          });
        }
      });
    } else {
      createEvent(currentToken, selectedDay, title, time).then(() => {
        document.getElementById("event-popup").classList.add("hidden");
        loadAndRenderCalendar();
      });
    }
  });
});
