(function () {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const input = byId("guessInput"),
    list = byId("matches"),
    rows = byId("guessRows");
  let pool = [],
    deck = [],
    secret = null,
    guesses = new Set(),
    ended = false,
    current = [],
    active = 0;
  const esc = (value) =>
    String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (a) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[a],
    );
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const status = (s) => (byId("message").textContent = s);
  const safeImg = (url) => (typeof url === "string" && /^https:\/\//i.test(url) ? url : "");
  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = b[i];
      b[i] = b[j];
      b[j] = t;
    }
    return b;
  }
  function nextSecret() {
    if (!deck.length) deck = shuffle(pool);
    let n = deck.pop();
    if (secret && n.id === secret.id && pool.length > 1) {
      if (deck.length) {
        let alt = deck.pop();
        deck.push(n);
        n = alt;
      } else {
        deck = shuffle(pool.filter((x) => x.id !== secret.id));
        n = deck.pop();
      }
    }
    return n;
  }
  function closeList() {
    list.classList.remove("open");
    input.setAttribute("aria-expanded", "false");
  }
  function showList() {
    const q = norm(input.value);
    if (!q || ended) {
      closeList();
      return;
    }
    current = pool
      .filter((x) => !guesses.has(x.id) && [x.name].concat(x.aliases || []).some((n) => norm(n).includes(q)))
      .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 12);
    active = 0;
    if (!current.length) {
      list.innerHTML = '<div class="option">Nessun personaggio trovato</div>';
    } else {
      list.innerHTML = current
        .map(
          (c, i) =>
            `<button type="button" class="option ${i === 0 ? "active" : ""}" data-index="${i}" role="option" aria-selected="${i === 0}"><img class="mini" loading="lazy" referrerpolicy="no-referrer" src="${esc(safeImg(c.image_url))}" alt="" onerror="this.style.visibility='hidden'"><span><span class="opt-name">${esc(c.name)}</span><br><span class="opt-sub">${esc(c.affiliations.join(", ") || "Affiliazione non nota")}</span></span></button>`,
        )
        .join("");
    }
    list.classList.add("open");
    input.setAttribute("aria-expanded", "true");
  }
  function arrState(a, b) {
    const aa = new Set(a || []),
      bb = new Set(b || []);
    if (aa.size === bb.size && [...aa].every((x) => bb.has(x))) return "correct";
    if ([...aa].some((x) => bb.has(x))) return "partial";
    return "wrong";
  }
  function scalarState(a, b) {
    return a === b ? "correct" : "wrong";
  }
  function tile(content, klass) {
    return `<div class="tile ${klass}">${content}</div>`;
  }
  function textLabels(a) {
    return a && a.length ? a.map((v) => `<span class="tag">${esc(v)}</span>`).join("") : '<span class="tag">Nessuno</span>';
  }
  const symbols = {
    Fuoco: "🔥",
    Acqua: "💧",
    Vento: "🌪️",
    Fulmine: "⚡",
    Terra: "🪨",
  };
  const fiveNatures = new Set(["Fuoco", "Acqua", "Vento", "Fulmine", "Terra"]);
  const onlyFive = (list) => (Array.isArray(list) ? list.filter((n) => fiveNatures.has(n)) : []);
  function natureLabels(a) {
    return a && a.length ? a.map((n) => `<span class="nitem" title="${esc(n)}"><span class="nature-emoji">${symbols[n] || "✦"}</span>${esc(n)}</span>`).join("") : '<span class="tag">Nessuna</span>';
  }
  function arcTile(g, s) {
    if (g.first_arc_order === s.first_arc_order) return tile(esc(g.first_arc), "correct");
    return tile(
      esc(g.first_arc) +
        `<span class="arrow" title="${s.first_arc_order > g.first_arc_order ? "Soluzione in un arco successivo" : "Soluzione in un arco precedente"}">${s.first_arc_order > g.first_arc_order ? "↑" : "↓"}</span>`,
      "wrong",
    );
  }
  function renderGuess(c) {
    const hit = c.id === secret.id;
    let url = esc(safeImg(c.image_url));
    let picture = `<div class="tile portrait ${hit ? "hit" : ""}"><div class="portrait-media"><b>${esc(c.name.charAt(0).toUpperCase())}</b><img src="${url}" loading="lazy" referrerpolicy="no-referrer" alt="" onerror="this.style.display='none'"></div><span class="name">${esc(c.name)}</span></div>`;
    return `<tr><td>${picture}</td><td>${tile(esc(c.gender), scalarState(c.gender, secret.gender))}</td><td>${tile(textLabels(c.affiliations), arrState(c.affiliations, secret.affiliations))}</td><td>${tile(textLabels(c.jutsu_types), arrState(c.jutsu_types, secret.jutsu_types))}</td><td>${tile(textLabels(c.kekkei_genkai_types), arrState(c.kekkei_genkai_types, secret.kekkei_genkai_types))}</td><td>${tile(natureLabels(onlyFive(c.nature_types)), arrState(onlyFive(c.nature_types), onlyFive(secret.nature_types)))}</td><td>${tile(textLabels(c.attributes), arrState(c.attributes, secret.attributes))}</td><td>${arcTile(c, secret)}</td></tr>`;
  }
  function finish(win) {
    ended = true;
    input.disabled = true;
    byId("submitGuess").disabled = true;
    byId("showAnswer").disabled = true;
    closeList();
    const r = byId("result");
    r.classList.add("open");
    r.classList.toggle("revealed", !win);
    byId("resultTitle").textContent = win ? "🎉 Personaggio indovinato!" : "Soluzione rivelata";
    byId("resultText").textContent = win ? `Hai trovato ${secret.name} in ${guesses.size} tentativi!` : `Il personaggio segreto era ${secret.name}. Puoi ricominciare subito.`;
    status("");
  }
  function makeGuess(c) {
    if (!c || ended) return;
    if (guesses.has(c.id)) {
      status("Hai già provato questo personaggio.");
      return;
    }
    guesses.add(c.id);
    rows.insertAdjacentHTML("afterbegin", renderGuess(c));
    rows.firstElementChild.classList.add("riga-animata");
    input.value = "";
    closeList();
    if (c.id === secret.id) {
      finish(true);
      return;
    }
    status(`Tentativi: ${guesses.size} · ${pool.length - guesses.size} personaggi ancora da provare`);
  }
  function submit() {
    if (ended) return;
    const q = norm(input.value);
    if (!q) {
      status("Scrivi un nome per iniziare.");
      return;
    }
    const c = pool.find((x) => !guesses.has(x.id) && [x.name].concat(x.aliases || []).some((n) => norm(n) === q)) || (current.length && norm(current[0].name).startsWith(q) ? current[0] : null);
    if (!c) {
      status("Seleziona un personaggio dall’elenco dei suggerimenti.");
      showList();
      return;
    }
    makeGuess(c);
  }
  function begin() {
    if (!pool.length) {
      status("Nessun personaggio disponibile.");
      return;
    }
    secret = nextSecret();
    guesses = new Set();
    ended = false;
    rows.innerHTML = "";
    input.value = "";
    input.disabled = false;
    byId("submitGuess").disabled = false;
    byId("showAnswer").disabled = false;
    byId("result").classList.remove("open", "revealed");
    closeList();
    status(`${pool.length} personaggi · Partite infinite · Nessun limite di tentativi`);
  }
  input.addEventListener("input", showList);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeList();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (list.classList.contains("open") && current.length) makeGuess(current[active]);
      else submit();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!current.length || !list.classList.contains("open")) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + current.length) % current.length;
      list.querySelectorAll(".option").forEach((b, i) => b.classList.toggle("active", i === active));
    }
  });
  list.addEventListener("click", (e) => {
    const el = e.target.closest("button.option");
    if (el) makeGuess(current[Number(el.dataset.index)]);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-wrap")) closeList();
  });
  byId("submitGuess").addEventListener("click", submit);
  byId("restart").addEventListener("click", begin);
  byId("again").addEventListener("click", begin);
  byId("showAnswer").addEventListener("click", () => {
    if (secret && !ended) finish(false);
  });
  // On GitHub Pages characters.json is the editable source of truth.
  // file:// local opens use the embedded fallback to work without any server.
  fetch("./characters.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw Error("Data not available");
      return r.json();
    })
    .catch(() => fallback)
    .then((data) => {
      if (!Array.isArray(data) || !data.length) throw Error("Empty dataset");
      pool = data;
      begin();
    })
    .catch((e) => {
      status("Impossibile caricare il dataset: " + e.message);
    });
})();
