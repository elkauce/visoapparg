# Carrusel móvil de productos

El hero compartido por el inicio web y el panel avanza cada cinco segundos en pantallas de hasta 767 px. Conserva Display como producto inicial, los controles manuales y el color del estado. Permite pausar y reanudar; suspende el avance durante un gesto, con foco de teclado, fuera de pantalla y al ocultar la pestaña. Respeta movimiento reducido.

Validación: nueve pruebas de comportamiento, TypeScript, ESLint de archivos modificados y compilación web aprobados. `browser-report.json` registra trece comprobaciones con Chromium móvil/escritorio. `mobile-autoplay.png` muestra una captura estable, pausada en Display tras seleccionar Ocupado en la demo anónima. No se accedió a una cuenta ni se enviaron comandos a luces físicas.

Revisión independiente del código sin defectos bloqueantes. El intento de despliegue de revisión fue rechazado por Vercel como `Not authorized`; no se publicó una versión nueva ni se modificó el backend.

Alexa se auditó por separado: el mecanismo actual activa rutinas mediante webhook y no ofrece vinculación de cuenta Amazon ni descubrimiento de luces. Los disparadores GET de Voice Monkey no transmiten el RGB dinámico del estado. La selección de un conector real está pendiente de conocer la marca/aplicación de las luces del propietario. Este cambio no anuncia ni simula una nueva conexión con Alexa.
