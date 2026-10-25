(() => {
  "use strict";

  const audio = document.getElementById("ambientAudio");
  const button = document.getElementById("ambientToggle");
  const icon = document.getElementById("ambientIcon");

  if (!audio || !button || !icon) return;

  // Volume iniziale: 20%
  audio.volume = 0.2;

  // Aggiorna icona e testo del pulsante
  function updateButton() {
    const playing = !audio.paused;

    icon.innerHTML = playing ? '<i class="fa-solid fa-volume"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';

    button.setAttribute("aria-pressed", String(playing));

    // Aggiorna le icone se Font Awesome utilizza SVG
    if (window.FontAwesome?.dom?.i2svg) {
      window.FontAwesome.dom.i2svg({ node: icon });
    }
  }

  // Gestione del pulsante
  button.addEventListener("click", async () => {
    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        console.error("Impossibile avviare l'audio:", error);
      }
    } else {
      audio.pause();
    }

    updateButton();
  });

  // Sincronizza lo stato con l'audio
  audio.addEventListener("play", updateButton);
  audio.addEventListener("pause", updateButton);

  audio.addEventListener("error", () => {
    console.error("Errore nel caricamento dell'audio:", audio.src);
    updateButton();
  });

  updateButton();
})();
