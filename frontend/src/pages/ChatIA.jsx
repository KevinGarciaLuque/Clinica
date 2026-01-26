import { useState } from "react";
import api from "../api/api";

export default function ChatIA() {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([
    { rol: "IA", texto: "Hola 👋 Soy el asistente. ¿En qué te ayudo?" },
  ]);

  const enviar = async (e) => {
    e.preventDefault();
    const texto = input.trim();
    if (!texto) return;

    setChat((c) => [...c, { rol: "TÚ", texto }]);
    setInput("");

    try {
      const res = await api.post("/api/ia/chat", { mensaje: texto });
      setChat((c) => [...c, { rol: "IA", texto: res.data.respuesta }]);
    } catch (err) {
      setChat((c) => [...c, { rol: "IA", texto: "Error conectando con el servidor." }]);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 800 }}>
      <h4 className="mb-3">Chat IA</h4>

      <div className="card shadow-sm">
        <div className="card-body" style={{ height: 380, overflowY: "auto" }}>
          {chat.map((m, i) => (
            <div key={i} className={`mb-2 ${m.rol === "TÚ" ? "text-end" : ""}`}>
              <div
                className={`d-inline-block p-2 rounded ${
                  m.rol === "TÚ" ? "bg-dark text-white" : "bg-light"
                }`}
                style={{ maxWidth: "80%" }}
              >
                <div className="small fw-bold">{m.rol}</div>
                <div>{m.texto}</div>
              </div>
            </div>
          ))}
        </div>

        <form className="card-footer d-flex gap-2" onSubmit={enviar}>
          <input
            className="form-control"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
          />
          <button className="btn btn-dark">Enviar</button>
        </form>
      </div>
    </div>
  );
}
