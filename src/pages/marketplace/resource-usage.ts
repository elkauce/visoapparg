export interface MarketplaceResourceUsage {
  kind: string;
  destination: string;
  description: string;
  requirements: string;
}

interface Resource {
  category: string;
  delivery?: string;
  pageTemplate?: string;
  profileTemplate?: string;
  productId?: string;
  id?: string;
}

/** Describes the destination actually supported by VISO, before applying a resource. */
export function marketplaceResourceUsage(
  product: Resource,
): MarketplaceResourceUsage {
  const productId = product.productId ?? product.id;
  if (product.category === "pages") {
    const base = {
      kind: "Página para el Deck",
      destination: "Una página de tu Deck",
    };
    switch (product.pageTemplate) {
      case "football":
        return {
          ...base,
          description:
            "Resultados, partidos anteriores, equipos y competiciones a pantalla completa.",
          requirements:
            "Conexión a internet. Los datos disponibles dependen de cada competición.",
        };
      case "weather":
        return {
          ...base,
          description:
            "Clima actual y pronóstico para la ciudad que elijas, a pantalla completa.",
          requirements:
            "Conexión a internet y una ciudad configurada desde el Deck.",
        };
      case "clock":
        return {
          ...base,
          description:
            "Reloj a pantalla completa con estilos, fecha, colores y fotos configurables.",
          requirements:
            "Elegí el diseño desde el Deck. Las fotos se agregan al seleccionarlas.",
        };
      case "spotify":
        return {
          ...base,
          description:
            "Muestra la canción, la carátula y los controles de Spotify en tu dispositivo Android.",
          requirements:
            "App VISO para Android, Spotify reproduciendo y permiso multimedia de VISO.",
        };
      case "visualizer":
      case "vumeter":
        return {
          ...base,
          description:
            "Vúmetros, ondas y barras que reaccionan al audio, a pantalla completa.",
          requirements:
            "Permiso para el micrófono o para compartir audio. La captura de música depende del dispositivo y la aplicación.",
        };
      case "states":
      case "statuses":
        return {
          ...base,
          description:
            "Tus teclas de estado para controlar la señalización vinculada con tu cuenta VISO.",
          requirements:
            "Los dispositivos y las luces se vinculan desde Conexiones.",
        };
      default:
        return {
          ...base,
          description:
            "Agrega una página compatible con VISO y conserva las páginas que ya tenés.",
          requirements:
            "Revisá la compatibilidad y la configuración indicadas en la ficha del producto.",
        };
    }
  }
  if (product.category === "icons")
    return {
      kind: "Iconos para teclas",
      destination: "Una tecla del Deck o el fondo del Display",
      description:
        "Elegí una imagen, un GIF o un video y aplicalo a una tecla conservando su acción.",
      requirements:
        "Elegí el archivo y la tecla o el Display donde querés usarlo.",
    };
  if (product.category === "screensavers")
    return {
      kind: "Fondo para Display",
      destination: "El fondo de tu Display",
      description:
        "Aplica una imagen o un video al Display y permite elegir si se muestra tu estado encima.",
      requirements:
        "Elegí el archivo y su ajuste a la pantalla antes de aplicarlo.",
    };
  if (product.category === "profiles")
    return product.profileTemplate === "essential"
      ? {
          kind: "Perfil de teclas",
          destination: "Una página nueva de tu Deck",
          description:
            "Agrega una página con las teclas de los seis estados VISO.",
          requirements:
            "Espacio disponible para una página nueva. Tus otras páginas se conservan.",
        }
      : {
          kind: "Perfil descargable",
          destination: "La aplicación compatible indicada por el creador",
          description:
            "Descargá el perfil y seguí las instrucciones de instalación de su ficha.",
          requirements:
            "Revisá el dispositivo, la aplicación y la versión compatibles antes de instalarlo.",
        };
  if (product.category === "soundboards")
    return {
      kind: "Colección de sonidos",
      destination: "Reproducción o descarga desde tu biblioteca",
      description:
        "Escuchá los sonidos o descargalos para usarlos en una aplicación compatible.",
      requirements: "Salida de audio y volumen habilitados para escucharlos.",
    };
  if (product.category === "plugins")
    return productId === "viso-stream-deck"
      ? {
          kind: "Plugin para Elgato Stream Deck",
          destination: "Stream Deck en tu computadora",
          description:
            "Descargá el plugin de VISO preparado con la configuración de tu cuenta desde Conexiones.",
          requirements:
            "Computadora con la aplicación Elgato Stream Deck. La instalación se completa allí.",
        }
      : {
          kind: "Plugin descargable",
          destination: "La aplicación compatible indicada por el creador",
          description:
            "Descargá el archivo y seguí las instrucciones de su ficha para instalarlo.",
          requirements:
            "Revisá la aplicación, el sistema y la versión compatibles antes de instalarlo.",
        };
  if (["hardware", "new", "used"].includes(product.category))
    return {
      kind: product.category === "used" ? "Equipo usado" : "Equipo físico",
      destination: "Tu espacio de trabajo",
      description:
        "Consultá las características y continuá la compra desde la ficha del equipo.",
      requirements:
        "Revisá compatibilidad, estado, entrega y garantía con el vendedor.",
    };
  return {
    kind: "Recurso para VISO",
    destination: "El destino indicado en la ficha del producto",
    description:
      "Consultá las instrucciones del recurso para elegir dónde utilizarlo.",
    requirements: "Revisá la compatibilidad indicada por el creador.",
  };
}
