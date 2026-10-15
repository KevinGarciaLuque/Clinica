// Convierte las publicaciones y videos de Marketing Médico en una sola lista
// de piezas para la vitrina de la landing.

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const mediaAbs = (u) => (!u ? "" : (u.startsWith("http") || u.startsWith("data:") ? u : `${API}${u}`));

function videoInfo(url) {
  if (!url) return null;
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)))
    return { embed: `https://www.youtube.com/embed/${m[1]}?rel=0&autoplay=1&playsinline=1`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return { embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: null };
  return null;
}

export function construirItems(posts, videos) {
  const vids = (videos || []).map(v => {
    const info = videoInfo(v.media_url);
    return info && { key: `v${v.id}`, tipo: "video", img: info.thumb, embed: info.embed, titulo: v.titulo, vertical: v.formato === "vertical" };
  }).filter(Boolean);
  const pubs = (posts || []).filter(p => p.media_url).map(p => ({
    key: `p${p.id}`, tipo: "post", img: mediaAbs(p.media_url), titulo: p.titulo,
  }));
  // Intercala: un video, luego publicaciones, para que la rotación tenga variedad
  const out = [];
  const max = Math.max(vids.length, pubs.length);
  for (let i = 0; i < max; i++) {
    if (vids[i]) out.push(vids[i]);
    if (pubs[i * 2]) out.push(pubs[i * 2]);
    if (pubs[i * 2 + 1]) out.push(pubs[i * 2 + 1]);
  }
  return out;
}
