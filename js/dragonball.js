(function () {
  "use strict";
  const byId = (s) => document.getElementById(s);
  const inp = byId("guessInput"),
    menu = byId("matches"),
    tbody = byId("guessRows");
  const esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (t) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[t],
    );
  const norm = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  let pool = [],
    remaining = [],
    secret = null,
    guesses = new Set(),
    ended = false,
    options = [],
    active = 0,
    portraits = new Map();
  const isUrl = (x) => typeof x === "string" && /^https:\/\//.test(x);
  function imgFor(c) {
    return portraits.get(c.name) || c.image_url || "";
  }
  function avatar(c, small) {
    const url = imgFor(c);
    const char = esc((c.name || "?").slice(0, 1).toUpperCase());
    return url ? `<img src="${esc(url)}" loading="lazy" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none';this.parentElement.textContent='${char}'">` : `<span>${char}</span>`;
  }
  const msg = (s) => (byId("message").textContent = s);
  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }
  function getSecret() {
    if (!remaining.length) remaining = shuffle(pool);
    let next = remaining.pop();
    if (secret && next.id === secret.id && pool.length > 1) {
      if (remaining.length) {
        const alt = remaining.pop();
        remaining.push(next);
        next = alt;
      } else {
        remaining = shuffle(pool.filter((c) => c.id !== secret.id));
        next = remaining.pop();
      }
    }
    return next;
  }
  function close() {
    menu.classList.remove("open");
    inp.setAttribute("aria-expanded", "false");
  }
  function search() {
    if (!inp.value.trim() || ended) {
      close();
      return;
    }
    const q = norm(inp.value);
    options = pool
      .filter((c) => !guesses.has(c.id) && [c.name, ...(c.aliases || [])].some((n) => norm(n).includes(q)))
      .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 12);
    active = 0;
    menu.innerHTML = options.length
      ? options
          .map(
            (c, i) =>
              `<button type="button" role="option" class="option ${i === 0 ? "active" : ""}" data-i="${i}"><div class="mini-place">${avatar(c, true)}</div><span><strong>${esc(c.name)}</strong><small>${esc(c.series)} · ${esc(c.race)}</small></span></button>`,
          )
          .join("")
      : '<div class="option">Nessun personaggio trovato</div>';
    menu.classList.add("open");
    inp.setAttribute("aria-expanded", "true");
  }
  function equals(a, b) {
    return String(a) === String(b);
  }
  const unset = (v) => v === null || v === undefined || v === "" || v === "Sconosciuto" || v === "Sconosciuta";
  function state(a, b, kind) {
    if (unset(a) || unset(b)) return "wrong";
    if (equals(a, b)) return "correct";
    if (kind === "hair" && ["Calvo", "Nessuno"].includes(a) && ["Calvo", "Nessuno"].includes(b)) return "partial";
    if (kind === "series") {
      const base = (s) => String(s).replace(/ · Film$/, "");
      if (base(a) === base(b)) return "partial";
    }
    return "wrong";
  }
  function tile(v, cls, extra = "") {
    return `<div class="tile ${cls} ${extra}">${v}</div>`;
  }
  function value(v) {
    return v === null || v === undefined ? "?" : esc(v);
  }
  function card(c) {
    const won = c.id === secret.id;
    return tile(`<div class="photo">${avatar(c)}</div><span class="name">${esc(c.name)}</span>`, "portrait " + (won ? "hit" : ""));
  }
  function cell(c, field, kind) {
    const v = c[field];
    const status = c.id === secret.id ? "correct" : state(v, secret[field], kind);
    return tile(field === "series" ? `<span class="series-label">${value(v)}</span>` : value(v), status, field === "episode" && v === "Film" ? "film" : "");
  }
  function render(c) {
    return `<tr><td>${card(c)}</td><td>${cell(c, "gender")}</td><td>${cell(c, "hair", "hair")}</td><td>${cell(c, "origin")}</td><td>${cell(c, "race")}</td><td>${cell(c, "saga")}</td><td>${cell(c, "series", "series")}</td></tr>`;
  }
  function finish(win) {
    ended = true;
    inp.disabled = true;
    byId("submitGuess").disabled = true;
    byId("showAnswer").disabled = true;
    close();
    byId("result").classList.add("open");
    byId("result").classList.toggle("revealed", !win);
    byId("resultTitle").textContent = win ? "🎉 Personaggio indovinato!" : "Soluzione rivelata";
    byId("resultText").textContent = win ? `Hai indovinato ${secret.name} in ${guesses.size} tentativi!` : `Il personaggio segreto era ${secret.name}. Puoi ricominciare quando vuoi.`;
    msg("");
  }
  function guess(c) {
    if (!c || ended) return;
    if (guesses.has(c.id)) {
      msg("Hai già provato questo personaggio.");
      return;
    }
    const first = guesses.size === 0;
    guesses.add(c.id);
    if (first) tbody.innerHTML = "";
    tbody.insertAdjacentHTML("afterbegin", render(c));
    tbody.firstElementChild.classList.add("riga-animata");
    inp.value = "";
    close();
    if (c.id === secret.id) {
      finish(true);
      return;
    }
    msg(`${guesses.size} tentativi · ${pool.length - guesses.size} personaggi ancora da provare`);
  }
  function submit() {
    if (ended) return;
    const q = norm(inp.value);
    if (!q) {
      msg("Scrivi un nome.");
      return;
    }
    const exact = pool.find((c) => !guesses.has(c.id) && [c.name, ...(c.aliases || [])].some((v) => norm(v) === q));
    const selected = exact || (menu.classList.contains("open") && options.length && norm(options[0].name).startsWith(q) ? options[0] : null);
    if (selected) guess(selected);
    else {
      msg("Seleziona un personaggio dai suggerimenti.");
      search();
    }
  }
  function begin() {
    if (!pool.length) {
      msg("Nessun personaggio disponibile.");
      return;
    }
    secret = getSecret();
    guesses.clear();
    ended = false;
    tbody.innerHTML = '<tr><td colspan="7" class="empty"></td></tr>';
    inp.value = "";
    inp.disabled = false;
    byId("submitGuess").disabled = false;
    byId("showAnswer").disabled = false;
    byId("result").className = "result";
    close();
    msg(`${pool.length} personaggi · Partite infinite · Nessun limite di tentativi`);
  }
  inp.addEventListener("input", search);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (menu.classList.contains("open") && options.length) guess(options[active]);
      else submit();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!menu.classList.contains("open") || !options.length) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      menu.querySelectorAll("button.option").forEach((x, i) => x.classList.toggle("active", i === active));
    }
  });
  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-i]");
    if (btn) guess(options[Number(btn.dataset.i)]);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) close();
  });
  byId("submitGuess").addEventListener("click", submit);
  byId("restart").addEventListener("click", begin);
  byId("again").addEventListener("click", begin);
  byId("showAnswer").addEventListener("click", () => {
    if (secret && !ended) finish(false);
  });

  fetch("./characters.json", {
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Dataset vuoto o non valido");
      }

      pool = data;
      begin();
    })
    .catch((error) => {
      console.error("Errore caricamento personaggi:", error);
      msg("Impossibile caricare i personaggi. Riprova ad aggiornare la pagina.");
    });
})();
