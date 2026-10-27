import { useState, type FormEvent, type ReactNode } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download, FileCheck2, Package, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { downloadTimbreExport, exportTimbreQr } from "@/lib/timbre-qr";
import { timbrePublicQrUrl } from "@/lib/timbre-public-url";
import TimbreServiceSetup from "./service-setup";
import "./admin.css";

type Overview = FunctionReturnType<typeof api.timbre_commerce.adminOverview>;
type Plan = Doc<"timbrePlans">;
const featureNames = { bookings: "Agenda y reservas Te Aviso", templates: "Portal de mensajes Te Aviso", audio: "Audio", video: "Video", chat: "Chat", messages: "Mensajes de ausencia", families: "Familiares", buildings: "Edificios", offices: "Oficinas", access: "Control de acceso compatible" } as const;
const limitNames = { maxSites: "Timbres por licencia", maxQrs: "QR por Timbre", maxMembers: "Integrantes por Timbre", maxUnits: "Unidades por Timbre" } as const;
const statusNames: Record<Doc<"timbrePlateOrders">["status"], string> = { draft: "Borrador", pending_payment: "Pago pendiente", paid: "Pagado", production: "En producción", ready: "Listo para despacho", shipped: "Despachado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reintegrado" };
const licenseNames: Record<Doc<"timbreLicenses">["status"], string> = { pending_payment: "Pago pendiente", active: "Activa", past_due: "Pago vencido", suspended: "Suspendida", expired: "Vencida", revoked: "Revocada" };
function value(data: FormData, name: string) { return String(data.get(name) ?? "").trim(); }
function optionalNumber(data: FormData, name: string) { const raw = value(data, name); return raw ? Number(raw) : undefined; }
function amount(data: FormData, name = "price", optional = false) {
  const raw = value(data, name);
  if (!raw && optional) return undefined;
  if (!/^\d+([.,]\d{1,2})?$/.test(raw)) throw new Error("Indicá un importe con hasta dos decimales.");
  return Math.round(Number(raw.replace(",", ".")) * 100);
}
function currency(data: FormData) { return value(data, "currency") as "ARS" | "USD"; }
function checked(data: FormData, name: string) { return data.has(name); }
function dateInput(ms: number) { const date = new Date(ms); return new Date(ms - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function date(ms?: number) { return ms ? new Date(ms).toLocaleString("es-AR") : "Sin vencimiento"; }
function money(minor?: number, curr = "ARS") { return minor === undefined ? "Sin precio configurado" : new Intl.NumberFormat("es-AR", { style: "currency", currency: curr }).format(minor / 100); }
function Card({ title, children }: { title: string; children: ReactNode }) { return <section className="vt-card"><h2>{title}</h2>{children}</section>; }
function Field({ title, children }: { title: string; children: ReactNode }) { return <label>{title}{children}</label>; }
function Check({ name, label, initial = false }: { name: string; label: string; initial?: boolean }) { return <label className="vta-check"><input type="checkbox" name={name} defaultChecked={initial} />{label}</label>; }
function Currency({ initial = "ARS" }: { initial?: string }) { return <Field title="Moneda"><select name="currency" defaultValue={initial}><option value="ARS">Pesos argentinos · ARS</option><option value="USD">Dólares · USD</option></select></Field>; }
function PlanSelect({ plans, name = "planId", initial = "", optional = false }: { plans: Plan[]; name?: string; initial?: string; optional?: boolean }) {
  return <select name={name} defaultValue={initial} required={!optional}><option value="">{optional ? "No incluye licencia" : "Seleccionar plan"}</option>{plans.map((row) => <option key={row._id} value={row._id}>{row.name}{row.enabled ? "" : " · desactivado"}</option>)}</select>;
}
function Picker({ label, rows, selected, onChange }: { label: string; rows: { _id: string; name: string }[]; selected: string; onChange: (id: string) => void }) {
  return <div className="vt-toolbar"><Field title={label}><select value={selected} onChange={(e) => onChange(e.target.value)}><option value="">Crear nuevo</option>{rows.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></Field><Button variant="outline" onClick={() => onChange("")}><Plus /> Nuevo</Button></div>;
}
function AdminForm({ children, save, button = "Guardar configuración" }: { children: ReactNode; save: (data: FormData) => Promise<unknown>; button?: string }) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget); setBusy(true);
    try { await save(data); toast.success("Guardado en VISO"); } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  };
  return <form className="vt-form" onSubmit={(e) => void submit(e)}><fieldset disabled={busy} className="vta-fieldset">{children}</fieldset><Button type="submit" disabled={busy}>{busy ? "Guardando…" : button}</Button></form>;
}

