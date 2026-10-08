import { useCallback, useEffect, useState } from "react";
import {
  getStreamDecks,
  requestStreamDecks,
  type StreamDeckButtonControlDefinitionLcdFeedback,
  type StreamDeckWeb,
} from "@elgato-stream-deck/webhid";
import { drawKeyFace } from "@/lib/deck-canvas.ts";

export type PhysicalStatus = { _id: string; name: string; color: string };

type Options = {
  statuses: PhysicalStatus[];
  activeStatusId: string | null;
  onSelect: (statusId: string) => void;
};

type ButtonControl = { type: string; index: number; pixelSize?: { width: number; height: number } };

// Teclas con pantalla del dispositivo (las únicas donde podemos dibujar)
function getLcdButtons(device: StreamDeckWeb) {
  return device.modelInfo.controls.filter(
    (control): control is StreamDeckButtonControlDefinitionLcdFeedback =>
      control.type === "button" && control.feedbackType === "lcd",
  );
}

async function paintDevice(
  device: StreamDeckWeb,
  statuses: PhysicalStatus[],
  activeStatusId: string | null,
) {
  for (const button of getLcdButtons(device)) {
    const status = statuses[button.index];
    if (!status) {
      await device.clearKey(button.index);
      continue;
    }
    const canvas = document.createElement("canvas");
    canvas.width = button.pixelSize.width;
    canvas.height = button.pixelSize.height;
    drawKeyFace(canvas, {
      name: status.name,
      color: status.color,
      active: status._id === activeStatusId,
    });
    await device.fillKeyCanvas(button.index, canvas);
  }
}

// Conecta un Stream Deck físico por WebHID: pinta los estados y escucha las pulsaciones
export function usePhysicalDeck({ statuses, activeStatusId, onSelect }: Options) {
  const [device, setDevice] = useState<StreamDeckWeb | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof navigator !== "undefined" && "hid" in navigator;

  // Reabre automáticamente un dispositivo ya autorizado antes
  useEffect(() => {
    if (!supported) {
      return;
    }
    let cancelled = false;
    getStreamDecks()
      .then((devices) => {
        if (!cancelled && devices[0]) {
          setDevice(devices[0]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [supported]);

  // Si se desenchufa, volvemos al estado "desconectado"
  useEffect(() => {
    if (!supported) {
      return;
    }
    const handleDisconnect = () => setDevice(null);
    navigator.hid.addEventListener("disconnect", handleDisconnect);
    return () => navigator.hid.removeEventListener("disconnect", handleDisconnect);
  }, [supported]);

  // Redibuja las teclas cuando cambian los estados o el activo
  useEffect(() => {
    if (!device) {
      return;
    }
    paintDevice(device, statuses, activeStatusId).catch(() =>
      setError("No se pudo dibujar en el Stream Deck"),
    );
  }, [device, statuses, activeStatusId]);

  // Escucha las pulsaciones de las teclas
  useEffect(() => {
    if (!device) {
      return;
    }
    const handleDown = (control: ButtonControl) => {
      const status = control.type === "button" ? statuses[control.index] : undefined;
      if (status) {
        onSelect(status._id);
      }
    };
    device.on("down", handleDown);
    return () => {
      device.off("down", handleDown);
    };
  }, [device, statuses, onSelect]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const devices = await requestStreamDecks();
      if (devices[0]) {
        await devices[0].setBrightness(80);
        setDevice(devices[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo conectar. Cierra el programa de Elgato e inténtalo de nuevo",
      );
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!device) {
      return;
    }
    await device.resetToLogo().catch(() => undefined);
    await device.forget().catch(() => undefined);
    setDevice(null);
  }, [device]);

  return {
    supported,
    connected: device !== null,
    modelName: device?.modelInfo.name ?? null,
    error,
    connect,
    disconnect,
  };
}
