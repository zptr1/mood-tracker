window.addEventListener("load", async () => {
  const tokenCookie = document.cookie.match(/token=([A-Za-z0-9_-]{64})/);
  const token = tokenCookie ? tokenCookie[1] : undefined;

  const req = await fetch(`/api/history/all/${username}?sort=newest`, {
    headers: {
      "Authorization": token
    }
  });

  const data = await req.json();
  
  if (req.status != 200 || data.status == "error") {
    loading.textContent = "Could not load data.";
    return;
  }

  const oldestAt = parseInt(data.entries[data.entries.length - 1].timestamp);

  moment.locale(navigator.userLanguage || navigator.language);
  analytics.style = null;
  loading.remove();

  const lineChart = new Chart(line_chart_canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          label: "Energy",
          borderColor: "#f0c243",
        },
        {
          data: [],
          label: "Pleasantness",
          borderColor: "#7ba7e0",
        }
      ]
    }
  });

  function displayEntries(entries) {
    document.querySelectorAll("#moods > div > div").forEach((x) => {
      x.removeAttribute("data-hover-text");
      x.style.opacity = null;
      x.style.filter = null;
    });

    document.querySelectorAll(".dot").forEach((x) => {
      x.remove();
    });

    if (entries.length >= 150) {
      status_warn.textContent = "The amount of data points has been limited for performance reasons";
    } else {
      status_warn.textContent = "";
    }
    
    if (htype.value == "scatter") {
      const oldestAt = entries[Math.min(entries.length - 1, 200)].timestamp;
      const latestAt = entries[0].timestamp - oldestAt;

      for (let i = 0; i < entries.length && i <= 200; i++) {
        const point = entries[i];
        const decay = (point.timestamp - oldestAt) / latestAt;
        if (decay < 0.01) break;
  
        const dot = document.createElement("span");
        dot.classList.add("dot");
        dot.style.left = `${(point.pleasantness + 1) / 2 * 100}%`;
        dot.style.top = `${(-point.energy + 1) / 2 * 100}%`;
        dot.style.opacity = decay;
        dot.setAttribute("data-hover-text", `${moment(parseInt(point.timestamp)).calendar()}\nPleasantness: ${Math.floor(point.pleasantness * 100)}% | Energy: ${Math.floor(point.energy * 100)}%`);
        dots.appendChild(dot);
      }
    } else if (htype.value == "heatmap") {
      const moods = new Array(labels.length).fill(0);
      for (const entry of entries) {
        moods[moodInfo(entry.pleasantness, entry.energy)]++;
      }
      
      const highest = Math.max(...moods);
      const sum = moods.reduce((p, c) => p + c, 0);

      moods.forEach((x, i) => {
        const sq = document.getElementById(`mood_sq_${i}`);
        sq.style.filter = `saturate(${x / highest * 4})`;
        sq.style.opacity = Math.max(x / highest, 0.05);
        sq.setAttribute("data-hover-text", `${x} (${(x / sum * 100).toFixed(2)}%)`);
      })
    }
    
    const today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);
    
    lineChart.data.datasets[0].data = entries.slice(0, 150).map((x) => x.energy).reverse();
    lineChart.data.datasets[1].data = entries.slice(0, 150).map((x) => x.pleasantness).reverse();
    lineChart.data.labels = entries.slice(0, 150)
      .map((x) => moment(parseInt(x.timestamp)).format(
        x.timestamp > today.getTime() ? "LT" : "L"
      )).reverse();

    lineChart.update();
  }

  function displayFilterDays(days) {
    const timestamp = Date.now() - days * 24 * 3600 * 1000;
    end_date.value = formatDate(new Date());

    if (!days) {
      start_date.value = formatDate(new Date(oldestAt));
      displayEntries(data.entries);
    } else {
      start_date.value = formatDate(new Date(Math.max(timestamp, oldestAt)));
      displayEntries(
        data.entries.filter(
          (x) => x.timestamp > timestamp
        )
      );
    }
  }

  function displayFilterCustomRange() {
    const dist = end_date.valueAsNumber - start_date.valueAsNumber;
    timespan.value = "-";

    if (dist < 0) {
      status_warn.textContent = "Invalid range";
      return;
    } else status_warn.textContent = "";

    const end = dist == 0
      ? start_date.valueAsNumber + 24 * 3600 * 1000
      : end_date.valueAsNumber;

    displayEntries(
      data.entries.filter(
        (x) =>
          x.timestamp >= start_date.valueAsNumber
          && x.timestamp <= end
      )
    );
  }

  function display() {
    if (timespan.value != "-") {
      displayFilterDays(parseInt(timespan.value));
    } else {
      displayFilterCustomRange();
    }
  }

  const formatDate = (date) => `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`

  start_date.min = end_date.min = formatDate(new Date(parseInt(data.entries[data.entries.length - 1].timestamp)));
  start_date.max = end_date.max = formatDate(new Date(parseInt(data.entries[0].timestamp)));
  
  display();
  
  timespan.addEventListener("change", () => {
    if (timespan.value != "-") {
      displayFilterDays(parseInt(timespan.value));
    }
  });

  start_date.addEventListener("change", () => displayFilterCustomRange());
  end_date.addEventListener("change", () => displayFilterCustomRange());

  htype.addEventListener("change", () => {
    display();
  });

  document.addEventListener("mousemove", (e) => {
    if (e.target.hasAttribute('data-hover-text')) {
      const rect = e.target.getBoundingClientRect();
      hover_tooltip.textContent = e.target.getAttribute("data-hover-text");
      hover_tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
      hover_tooltip.style.top = `${rect.top + window.scrollY + rect.height}px`;
      hover_tooltip.style.opacity = 1;
    } else {
      hover_tooltip.style.opacity = 0;
    }
  });
});

function moodInfo(pleasantness, energy) {
  if (energy >= 0.67) {
    if (pleasantness >= 0.67) return 0;
    if (pleasantness >= 0.33) return 1;
    if (pleasantness >= 0) return 2;
    if (pleasantness >= -0.33) return 3;
    if (pleasantness >= -0.67) return 4;
    return 5;
  } else if (energy >= 0.33) {
    if (pleasantness >= 0.67) return 6;
    if (pleasantness >= 0.33) return 7;
    if (pleasantness >= 0) return 8;
    if (pleasantness >= -0.33) return 9;
    if (pleasantness >= -0.67) return 10;
    return 11;
  } else if (energy >= 0) {
    if (pleasantness >= 0.67) return 12;
    if (pleasantness >= 0.33) return 13;
    if (pleasantness >= 0) return 14;
    if (pleasantness >= -0.33) return 15;
    if (pleasantness >= -0.67) return 16;
    return 17;
  } else if (energy >= -0.33) {
    if (pleasantness >= 0.67) return 18;
    if (pleasantness >= 0.33) return 19;
    if (pleasantness >= 0) return 20;
    if (pleasantness >= -0.33) return 21;
    if (pleasantness >= -0.67) return 22;
    return 23;
  } else if (energy >= -0.67) {
    if (pleasantness >= 0.67) return 24;
    if (pleasantness >= 0.33) return 25;
    if (pleasantness >= 0) return 26;
    if (pleasantness >= -0.33) return 27;
    if (pleasantness >= -0.67) return 28;
    else return 29;
  } else {
    if (pleasantness >= 0.67) return 30;
    if (pleasantness >= 0.33) return 31;
    if (pleasantness >= 0) return 32;
    if (pleasantness >= -0.33) return 33;
    if (pleasantness >= -0.67) return 34;
    return 35;
  }  
}