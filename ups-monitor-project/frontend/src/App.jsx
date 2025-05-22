// src/App.jsx
import React, { useEffect, useState } from "react";
import Login from "./Login";
import Monitor from "./Monitor";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check login status on load
    fetch("http://<backend_server_ip>:5000/api/check-login", {
      credentials: "include",
    })
      .then((res) => {
        setLoggedIn(res.ok);
        setLoading(false);
      })
      .catch(() => {
        setLoggedIn(false);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center p-4">Checking session...</div>;
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  return <Monitor onLogout={() => setLoggedIn(false)} />;
}