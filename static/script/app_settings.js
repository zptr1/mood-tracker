let confirmAction = null;

document.addEventListener("click", async(e) => {
  if (e.target.tagName == "BUTTON")
    e.target.blur();

  if (e.target.classList.contains("remove_redirect_uri_btn")) {
    if (redirect_uris.childElementCount <= 2) {
      alert(
        "The application needs to have at least one redirect URI\nCan't redirect to nowhere y'know"
      );
    } else {
      const uri = e.target.parentElement.getAttribute("data-uri");
      redirectURIs.splice(redirectURIs.indexOf(uri), 1);
      try {
        await _patch();
        e.target.parentElement.remove();
      } catch (err) {
        e.target.parentElement.opacity = "0.5";
        if (typeof err == "string") alert(err);
        else {
          alert("Something went wrong, sorry.");
          throw err;
        }
      }
    }
  } else if (e.target.id == "add_redirect_uri_btn") {
    const uri = add_redirect_uri_input.value;

    if (redirect_uris.childElementCount >= 6) {
      alert("Too many redirect URIs");
    } else if (!uri.match(/^https?:\/\//)) {
      alert("Invalid redirect URI");
    } else {
      try {
        new URL(uri);
      } catch (err) {
        return alert("Invalid redirect URI");
      }

      redirectURIs.push(uri);
      try {
        await _patch();
        add_redirect_uri_input.value = "";

        const li = document.createElement("li");
        const span = document.createElement("span");
        const button = document.createElement("button");

        button.classList.add("remove_redirect_uri_btn");
        li.setAttribute("data-uri", uri);

        button.textContent = "Remove";
        span.textContent = uri;

        li.appendChild(span);
        li.appendChild(button);
        redirect_uris.insertBefore(li, add_redirect_uri);
      } catch (err) {
        if (typeof err == "string") alert(err);
        else {
          alert("Something went wrong, sorry.");
          throw err;
        }
      }
    }
  }
});

async function _patch() {
  const token = document.cookie.match(/token=([A-Za-z0-9_-]{64})/)[1];
  const req = await fetch(
    `/api/apps/${appID}`, {
      method: "PATCH",
      body: JSON.stringify({
        redirect_uris: redirectURIs
      }),
      headers: {
        "Authorization": token,
        "Content-Type": "application/json"
      }
    }
  );

  const res = await req.json();
  if (res.status != "ok")
    throw res.message;
}

app_copy_id.addEventListener("click", (e) => {
  navigator.clipboard.writeText("<%= app.id %>");
  e.target.style.color = "#8bdf7a";
  setTimeout(() => {
    e.target.style = null;
  }, 150);
});

app_reset_secret.addEventListener("click", () => {
  status_warn.textContent = "Are you sure you want to reset this application's secret?";
  form.style.display = "none";
  confirm_form.style = null;
  confirm_btn.disabled = true;
  password_confirm.value = "";
  confirmAction = "reset_secret";
  confirm_action.textContent = "Reset Secret";
});

delete_app.addEventListener("click", () => {
  status_warn.innerHTML = "Are you sure you want to delete this application?<br>Your app will be lost forever (a long time!)";
  form.style.display = "none";
  confirm_form.style = null;
  confirm_btn.disabled = true;
  password_confirm.value = "";
  confirmAction = "delete_app";
  confirm_action.textContent = "Delete";
});

password_confirm.addEventListener("keyup", () => {
  confirm_btn.disabled = !password_confirm.value;
});

confirm_btn.addEventListener("click", async () => {
  confirm_form.style.pointerEvents = "none";
  confirm_form.style.opacity = "0.5";
  status_error.textContent = "";

  try {
    const token = document.cookie.match(/token=([A-Za-z0-9_-]{64})/)[1];
    const req = await fetch(
      confirmAction == "reset_secret"
        ? `/api/apps/${appID}/secret`
        : `/api/apps/${appID}`,
      {
        method: confirmAction == "reset_secret" ? "PATCH" : "DELETE",
        body: JSON.stringify({
          password: password_confirm.value
        }),
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        }
      }
    );

    const res = await req.json();
    confirm_form.style = null;

    if (res.status != "ok") {
      status_error.textContent = res.message;
    } else if (confirmAction == "reset_secret") {
      confirm_form.style.display = "none";
      form.style = null;

      [
        "The secret has been reset",
        `New secret: <span>${res.secret}</span>`,
        "Make sure to save it somewhere!"
      ].forEach((t) => {
        const e = document.createElement("p");
        e.innerHTML = t;
        highlight.appendChild(e);
      });
    } else {
      window.location.href = "/settings/api";
    }
  } catch (err) {
    status_error.textContent = "Something went wrong, sorry.";
    confirm_form.style = null;
    throw err;
  }
});

cancel_btn.addEventListener("click", () => {
  confirm_form.style.display = "none";
  form.style = null;
  status_error.textContent = "";
  status_warn.textContent = "";
  password_confirm.value = "";
  confirm_btn.disabled = true;
});