export default function TimbreAdmin() {
  const data = useQuery(api.timbre_commerce.adminOverview, {});
  const [tab, setTab] = useState("plans");
  if (!data) return <p role="status">Cargando administración…</p>;
  const sections = [{ id: "plans", label: "Planes" }, { id: "plates", label: "Placas" }, { id: "shipping", label: "Envíos" },
    { id: "discounts", label: "Cupones" }, { id: "hardware", label: "Hardware" }, { id: "orders", label: "Pedidos" }, { id: "licenses", label: "Licencias" }, { id: "connection", label: "Conexión de llamadas" }];
  return <div className="vt-stack vta-admin"><div className="vt-notice"><strong>Administración comercial de Timbre</strong><p>Los precios, materiales y condiciones se publican con lo que guardes acá. Una cuenta VISO o un recurso gratuito del marketplace nunca activa el servicio.</p></div>
    <nav className="vt-segmented" aria-label="Administración comercial">{sections.map((section) => <button key={section.id} aria-pressed={tab === section.id} onClick={() => setTab(section.id)}>{section.label}</button>)}</nav>
    {tab === "plans" ? <Plans data={data} /> : tab === "plates" ? <Variants data={data} /> : tab === "shipping" ? <Shipping data={data} /> : tab === "discounts" ? <Discounts data={data} /> : tab === "hardware" ? <Hardware data={data} /> : tab === "orders" ? <Orders data={data} /> : tab === "connection" ? <TimbreServiceSetup /> : <Licenses data={data} />}
  </div>;
}

function Plans({ data }: { data: Overview }) {
  const [selected, setSelected] = useState(""); const row = data.plans.find((item) => item._id === selected);
  const save = useMutation(api.timbre_commerce.savePlan);
  return <Card title="Planes y funciones"><Picker label="Plan que querés editar" rows={data.plans} selected={selected} onChange={setSelected} />
    <AdminForm key={`${selected}:${row?._id ?? "new"}`} save={(form) => save({ ...(row ? { id: row._id } : {}), code: value(form, "code") as Plan["code"], name: value(form, "name"), description: value(form, "description"), enabled: checked(form, "enabled"),
      priceAmount: amount(form, "price", true), currency: currency(form), period: value(form, "period") as Plan["period"], durationDays: optionalNumber(form, "duration"),
      features: Object.fromEntries(Object.keys(featureNames).map((key) => [key, checked(form, key)])) as Plan["features"],
      limits: Object.fromEntries(Object.keys(limitNames).map((key) => [key, Number(value(form, key))])) as Plan["limits"] }).then((id) => { setSelected(id); return id; })}>
      <div className="vt-grid"><Field title="Nombre"><input name="name" defaultValue={row?.name} required maxLength={120} /></Field><Field title="Producto"><select name="code" defaultValue={row?.code ?? "digital"}><option value="digital">Timbre Digital</option><option value="personalizado">Timbre Personalizado</option><option value="hardware">Incluido con Hardware VISO</option><option value="edificios">Edificios y oficinas</option></select></Field></div>
      <Field title="Descripción"><textarea name="description" defaultValue={row?.description} required maxLength={3000} /></Field>
      <div className="vt-grid"><Field title="Precio (importe final; vacío = sin venta)"><input name="price" type="number" min="0.01" step="0.01" defaultValue={row?.priceAmount === undefined ? "" : row.priceAmount / 100} /></Field><Currency initial={row?.currency} /><Field title="Modalidad"><select name="period" defaultValue={row?.period ?? "one_time"}><option value="one_time">Pago único</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></Field><Field title="Vigencia de la licencia (días; vacío = sin vencimiento)"><input name="duration" type="number" min={1} max={36500} defaultValue={row?.durationDays} /></Field></div>
      <p className="vt-caption">Los cobros mensuales y anuales requieren la conexión recurrente del proveedor. Guardar un plan no confirma pagos ni activa licencias. Los cambios respetan las funciones ya adquiridas.</p>
      <fieldset className="vta-options"><legend>Funciones incluidas</legend>{Object.entries(featureNames).map(([key, label]) => <Check key={key} name={key} label={label} initial={row?.features[key as keyof Plan["features"]]} />)}</fieldset>
      <p className="vt-caption">El control de acceso también necesita un proveedor de cerradura compatible y una integración autenticada; esta opción comercial no abre puertas.</p>
      <div className="vt-grid">{Object.entries(limitNames).map(([key, title]) => <Field key={key} title={title}><input name={key} type="number" min={1} max={key === "maxSites" ? 100 : 1000} required defaultValue={row?.limits[key as keyof Plan["limits"]] ?? 1} /></Field>)}</div><Check name="enabled" label="Mostrar este plan en el catálogo" initial={row?.enabled} />
    </AdminForm>
  </Card>;
}

