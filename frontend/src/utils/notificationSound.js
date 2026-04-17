export function playNotificationSound() {
  try {
    const audio = new Audio("/Notificacion.mp3");
    audio.volume = 0.6;
    audio.play();
  } catch {}
}
