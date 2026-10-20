import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Download,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { externalMarketplaceNavigation } from "@/lib/marketplace-navigation";
import { CREATOR_GUIDES, type GuideCategory, type DownloadExample } from "./creator-guides";
import "./creator-docs.css";

function ExampleDownload({ example }: { example: DownloadExample }) {
  return <div className="vm-doc-example">
    <a href={example.path} download onClick={(event) => externalMarketplaceNavigation(event, example.path)}>
      <Download aria-hidden="true" /> {example.label}
    </a>
    <p>{example.note}</p>
  </div>;
}

export default function CreatorDocs() {
  const [category, setCategory] = useState<GuideCategory>("icons");
  const guide = CREATOR_GUIDES.find((entry) => entry.id === category)!;
  const Icon = guide.icon;
  return (
    <div className="vm-docs">
      <section className="vm-doc-intro">
        <span><BookOpen aria-hidden="true" /> GUÍA PARA CREAR EN VISO</span>
        <h2>De tu idea a la biblioteca de otros.</h2>
        <p>Prepará tus recursos, probalos y publicalos con toda la información que necesita el usuario.</p>
        <div className="vm-doc-intro-actions">
          <Button asChild><Link to="/marketplace?view=studio">Abrir mi espacio creador <ArrowUpRight /></Link></Button>
          <a className="vm-doc-readme" href="/marketplace/creator-templates/LEEME.md" download onClick={(event) => externalMarketplaceNavigation(event, "/marketplace/creator-templates/LEEME.md")}><Download /> Descargar guía</a>
        </div>
      </section>

      <nav className="vm-doc-category-nav" aria-label="Documentación por categoría">
        {CREATOR_GUIDES.map((entry) => {
          const CategoryIcon = entry.icon;
          return <button key={entry.id} type="button" aria-pressed={category === entry.id} onClick={() => setCategory(entry.id)}><CategoryIcon aria-hidden="true" />{entry.label}</button>;
        })}
      </nav>

      <article className="vm-doc-guide" aria-live="polite" aria-label={`Guía de ${guide.label}`}>
        <header><span className="vm-doc-guide-icon"><Icon aria-hidden="true" /></span><div><h3>{guide.label}</h3><p>{guide.introduction}</p></div></header>
        <dl className="vm-doc-specs">
          <div><dt>Formatos</dt><dd>{guide.format}</dd></div>
          <div><dt>Tamaño y presentación</dt><dd>{guide.dimensions}</dd></div>
          <div><dt>Compatibilidad</dt><dd>{guide.compatibility}</dd></div>
          <div><dt>Límites de archivos</dt><dd>Hasta 60 MB por archivo. JSON de hasta 512 KB. Optimizá imágenes y videos para una descarga y reproducción ágiles.</dd></div>
        </dl>
        <div className="vm-doc-checklists">
          <section><h4>Cómo prepararlo</h4><ol>{guide.prepare.map((step) => <li key={step}>{step}</li>)}</ol></section>
          <section><h4>Cómo probarlo</h4><ul>{guide.verify.map((step) => <li key={step}><Check aria-hidden="true" />{step}</li>)}</ul></section>
        </div>
        <section className="vm-doc-examples" aria-label={`Ejemplos de ${guide.label}`}><h4>Plantillas y ejemplos</h4>{guide.examples.map((example) => <ExampleDownload key={example.path} example={example} />)}</section>
      </article>

      <section className="vm-doc-publication">
        <div><FileCheck2 aria-hidden="true" /><h3>Publicar y mantener tu producto</h3></div>
        <ol>
          <li><strong>Completá tu perfil.</strong> Presentá tu marca y solicitá aprobación desde Espacio creador.</li>
          <li><strong>Armá la ficha.</strong> Título, descripción, portada, galería vertical u horizontal, instrucciones, versión y soporte.</li>
          <li><strong>Definí la compra.</strong> Elegí Gratis, precio y moneda o compra externa. Los recursos gratuitos no pasan por checkout. Para cobros dentro de VISO, vinculá tu cuenta cuando el proveedor esté habilitado y revisá la comisión indicada antes de vender.</li>
          <li><strong>Guardá y revisá.</strong> El borrador te permite corregir archivos y detalles antes de solicitar la publicación.</li>
          <li><strong>Enviá a revisión.</strong> Seguí el estado y las observaciones en Espacio creador. Podés editar tus publicaciones y enviar nuevas versiones; lo ya instalado se conserva hasta que el usuario decida actualizarlo.</li>
        </ol>
        <p className="vm-doc-license">Publicá contenido propio o con autorización de distribución. Describí la licencia, los permisos y los servicios externos necesarios. Los archivos públicos deben estar libres de contraseñas y accesos personales.</p>
      </section>
    </div>
  );
}
