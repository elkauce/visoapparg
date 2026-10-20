import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAndroidNative } from "@/lib/android-native";
import { openMarketplaceAsset } from "@/lib/marketplace-navigation";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import { percentToBps } from "@/lib/marketplace-payments";
import "./payment-settings.css";

type Settings = { configured: boolean; mode: "test" | "live"; requestedEnabled?: boolean;
  splitApproved?: boolean; policiesAccepted?: boolean; digitalCommissionBps: number | null; hardwareCommissionBps: number | null };

export default function MarketplacePaymentSettings() {
  const settings = useQuery(api.marketplace_payments.configuration, {});
  if (!settings?.isAdmin) return null;
  return <PaymentSettingsForm settings={settings} />;
}

function PaymentSettingsForm({ settings }: { settings: Settings }) {
  const save = useMutation(api.marketplace_payments.saveSettings);
  const [digital, setDigital] = useState(settings.digitalCommissionBps === null ? "" : String(settings.digitalCommissionBps / 100));
  const [hardware, setHardware] = useState(settings.hardwareCommissionBps === null ? "" : String(settings.hardwareCommissionBps / 100));
  const [split, setSplit] = useState(settings.splitApproved ?? false);
  const [policies, setPolicies] = useState(settings.policiesAccepted ?? false);
  const [enabled, setEnabled] = useState(settings.requestedEnabled ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function submit() {
    setError(null); setSaved(false);
    try {
      const rates = { digitalCommissionBps: percentToBps(digital), hardwareCommissionBps: percentToBps(hardware) };
      setPending(true);
      await save({ ...rates, enabled, splitApproved: split, policiesAccepted: policies });
      setSaved(true);
    } catch (problem) { setError(marketErrorMessage(problem, "No se pudo guardar la configuración de cobros.")); }
    finally { setPending(false); }
  }
  return <section className="vm-payment-card" aria-labelledby="vm-payments-title">
    <div className="vm-payment-heading"><CreditCard /><div><h2 id="vm-payments-title">Cobros y comisiones</h2><p>Mercado Pago Argentina · {settings.mode === "test" ? "Modo de prueba" : "Modo real"}</p></div></div>
    <p>Una compra tiene un solo vendedor. La comisión se guarda con cada pedido: cambiarla afecta únicamente a compras futuras.</p>
    <form className="vm-payment-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="vm-payment-rates">
        <div><Label htmlFor="vm-digital-rate">Comisión de recursos digitales (%)</Label><Input id="vm-digital-rate" inputMode="decimal" value={digital} onChange={(event) => { setDigital(event.target.value); setSaved(false); }} placeholder="Sin definir" disabled={pending} /></div>
        <div><Label htmlFor="vm-hardware-rate">Comisión de hardware (%)</Label><Input id="vm-hardware-rate" inputMode="decimal" value={hardware} onChange={(event) => { setHardware(event.target.value); setSaved(false); }} placeholder="Sin definir" disabled={pending} /><small>Preparada para cuando se incorpore la gestión de entrega.</small></div>
      </div>
      <p className="vm-payment-help">Dejar vacío mantiene esa categoría sin cobro. Los productos propios no llevan comisión VISO; los gratuitos y enlaces de afiliados tampoco. Mercado Pago puede cobrar su propia tarifa adicional.</p>
      <label className="vm-payment-check"><input type="checkbox" checked={split} onChange={(event) => setSplit(event.target.checked)} disabled={pending} /><span>Confirmo que Mercado Pago habilitó el reparto de pagos para esta aplicación y que probamos la vinculación de vendedores.</span></label>
      <label className="vm-payment-check"><input type="checkbox" checked={policies} onChange={(event) => setPolicies(event.target.checked)} disabled={pending} /><span>Confirmo que están definidas las políticas de devoluciones, contracargos y facturación.</span></label>
      <label className="vm-payment-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={pending || !settings.configured} /><span>Habilitar pagos {settings.mode === "test" ? "de prueba" : "reales"}</span></label>
      {!settings.configured && <p className="vm-payment-help">Falta completar la configuración segura de Mercado Pago en el servidor. No ingreses credenciales en este formulario.</p>}
      {error && <p role="alert" className="vm-error">{error}</p>}
      {saved && <p role="status">Configuración guardada.</p>}
      <div><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Guardar configuración</Button></div>
    </form>
  </section>;
}

export function CreatorPaymentConnection() {
  const configuration = useQuery(api.marketplace_payments.configuration, {});
  const account = useQuery(api.marketplace_payments.account, {});
  const connect = useAction(api.marketplace_payments.beginConnection);
  const disconnect = useMutation(api.marketplace_payments.disconnect);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function begin() {
    setPending(true); setError(null);
    try {
      const result = await connect({});
      if (isAndroidNative()) await openMarketplaceAsset(result.authorizationUrl);
      else window.location.assign(result.authorizationUrl);
    } catch (problem) { setError(marketErrorMessage(problem, "No se pudo iniciar la vinculación.")); }
    finally { setPending(false); }
  }
  async function unlink() {
    setPending(true); setError(null);
    try { await disconnect({}); }
    catch (problem) { setError(marketErrorMessage(problem, "No se pudo desvincular la cuenta.")); }
    finally { setPending(false); }
  }
  const digital = configuration?.digitalCommissionBps;
  const hardware = configuration?.hardwareCommissionBps;
  return <section className="vm-payment-card" aria-label="Mi cuenta de cobro">
    <div className="vm-payment-heading"><ShieldCheck /><div><h2>Mi cuenta de cobro</h2><p>{account?.connected ? `Mercado Pago conectado · Argentina · Cuenta ${account.providerUserId}` : "Vinculá Mercado Pago Argentina para vender dentro de VISO."}</p></div></div>
    <p>Autorizás desde Mercado Pago. VISO nunca te pide la contraseña. Cada compra reparte el importe entre tu cuenta y VISO, cuando el servicio esté habilitado.</p>
    <div className="vm-payment-rate-info"><span>Digital: {digital === null || digital === undefined ? "comisión sin definir" : `${digital / 100}% para VISO`}</span><span>Hardware (futuro): {hardware === null || hardware === undefined ? "comisión sin definir" : `${hardware / 100}% para VISO`}</span></div>
    <p className="vm-payment-help">Tu importe antes de los costos de Mercado Pago es el precio menos la comisión VISO. El costo y plazo final dependen del medio de pago y de tu cuenta. Los enlaces externos y afiliados se pagan fuera de VISO, sin esta comisión.</p>
    <div className="vm-payment-actions">{account?.connected
      ? <Button variant="outline" disabled={pending} onClick={() => void unlink()}>{pending && <Loader2 className="animate-spin" />}Desvincular de VISO</Button>
      : <Button disabled={pending || !configuration?.connectionReady} onClick={() => void begin()}>{pending ? <Loader2 className="animate-spin" /> : <ExternalLink />}Conectar Mercado Pago</Button>}</div>
    {!configuration?.connectionReady && <p className="vm-payment-help">La vinculación estará disponible cuando VISO complete la configuración del proveedor.</p>}
    {account?.connected && <p className="vm-payment-help">Desvincular impide nuevas ventas. VISO conserva la autorización cifrada para comprobar compras anteriores. También podés retirar el permiso desde Mercado Pago; en ese caso puede ser necesario reconectar para resolver esas compras.</p>}
    {error && <p role="alert" className="vm-error">{error}</p>}
  </section>;
}
