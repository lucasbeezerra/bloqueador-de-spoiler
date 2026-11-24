// Toca a música da confirmação ("Tem certeza, Big?").
// O arquivo é o musica.mp3 desta pasta: cada um coloca o seu (não vem no GitHub).
const audio = document.getElementById("musica");
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.alvo !== "tocador") return;
  if (msg.musica === "tocar") {
    audio.currentTime = 0;
    audio.play().catch(() => {}); // sem musica.mp3: fica em silêncio
  } else if (msg.musica === "parar") {
    audio.pause();
  }
});