function Variants({ data }: { data: Overview }) {
  const [selected, setSelected] = useState(""); const row = data.variants.find((item) => item._id === selected); const save = useMutation(api.timbre_commerce.savePlateVariant);
  return <Card title="Placas y variantes"><Picker label="Variante que querés editar" rows={data.variants} selected={selected} onChange={setSelected} />
    <AdminForm key={`${selected}:${row?._id ?? "new"}`} save={(form) => save({ ...(row ? { id: row._id } : {}), name: value(form, "name"), material: value(form, "material"), widthMm: Number(value(form, "width")), heightMm: Number(value(form, "height")),
      enabled: checked(form, "enabled"), priceAmount: amount(form, "price", true), currency: currency(form), availability: value(form, "availability") as Doc<"timbrePlateVariants">["availability"],
      productionNotes: value(form, "notes"), warranty: value(form, "warranty"), includedPlanId: (value(form, "planId") || undefined) as Id<"timbrePlans"> | undefined }).then((id) => { setSelected(id); return id; })}>
      <div className="vt-grid"><Field title="Nombre de la variante"><input name="name" defaultValue={row?.name} required maxLength={120} /></Field><Field title="Material disponible"><input name="material" defaultValue={row?.material} required maxLength={120} placeholder="Material que realmente ofrecerás" /></Field><Field title="Ancho (mm)"><input name="width" type="number" min={50} max={300} step="0.1" defaultValue={row?.widthMm} required /></Field><Field title="Alto (mm)"><input name="height" type="number" min={50} max={300} step="0.1" defaultValue={row?.heightMm} required /></Field><Field title="Precio de la placa"><input name="price" type="number" min="0.01" step="0.01" defaultValue={row?.priceAmount === undefined ? "" : row.priceAmount / 100} /></Field><Currency initial={row?.currency} />
        <Field title="Disponibilidad"><select name="availability" defaultValue={row?.availability ?? "unconfigured"}><option value="unconfigured">Pendiente de configurar</option><option value="available">Disponible para comprar</option><option value="unavailable">No disponible</option></select></Field><Field title="Licencia incluida expresamente"><PlanSelect plans={data.plans} optional initial={row?.includedPlanId} /></Field></div>
      <Field title="Especificaciones de producción y acabado"><textarea name="notes" defaultValue={row?.productionNotes} maxLength={3000} placeholder="Material, acabado, preparación del archivo y demás requisitos reales" /></Field><Field title="Garantía y condiciones"><textarea name="warranty" defaultValue={row?.warranty} maxLength={3000} /></Field><Check name="enabled" label="Mostrar variante en el catálogo" initial={row?.enabled} />
    </AdminForm>
  </Card>;
}

