# Panel 03 — control esencial

El usuario eligió la alternativa 03 con teclas oscuras e iluminación existente. Se aplica sobre `fix/viso-deck-reference-layout`, sin modificar `main`.

El panel reemplaza la gran pantalla de estado superior por una barra compacta. Conserva todos los estados reales y ofrece pestañas Estados, Display y Conexiones. Los componentes de ajustes y conexión permanecen montados al cambiar de pestaña para no interrumpir subidas ni conexiones USB. Los accesos rápidos permiten abrir y copiar el Display, acceder a imagen/video, conexión/plugin y APK/QR. Cuenta ofrece la sesión existente y cierre de sesión. El editor completo y las pantallas Deck/Display mantienen su diseño y temas.

El modo `compact` del componente Deck es optativo: el comportamiento predeterminado permanece disponible. No se modifican APIs, estados guardados, usuarios, dispositivos, credenciales, Google Home ni código Android.

Verificación: compilación TypeScript/Vite y ESLint correctos; 384 pruebas existentes correctas; 52 comprobaciones Playwright con cuenta técnica local en 1440, 390 y 320 píxeles. Se comprobaron tres columnas de teclas oscuras, cambios de estado y vista previa sincronizados, restauración del estado de prueba, ajustes de Display, plugin, APK/QR, cuenta, navegación con teclado y barra inferior, editor y restauración de tema, sin desbordamiento ni errores de ejecución. No se controlaron luces ni datos de usuarios reales.

El acceso social todavía no está activado. Los requisitos concretos y la protección de cuentas existentes están en [social-login-setup.md](social-login-setup.md).
