# Feria Empresarial - I.E.D. Juan Jose Neira

Sitio web estatico. No necesita paquetes ni envia las fotos a servicios externos.

## Ejecutar

La camara necesita un origen seguro. En Windows, inicia `abrir-feria.bat`; abre el sitio local y deja abierta la ventana del servidor mientras lo usas. Tambien puedes usar cualquier servidor local con esta carpeta o desplegar el sitio bajo HTTPS.

### Probar los controles en un celular

1. Conecta el computador y el celular a la misma red Wi-Fi.
2. Inicia `abrir-feria.bat` en el computador.
3. En la ventana del servidor, busca la direccion de red que aparece como `http://...:<puerto>/` y abrela en el navegador del celular. Si el puerto predeterminado esta ocupado, el servidor elige automaticamente otro disponible entre 8765 y 8785.
4. Entra a Juegos y prueba el pad, los deslizamientos del tablero, el disparo y la pausa. Si Windows pregunta, permite el acceso en redes privadas.

La direccion `127.0.0.1` solo sirve en el computador. La camara del celular requiere HTTPS; por HTTP en la direccion local de la red, los juegos tactiles funcionan, pero el navegador puede bloquear el acceso a la camara.

## Secciones

- Inicio y navegacion adaptable.
- Proyectos: ficha del Sistema de Votacion Electronico. La zona de juegos es una seccion separada.
- Zona arcade con Gusano y Manzana, Galaga, Tetris, Flappy Bird, Bomberman, Pac-Man y Donkey Kong. Los juegos incluyen niveles progresivos, personajes y efectos pixel art animados, sonidos propios y controles de teclado y tactiles. Galaga incluye oleadas, vidas y mejoras de disparo; Donkey Kong se juega con escaleras, salto y martillo; Pac-Man conserva el giro por pasillos y los puntos de poder.
- Mezclador de volumen general para la musica y los efectos, con control de sonido independiente de pantalla completa. La pausa esta separada de los controles de movimiento y accion para evitar activaciones accidentales.
- Estacion de fotos con captura local, seis fondos ilustrados, filtros decorativos alineados automaticamente con la cabeza y ajustables a mano, marco arcade independiente y descarga PNG de alta resolucion.
- Introduccion arcade tactil, fondo animado ligero y transiciones entre secciones.

El recorte de fotos usa el modelo local SelfieSegmenter de MediaPipe y corre dentro del navegador. El runtime, WebAssembly y modelo se guardan en `assets/models/mediapipe`; la foto no se envia a ningun servicio externo. Las fotos se procesan a la resolucion nativa de la camara, limitada a 1600 px por lado para cuidar el rendimiento; los filtros se alinean con la zona de cabeza estimada desde la silueta recortada y se pueden ajustar manualmente. El codigo de MediaPipe se distribuye bajo Apache-2.0 (licencia incluida); el modelo de selfie segmentation es de MediaPipe.

Los records se guardan en `localStorage`. La secuencia de carga es breve y da paso a una pantalla de bienvenida con el boton COMENZAR. Las particulas usan un canvas con una cantidad limitada de elementos; las animaciones respetan `prefers-reduced-motion`.
