// client/src/App.jsx
import { useState } from "react";
import OnlineLobby from "./OnlineLobby";

function Home({ onGoOnline }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0c",
        color: "white",
        fontFamily: "system-ui, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          padding: 18,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(16,16,18,0.75)",
          boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 900 }}>Knucklebones</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>
          1v1 online — create a room and invite your friend.
        </div>

        <button
          onClick={onGoOnline}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Online Lobby
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home"); // "home" | "lobby"

  if (screen === "lobby") {
    return <OnlineLobby onBack={() => setScreen("home")} />;
  }

  return <Home onGoOnline={() => setScreen("lobby")} />;
}
