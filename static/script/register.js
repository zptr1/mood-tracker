window.addEventListener("load", () => {
  username.addEventListener("keyup", (e) => {
    e.target.value = e.target.value.replace(/\s/g, "_").toLowerCase();
    const value = e.target.value;
    const err =
      value.match(/[^a-z0-9_-]/)
        ? "Username must contain only lowercase letters, numbers, underscores and dashes."
      : value.length > 32
        ? "Username is too long!"
      : value.length < 3
        ? "Username is too short!"
      : null;

    if (err) status_error.textContent = err;
    else status_error.textContent = "";
  });
})