export function playNotificationSound() {
  try {
    const audio = new Audio("/Notificacion.mp3");
    audio.volume = 0.6;
    const promise = audio.play();
    // audio.play() devuelve una Promise que puede rechazarse
    // por la política de autoplay del navegador — hay que capturarla
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        // Fallback: tono corto con Web Audio API (no requiere interacción previa
        // si el contexto fue desbloqueado en algún momento)
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        } catch {}
      });
    }
  } catch {}
}
