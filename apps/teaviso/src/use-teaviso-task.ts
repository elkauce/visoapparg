import { useEffect, useState } from "react";
import { errorText } from "./config";
export function useTask() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return {
    busy,
    error,
    notice,
    run: async (
      task: () => Promise<unknown>,
      message = "Cambios guardados.",
    ) => {
      if (busy) return;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await task();
        setNotice(message);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
    },
  };
}

export function useTeavisoNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, interval);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [interval]);
  return now;
}
