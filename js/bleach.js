(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const labels = {
    gender: "Genere",
    height_cm: "Altezza",
    race: "Razza",
    profession: "Professione",
    location: "Luogo",
    affiliation: "Affiliazione",
    first_arc: "Primo arco",
  };
  const pool = [],
    used = new Set(),
    tried = new Set();
  let secret = null,
    win = false,
    shown = [],
    selected = null,
    choice = -1;
  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const fmt = (v) => (Array.isArray(v) ? (v.length ? v.join(", ") : "N/D") : v === null || v === undefined || v === "" ? "N/D" : String(v));
  const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v === null || v === undefined || v === " " ? [] : [String(v)]);
  const known = (v) => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "" && v !== "N/D");
  const showResult = (title, text, revealed = false) => {
    const box = $("result");
    $("resultTitle").textContent = title;
    $("resultText").textContent = text;
    box.className = "result open" + (revealed ? " revealed" : "");
  };
  const safeMessage = (text, cls = "") => {
    const e = $("message");
    e.textContent = text;
    e.className = "message" + (cls ? " " + cls : "");
  };
  const img = (url, alt) => {
    const e = el("img");
    e.src = url;
    e.alt = alt;
    e.loading = "lazy";
    e.referrerPolicy = "no-referrer";
    e.addEventListener("error", () => {
      const parent = e.parentElement;
      e.remove();
      if (parent && !parent.textContent.trim()) {
        const badge = el("span", parent.classList.contains("photo") ? "face-fallback" : "", alt.slice(0, 1).toUpperCase());
        parent.append(badge);
      }
    });
    return e;
  };
  const allMatches = (q) => {
    if (!q.trim()) return [];
    let n = norm(q);
    return pool
      .filter((c) => [c.name, ...(c.aliases || [])].some((x) => norm(x).includes(n)))
      .sort((a, b) => Number(norm(b.name).startsWith(n)) - Number(norm(a.name).startsWith(n)) || a.name.localeCompare(b.name))
      .slice(0, 12);
  };
  function toggleDropdown(open) {
    $("dropdown").hidden = !open;
    $("search").setAttribute("aria-expanded", String(open));
  }
  function showMatches() {
    const box = $("dropdown"),
      q = $("search").value;
    box.replaceChildren();
    shown = allMatches(q);
    choice = -1;
    if (!q.trim()) {
      toggleDropdown(false);
      return;
    }
    if (!shown.length) {
      box.append(el("div", "no-results", "Nessun personaggio trovato"));
      toggleDropdown(true);
      return;
    }
    for (let i = 0; i < shown.length; i++) {
      const c = shown[i],
        b = el("button", "option");
      b.type = "button";
      b.setAttribute("role", "option");
      let pic = el("span", "mini-place");
      if (c.image_url) pic.append(img(c.image_url, c.name));
      else pic.textContent = c.name.slice(0, 1);
      b.append(pic);
      const words = el("span", "option-txt");
      words.append(el("span", "option-name", c.name));
      words.append(el("div", "option-extra", c.source_category || "Bleach"));
      b.append(words);
      b.addEventListener("click", () => choose(c));
      box.append(b);
    }
    toggleDropdown(true);
  }
  function choose(c) {
    selected = c;
    $("search").value = c.name;
    toggleDropdown(false);
    $("search").focus();

    // Invia automaticamente il personaggio selezionato
    tryGuess();
  }
  function compare(c, key) {
    const sv = secret[key],
      cv = c[key];
    if (!known(cv) || !known(sv)) return { status: "unknown", direction: null };
    if (key === "height_cm" || key === "first_arc") {
      const other = key === "first_arc" ? secret.first_arc_order : sv;
      const now = key === "first_arc" ? c.first_arc_order : cv;
      if (now === null || other === null) return { status: "unknown", direction: null };
      return now === other ? { status: "ok", direction: null } : { status: "bad", direction: now < other ? "up" : "down" };
    }
    if (key === "gender") return { status: cv === sv ? "ok" : "bad", direction: null };
    const a = arr(cv),
      b = arr(sv),
      na = new Set(a.map(norm)),
      nb = new Set(b.map(norm));
    return na.size === nb.size && [...na].every((z) => nb.has(z)) ? { status: "ok", direction: null } : [...na].some((z) => nb.has(z)) ? { status: "partial", direction: null } : { status: "bad", direction: null };
  }
  function cell(c, key) {
    const v = c[key],
      s = compare(c, key),
      tile = el("div", "tile " + s.status + (s.direction ? " arrow-" + s.direction : ""));
    let value = fmt(v);
    if (key === "height_cm" && v !== null) value = v + " cm";
    const t = el("span", "copy", value);
    tile.append(t);
    const td = el("td");
    td.append(tile);
    return td;
  }
  function portrait(c) {
    const td = el("td"),
      tile = el("div", "tile portrait"),
      photo = el("div", "photo");
    if (c.image_url) photo.append(img(c.image_url, c.name));
    else photo.append(el("span", "face-fallback", (c.name || "?")[0]));
    tile.append(photo, el("span", "name", c.name));
    td.append(tile);
    return td;
  }
  function render(c) {
    const tbody = $("attempts");
    if (tbody.querySelector(".empty")) tbody.replaceChildren();
    const tr = el("tr");
    tr.classList.add("riga-animata");
    tr.append(portrait(c));
    for (const key of Object.keys(labels)) tr.append(cell(c, key));
    tbody.prepend(tr);
  }
  function tryGuess() {
    if (!secret) {
      safeMessage("Il dataset non è ancora disponibile.", "error");
      return;
    }
    if (win) {
      safeMessage("Partita conclusa: premi Nuova partita.");
      return;
    }
    let q = $("search").value.trim();
    let c = selected && norm(selected.name) === norm(q) ? selected : pool.find((z) => norm(z.name) === norm(q) || z.aliases?.some((a) => norm(a) === norm(q)));
    if (!c) {
      const m = allMatches(q);
      if (m.length === 1) c = m[0];
    }
    if (!c) {
      safeMessage("Seleziona un personaggio dai suggerimenti.", "error");
      showMatches();
      return;
    }
    if (tried.has(c.id)) {
      safeMessage("Hai già provato questo personaggio.", "error");
      return;
    }
    tried.add(c.id);
    render(c);
    $("count").textContent = tried.size + " tentativ" + (tried.size === 1 ? "o" : "i");
    $("search").value = "";
    selected = null;
    toggleDropdown(false);
    if (c.id === secret.id) {
      win = true;
      safeMessage("Complimenti! Hai indovinato " + secret.name + " in " + tried.size + " tentativ" + (tried.size === 1 ? "o!" : "i!"), "success");
      $("try").disabled = true;
      showResult("Hai indovinato!", "Il personaggio era " + secret.name + ". Tentativi: " + tried.size + ".");
    } else safeMessage("Continua a cercare! Ogni riquadro è un indizio.");
  }
  function begin() {
    if (!pool.length) return;
    const available = pool.filter((c) => c.eligible_target);
    if (!available.length) {
      safeMessage("Nessun personaggio selezionabile nel dataset.", "error");
      return;
    }
    if (used.size >= available.length) used.clear();
    const left = available.filter((c) => !used.has(c.id));
    secret = left[Math.floor(Math.random() * left.length)];
    used.add(secret.id);
    tried.clear();
    win = false;
    selected = null;
    $("attempts").replaceChildren();
    const tr = el("tr");
    const empty = el("td", "empty", "");
    empty.colSpan = 8;
    tr.append(empty);
    $("attempts").append(tr);
    $("result").className = "result";
    $("search").value = "";
    $("search").disabled = false;
    $("try").disabled = false;
    $("reveal").disabled = false;
    $("count").textContent = "0 tentativi";
    toggleDropdown(false);
    safeMessage("Personaggio segreto estratto. Buona fortuna!");
  }
  $("guess-form").addEventListener("submit", (e) => {
    e.preventDefault();
    tryGuess();
  });
  $("search").addEventListener("input", () => {
    selected = null;
    showMatches();
  });
  $("search").addEventListener("keydown", (e) => {
    if ($("dropdown").hidden) return;
    if (e.key === "Escape") {
      toggleDropdown(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      choice = (choice + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      Array.from($("dropdown").children).forEach((z, i) => z.classList.toggle("active", i === choice));
      return;
    }
    if (e.key === "Enter" && choice >= 0) {
      e.preventDefault();
      choose(shown[choice]);
      return;
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-wrap")) toggleDropdown(false);
  });
  $("new").addEventListener("click", begin);
  $("again").addEventListener("click", begin);
  $("reveal").addEventListener("click", () => {
    if (!secret) return;
    if (!tried.has(secret.id)) {
      tried.add(secret.id);
      render(secret);
    }
    win = true;
    $("try").disabled = true;
    safeMessage("La soluzione era " + secret.name + ". Premi Nuova partita per ricominciare.");
    showResult("Soluzione: " + secret.name, "Puoi iniziare immediatamente una nuova partita.", true);
  });
  fetch("./characters.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((data) => {
      if (!Array.isArray(data) || data.length === 0) throw Error("Dataset vuoto o malformato");
      for (const c of data) {
        if (c && c.id && c.name) pool.push(c);
      }
      pool.sort((a, b) => a.name.localeCompare(b.name));
      begin();
    })
    .catch((e) => {
      console.error("Errore caricamento Bleachdle", e);
      $("try").disabled = true;
      $("new").disabled = true;
      $("reveal").disabled = true;
      safeMessage("Impossibile leggere characters.json. Apri il gioco su GitHub Pages o con un server locale. (" + e.message + ")", "error");
      $("count").textContent = "Errore dataset";
    });
})();
