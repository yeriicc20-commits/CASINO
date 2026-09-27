# Símbolos de la tragaperras

Diez sprites de 512×512 con fondo transparente, generados desde los dibujos
SVG de la web (`js/games/slot-symbols.js`), que son la única fuente de verdad:

| Fichero | Símbolo |
|---|---|
| `cereza.png` | dos cerezas con rabo y hoja |
| `limon.png` | limón |
| `naranja.png` | naranja |
| `sandia.png` | media sandía |
| `uvas.png` | racimo de uvas |
| `campana.png` | campana dorada |
| `siete.png` | el 7 rojo |
| `bar.png` | placa BAR |
| `comodin.png` | rombo WILD (comodín) |
| `estrella.png` | estrella dorada |

Son **frutas dibujadas, no emoji**: los emoji los pinta el sistema operativo,
así que el comodín salía como una carta de baraja y el siete como una tecla
azul, y cada plataforma los dibujaba distinto.

## Ajustes de importación en Unity

Selecciona los diez en el Inspector y ponlos de una vez:

- **Texture Type**: `Sprite (2D and UI)`
- **Sprite Mode**: `Single`
- **Pivot**: `Center`
- **Alpha Is Transparency**: sí
- **Filter Mode**: `Bilinear`
- **Compression**: `High Quality` (son planos y con bordes limpios; una
  compresión agresiva ensucia los contornos)
- **Max Size**: 512, o 256 si sólo vas a móvil

## Regenerarlos

Si cambian los dibujos de la web:

```bash
node tools/gen-unity-sprites.js
```

Rasteriza con el Chromium del sistema. No los edites a mano aquí: se
sobrescriben.
