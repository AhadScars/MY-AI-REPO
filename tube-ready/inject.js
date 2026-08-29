(() => {
  const SOURCE = "tube-ready";

  function readPlayer() {
    let player = window.ytInitialPlayerResponse || null;
    if (!player) {
      try {
        const raw = document.getElementById("movie_player")?.getPlayerResponse?.();
        if (raw) player = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        player = null;
      }
    }
    window.postMessage({ source: SOURCE, type: "PLAYER", player }, "*");
  }

  readPlayer();
  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(readPlayer, 350);
  });
})();
