import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, BellRing, Search, UserRound } from "lucide-react";
import { Empty, Feedback, Loading } from "./ui-v2";
import { useTask } from "./use-teaviso-task";

type Customer = FunctionReturnType<typeof api.teaviso_accounts.customer>;
type Doorbell = {
  id: string;
  name: string;
  enabled: boolean;
  updatedAt: number;
};
export default function AdminCustomers() {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Id<"users"> | null>(null);
  const { results, status, loadMore } = usePaginatedQuery(
    api.teaviso_accounts.directory,
    { search: search.trim() || undefined },
    { initialNumItems: 20 },
  );
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Administración Te Aviso</span>
          <h1>Usuarios y timbres</h1>
          <p>Clientes, datos de contacto y timbres de este servicio.</p>
        </div>
      </header>
      {selected ? (
        <>
          <button className="av-back" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            Volver a usuarios
          </button>
          <CustomerDetail userId={selected} />
        </>
      ) : (
        <>
          <label className="av-admin-search">
            <Search size={19} />
            <span className="sr-only">Buscar usuarios de Te Aviso</span>
            <input
              type="search"
              value={search}
              maxLength={120}
              placeholder="Buscar por nombre o correo"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <section
            className="av-card av-stack"
            aria-label="Usuarios de Te Aviso"
          >
            {results.map((r) => (
              <button
                className="av-customer-row"
                key={r.id}
                onClick={() => setSelected(r.id)}
              >
                <UserRound size={22} />
                <span>
                  <strong>{r.name}</strong>
                  <small>{r.email}</small>
                </span>
                <span>Ver timbres →</span>
              </button>
            ))}
            {status === "LoadingFirstPage" ? (
              <Loading />
            ) : results.length === 0 ? (
              <Empty title="No encontramos clientes">
                <p>
                  {search
                    ? "Probá otro nombre o correo."
                    : "Acá aparecen quienes ingresan a Te Aviso y los clientes con timbres existentes."}
                </p>
              </Empty>
            ) : null}
            {status === "CanLoadMore" && (
              <button
                className="av-button av-outline"
                onClick={() => loadMore(20)}
              >
                Ver más usuarios
              </button>
            )}
            {status === "LoadingMore" && <Loading />}
          </section>
        </>
      )}
    </div>
  );
}
function CustomerDetail({ userId }: { userId: Id<"users"> }) {
  const customer = useQuery(api.teaviso_accounts.customer, { userId });
  if (!customer) return <Loading />;
  const doorbells =
    customer.spaces.length + customer.qrs.length + customer.sites.length;
  return (
    <div className="av-stack">
      <section className="av-card">
        <h2>{customer.name}</h2>
        <p>{customer.email}</p>
        <span className="av-tag">
          {doorbells} timbre{doorbells === 1 ? "" : "s"}
        </span>
      </section>
      <CustomerForm key={customer.updatedAt} customer={customer} />
      <section className="av-stack">
        <h2>
          <BellRing size={22} /> Timbres del cliente
        </h2>
        {customer.spaces.map((row) => (
          <DoorbellForm
            key={`${row.id}:${row.updatedAt}`}
            row={row}
            target="space"
            userId={userId}
            kind={row.digital ? "Timbre con llamadas" : "Entrada y QR"}
          />
        ))}
        {customer.qrs.map((row) => (
          <DoorbellForm
            key={`${row.id}:${row.updatedAt}`}
            row={row}
            target="whatsapp"
            userId={userId}
            kind="WhatsApp"
          />
        ))}
        {customer.sites.map((row) => (
          <DoorbellForm
            key={`${row.id}:${row.updatedAt}`}
            row={row}
            target="digital"
            userId={userId}
            kind="Timbre con llamadas"
          />
        ))}
        {!doorbells && (
          <Empty title="Este cliente todavía no creó timbres">
            <p>Su cuenta ya está registrada en Te Aviso.</p>
          </Empty>
        )}
      </section>
      <section className="av-card av-stack">
        <h2>Planes y licencias</h2>
        {customer.licenses.length ? (
          customer.licenses.map((l) => (
            <div className="av-small-item" key={l.id}>
              <strong>{l.name}</strong>
              <span>
                {
                  {
                    active: "Activa",
                    pending_payment: "Pago pendiente",
                    past_due: "Pago vencido",
                    suspended: "Suspendida",
                    expired: "Vencida",
                    revoked: "Revocada",
                  }[l.status]
                }
              </span>
            </div>
          ))
        ) : (
          <p>Sin licencias de pago. Puede usar el QR WhatsApp básico.</p>
        )}
      </section>
      {!!customer.business.length && (
        <section className="av-card">
          <h2>Solicitudes de número dedicado</h2>
          {customer.business.map((b) => (
            <p key={b.id}>
              {b.name} ·{" "}
              {
                {
                  requested: "Solicitada",
                  awaiting_payment: "Pago pendiente",
                  paid: "Pagada",
                  configuring: "En configuración",
                  active: "Activa",
                  cancelled: "Cancelada",
                }[b.status]
              }
            </p>
          ))}
        </section>
      )}
      {!!customer.events.length && (
        <section className="av-card">
          <h2>Historial de administración</h2>
          {customer.events.map((e) => (
            <article className="av-small-item" key={e.id}>
              <div>
                <strong>
                  {e.action === "profile.updated"
                    ? "Datos actualizados"
                    : e.action === "doorbell.paused"
                      ? "Timbre pausado"
                      : "Timbre actualizado"}
                </strong>
                <p>{e.reason}</p>
                <small>{new Date(e.createdAt).toLocaleString("es-AR")}</small>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
function CustomerForm({ customer }: { customer: Customer }) {
  const save = useMutation(api.teaviso_accounts.adminSaveProfile),
    task = useTask();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void task.run(
      () =>
        save({
          userId: customer.id,
          name: String(f.get("name")),
          contactPhone: String(f.get("phone")),
          expectedUpdatedAt: customer.updatedAt,
          reason: String(f.get("reason")),
        }),
      "Datos del cliente guardados.",
    );
  };
  return (
    <form className="av-card av-form" onSubmit={submit}>
      <h2>Datos del cliente</h2>
      <fieldset disabled={task.busy}>
        <label>
          Nombre
          <input
            name="name"
            defaultValue={customer.name}
            required
            maxLength={80}
          />
        </label>
        <label>
          Teléfono de contacto
          <input name="phone" type="tel" defaultValue={customer.contactPhone} />
        </label>
        <label>
          Motivo del cambio
          <input name="reason" required maxLength={300} />
        </label>
        <button className="av-button" type="submit">
          Guardar datos del cliente
        </button>
      </fieldset>
      <Feedback task={task} />
    </form>
  );
}
function DoorbellForm({
  row,
  target,
  userId,
  kind,
}: {
  row: Doorbell;
  target: "space" | "whatsapp" | "digital";
  userId: Id<"users">;
  kind: string;
}) {
  const save = useMutation(api.teaviso_accounts.adminSaveDoorbell),
    task = useTask();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void task.run(
      () =>
        save({
          userId,
          target,
          id: row.id,
          name: String(f.get("name")),
          enabled: f.has("enabled"),
          expectedUpdatedAt: row.updatedAt,
          reason: String(f.get("reason")),
        }),
      "Timbre actualizado. El QR conserva su enlace.",
    );
  };
  return (
    <details className="av-card av-admin-doorbell">
      <summary>
        <BellRing size={20} />
        <strong>{row.name}</strong>
        <span className="av-tag">{row.enabled ? "Activo" : "Pausado"}</span>
      </summary>
      <p>{kind}</p>
      <form className="av-form" onSubmit={submit}>
        <fieldset disabled={task.busy}>
          <label>
            Nombre del timbre
            <input
              name="name"
              defaultValue={row.name}
              required
              maxLength={100}
            />
          </label>
          <label className="av-checkbox">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={row.enabled}
            />{" "}
            Timbre habilitado
          </label>
          <label>
            Motivo del cambio
            <input name="reason" required maxLength={300} />
          </label>
          <button className="av-button av-outline" type="submit">
            Guardar timbre
          </button>
        </fieldset>
        <Feedback task={task} />
      </form>
    </details>
  );
}
