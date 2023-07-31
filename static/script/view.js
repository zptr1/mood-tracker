window.addEventListener("load", () => {
  let $pleasantness = null, $energy = null;

  moods.addEventListener("click", (e) => {
    const rect = moods.getBoundingClientRect();
    const x = e.clientX - rect.left + 1;
    const y = e.clientY - rect.top + 1;

    $pleasantness = Math.max(Math.min((x / rect.width) * 2 - 1, 1), -1);
    $energy = Math.max(Math.min(-((y / rect.height) * 2 - 1), 1), -1);

    status_pleasantness.textContent = Math.floor($pleasantness * 100);
    status_energy.textContent = Math.floor($energy * 100);

    dot.style.setProperty("--left", `${($pleasantness + 1) / 2 * 100}%`);
    dot.style.setProperty("--top", `${(-$energy + 1) / 2 * 100}%`);
  
    submit.style.display = "block";
  });

  submit.addEventListener("click", (e) => {
    const token = document.cookie.match(/token=([A-Za-z0-9_-]{64})/)[1];

    e.target.disabled = true;
    e.target.style.opacity = "0.5";
    e.target.textContent = "Updating ...";

    fetch("/api/mood", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }, body: JSON.stringify({
        pleasantness: $pleasantness,
        energy: $energy
      })
    })
      .catch((err) => {
        alert("Could not update the mood (check console)\nSorry!");
        console.error(err);
      })
      .then((res) => {
        if (res.status != 200) {
          alert(`Could not update the mood (status ${res.status})\nSorry!`);
        } else {
          status_last_update.textContent = moment().calendar();
          e.target.style.display = "none";
        }
      })
      .finally(() => {
        e.target.disabled = false;
        e.target.style.opacity = null;
        e.target.textContent = "Submit";
      });
  });

  moment.locale(navigator.userLanguage || navigator.language);
  const lastUpdate = parseInt(status_last_update.getAttribute("data-timestamp"));
  if (lastUpdate) {
    status_last_update.textContent = moment(lastUpdate).calendar();
  }
})