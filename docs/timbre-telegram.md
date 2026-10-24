# Telegram directo en VISO Timbre

Canal opcional para abrir un perfil personal de Telegram desde el QR de Timbre. El visitante toca **Abrir Telegram** y después inicia una llamada de audio o video en esa aplicación. El propietario recibe y atiende en Telegram, sin mantener VISO abierto. Ambos necesitan Telegram y conexión a Internet. No utiliza un bot, una central telefónica, una transferencia de WhatsApp ni una API empresarial de llamadas.

Estado de esta entrega: implementado y compilado, con 938 pruebas aprobadas en 98 archivos. Los tipos backend/frontend, lint de los archivos cambiados y las vistas estáticas del formulario a 390/1440 píxeles pasaron la revisión. El [informe de validación](validation/timbre-telegram.json) distingue esas pruebas de una llamada física, que sigue pendiente. El despliegue del servidor y la web requiere la autorización de publicación del propietario; no se habilitó Telegram en ninguna cuenta real.

## Configurar el contacto

1. En la web de VISO, ingresar con la cuenta propietaria o responsable del Timbre y abrir **Timbre → Disponibilidad → Atender por Telegram (opcional)**.
2. Ingresar un usuario normal de Telegram, `@usuario` o su enlace `https://t.me/usuario`. No ingresar números de teléfono, invitaciones a grupos, bots ni enlaces a canales.
3. Usar **Comprobar perfil** para revisar la cuenta de destino. VISO valida el formato del enlace; no verifica su existencia, titularidad ni los ajustes de privacidad de Telegram.
4. Confirmar que el perfil es correcto y que se tiene permiso para publicar su usuario a quienes escaneen el QR. Guardar Telegram. No se habilita automáticamente al escribir.
5. En Telegram, ajustar **Privacidad y seguridad → Número de teléfono → Nadie**, revisando las excepciones, y **Llamadas → Todos** para recibir a visitantes desconocidos. Las personas que ya conocen y tienen guardado el teléfono pueden seguir viéndolo según sus reglas de privacidad.

En edificios y oficinas con unidades habilitadas, configurar cada destino en **Integrantes y unidades → Unidades y sectores → Telegram de esta unidad**. El contacto de una unidad nunca se toma de otra ni se reemplaza por el contacto general del inmueble. Las oficinas sin unidades y los hogares usan el contacto general.

## Comportamiento y límites

- Se conserva el QR impreso y las opciones de llamada, video, chat y mensajes de VISO. Telegram se ofrece como otra opción cuando su contacto está guardado.
- El visitante no necesita una cuenta VISO. Al elegir Telegram sale a la aplicación o a su sitio; debe iniciar sesión allí si corresponde y tocar la llamada. VISO no inicia llamadas externas automáticamente ni solicita micrófono o cámara para abrir el perfil.
- La publicación del contacto requiere una licencia Timbre activa con audio o video. Se oculta el acceso cuando el QR, inmueble o unidad están deshabilitados, la licencia vence o el inmueble está silenciado o fuera de horario.
- **Quitar Telegram** elimina el contacto configurado en VISO. Quien ya guardó el usuario puede seguir contactándolo directamente desde Telegram; pausar o revocar un QR no revoca un perfil externo.
- VISO no recibe eventos de atención o finalización de estas llamadas. No las registra como llamadas atendidas ni cambia automáticamente los estados, Display o luces. Las llamadas propias de VISO conservan su funcionamiento.
- No se incluyen teléfonos personales en el enlace: sólo se construye `https://t.me/usuario`. La visibilidad del teléfono dentro de Telegram depende de los ajustes y contactos de esa cuenta.
- Las llamadas personales habituales de Telegram utilizan datos. Esto no elimina las condiciones de la licencia VISO ni el consumo de infraestructura de la plataforma.

## Implementación

Los campos `telegramUsername` son opcionales en `timbreSites` y `timbreUnits`: los registros anteriores continúan sin este canal. `timbre_telegram:saveContact` permite guardar o quitar el alias a propietarios y responsables autorizados, valida la pertenencia de la unidad y registra auditoría sin iniciar llamadas ni enviar mensajes. Quitar un contacto sigue permitido con licencia vencida.

`timbre_telegram:publicContact` exige el token de un QR vigente y resuelve licencia, disponibilidad y unidad antes de devolver sólo el alias y su URL o `null`. La validación acepta usuarios normales de 5 a 32 caracteres y rechaza teléfonos, hosts alternativos, esquemas peligrosos, consultas, fragmentos, rutas especiales e invitaciones. Los enlaces se abren con `noopener noreferrer` y sin enviar el referente del QR.

Las cuentas existentes no se configuran ni se modifican al desplegar. El usuario debe optar por este canal. El destinatario puede atender en Telegram sin una APK nueva de VISO; la configuración se realiza en la web. La APK 1.16.1 conserva su interfaz existente.

## Verificación física pendiente

Antes de afirmar recepción física, probar con dos teléfonos y cuentas distintas: abrir el QR, elegir la unidad si corresponde, abrir el perfil, iniciar audio/video y atender con el teléfono propietario bloqueado. Revisar desde la cuenta visitante qué datos muestra el perfil. Probar también una visita sin Telegram instalado, volver a VISO y usar la llamada nativa.

Referencia de las capacidades de Telegram: [TDLib oficial](https://github.com/tdlib/td/blob/master/td/generate/scheme/td_api.tl) y [cliente Android oficial](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/ChangeUsernameActivity.java). La integración de VISO no controla ni cambia esos clientes.
