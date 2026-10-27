import { useEffect, useState, type FormEvent } from "react";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { signModels } from "@/convex/lib/teaviso_signs";
import { PublicLayout, Feedback, Loading } from "./ui-v2";
import { qrUrl, publicOrigin } from "./config";
import { randomToken } from "./v2-model";
import { useTask } from "./use-teaviso-task";

type Model = keyof typeof signModels;
type Fields = {
  street: string;
  number: string;
  name: string;
  profession: string;
  registration: string;
  details: string;
};
const empty: Fields = {
  street: "",
  number: "",
  name: "",
  profession: "",
  registration: "",
  details: "",
};
const statusNames = {
  requested: "Solicitud recibida",
  reviewing: "En revisión",
  closed: "Consulta finalizada",
  cancelled: "Cancelada",
};
export function SignCards() {
  return (
    <div className="sb-products">
      {Object.entries(signModels).map(([id, m], i) => (
        <article key={id}>
          <span className="sb-product-number">0{i + 1}</span>
          <h3>{m.name}</h3>
          <p>
            {id === "address"
              ? "Vertical compacto · 12 × 18 cm."
              : m.description}
          </p>
          <Link className="av-button av-outline" to={`/carteles/${id}`}>
            Ver opciones →
          </Link>
        </article>
      ))}
    </div>
  );
}
export function SignCatalog() {
  return (
    <PublicLayout>
      <main className="sb-page">
        <header>
          <span className="sb-eyebrow">Carteles personalizados</span>
          <h1>Elegí tu cartel</h1>
          <p>Para tu puerta, casa o consultorio.</p>
        </header>
        <SignCards />
        <section className="av-card sb-contract-info">
          <h2>Tu QR, a tu manera</h2>
          <p>
            Elegí acrílico o aluminio y revisá tus datos antes de solicitar el
            presupuesto. Las medidas y la fijación se confirman según la
            fabricación y la superficie.
          </p>
          <p>
            El cartel y el envío se cotizan por separado del plan. También podés
            descargar tu QR e imprimirlo.
          </p>
          <Link className="av-button" to="/panel/timbres">
            Ver mis timbres
          </Link>
        </section>
      </main>
    </PublicLayout>
  );
}
export function SignPage({ owner = false }: { owner?: boolean }) {
  const { model } = useParams();
  if (!model || !(model in signModels))
    return (
      <PublicLayout>
        <main className="sb-page">
          <h1>No encontramos ese cartel</h1>
          <Link to="/carteles">Ver los modelos</Link>
        </main>
      </PublicLayout>
    );
  const content = (
    <SignCustomizer key={model} model={model as Model} owner={owner} />
  );
  return owner ? (
    content
  ) : (
    <PublicLayout>
      <main className="sb-page">{content}</main>
    </PublicLayout>
  );
}
function stored(model: Model): Fields {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`teaviso-sign-${model}`) ?? "{}",
    );
    return Object.fromEntries(
      Object.keys(empty).map((k) => [
        k,
        typeof value[k] === "string" ? value[k].slice(0, 120) : "",
      ]),
    ) as Fields;
  } catch {
    return { ...empty };
  }
}
export function SignPreview({
  model,
  material,
  fields,
  url,
}: {
  model: Model;
  material: "acrylic" | "aluminum";
  fields: Fields;
  url: string;
}) {
  const m = signModels[model],
    dark = material === "acrylic",
    ink = dark ? "#fafaf6" : "#232824",
    bg = dark ? "#242625" : "#f5f3eb";
  const professional = model === "professional",
    address = model === "address",
    qrSize = professional ? 78 : address ? 68 : 80,
    qx = professional ? 209 : address ? 26 : 20,
    qy = professional ? 42 : address ? 90 : 26;
  return (
    <svg
      viewBox={`0 0 ${m.width} ${m.height}`}
      role="img"
      aria-label={`Vista previa de ${m.name}`}
      className={`sb-sign-preview model-${model}`}
    >
      <rect
        x="1"
        y="1"
        width={m.width - 2}
        height={m.height - 2}
        rx="4"
        fill={bg}
        stroke="#b9bdb3"
      />
      <text
        x={professional ? 14 : m.width / 2}
        y={professional ? 25 : 14}
        textAnchor={professional ? "start" : "middle"}
        fill={ink}
        fontSize={professional ? 9 : 8}
        fontWeight="600"
      >
        Te Aviso
      </text>
      {address && (
        <>
          <text
            x="60"
            y="37"
            textAnchor="middle"
            fill={ink}
            fontSize={Math.min(8, 180 / Math.max(fields.street.length, 10))}
          >
            {fields.street || "San Martín"}
          </text>
          <text
            x="60"
            y="70"
            textAnchor="middle"
            fill={ink}
            fontSize={Math.min(30, 158 / Math.max(fields.number.length, 4))}
            fontWeight="600"
          >
            {fields.number || "1234"}
          </text>
        </>
      )}
      {professional && (
        <>
          <text
            x="14"
            y="65"
            fill={ink}
            fontSize={Math.min(12, 320 / Math.max(fields.name.length, 25))}
            fontWeight="600"
          >
            {fields.name || "Nombre del profesional"}
          </text>
          <text
            x="14"
            y="89"
            fill={ink}
            fontSize={Math.min(9, 320 / Math.max(fields.profession.length, 25))}
          >
            {fields.profession || "Profesión o especialidad"}
          </text>
          <text x="14" y="108" fill={ink} fontSize="8">
            {fields.registration || "Matrícula (si corresponde)"}
          </text>
          <text x="14" y="143" fill={ink} fontSize="5.5">
            {fields.details.slice(0, 60) || "Datos del consultorio"}
          </text>
          <text x="14" y="156" fill={ink} fontSize="5.5">
            {fields.details.slice(60, 120)}
          </text>
        </>
      )}
      <QRCodeSVG
        x={qx}
        y={qy}
        value={url}
        size={qrSize}
        marginSize={4}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
      />
      <text
        x={professional ? qx + qrSize / 2 : m.width / 2}
        y={professional ? qy + qrSize + 15 : address ? 169 : 115}
        textAnchor="middle"
        fill={ink}
        fontSize={professional ? 7 : 5.5}
      >
        Escaneá para avisar
      </text>
    </svg>
  );
}
function SignCustomizer({ model, owner }: { model: Model; owner: boolean }) {
  const [fields, setFields] = useState<Fields>(() => stored(model)),
    [material, setMaterial] = useState<"acrylic" | "aluminum">("aluminum"),
    [spaceId, setSpaceId] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [key] = useState(randomToken),
    [sent, setSent] = useState(false);
  const auth = useConvexAuth(),
    rows = useQuery(
      api.teaviso_spaces.list,
      auth.isAuthenticated ? {} : "skip",
    ),
    request = useMutation(api.teaviso_signs.request),
    task = useTask();
  useEffect(() => {
    try {
      sessionStorage.setItem(`teaviso-sign-${model}`, JSON.stringify(fields));
    } catch {
      /* Private browsing may disable session storage. */
    }
  }, [model, fields]);
  const selected = rows?.find((r) => r._id === spaceId) ?? rows?.[0],
    m = signModels[model];
  const change = (name: keyof Fields, value: string) => {
    setFields((f) => ({ ...f, [name]: value }));
    setReviewed(false);
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    void task.run(async () => {
      await request({
        spaceId: selected._id,
        model,
        material,
        fields,
        requestKey: key,
        reviewed,
      });
      setSent(true);
    }, "Solicitud recibida. Revisaremos el diseño para cotizarlo.");
  };
  return (
    <div className="av-stack">
      <Link
        className="sb-text-link"
        to={owner ? "/panel/carteles" : "/carteles"}
      >
        ← Ver carteles
      </Link>
      <header className="av-panel-heading">
        <div>
          <span className="sb-eyebrow">Cartel personalizado</span>
          <h1>{m.name}</h1>
          <p>{m.size} · Medida orientativa</p>
        </div>
      </header>
      <div className="sb-customizer">
        <figure>
          <SignPreview
            model={model}
            material={material}
            fields={fields}
            url={selected ? qrUrl(selected.token) : publicOrigin()}
          />
          <figcaption>
            Vista previa de diseño. Material, medidas y precio sujetos a
            confirmación.
          </figcaption>
        </figure>
        <form className="av-card av-form" onSubmit={submit}>
          <fieldset disabled={task.busy || sent}>
            <label>
              Material
              <select
                value={material}
                onChange={(e) => {
                  setMaterial(e.target.value as typeof material);
                  setReviewed(false);
                }}
              >
                <option value="aluminum">Aluminio</option>
                <option value="acrylic">Acrílico</option>
              </select>
            </label>
            {model === "address" && (
              <>
                <label>
                  Calle
                  <input
                    required
                    maxLength={60}
                    value={fields.street}
                    placeholder="San Martín"
                    onChange={(e) => change("street", e.target.value)}
                  />
                </label>
                <label>
                  Número
                  <input
                    required
                    maxLength={15}
                    value={fields.number}
                    placeholder="1234"
                    onChange={(e) => change("number", e.target.value)}
                  />
                </label>
              </>
            )}
            {model === "professional" && (
              <>
                <label>
                  Nombre del profesional
                  <input
                    required
                    maxLength={60}
                    value={fields.name}
                    onChange={(e) => change("name", e.target.value)}
                  />
                </label>
                <label>
                  Profesión o especialidad
                  <input
                    required
                    maxLength={60}
                    value={fields.profession}
                    onChange={(e) => change("profession", e.target.value)}
                  />
                </label>
                <label>
                  Matrícula (si corresponde)
                  <input
                    maxLength={35}
                    value={fields.registration}
                    onChange={(e) => change("registration", e.target.value)}
                  />
                </label>
                <label>
                  Datos del consultorio
                  <textarea
                    maxLength={120}
                    value={fields.details}
                    onChange={(e) => change("details", e.target.value)}
                  />
                </label>
              </>
            )}
            {owner ? (
              <>
                {rows === undefined ? (
                  <Loading />
                ) : rows.length ? (
                  <>
                    <label>
                      Timbre para este cartel
                      <select
                        value={selected?._id ?? ""}
                        onChange={(e) => {
                          setSpaceId(e.target.value);
                          setReviewed(false);
                        }}
                      >
                        {rows.map((r) => (
                          <option key={r._id} value={r._id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="av-checkbox">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                        required
                      />
                      Revisé la vista previa y mis datos para solicitar
                      presupuesto.
                    </label>
                    <button
                      className="av-button"
                      type="submit"
                      disabled={!reviewed}
                    >
                      {sent
                        ? "Solicitud enviada"
                        : task.busy
                          ? "Enviando…"
                          : "Solicitar presupuesto"}
                    </button>
                  </>
                ) : (
                  <p>
                    Primero{" "}
                    <Link className="sb-text-link" to="/panel/nuevo">
                      creá tu timbre
                    </Link>{" "}
                    para vincular el QR.
                  </p>
                )}
              </>
            ) : (
              <Link className="av-button" to={`/panel/carteles/${model}`}>
                Continuar con mi cuenta
              </Link>
            )}
          </fieldset>
          <Feedback task={task} />
          <p className="sb-note">
            Esta solicitud no genera un cobro ni una orden de fabricación.
            Confirmaremos precio, envío y condiciones antes de encargarlo.
          </p>
        </form>
      </div>
    </div>
  );
}
export function MySigns() {
  const rows = useQuery(api.teaviso_signs.mine, {});
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="sb-eyebrow">Placas y carteles</span>
          <h1>Mis carteles</h1>
          <p>Personalizá tu placa y consultá tus solicitudes.</p>
        </div>
      </header>
      <SignCards />
      <section className="av-card">
        <h2>Mis solicitudes</h2>
        {rows === undefined ? (
          <Loading />
        ) : !rows.length ? (
          <p>Todavía no enviaste una solicitud de presupuesto.</p>
        ) : (
          rows.map((r) => (
            <article className="av-small-item" key={r._id}>
              <div>
                <strong>
                  {signModels[r.model].name} · {r.spaceName}
                </strong>
                <p>
                  {r.material === "acrylic" ? "Acrílico" : "Aluminio"} ·{" "}
                  {statusNames[r.status]}
                </p>
                <small>
                  {new Date(r.createdAt).toLocaleDateString("es-AR")}
                </small>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
export function AdminSigns() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.teaviso_signs.adminList,
    {},
    { initialNumItems: 20 },
  );
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="sb-eyebrow">Administración Te Aviso</span>
          <h1>Solicitudes de carteles</h1>
          <p>Revisá los datos y coordiná el presupuesto antes de fabricar.</p>
        </div>
      </header>
      {results.map((row) => (
        <AdminSign key={`${row._id}:${row.updatedAt}`} row={row} />
      ))}
      {status === "LoadingFirstPage" ? (
        <Loading />
      ) : !results.length ? (
        <section className="av-card">
          <p>No hay solicitudes de carteles.</p>
        </section>
      ) : null}
      {status === "CanLoadMore" && (
        <button className="av-button av-outline" onClick={() => loadMore(20)}>
          Ver más solicitudes
        </button>
      )}
    </div>
  );
}
type RequestRow = FunctionReturnType<
  typeof api.teaviso_signs.adminList
>["page"][number];
function AdminSign({ row }: { row: RequestRow }) {
  const save = useMutation(api.teaviso_signs.adminUpdate),
    task = useTask();
  return (
    <details className="av-card">
      <summary>
        {row.spaceName} · {signModels[row.model].name} ·{" "}
        {statusNames[row.status]}
      </summary>
      <p>{row.email}</p>
      <div className="sb-customizer">
        <SignPreview
          model={row.model}
          material={row.material}
          fields={row.fields}
          url={qrUrl(row.qrToken)}
        />
        <div>
          <dl>
            {Object.entries(row.fields)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {
                      {
                        street: "Calle",
                        number: "Número",
                        name: "Nombre",
                        profession: "Profesión",
                        registration: "Matrícula",
                        details: "Datos",
                      }[k as keyof Fields]
                    }
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <p>
            Material: {row.material === "acrylic" ? "Acrílico" : "Aluminio"}
          </p>
          <form
            className="av-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void task.run(
                () =>
                  save({
                    id: row._id as Id<"teavisoSignRequests">,
                    status: String(data.get("status")) as RequestRow["status"],
                    notes: String(data.get("notes")),
                    expectedUpdatedAt: row.updatedAt,
                  }),
                "Solicitud actualizada.",
              );
            }}
          >
            <fieldset disabled={task.busy}>
              <label>
                Estado
                <select
                  name="status"
                  aria-label="Estado"
                  defaultValue={row.status}
                >
                  {Object.entries(statusNames).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notas internas
                <textarea
                  name="notes"
                  aria-label="Notas internas"
                  maxLength={1000}
                  defaultValue={row.adminNotes}
                />
              </label>
              <button className="av-button" type="submit">
                Guardar revisión
              </button>
            </fieldset>
            <Feedback task={task} />
          </form>
        </div>
      </div>
    </details>
  );
}