function Shipping({ data }: { data: Overview }) {
  const [selected, setSelected] = useState(""); const row = data.shippingOptions.find((item) => item._id === selected); const save = useMutation(api.timbre_commerce.saveShippingOption);
  return <Card title="Opciones de entrega"><Picker label="Envío que querés editar" rows={data.shippingOptions} selected={selected} onChange={setSelected} />
    <AdminForm key={`${selected}:${row?._id ?? "new"}`} save={(form) => save({ ...(row ? { id: row._id } : {}), name: value(form, "name"), country: value(form, "country"), regions: value(form, "regions").split("\n").map((part) => part.trim()).filter(Boolean),
      priceAmount: amount(form)!, currency: currency(form), enabled: checked(form, "enabled"), terms: value(form, "terms") }).then((id) => { setSelected(id); return id; })}>
      <div className="vt-grid"><Field title="Nombre del servicio de entrega"><input name="name" defaultValue={row?.name} required maxLength={120} /></Field><Field title="País (código ISO de dos letras)"><input name="country" defaultValue={row?.country ?? "AR"} required pattern="[A-Za-z]{2}" maxLength={2} /></Field><Field title="Costo de envío (0 si está bonificado)"><input name="price" type="number" min={0} step="0.01" defaultValue={row ? row.priceAmount / 100 : ""} required /></Field><Currency initial={row?.currency} /></div>
      <Field title="Provincias o regiones (una por línea; vacío = todo el país)"><textarea name="regions" defaultValue={row?.regions.join("\n")} placeholder="Usá los nombres que el cliente indicará en su dirección" /></Field><Field title="Condiciones y plazos reales"><textarea name="terms" defaultValue={row?.terms} maxLength={3000} required /></Field><Check name="enabled" label="Habilitar esta entrega" initial={row?.enabled} />
    </AdminForm>
  </Card>;
}

function Discounts({ data }: { data: Overview }) {
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState(""); const row = data.discounts.find((item) => item._id === selected); const save = useMutation(api.timbre_commerce.saveDiscount);
  return <Card title="Cupones de descuento"><Picker label="Cupón que querés editar" rows={data.discounts.map((item) => ({ _id: item._id, name: item.code }))} selected={selected} onChange={setSelected} />
    <AdminForm key={`${selected}:${row?._id ?? "new"}`} save={(form) => save({ ...(row ? { id: row._id } : {}), code: value(form, "code"), planIds: form.getAll("plans").map(String) as Id<"timbrePlans">[],
      percentBps: amount(form, "percent")!, enabled: checked(form, "enabled"), startsAt: new Date(value(form, "start")).getTime(), expiresAt: new Date(value(form, "end")).getTime(), maxRedemptions: optionalNumber(form, "uses") }).then((id) => { setSelected(id); return id; })}>
      <div className="vt-grid"><Field title="Código"><input name="code" defaultValue={row?.code} required pattern="[A-Za-z0-9_-]{3,40}" maxLength={40} /></Field><Field title="Descuento (%)"><input name="percent" type="number" min="0.01" max="99.99" step="0.01" defaultValue={row ? row.percentBps / 100 : ""} required /></Field><Field title="Desde"><input name="start" type="datetime-local" defaultValue={dateInput(row?.startsAt ?? now)} required /></Field><Field title="Hasta"><input name="end" type="datetime-local" defaultValue={row ? dateInput(row.expiresAt) : ""} required /></Field><Field title="Máximo de usos (vacío = sin tope)"><input name="uses" type="number" min={1} defaultValue={row?.maxRedemptions} /></Field></div>
      <PlanCheckboxes plans={data.plans} initial={row?.planIds ?? []} /><p className="vt-caption">Cada cupón conserva un importe mayor que cero. Usos confirmados: {row?.redemptions ?? 0}.</p><Check name="enabled" label="Cupón habilitado" initial={row?.enabled} />
    </AdminForm>
  </Card>;
}
function PlanCheckboxes({ plans, initial }: { plans: Plan[]; initial: Id<"timbrePlans">[] }) {
  return <fieldset className="vta-options"><legend>Planes a los que se aplica</legend>{plans.map((plan) => <label key={plan._id} className="vta-check"><input type="checkbox" name="plans" value={plan._id} defaultChecked={initial.includes(plan._id)} />{plan.name}</label>)}</fieldset>;
}

