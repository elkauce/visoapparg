import { useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Link2,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { actions, isAndroidNative } from "@/lib/android-native.ts";
import { getSiteUrl } from "@/lib/site-url.ts";
import {
  buildVisoStatusFeeds,
  getVisoStoreUrl,
  readVisoRgbStatus,
} from "@/lib/viso-device-protocol.ts";

export function VisoDevicesPanel() {
  const slug = useQuery(api.public_status.getMine, {});
  const data = useQuery(api.statuses.list, {});
  const ensure = useMutation(api.public_status.ensureMine);
  const connection = useConvexConnectionState();
  const [pairing, setPairing] = useState(false);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [checkedFeed, setCheckedFeed] = useState<{
    url: string;
    status: "available" | "unavailable";
  } | null>(null);
  const feeds = slug ? buildVisoStatusFeeds(getSiteUrl(), slug) : null;
  const storeUrl = getVisoStoreUrl(import.meta.env.VITE_VISO_STORE_URL);
  const active = data?.statuses.find(
    (status) => status._id === data.activeStatusId,
  );

  const prepare = async () => {
    if (pending || !connection.isWebSocketConnected) return;
    setPending(true);
    try {
      await ensure({});
      toast.success("Configuración preparada");
    } catch {
      toast.error("No se pudo preparar la configuración. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  };
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success("Dirección copiada");
    } catch {
      toast.error(
        "No se pudo copiar. Mantén pulsada la dirección para seleccionarla.",
      );
    }
  };
  const checkFeed = async () => {
    if (pending || !feeds) return;
    setPending(true);
    try {
      await readVisoRgbStatus(feeds.rgb);
      setCheckedFeed({ url: feeds.rgb, status: "available" });
      toast.success("VISO respondió. Comprueba el color en tu dispositivo.");
    } catch (error) {
      setCheckedFeed({ url: feeds.rgb, status: "unavailable" });
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo consultar VISO. Revisa tu conexión.",
      );
    } finally {
      setPending(false);
    }
  };
  const shop = async () => {
    if (!storeUrl || pending) return;
    setPending(true);
    try {
      await actions.openUrl(storeUrl);
    } catch {
      toast.error("No se pudo abrir el catálogo. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Conectá, administrá y controlá tus dispositivos VISO.
      </p>
      <div className="grid gap-3">
        <button
          type="button"
          aria-label="Vincular dispositivo VISO"
          aria-expanded={pairing}
          onClick={() => setPairing(!pairing)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        >
          <Link2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Vincular dispositivo VISO
            </span>
            <span className="block text-xs text-muted-foreground">
              Configura un dispositivo compatible con tus estados.
            </span>
          </span>
          <ChevronRight
            className={`size-4 shrink-0 transition-transform ${pairing ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </button>
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <ShoppingBag
            className="size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Comprar dispositivos VISO</h2>
            <p className="text-xs text-muted-foreground">
              Conocé nuestro hardware.
            </p>
          </div>
          {storeUrl ? (
            isAndroidNative() ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void shop()}
              >
                Ver catálogo
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <a href={storeUrl} target="_blank" rel="noreferrer">
                  Ver catálogo
                </a>
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="whitespace-normal text-xs"
            >
              Catálogo próximamente
            </Button>
          )}
        </section>
      </div>

      {pairing && (
        <section
          className="space-y-4 rounded-2xl border border-border bg-card p-4"
          aria-label="Vincular dispositivo VISO"
        >
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">
              Sincronizar con tus estados
            </h2>
            <p className="text-sm text-muted-foreground">
              Los dispositivos compatibles leen el color de tu cuenta. Si tu
              dispositivo permite configurar una dirección de VISO, usa la
              siguiente.
            </p>
          </div>
          {feeds ? (
            <>
              <label htmlFor="viso-device-rgb" className="text-xs font-medium">
                Dirección de color
              </label>
              <div className="flex gap-2">
                <Input
                  id="viso-device-rgb"
                  readOnly
                  value={feeds.rgb}
                  onFocus={(event) => event.target.select()}
                  className="min-w-0 font-mono text-xs"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Copiar dirección de color"
                  onClick={() => void copy("rgb", feeds.rgb)}
                >
                  {copied === "rgb" ? <Check /> : <Copy />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Es una dirección pública: permite leer tu estado, sin acceder a
                tu cuenta. Tu dispositivo conserva esta configuración.
              </p>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void checkFeed()}
              >
                {pending ? "Consultando…" : "Comprobar respuesta de VISO"}
              </Button>
              {checkedFeed?.url === feeds.rgb && (
                <p role="status" className="text-xs text-muted-foreground">
                  {checkedFeed.status === "available"
                    ? "VISO respondió al consultar el color. La conexión física del dispositivo aún no está verificada."
                    : "VISO no respondió a la consulta. Revisa la conexión antes de probar de nuevo."}
                </p>
              )}
              <details className="space-y-3 border-t border-border pt-3">
                <summary className="cursor-pointer text-xs font-medium">
                  Otros formatos compatibles
                </summary>
                <div className="space-y-3 pt-3">
                  {(
                    [
                      { key: "hex", label: "Color HEX" },
                      { key: "name", label: "Nombre del estado" },
                      { key: "json", label: "Estado completo" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label
                        htmlFor={`viso-device-${key}`}
                        className="text-xs text-muted-foreground"
                      >
                        {label}
                      </label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          id={`viso-device-${key}`}
                          readOnly
                          value={feeds[key]}
                          onFocus={(event) => event.target.select()}
                          className="min-w-0 font-mono text-xs"
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label={`Copiar ${label}`}
                          onClick={() => void copy(key, feeds[key])}
                        >
                          {copied === key ? <Check /> : <Copy />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <Button
              disabled={
                slug === undefined ||
                pending ||
                !connection.isWebSocketConnected
              }
              onClick={() => void prepare()}
            >
              {pending ? "Preparando…" : "Preparar configuración"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            La detección automática depende del modelo y su firmware. Esta
            versión no recibe información del dispositivo ni confirma si está
            conectado.
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Tus dispositivos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          La conexión de tu dispositivo debe comprobarse físicamente. No hay
          dispositivos confirmados en esta pantalla.
        </p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">
            Sobre la compatibilidad
          </summary>
          <p className="pt-2">
            La comunicación disponible publica el color de tu cuenta. No
            recibimos información del dispositivo para verificar su conexión,
            nombre o controles propios.
          </p>
        </details>
        <p className="text-xs text-muted-foreground">
          Para desvincularlo, quita la dirección de VISO de su configuración.
          Esto no cambia tu Display ni tus otros dispositivos.
        </p>
      </section>

      {pairing && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Color y estados</h2>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-8 shrink-0 rounded-lg border border-border"
              style={{ backgroundColor: active?.color ?? "#000000" }}
            />
            <div>
              <p className="text-sm">
                {data === undefined
                  ? "Consultando estado…"
                  : (active?.name ?? "Apagado")}
              </p>
              <p className="text-xs text-muted-foreground">
                {data === undefined
                  ? "Esperando el estado de tu cuenta."
                  : active
                    ? "Color del estado activo de tu cuenta"
                    : "Sin estado activo: el dispositivo recibe negro."}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Cambia el estado desde el Deck. El dispositivo recibe el color
            cuando vuelve a consultar VISO.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/deck">Abrir controles de estado</Link>
          </Button>
        </section>
      )}
    </div>
  );
}

export default VisoDevicesPanel;
