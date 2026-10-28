import { createRoot } from "react-dom/client";
import App from "./runtime";
import "./product-connected.css";
import { isTeavisoAndroid } from "./native-app";
if (isTeavisoAndroid() && window.location.pathname === "/") {
  window.history.replaceState(null, "", "/panel");
}
createRoot(document.getElementById("root")!).render(<App />);