function Hardware({ data }: { data: Overview }) {
  const [selected, setSelected] = useState(""); const row = data.hardware.find((item) => item.productId === selected); const save = useMutation(api.timbre_commerce.saveHardwareEligibility); const reconcile = useMutation(api.timbre_commerce.reconcileHardwareLicense);
  return <div className="vt-stack"><Card title="Hardware VISO con Timbre incluido"><p>Solo los productos propios habilitados expresamente otorgan la licencia después de un pago verificado. Los enlaces de afiliado no activan Timbre.</p>
    <Field title="Producto que querés editar"><select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Seleccionar producto</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></Field>
    {selected && <AdminForm key={selected} save={(form) => save({ productId: selected, planId: value(form, "planId") as Id<"timbrePlans">, enabled: checked(form, "enabled"), durationDays: optionalNumber(form, "duration") })}>
      <Field title="Plan incluido"><PlanSelect plans={data.plans} initial={row?.planId} /></Field><Field title="Vigencia especial en días (vacío = vigencia del plan)"><input name="duration" type="number" min={1} max={36500} defaultValue={row?.durationDays} /></Field><Check name="enabled" label="Este producto incluye Timbre" initial={row?.enabled} />
    </AdminForm>}{data.products.length === 0 && <p>Primero creá un producto propio de Hardware o Nuevo en el marketplace.</p>}
  </Card><Card title="Conciliar una compra elegible"><p>Usalo para reprocesar una compra cuyo pago ya fue verificado y que incluía una licencia al reservarse. Esto no aprueba pagos ni agrega beneficios retroactivamente.</p><AdminForm save={(form) => reconcile({ orderId: value(form, "order") as Id<"marketplaceOrders"> })} button="Revisar compra verificada"><Field title="Identificador del pedido del marketplace"><input name="order" required /></Field></AdminForm></Card></div>;
}

