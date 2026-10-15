# Herencia Digital con Dead Man's Switch

Trabajo Final — Blockchain / Web3.

Contrato inteligente que custodia ETH y lo distribuye automáticamente entre
herederos designados si el titular deja de confirmar actividad (heartbeat)
durante un período configurable.

## 🚀 Puesta en marcha

> 💡 **El "back" no se enciende.** El contrato ya vive en la blockchain de Sepolia y funciona 24/7 sin que tengas nada corriendo:
> [`0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9`](https://sepolia.etherscan.io/address/0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9#code). Este repo lo usas para **compilar, probar y desplegar**.

### 🆕 Primera vez (recién clonado)

```bash
git clone https://github.com/MaximoBaronee/herencia-digital.git
cd herencia-digital
npm install          # 1️⃣ instala Hardhat y OpenZeppelin (requiere Node.js 18+)
npm test             # 2️⃣ compila solo y corre los 71 tests ✅
npm run demo         # 3️⃣ opcional: flujo completo en una red local en memoria
```

| Pregunta | Respuesta |
|---|---|
| ¿Tengo que compilar aparte? | ❌ No. `npm test` y `npm run demo` compilan solos. Si quieres hacerlo explícito: `npm run compile`. |
| ¿Necesito `.env`? | ❌ No para tests ni demo. ✅ Solo para **desplegar en Sepolia** (`cp .env.example .env` y completar). |
| ¿Necesito internet? | Solo para `npm install` y para desplegar o verificar. |
| ¿Qué carpetas se generan? | `artifacts/`, `cache/` y `node_modules/`. Están ignoradas por git. |

### 🔁 Segunda vez en adelante

| Situación | Qué hacer |
|---|---|
| Solo quiero ver que sigue todo bien | `npm test` |
| Hice `git pull` y cambió `package.json` | `npm install` |
| Cambié un archivo de `contracts/` | `npm test` (recompila solo) |
| Quiero una demo sin gastar ETH | `npm run demo` o `npm run demo:cancel` |
| Quiero un contrato nuevo en Sepolia | `npm run deploy -- --network sepolia` y luego actualizar la dirección en el front |

**🚫 Qué NO hacer**
- No subas `.env` a git: tiene la clave privada de despliegue.
- No vuelvas a desplegar "por probar": cada despliegue es **otro contrato con otra dirección**, y el front sigue apuntando al anterior.
- No esperes que un cambio en `contracts/` actualice el contrato ya desplegado: es **inmutable**. Hay que desplegar uno nuevo.
- No ejecutes `deposit` ni `heartbeat` con "Added protection" de MetaMask activado (ver [incidencias del front](https://github.com/johanriascos7777/front-herencia-digital#-incidencias)).

### 🚢 Desplegar y verificar en Sepolia

```bash
cp .env.example .env     # completar SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY, HEIR_1, HEIR_2
npm run deploy -- --network sepolia
```

La wallet de `PRIVATE_KEY` necesita Sepolia ETH y será la **titular** del contrato. `INACTIVITY_PERIOD_SECONDS` (por defecto 1 año) permite fijar un plazo corto para demos, por ejemplo `600`.

### 🧠 ¿Cómo funciona?

Un **testamento automático**: el titular deja ETH en el contrato y confirma cada tanto que sigue activo. Si deja de hacerlo, los herederos cobran solos, sin notarios ni intermediarios.

```
 💰 deposit() ──► 💓 heartbeat() ──► ... silencio ... ──► ⏰ plazo vencido
                                                              │
                                  ┌───────────────────────────┘
                                  ▼
                       🚨 triggerInheritance()   (la ejecuta cualquiera)
                                  │
                ┌─────────────────┴──────────────────┐
                ▼                                    ▼
      ↩️ cancelTrigger()                    🎁 claim() de cada heredero
   (solo el titular, y solo si                (cada uno cobra su %,
    nadie cobró todavía)                       una sola vez)
```

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| 👑 **Titular** | quien desplegó el contrato | `deposit`, `heartbeat`, `withdraw`, `setHeirs`, `setInactivityPeriod`, `cancelTrigger`, `sweepDust` |
| 👨‍👩‍👧 **Heredero** | direcciones con un % asignado | `claim()` cuando la herencia está activada |
| 👀 **Observador** | cualquier otra wallet | `triggerInheritance()` si el plazo venció, y leer el estado |

### 🎬 Ejemplo: el caso de Ana

> Ana (titular) deja **1 ETH** para sus hermanos **Bruno (60 %)** y **Carla (40 %)**, con un plazo de **30 días** de inactividad.

| Día | Qué pasa | Estado |
|:-:|---|:-:|
| 0 | Ana despliega el contrato y llama `deposit()` con 1 ETH | 🟢 ACTIVE |
| 10 | Ana llama `heartbeat()`: el reloj de 30 días **vuelve a empezar** | 🟢 ACTIVE |
| 40 | Ana no responde: pasaron más de 30 días desde su último heartbeat | 🟡 plazo vencido |
| 41 | Carla (o cualquiera) llama `triggerInheritance()`: el balance de 1 ETH queda congelado | 🔴 TRIGGERED |
| 41 | Bruno llama `claim()` y recibe **0.6 ETH** | 🔴 TRIGGERED |
| 42 | Carla llama `claim()` y recibe **0.4 ETH** | 🔴 TRIGGERED |

**¿Y si fue una falsa alarma?** Si Ana vuelve entre el día 41 y el momento en que alguien cobra, llama `cancelTrigger()` y todo regresa a 🟢 ACTIVE sin perder fondos. Pero **en cuanto un heredero cobra, ya no hay vuelta atrás**.

---

## Índice

- [🚀 Puesta en marcha](#-puesta-en-marcha)
- [¿Por qué blockchain?](#por-qué-blockchain)
- [Arquitectura](#arquitectura)
- [Instalación](#instalación)
- [Cómo correr los tests](#cómo-correr-los-tests)
- [Cómo correr la demo](#cómo-correr-la-demo)
- [Despliegue en testnet (opcional)](#despliegue-en-testnet-opcional)
- [Seguridad](#seguridad)
- [Optimización de gas](#optimización-de-gas)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Checklist de entrega](#checklist-de-entrega)
- [Roadmap](#roadmap)

## ¿Por qué blockchain?

Un mecanismo de herencia digital necesita tres propiedades que una base de
datos tradicional no puede dar sin confiar en un tercero:

- **Ejecución garantizada**: una vez desplegado, nadie —ni el equipo que lo
  construyó— puede impedir que un heredero cobre lo que le corresponde
  cuando se cumplen las condiciones. No depende de que una empresa siga
  existiendo o de un trámite sucesorio.
- **Verificabilidad pública**: cualquiera puede auditar el código, el estado
  del contrato y el historial de heartbeats sin pedir permiso.
- **Custodia sin intermediario**: los fondos nunca pasan por una cuenta de
  terceros; viven en el contrato desde el depósito hasta el reclamo.

La contracara, documentada honestamente: la clave privada del titular es un
punto único de falla (si se pierde, no hay "recuperación de contraseña"), y
el `inactivityPeriod` es un parámetro rígido que no distingue "me morí" de
"me fui de vacaciones sin señal". Ambas limitaciones se abordan en el
[roadmap](#roadmap) (guardianes de recuperación social, avisos previos, etc.).

## Arquitectura

```
contracts/
  DigitalInheritance.sol      # contrato principal
  mocks/
    ReentrancyAttacker.sol    # mock usado solo en tests de seguridad
    RejectingHeir.sol         # mock: heredero que rechaza ETH (claim falla, sweep bloqueado)
    TriggerAndClaimHeir.sol   # mock: heredero que dispara y reclama en una sola tx
test/
  DigitalInheritance.test.js  # suite de tests unitarios (Hardhat + Chai)
scripts/
  deploy.js                   # despliegue simple
  demo.js                     # flujo completo end-to-end con logs de estado
```

**Flujo principal:**

```
deploy → deposit → heartbeat (periódico) → ... inactividad ...
       → triggerInheritance() → claim() por cada heredero
```

**Máquina de estados** (`Status`):

```
                 triggerInheritance()
        ┌────────────────────────────────►
ACTIVE                                       TRIGGERED
        ◄────────────────────────────────
          cancelTrigger()  (solo si nadie
          reclamó todavía: claimsCount==0)
```

- `heartbeat()`, `withdraw()`, `setHeirs()`, `setInactivityPeriod()` → solo en `ACTIVE`.
- `claim()`, `sweepDust()`, `cancelTrigger()` → solo en `TRIGGERED`.
- Ni bien hay un primer `claim()`, `cancelTrigger()` queda bloqueada para
  siempre: el trigger pasa a ser irreversible (ver [Seguridad](#seguridad)).

### Contrato: `DigitalInheritance.sol`

| Elemento | Detalle |
|---|---|
| Herencia | `ReentrancyGuard` (OZ). El titular es un `address public immutable owner`, control de acceso propio (ver [Gas](#optimización-de-gas)) |
| Struct `Heir` | `{ address account; uint8 percentage; }` — empaqueta en 1 slot de storage |
| Storage packing | `status` + `lastHeartbeat` (`uint40`) + `inactivityPeriod` (`uint40`) comparten 1 slot |
| Errores | Custom errors (`error X()`) en vez de `require(string)` → menor costo de gas y de bytecode |
| Eventos | `Deposited`, `Heartbeat`, `HeirsUpdated`, `InactivityPeriodUpdated`, `InheritanceTriggered`, `TriggerCancelled`, `Claimed`, `Withdrawn`, `DustSwept` |

### Funciones principales

| Función | Quién | Cuándo | Qué hace |
|---|---|---|---|
| `deposit()` / `receive()` | titular | `ACTIVE` | deposita ETH |
| `heartbeat()` | titular | `ACTIVE` | reinicia el temporizador |
| `setHeirs()` / `setInactivityPeriod()` | titular | `ACTIVE` | reconfigura herederos/plazo |
| `withdraw(amount)` | titular | `ACTIVE` | retira fondos |
| `triggerInheritance()` | cualquiera | `ACTIVE`, plazo vencido | pasa a `TRIGGERED`, congela `inheritedBalance` |
| `cancelTrigger()` | titular | `TRIGGERED`, `claimsCount == 0` | vuelve a `ACTIVE`, cuenta como heartbeat |
| `claim()` | heredero | `TRIGGERED` | cobra su porcentaje, una sola vez |
| `sweepDust(to)` | titular | `TRIGGERED`, todos ya cobraron | recupera el resto por redondeo |

## Instalación

Requiere Node.js 18+.

```bash
npm install
```

Esto instala Hardhat, `@nomicfoundation/hardhat-toolbox` y
`@openzeppelin/contracts`. No hace falta configurar nada más para compilar,
testear o correr la demo local.

## Cómo correr los tests

```bash
npm test
```

La suite (`test/DigitalInheritance.test.js`) cubre:

- Deploy y validación de parámetros iniciales (porcentajes, herederos duplicados, dirección cero, arrays de distinto largo) y estado inicial.
- Depósitos (por `deposit()` y por `receive()`), que un tercero no pueda depositar, y que un depósito en `TRIGGERED` no altere el snapshot.
- Heartbeat: quién puede llamarlo, cómo pospone el trigger y que no se pueda usar en `TRIGGERED`.
- Alta/baja de herederos y cambio del período de inactividad: que los herederos reemplazados dejen de serlo, que nada se pueda cambiar en `TRIGGERED`, y que un período de 0 habilite el trigger de inmediato (no hay cota mínima).
- Retiro de fondos por el titular, incluyendo límites y que se bloquee tras el trigger.
- `triggerInheritance()`: que sea permissionless, que respete el plazo (incluido el límite exacto del deadline y los segundos restantes que informa `TooEarly`), que no se pueda disparar dos veces, y que funcione con balance 0.
- `cancelTrigger()`: que funcione solo si nadie reclamó, que reinicie `lastHeartbeat`, que quede bloqueada para siempre en cuanto hay un primer `claim()`, y que un heredero contrato (`TriggerAndClaimHeir`) pueda disparar y reclamar en la misma transacción, sin dejar ventana real de cancelación.
- `claim()`: reparto proporcional correcto e independiente del orden de los reclamos, anti doble-reclamo, que solo reclamen herederos, heredero con 0 %, y un heredero cuya dirección rechaza ETH (`RejectingHeir`): su `claim()` revierte con `TransferFailed` y `sweepDust()` queda bloqueado.
- **Reentrancia**: un contrato atacante (`ReentrancyAttacker`) intenta reclamar dos veces desde su `receive()`; el test verifica que la transacción revierte gracias al patrón Checks-Effects-Interactions + `ReentrancyGuard`.
- `sweepDust()`: recuperación del resto por redondeo entero, solo después de que todos reclamaron; incluye lo depositado después del trigger y no toca el ETH que entra al contrato sin pasar por `receive()`.
- Vistas: `getHeirs`, `percentageOf`, `isHeir`, `isTriggerable` y `timeUntilTrigger`.

71 tests, todos en verde. Cobertura del contrato: 100 % de líneas, sentencias y funciones.

## Cómo correr la demo

```bash
npm run demo
```

Corre `scripts/demo.js` sobre la red local en memoria de Hardhat. Hace todo
el flujo de punta a punta y va imprimiendo el estado real del contrato en
cada paso:

1. Deploy con 2 herederos (60% / 40%).
2. Depósito de 10 ETH por el titular.
3. Heartbeat.
4. Avance del reloj de la red (`evm_increaseTime`) para simular inactividad.
5. `triggerInheritance()` disparado por un tercero.
6. `claim()` de cada heredero, mostrando los balances antes/después.

Hay una segunda demo dedicada al escenario de falsa alarma:

```bash
npm run demo:cancel
```

`scripts/demo-cancel.js` simula que el titular pierde señal (no manda
heartbeat), un tercero dispara la herencia de buena fe, y el titular
recupera señal **antes** de que algún heredero cobre → `cancelTrigger()`
revierte todo a `ACTIVE` sin pérdida de fondos. Al final muestra también el
caso contrario: si llega tarde y un heredero ya cobró, `cancelTrigger()`
revierte con `ClaimsAlreadyStarted()`.

## Despliegue en testnet (opcional)

```bash
cp .env.example .env
# completar SEPOLIA_RPC_URL y PRIVATE_KEY en .env
npm run deploy -- --network sepolia
```

Despliegue actual en Sepolia: [`0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9`](https://sepolia.etherscan.io/address/0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9) (titular `0xB4c296D61f50CEdF5b68082A9cd7012eCb1Eb697`, 2 herederos 60/40, plazo de inactividad de 600 s). Código verificado en [Etherscan](https://sepolia.etherscan.io/address/0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9#code).

## Seguridad

- **Checks-Effects-Interactions**: en `claim()`, `withdraw()` y `sweepDust()`
  el estado (`claimed`, `depositBalance`) se actualiza *antes* de la llamada
  externa que transfiere ETH.
- **ReentrancyGuard**: `nonReentrant` en las tres funciones que mueven valor,
  como segunda capa de defensa además del CEI. Probado explícitamente con un
  contrato atacante en los tests.
- **Control de acceso**: `onlyOwner` (OpenZeppelin) en todas las funciones
  administrativas. `triggerInheritance()` es intencionalmente pública —
  cualquiera puede vigilar el contrato y dispararla, lo cual evita depender
  de un oráculo o de que el titular haga algo.
- **Errores custom**: además del ahorro de gas, dan información estructurada
  (ej. `TooEarly(secondsRemaining)`, `InsufficientBalance(requested, available)`).
- **Solidity ^0.8.20**: overflow/underflow revierten por defecto.
- **Snapshot de balance** (`inheritedBalance`): el reparto se calcula sobre
  una foto fija tomada en `triggerInheritance()`, así el orden en que
  reclaman los herederos no afecta el monto que le toca a cada uno.
- **Límite conocido**: al ser porcentajes enteros con división entera, puede
  quedar un resto de pocos *wei* sin repartir; `sweepDust()` se lo asigna al
  titular una vez que todos los herederos ya cobraron.

### `cancelTrigger()` y el punto de no retorno

`triggerInheritance()` lo puede disparar cualquiera (para no depender de un
oráculo), lo cual significa que puede dispararse por una falsa alarma: el
titular está vivo pero no mandó heartbeat a tiempo (viaje, pérdida de señal,
etc.). Sin una salida, esa falsa alarma sería irreversible e injusta.
`cancelTrigger()` resuelve eso, pero con una restricción clave:

> **Una vez que un heredero ya ejecutó `claim()`, `cancelTrigger()` queda
> bloqueada para siempre** (revierte con `ClaimsAlreadyStarted`).

Se evaluaron dos alternativas:

1. **Permitir cancelar siempre**, incluso con claims parciales ya hechos.
   Se descartó: el heredero que ya cobró se queda con ETH que solo le
   correspondía si la herencia era real, y `depositBalance` ya quedó
   reducido por ese cobro — el contrato volvería a `ACTIVE` con una
   contabilidad que ya no coincide con lo que el titular cree tener. Peor
   aún, crea un incentivo perverso: a cualquier heredero le conviene
   reclamar *apenas* ve el trigger, aunque sospeche que es falsa alarma,
   para asegurarse su parte antes de que el titular llegue a cancelar.
2. **Bloquear la cancelación en el primer `claim()`** (la que se
   implementó). El trigger pasa a ser reversible mientras nadie cobró, e
   irreversible en cuanto empieza el reparto — mismo criterio de "todo o
   nada" que ya se usa en `sweepDust()`. Es más simple, no requiere que el
   titular reponga fondos para "deshacer" cobros ya hechos, y elimina la
   carrera entre heredero y titular.

Efecto práctico: cuanto antes reaccione el titular después de un trigger por
error, más margen tiene. Una vez que un heredero cobra, el proceso ya no se
puede frenar — es una limitación conocida y documentada, no un bug: llamar a
`cancelTrigger()` también actúa como heartbeat (reinicia `lastHeartbeat`),
así que el titular tiene el mismo incentivo de siempre para reaccionar rápido.

### Modelo de amenazas: identidad del titular y de los herederos

- **¿Puede alguien hacerse pasar por el titular?** No. El titular no es un
  dato que se configura — es criptográficamente quien firmó la transacción
  de deploy (`Ownable(msg.sender)`). Conocer la dirección pública de
  alguien no alcanza para actuar en su nombre; hace falta su clave privada,
  y ahí el problema deja de ser este contrato.
- **¿Puede alguien ponerme como heredero sin mi permiso?** Sí, y no hace
  falta que sea un problema: es simétrico a un testamento en papel, donde
  tampoco hace falta el consentimiento de a quién se nombra. `claim()`
  exige la firma de esa dirección específica, así que nadie puede cobrar
  en tu nombre ni perjudicarte por figurar ahí.
- **El riesgo real está en la custodia de la clave privada del titular**,
  no en el contrato: quien la tenga puede cambiar herederos, retirar
  fondos y cancelar activaciones — es, literalmente, vos. La mitigación de
  Fase 2 (recuperación social con guardianes, más abajo) apunta directo a
  este punto.

## Optimización de gas

Medido con `REPORT_GAS=true npm test` (solc 0.8.20, optimizer on, 200 runs).

| Función | Antes (Ownable de OZ) | Después (owner immutable) | Diferencia |
|---|---:|---:|---:|
| Deploy | 1.601.153 | 1.601.814 | +661 (una sola vez) |
| `deposit()` | 47.325 | 45.223 | **−2.102** |
| `heartbeat()` | 28.178 | 28.025 | −153 |
| `setHeirs()` | 92.090 | 91.755 | −335 |
| `setInactivityPeriod()` | 28.295 | 28.170 | −125 |
| `withdraw()` | 40.360 | 40.116 | −244 |
| `cancelTrigger()` | 30.485 | 30.309 | −176 |

**Por qué:** el contrato originalmente heredaba `Ownable` de OpenZeppelin, que
guarda el titular en una variable de **storage** (para poder transferirla
con `transferOwnership()`). Cada una de las 7 funciones `onlyOwner` pagaba
una lectura de storage (SLOAD) para verificar quién llama. Para este
contrato puntual la titularidad no tiene por qué ser transferible — así que
se reemplazó por `address public immutable owner`, fijado una única vez en
el constructor y grabado directamente en el bytecode: leerlo no cuesta
SLOAD, solo una comparación.

El deploy queda apenas más caro (+661 gas, pago único) porque OZ centraliza
el chequeo en una función interna compartida (`_checkOwner()`, llamada por
`JUMP` desde las 7 funciones — menos bytecode), mientras que el modificador
propio, al ser más simple, el compilador lo repite inline en cada una de
las 7 — un poco más de bytecode a cambio de evitar la lectura de storage en
cada llamada futura. Es exactamente el trade-off que conviene acá: pagar un
poco más una sola vez en el deploy para ahorrar en cada una de las
llamadas que va a recibir el contrato durante toda su vida útil.

**Bonus de seguridad, no solo de gas**: sacar `Ownable` completo también
elimina `transferOwnership()` y `renounceOwnership()` del contrato. Ninguna
de las dos tenía sentido acá — la titularidad de una herencia no debería
ser transferible, y un `renounceOwnership()` accidental habría dejado el
contrato sin nadie que pueda hacer `heartbeat()` nunca más.

**Otras optimizaciones aplicadas** (además de las ya mencionadas en
[Arquitectura](#arquitectura)):
- Errores custom en vez de `require(string)` en todo el contrato — evita
  codificar y guardar el string del mensaje en cada revert.
- `unchecked { ++i; }` en los dos únicos loops del contrato (dentro de
  `_setHeirs`), porque el índice está acotado por la cantidad de
  herederos (siempre chica) y solo el titular carga esos arrays — nunca
  puede desbordar, así que el chequeo de overflow que Solidity 0.8 agrega
  por defecto en cada incremento es gasto innecesario ahí.
- `claimsCount` en vez de loopear `_heirs` en `sweepDust()` (ver
  [Decisiones de diseño](#decisiones-de-diseño)).

## Decisiones de diseño

- Se usó `uint8` para el porcentaje (en vez de basis points) porque la
  consigna original pide que sumen exactamente 100; queda documentado como
  mejora de precisión en el roadmap.
- `HeirsUpdated` emite `address[]` y `uint8[]` en paralelo en lugar de un
  array de structs, porque los eventos con arrays de structs son más caros
  y más incómodos de indexar desde el front/subgraph.
- `receive()` solo acepta ETH si viene del titular, para que el contrato no
  termine con fondos "fantasma" que no formaban parte de la herencia.
- `claimsCount` (contador) reemplaza a un loop sobre `_heirs` tanto para
  decidir si `cancelTrigger()` es seguro como para el check de "todos
  cobraron" en `sweepDust()` — antes era `for` sobre el array, ahora es una
  comparación directa, más barata en gas.

## Checklist de entrega

Repos del proyecto:

- **Backend (contratos):** https://github.com/MaximoBaronee/herencia-digital
- **Frontend (React):** https://github.com/johanriascos7777/front-herencia-digital

Este checklist es el mismo en ambos repos.

**Hecho**
- [x] Contrato `DigitalInheritance` con CEI, `ReentrancyGuard`, eventos y errores custom.
- [x] NatSpec completo en `/contracts`.
- [x] 71 tests unitarios en verde (incluye reentrancia).
- [x] Scripts `demo`, `demo:cancel` y `deploy` (este último con herederos y plazo por variables de entorno).
- [x] Frontend base: conexión de wallet, detección de rol, dashboard y acciones.

**Backend (`herencia-digital`)**
- [x] Fondear con Sepolia ETH la wallet de despliegue.
- [x] Desplegar en Sepolia con `npm run deploy -- --network sepolia`.
- [x] Verificar el contrato en Etherscan (requiere `ETHERSCAN_API_KEY`).
- [x] Anotar la dirección desplegada en este README.
- [x] Reemplazar en el Roadmap la app Android por el frontend web en React.

**Frontend (`front-herencia-digital`)**
- [ ] Probar el flujo completo con MetaMask contra `npx hardhat node`.
- [ ] Crear el sistema de diseño en Claude (Sistema de diseño → New design system → Using Claude Code) apuntando a este repo.
- [ ] Aplicar el diseño con el CSS mínimo necesario.
- [ ] Configurar Sepolia (`VITE_CHAIN_ID`, `VITE_CHAIN_NAME`, `VITE_CONTRACT_ADDRESS`) y probar contra el contrato desplegado.

**Entrega**
- [ ] Grabar el video de presentación y demo (máximo 5 minutos, incluyendo el frontend).
- [ ] Verificar que ambos READMEs expliquen cómo ejecutar y el Roadmap.
- [ ] Subir los cambios a ambos repos.

## Roadmap

### Fase 1 — MVP (este entregable)
- [x] Contrato `DigitalInheritance` con el flujo completo.
- [x] Tests unitarios, incluyendo test de reentrancia.
- [x] Scripts de deploy e interacción (demo end-to-end).
- [x] Documentación técnica.
- [x] Frontend web mínimo (React + ethers) en repo aparte.
- [x] Despliegue y verificación en Sepolia.

### Fase 2 — Próximas funciones
- Soporte para **ERC-20 y ERC-721** además de ETH nativo (depósito y reclamo
  de múltiples activos por heredero).
- **Recuperación social**: un guardián (o *m-de-n* guardianes) que pueda
  renovar el heartbeat si el titular pierde acceso a su wallet sin haber
  fallecido, para reducir el riesgo de activación por falso positivo.
- **Aviso previo**: un evento/ventana de gracia (ej. notificación on-chain
  30 días antes del vencimiento) para darle al titular una última chance de
  hacer heartbeat antes del trigger.
- Migrar porcentajes a **basis points (10000)** para reparto sin dust y con
  más precisión (ej. 33.33%).

**Reparto forzado tras período de gracia (`forceDeliverUnclaimed()`) — feature opcional/premium.**
Hoy el reparto es 100% *pull*: cada heredero tiene que llamar `claim()` para
cobrar. Es la decisión correcta para el MVP (evita que un solo heredero con
una dirección que revierte trabe el reparto de todos, y evita el límite de
gas de un `for` que paga a todos de una), pero deja abierta una pregunta
legítima: ¿qué pasa si el heredero nunca se entera y nunca reclama? La
respuesta para Fase 2 es un mecanismo configurable, no un cambio al modelo
por defecto:
- Se agrega un `claimGracePeriod` (además del `inactivityPeriod`) y se
  registra `triggeredAt`. Vencido ese plazo sin que un heredero reclame,
  **cualquiera** puede llamar `forceDeliverUnclaimed()` — mismo criterio
  permissionless que ya usa `triggerInheritance()`.
- La función intenta transferir a cada heredero pendiente, pero con
  **push con fallback a pull**: si un `.call` individual falla, no revierte
  el resto del loop — ese monto queda en un mapping de retiro pendiente
  para esa dirección puntual. Así no se repite el antipatrón de "pagos
  empujados a una lista no confiable".
- El costo de gas de repartir a todos queda concentrado en quien manda esa
  transacción, así que para que sea confiable en la práctica (y no dependa
  de que un tercero pague ese gas por buena voluntad) se integra con
  **Chainlink Automation prefinanciado por el titular**: al crear la
  herencia, el titular carga el contrato con fondos para cubrir ese gas
  futuro. La garantía de "llega solo" queda pagada por quien más le
  conviene que se cumpla, no regalada a un desconocido.
- El mismo Chainlink Automation prefinanciado puede encargarse también de
  llamar `triggerInheritance()` apenas se cumple el plazo, sin esperar a
  que un tercero lo note manualmente — incluida esa función activa la
  automatización, `forceDeliverUnclaimed()` es el paso siguiente para el
  reparto en sí.

**Frontend web (React + Vite + ethers v6).**
Reemplaza la idea original de una app móvil nativa para Android: una web
liviana llega a más gente (titular, herederos y observadores solo necesitan
un navegador con MetaMask) y se integra directo con el contrato ya
desplegado. La primera versión ya está implementada en
[`front-herencia-digital`](https://github.com/johanriascos7777/front-herencia-digital):
conexión de wallet, detección de rol por cuenta conectada (Titular / Heredero /
Observador), dashboard con estado, balance, cuenta regresiva y herederos, y
las acciones `deposit`, `withdraw`, `heartbeat`, `triggerInheritance`,
`cancelTrigger` y `claim`. Próximos pasos del front:
- **WalletConnect** y soporte de más wallets además de MetaMask.
- **Aviso al heredero**: notificación (correo o push) cuando se activa la
  herencia, para que no dependa de que se entere por su cuenta.
- **Varias herencias por titular**, apoyado en el `InheritanceFactory`
  descrito más abajo.
- **PWA o app móvil** sobre la misma base si el uso lo justifica.

**Factory de contratos (`InheritanceFactory`) para onboarding sin fricción.**
Hoy crear una herencia requiere correr `scripts/deploy.js` con Hardhat — no
es algo que una persona sin conocimientos técnicos pueda hacer sola desde
la app. Un contrato Factory con una función `createInheritance(heirs,
percentages, period)` payable resolvería esto: crea, configura y deposita
el fondo inicial en una sola transacción, sin terminal. Detalle de
seguridad no negociable: el constructor de `DigitalInheritance` tendría que
recibir el `owner` como parámetro explícito en vez de asumir `msg.sender`,
porque desde adentro del Factory ese `msg.sender` sería el Factory mismo, no
la persona que lo llamó — regalarle la titularidad al Factory por descuido
sería un bug grave, no un detalle menor.
Trade-offs evaluados y por qué queda en Fase 2 y no en el MVP:
  - Contrato nuevo = más superficie de bugs, y maneja fondos en el momento
    de la creación (el depósito inicial pasa por él antes de llegar al
    contrato final).
  - Desplegar desde adentro de otro contrato cuesta más gas que un deploy
    directo por script.
  - Un directorio on-chain de "quién es heredero de qué" es cómodo, pero
    también facilita ataques de ingeniería social: cualquiera puede
    anotarte como heredero de una herencia falsa y usarlo de gancho de
    phishing ("te dejaron una herencia, entrá a reclamarla") — ver
    [Modelo de amenazas](#modelo-de-amenazas-identidad-del-titular-y-de-los-herederos).
  - El diseño simple (`inheritanceOf[titular] => 1 contrato`) no soporta que
    una misma persona cree más de una herencia.
  - Un bug futuro en `DigitalInheritance.sol` no se puede corregir para las
    herencias ya creadas por una versión vieja del Factory (son inmutables),
    lo que obliga a versionar el Factory a futuro.

### Fase 3 — Hacia producción
- **Auditoría de seguridad** externa antes de manejar fondos reales.
- Patrón **proxy upgradeable (UUPS)** para poder corregir bugs sin migrar
  fondos, con timelock sobre las funciones administrativas.
- Despliegue en mainnet / L2 (ej. Polygon, Base) por costo de gas.
- Métricas de escalabilidad: paginar `claim()` para escenarios con muchos
  herederos, y evaluar Merkle-proof claims si la lista crece mucho.
