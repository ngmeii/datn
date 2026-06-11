import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

const APP_SESSION_KEY = "heirloom_app_session";

if (!sessionStorage.getItem(APP_SESSION_KEY)) {
  sessionStorage.setItem(APP_SESSION_KEY, "active");

  localStorage.removeItem("consignment_token");
  localStorage.removeItem("consignment_user");
  localStorage.removeItem("consignment_cart");
  localStorage.removeItem("consignment_checkout_items");

  if (window.location.pathname !== "/") {
    window.history.replaceState(null, "", "/");
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
