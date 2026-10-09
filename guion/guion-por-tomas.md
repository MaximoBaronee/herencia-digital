# 🎬 Guion del video — Herencia Digital

Video de presentación y demo del Trabajo Final (máximo **5 minutos**). Objetivo de duración: **4:30**.

Este documento contiene el guion por tomas. El guion de voz en off se agrega cuando terminen de grabarse las tomas.

## ✅ Cumplimiento de la entrega

| Requisito del protocolo | Estado |
|---|---|
| CEI, eventos, tipos optimizados, OpenZeppelin | ✅ |
| NatSpec en `/contracts` | ✅ |
| Pruebas unitarias en `/test` | ✅ 43 passing |
| Flujo core ejecutable (demo con scripts y front) | ✅ además, probado en Sepolia |
| README: cómo ejecutar, análisis blockchain y Roadmap | ✅ |
| **Video ≤ 5 minutos** | ❌ pendiente de grabar |

## 🧰 Antes de grabar

- [ ] Terminal 1 en `front-herencia-digital` con `npm run dev` corriendo y el front abierto en `localhost:5173`.
- [ ] MetaMask con **Imported Account 1** en la red **Sepolia**, sin otras notificaciones abiertas.
- [ ] Pulsar **Heartbeat** una vez antes de grabar (el reloj puede estar en 0 s).
- [ ] **Desactivar "Added protection"** en cada confirmación de MetaMask.
- [ ] Pestañas listas: README del back, VS Code con `DigitalInheritance.sol`, terminal en `herencia-digital` y Etherscan del contrato.
- [ ] Tamaño de letra grande en terminal y editor.
- [ ] Grabación de pantalla con `Cmd + Shift + 5` (macOS), con micrófono.

## 🎞️ Tomas

### Toma 1 · Presentación (0:00 – 0:25)

Abre el README del back en el navegador, arriba del todo. Muestra el título y baja hasta el diagrama "¿Cómo funciona?" y la tabla del caso de Ana.

### Toma 2 · El contrato (0:25 – 1:05)

En VS Code, abre `DigitalInheritance.sol` y recorre despacio, sin leer todo:

1. Cabecera con `@title`/`@notice` y `ReentrancyGuard`.
2. Los eventos y los errores custom.
3. `claim()`: marca que primero actualiza el estado y después transfiere (CEI) y el `nonReentrant`.

### Toma 3 · Tests (1:05 – 1:35)

En la terminal de `herencia-digital` ejecuta `npm test`. Deja que se vea la lista y el **43 passing**. Resalta con el mouse el test de reentrancia.

### Toma 4 · Demo por scripts (1:35 – 2:35)

Ejecuta `npm run demo`. Corre en menos de un segundo, así que **pausa y señala** cada bloque:

1. Deploy.
2. Depósito de 10 ETH.
3. Heartbeat.
4. Inactividad.
5. Trigger.
6. Claims (≈6 y ≈4 ETH).

Después ejecuta `npm run demo:cancel` y muestra el cancelar y el bloqueo con `ClaimsAlreadyStarted()`.

### Toma 5 · Contrato real en Sepolia (2:35 – 2:55)

Abre `https://sepolia.etherscan.io/address/0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9#code`. Muestra la marca verde de **código verificado** y la pestaña de transacciones.

### Toma 6 · Front en vivo (2:55 – 3:55)

1. Abre `localhost:5173` y pulsa **Conectar wallet**. Señala el rol **Titular**, el estado, el balance y los herederos 60/40.
2. Pulsa **Heartbeat**, confirma en MetaMask (sin "Added protection"). Muestra "Heartbeat confirmado" y la cuenta regresiva reiniciada.
3. Escribe `0.01`, pulsa **Depositar ETH**, confirma y muestra el balance en 0.01 ETH.

### Toma 7 · Roadmap (3:55 – 4:20)

Vuelve al README del back, sección **Roadmap**: baja por Fase 2 (ERC-20/721, recuperación social, aviso previo, `forceDeliverUnclaimed()` con Chainlink Automation) y el front React.

### Toma 8 · Cierre (4:20 – 4:40)

Vuelve al título del README del back. Cierra mostrando los dos enlaces de repo en el checklist.

## 📝 Notas de producción

- **Graba cada toma por separado** y únelas en CapCut. Si una falla, repites solo esa.
- **No uses "Activar herencia" en la toma del front.** Con un heredero cobrando, el trigger ya no es reversible y habría que desplegar otro contrato. El trigger y los claims se muestran en la toma 4 con el script local.
- Si MetaMask tarda en confirmar, corta y acelera esa parte en la edición.
- Si la toma 6 sale larga, puedes quitar el depósito y dejar solo el heartbeat.

## 🔗 Datos de referencia

| Dato | Valor |
|---|---|
| Contrato en Sepolia | `0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9` |
| Wallet titular | `0xB4c296D61f50CEdF5b68082A9cd7012eCb1Eb697` |
| Herederos | 60 % y 40 % |
| Plazo de inactividad en Sepolia | 600 s |
| Repo del back | https://github.com/MaximoBaronee/herencia-digital |
| Repo del front | https://github.com/johanriascos7777/front-herencia-digital |

## 🎙️ Voz en off

Pendiente: se entrega cuando terminen de grabarse las tomas, con el tiempo estimado de cada una y el archivo `.srt` de subtítulos.
