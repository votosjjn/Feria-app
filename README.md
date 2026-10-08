# Feria Empresarial - I.E.D. Juan Jose Neira

Sitio web estatico. No necesita paquetes ni envia las fotos a servicios externos.

## Ejecutar

La camara necesita un origen seguro. En Windows, inicia `abrir-feria.bat`; abre el sitio local y deja abierta la ventana del servidor mientras lo usas. Tambien puedes usar cualquier servidor local con esta carpeta o desplegar el sitio bajo HTTPS.

## Secciones

- Inicio y navegacion adaptable.
- Proyectos: ficha del Sistema de Votacion Electronico. La zona de juegos es una seccion separada.
- Juego Gusano y Manzana con teclado, deslizamiento, controles tactiles y record local.
- Estacion de fotos con captura directa de la camara, cuatro escenarios SVG locales y descarga PNG.
- Introduccion arcade tactil, fondo animado ligero y transiciones entre secciones.

El recorte de fotos usa el modelo local SelfieSegmenter de MediaPipe y corre dentro del navegador. El runtime, WebAssembly y modelo se guardan en `assets/models/mediapipe`; la foto no se envia a ningun servicio externo. El codigo de MediaPipe se distribuye bajo Apache-2.0 (licencia incluida); el modelo de selfie segmentation es de MediaPipe.

Los records se guardan en `localStorage`. La secuencia de carga es breve y da paso a una pantalla de bienvenida con el boton COMENZAR. Las particulas usan un canvas con una cantidad limitada de elementos; las animaciones respetan `prefers-reduced-motion`.