function Orders({ data }: { data: Overview }) {
  const [status, setStatus] = useState("all"); const rows = data.orders.filter((row) => status === "all" || row.status === status);
  return <Card title="Pedidos de placas"><Field title="Filtrar por estado"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    {rows.length === 0 ? <p>No hay pedidos en este estado.</p> : rows.map((order) => <PlateOrder key={order._id} order={order} />)}
  </Card>;
}
function PlateOrder({ order }: { order: Doc<"timbrePlateOrders"> }) {
  const client = useConvex(); const update = useMutation(api.timbre_commerce.adminUpdatePlateOrder); const upload = useMutation(api.timbre_commerce.generateProductionUploadUrl); const record = useMutation(api.timbre_commerce.recordProductionFile); const [busy, setBusy] = useState(false);
  const transition = ({ draft: "cancelled", paid: "production", production: "ready", ready: "shipped", shipped: "delivered" } as const)[order.status as "draft" | "paid" | "production" | "ready" | "shipped"];
  const generate = async (format: "png" | "svg" | "pdf", store: boolean) => {
    setBusy(true);
    try {
      const current = await client.query(api.timbre_commerce.productionExport, { id: order._id });
      const file = await exportTimbreQr(timbrePublicQrUrl(current.qrToken), current.design, format);
      if (store) {
        const target = await upload({}); const response = await fetch(target, { method: "POST", headers: { "Content-Type": file.blob.type }, body: file.blob, credentials: "omit", redirect: "error" });
        if (!response.ok) throw new Error("No se pudo guardar el archivo de producción.");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("storageId" in result) || typeof result.storageId !== "string") throw new Error("La carga no devolvió un archivo válido.");
        await record({ id: order._id, storageId: result.storageId as Id<"_storage">, fileName: file.filename, expectedQrToken: current.qrToken });
        toast.success("PDF verificado y archivado para este pedido");
      }
      downloadTimbreExport(file);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo generar el archivo."); }
    finally { setBusy(false); }
  };
  const downloadSaved = async () => {
    try {
      const result = await client.query(api.timbre_commerce.productionExport, { id: order._id });
      if (!result.fileUrl) throw new Error("Este pedido todavía no tiene un archivo archivado.");
      const url = new URL(result.fileUrl); if (url.protocol !== "https:" || url.username || url.password) throw new Error("El enlace del archivo no es seguro.");
      const response = await fetch(url.href, { credentials: "omit", redirect: "error" });
      if (!response.ok) throw new Error("No se pudo descargar el archivo archivado.");
      const blob = await response.blob(); if (blob.size > 25 * 1024 * 1024) throw new Error("El archivo supera el límite de producción.");
      const target = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = target; a.download = order.productionFileName ?? "VISO-Timbre-Produccion.pdf"; a.click(); window.setTimeout(() => URL.revokeObjectURL(target), 30_000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo descargar el archivo."); }
  };
  return <details className="vt-details vta-order"><summary><span><Package aria-hidden="true" /> {order.variant.name} · {money(order.amount, order.currency)}</span><span className="vta-status">{statusNames[order.status]}</span></summary>
    <p className="vt-caption">Pedido {order._id} · {date(order.createdAt)}</p><div className="vt-grid"><section><h3>Entrega</h3><p>{order.shippingAddress.name}<br />{order.shippingAddress.street}<br />{order.shippingAddress.city}, {order.shippingAddress.region}, {order.shippingAddress.postalCode}, {order.shippingAddress.country}<br />{order.shippingAddress.phone}</p>{order.shippingAddress.notes && <p>{order.shippingAddress.notes}</p>}<p>{order.shipping.name} · {order.shipping.terms}</p>{order.carrier && <p>{order.carrier} · {order.trackingReference}</p>}</section><section><h3>Producción</h3><p>{order.variant.material} · {order.variant.widthMm} × {order.variant.heightMm} mm<br />{order.variant.productionNotes}</p><p>Garantía: {order.variant.warranty}</p><p>{order.qrId ? "QR vinculado al pedido" : "El cliente debe vincular el QR antes de producir"}</p></section></div>
    {order.qrId && ["paid", "production", "ready", "shipped", "delivered"].includes(order.status) && <div className="vta-actions"><Button variant="outline" disabled={busy} onClick={() => void generate("svg", false)}><Download /> SVG</Button><Button variant="outline" disabled={busy} onClick={() => void generate("png", false)}><Download /> PNG 300 dpi</Button><Button variant="outline" disabled={busy} onClick={() => void generate("pdf", false)}><Download /> PDF</Button>{order.status === "paid" && <Button disabled={busy} onClick={() => void generate("pdf", true)}><FileCheck2 /> {busy ? "Verificando…" : "Generar y archivar PDF de producción"}</Button>}{order.productionFileId && <Button variant="outline" onClick={() => void downloadSaved()}>Descargar archivo archivado</Button>}</div>}
    {transition && <AdminForm save={(form) => update({ id: order._id, status: transition, ...(transition === "shipped" ? { carrier: value(form, "carrier"), trackingReference: value(form, "tracking") } : {}) })} button={transition === "cancelled" ? "Cancelar borrador" : `Pasar a ${statusNames[transition].toLowerCase()}`}>
      {transition === "shipped" && <div className="vt-grid"><Field title="Transportista real"><input name="carrier" required maxLength={120} /></Field><Field title="Código de seguimiento"><input name="tracking" required maxLength={200} /></Field></div>}
      {order.status === "paid" && !order.productionFileId && <p className="vt-caption">Primero generá y archivá el PDF. El pago confirmado, el QR y el archivo son obligatorios para comenzar la producción.</p>}
    </AdminForm>}
    {["pending_payment", "refunded"].includes(order.status) && <p className="vt-caption">El estado del pago se confirma mediante Mercado Pago. No se puede marcar un pedido como pagado desde este panel.</p>}
  </details>;
}

function Licenses({ data }: { data: Overview }) {
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState(""); const [ownerId, setOwnerId] = useState<Id<"users"> | "">("");
  const users = useQuery(api.timbre_commerce.adminSearchUsers, search.length >= 3 ? { query: search } : "skip");
  const record = useMutation(api.timbre_commerce.recordPaidContract); const revoke = useMutation(api.timbre_commerce.revokeLicense);
  return <div className="vt-stack"><Card title="Registrar un contrato con pago confirmado"><p>Para ventas comerciales cobradas y verificadas por fuera del checkout. La referencia debe ser real y única: no activa un período de prueba ni reemplaza la confirmación de un pago pendiente.</p>
    <Field title="Buscar cuenta por correo exacto"><input type="email" value={search} onChange={(e) => { setSearch(e.target.value.trim()); setOwnerId(""); }} placeholder="cliente@empresa.com" autoComplete="off" /></Field><div className="vta-search">{users?.map((user) => <button key={user.id} type="button" aria-pressed={ownerId === user.id} onClick={() => setOwnerId(user.id)}>{user.name ?? user.email ?? user.id}<span>{user.email}</span></button>)}{search.length >= 3 && users?.length === 0 && <p>No hay una cuenta con ese correo exacto.</p>}</div>
    <AdminForm save={(form) => { if (!ownerId) throw new Error("Elegí primero la cuenta del cliente."); if (!checked(form, "verified")) throw new Error("Confirmá que verificaste el pago real."); return record({ ownerId, planId: value(form, "planId") as Id<"timbrePlans">, reference: value(form, "reference"), amount: amount(form)!, currency: currency(form), paidAt: new Date(value(form, "paidAt")).getTime() }); }} button="Registrar pago y emitir licencia">
      <Field title="Plan contratado"><PlanSelect plans={data.plans.filter((plan) => plan.enabled)} /></Field><div className="vt-grid"><Field title="Referencia del pago o contrato"><input name="reference" required maxLength={200} /></Field><Field title="Importe realmente cobrado"><input name="price" type="number" min="0.01" step="0.01" required /></Field><Currency /><Field title="Fecha y hora del pago"><input name="paidAt" type="datetime-local" max={dateInput(now)} required /></Field></div><Check name="verified" label="Verifiqué el pago real y que corresponde a esta cuenta y plan" />
    </AdminForm>
  </Card><Card title="Licencias emitidas">{data.licenses.length === 0 ? <p>Todavía no hay licencias emitidas.</p> : data.licenses.map((license) => <details key={license._id} className="vt-details"><summary><ShieldCheck aria-hidden="true" /> {license.planName} · {licenseNames[license.status]}</summary><p className="vt-caption">Cuenta: {license.ownerId}<br />Origen: {license.source}<br />Referencia: {license.sourceReference}<br />Inicio: {date(license.startsAt)} · Fin: {date(license.expiresAt)}</p>{license.status !== "revoked" && <AdminForm save={(form) => { if (!checked(form, "confirm")) throw new Error("Confirmá la revocación."); return revoke({ id: license._id, reason: value(form, "reason") }); }} button="Revocar licencia"><Field title="Motivo de la revocación"><input name="reason" required maxLength={500} /></Field><Check name="confirm" label="Entiendo que esta licencia dejará de habilitar Timbre" /></AdminForm>}{license.revocationReason && <p>Motivo: {license.revocationReason}</p>}</details>)}</Card>
    <Card title="Suscripciones">{data.subscriptions.length === 0 ? <p>No hay solicitudes de suscripción.</p> : data.subscriptions.map((subscription) => <div key={subscription._id} className="vt-history-row"><div><strong>{subscription.planSnapshot.name}</strong><p className="vt-caption">Cuenta: {subscription.ownerId} · {date(subscription.createdAt)}{subscription.cancelRequestedAt ? " · Baja solicitada" : ""}</p></div><span>{{ pending_external: "Pendiente de autorización o primer pago", authorized: "Autorizada por Mercado Pago", paused: "Pausada", cancelled: "Cancelada" }[subscription.status]}</span></div>)}<p className="vt-caption">La autorización del proveedor no activa una licencia: se verifica el pago de cada período. Las cancelaciones con referencia de proveedor necesitan confirmarse también allí.</p></Card>
    <Card title="Pagos comerciales registrados">{data.externalPayments.length === 0 ? <p>No hay pagos externos registrados.</p> : data.externalPayments.map((payment) => <div className="vt-history-row" key={payment._id}><div><strong>{payment.reference}</strong><p className="vt-caption">{date(payment.paidAt)} · Cuenta {payment.ownerId}</p></div><span>{money(payment.amount, payment.currency)}</span></div>)}</Card>
  </div>;
}
