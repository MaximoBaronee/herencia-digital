# Herencia Digital con Dead Man's Switch

Trabajo Final — Blockchain / Web3.

Contrato inteligente que custodia ETH y lo distribuye automáticamente entre
herederos designados si el titular deja de confirmar actividad (heartbeat)
durante un período configurable.

## 🚀 Puesta en marcha

> 💡 **El "back" no se enciende.** Los contratos ya viven en la blockchain de Sepolia y funcionan 24/7 sin que tengas nada corriendo. Este repo lo usas para **compilar, probar y desplegar**.
> - `DigitalInheritance`: [`0xe45DB9f8f759Ad34C88C22c07BC4f09a274aa6a0`](https://sepolia.etherscan.io/address/0xe45DB9f8f759Ad34C88C22c07BC4f09a274aa6a0#code)
> - `InheritanceWatcher`: [`0x68E5FE129B3f51e79bdCfa6eabe7019962b93422`](https://sepolia.etherscan.io/address/0x68E5FE129B3f51e79bdCfa6eabe7019962b93422#code)

### 🆕 Primera vez (recién clonado)

```bash
git clone https://github.com/MaximoBaronee/herencia-digital.git
cd herencia-digital
npm install          # 1️⃣ instala Hardhat, OpenZeppelin y Chainlink (requiere Node.js 18+)
npm test             # 2️⃣ compila solo y corre los 83 tests ✅
npm run demo         # 3️⃣ opcional: flujo completo en una red local en memoria
```

| Pregunta | Respuesta |
|---|---|
| ¿Tengo que compilar aparte? | ❌ No. `npm test` y `npm run demo` compilan solos. Si quieres hacerlo explícito: `npm run compile`. |
| ¿Necesito `.env`? | ❌ No para tests ni demo. ✅ Solo para **desplegar en Sepolia**: ver [Configurar el `.env`](#-configurar-el-env-solo-para-desplegar). |
| ¿Necesito internet? | Solo para `npm install` y para desplegar o verificar. |
| ¿Qué carpetas se generan? | `artifacts/`, `cache/` y `node_modules/`. Están ignoradas por git. |

### 🔁 Segunda vez en adelante

| Situación | Qué hacer |
|---|---|
| Solo quiero ver que sigue todo bien | `npm test` |
| Hice `git pull` y cambió `package.json` | `npm install` |
| Cambié un archivo de `contracts/` | `npm test` (recompila solo) |
| Quiero una demo sin gastar ETH | `npm run demo` o `npm run demo:cancel` |
| Quiero ver la cobertura de tests | `npm run coverage` |
| Quiero correr el análisis estático | `npm run slither` (requiere Python y `pip install slither-analyzer`) |
| Quiero contratos nuevos en Sepolia | `npm run deploy -- --network sepolia` (despliega y verifica los dos) y luego actualizar las direcciones en el front |
| La verificación falló o cargué la API key después | `npm run verify -- --network sepolia` (no redespliega) |

**🚫 Qué NO hacer**
- No subas `.env` a git: tiene la clave privada del titular. Ya está en `.gitignore`, igual que sus variantes (`.env.local`, etc.).
- No vuelvas a desplegar "por probar": cada despliegue es **otro contrato con otra dirección**, y el front sigue apuntando al anterior.
- No esperes que un cambio en `contracts/` actualice el contrato ya desplegado: es **inmutable**. Hay que desplegar uno nuevo.
- No ejecutes `deposit` ni `heartbeat` con "Added protection" de MetaMask activado (ver [incidencias del front](https://github.com/johanriascos7777/front-herencia-digital#-incidencias)).

### 🔑 Configurar el `.env` (solo para desplegar)

El `.env` guarda los datos para desplegar en Sepolia. Está en `.gitignore`, así que **no se sube a GitHub**. `.env.example` es la plantilla vacía que sí está en el repo.

```bash
cp .env.example .env     # solo la primera vez; después se completa el .env
```

**Hacen falta tres cuentas**, y pueden estar en la misma billetera de MetaMask (menú de cuentas → *Añadir cuenta*):

| Cuenta | Qué hace | Qué va al `.env` |
|---|---|---|
| 👑 Titular | Despliega los contratos y queda como **owner** para siempre. Deposita, hace heartbeat y retira desde el front. | Su **clave privada**, en `PRIVATE_KEY` |
| 👤 Heredero 1 | Cobra su parte con "Reclamar mi parte" en el front | Solo su **dirección**, en `HEIR_1` |
| 👤 Heredero 2 | Igual que el heredero 1 | Solo su **dirección**, en `HEIR_2` |

Solo el titular necesita pedir Sepolia ETH a un faucet. Después le puede mandar un poco a cada heredero para el gas del reclamo; 0.01 ETH por heredero sobra.

**Qué poner en cada variable:**

| Variable | ¿Obligatoria? | Qué poner | De dónde sale |
|---|:-:|---|---|
| `PRIVATE_KEY` | ✅ | Clave privada del titular, con o sin `0x` adelante | MetaMask → cuenta titular → ⋮ → *Detalles de la cuenta* → *Mostrar clave privada* (el nombre exacto varía según la versión) |
| `ETHERSCAN_API_KEY` | ✅ | API key para verificar los contratos | [etherscan.io/myapikey](https://etherscan.io/myapikey): crear cuenta gratis → *Add* |
| `HEIR_1` | ✅ | Dirección del heredero 1: empieza con `0x` y tiene 42 caracteres | MetaMask → copiar la dirección de esa cuenta |
| `HEIR_2` | ✅ | Dirección del heredero 2, distinta de la anterior | Igual que `HEIR_1` |
| `SEPOLIA_RPC_URL` | — | Nodo de Sepolia. Si queda vacío se usa uno público | Alchemy o Infura (gratis), solo si el público falla |
| `HEIR_PERCENTAGES` | — | Porcentajes separados por coma, en el orden de los herederos. Vacío = `60,40` | — |
| `INACTIVITY_PERIOD_SECONDS` | — | Plazo de inactividad en segundos. Vacío = 1 año. Para la demo: `600` | — |

> ⚠️ **Usar como titular una cuenta solo de pruebas, nunca una con fondos reales.** Quien tenga esa clave controla la cuenta y el contrato. No compartirla por chat ni pegarla en otro archivo. Si el proyecto está en una carpeta sincronizada (OneDrive, Dropbox, Google Drive), el `.env` también se copia a esa nube: otra razón para usar una cuenta de pruebas.

**¿Quién es el owner?** La cuenta de `PRIVATE_KEY`. El constructor guarda como titular a quien firma el deploy, y no se puede cambiar después. Por eso la clave del `.env` tiene que ser la de la cuenta con la que después se va a depositar y hacer heartbeat desde el front. `InheritanceWatcher` no tiene owner.

### 🚢 Desplegar y verificar en Sepolia

Con el `.env` completo:

```bash
npm run deploy -- --network sepolia
```

Antes de gastar gas, el script valida todo y corta con un mensaje claro si algo falta: la clave del titular, saldo de Sepolia ETH, `HEIR_1` y `HEIR_2`, direcciones válidas y distintas entre sí, porcentajes que sumen 100 y un plazo entero positivo.

Con los parámetros validados, el script:

1. Despliega `DigitalInheritance` y después `InheritanceWatcher`, apuntando al primero.
2. Espera 5 confirmaciones y guarda direcciones, argumentos del constructor y hashes en `deployments/sepolia.json`.
3. Si hay `ETHERSCAN_API_KEY`, verifica los dos contratos en Etherscan. Si la verificación falla o la key se carga después, `npm run verify -- --network sepolia` la reintenta leyendo `deployments/sepolia.json`, sin redesplegar.
4. Imprime las URLs del código verificado y las variables para el `.env.local` del front.

### ⛓️ `InheritanceWatcher`: la interacción entre contratos

El botón **Activar herencia** del front no llama directo a la herencia: llama a `trigger()` del `InheritanceWatcher`, y el watcher llama a `triggerInheritance()` de `DigitalInheritance`. En Etherscan, esa transacción va dirigida al watcher y muestra dos eventos: `TriggeredViaWatcher`, del watcher, e `InheritanceTriggered`, de la herencia, con el watcher como `triggeredBy`.

El watcher además implementa la interfaz de Chainlink Automation (`checkUpkeep` / `performUpkeep`), pensada para que un servicio externo active la herencia solo apenas vence el plazo.

> ℹ️ Chainlink anunció la baja de Automation (lo reemplaza Chainlink Runtime Environment, CRE) y su app ya no permite registrar upkeeps nuevos. Por eso en este MVP el watcher no está registrado en Chainlink y lo dispara el front. Conectarlo a CRE queda en el [roadmap](#roadmap).

### 🧠 ¿Cómo funciona?

Un **testamento automático**: el titular deja ETH en el contrato y confirma cada tanto que sigue activo. Si deja de hacerlo, los herederos cobran solos, sin notarios ni intermediarios.

```
 💰 deposit() ──► 💓 heartbeat() ──► ... silencio ... ──► ⏰ plazo vencido
                                                              │
                                  ┌───────────────────────────┘
                                  ▼
                       🚨 triggerInheritance()   (cualquiera; el front pasa por InheritanceWatcher)
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
| 🤖 **Watcher** | el contrato `InheritanceWatcher` | lo usa el botón "Activar herencia" del front: `trigger()` → `triggerInheritance()` |

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
- [Cobertura](#cobertura)
- [Análisis estático (Slither)](#análisis-estático-slither)
- [Cómo correr la demo](#cómo-correr-la-demo)
- [Despliegue en testnet (opcional)](#despliegue-en-testnet-opcional)
- [Seguridad](#seguridad)
- [Optimización de gas](#optimización-de-gas)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Limitaciones conocidas del MVP](#limitaciones-conocidas-del-mvp)
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
  DigitalInheritance.sol      # contrato principal: custodia y reparto
  InheritanceWatcher.sol      # vigía que llama a triggerInheritance(); interfaz de Chainlink Automation
  mocks/                      # solo para tests, no se despliegan
    ReentrancyAttacker.sol    # mock usado solo en tests de seguridad
    RejectingHeir.sol         # mock: heredero que rechaza ETH (claim falla, sweep bloqueado)
    TriggerAndClaimHeir.sol   # mock: heredero que dispara y reclama en una sola tx
test/
  DigitalInheritance.test.js  # suite de tests unitarios (Hardhat + Chai)
  InheritanceWatcher.test.js  # tests del watcher e integración entre los dos contratos
scripts/
  deploy.js                   # despliega DigitalInheritance + InheritanceWatcher y los verifica
  verify.js                   # reintenta la verificación en Etherscan sin redesplegar
  lib/deployments.js          # guarda y lee deployments/<red>.json, y verifica
  demo.js                     # flujo completo end-to-end con logs de estado
  demo-cancel.js              # escenario de falsa alarma con cancelTrigger()
deployments/
  <red>.json                  # direcciones, argumentos y hashes (lo genera deploy.js en redes públicas)
```

**Flujo principal:**

```
deploy → deposit → heartbeat (periódico) → ... inactividad ...
       → triggerInheritance() (directo, o vía InheritanceWatcher, que es lo que usa el front)
       → claim() por cada heredero
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

### Contrato: `InheritanceWatcher.sol`

| Elemento | Detalle |
|---|---|
| Interfaz | `AutomationCompatibleInterface` de `@chainlink/contracts` (`checkUpkeep` / `performUpkeep`) |
| Storage | Ninguno: solo `DigitalInheritance public immutable inheritance`, fijado en el deploy |
| Fondos y privilegios | No custodia ETH ni tiene owner. Cualquiera puede llamarlo; quien valida plazo y estado es `DigitalInheritance` |
| Evento | `TriggeredViaWatcher(caller, timestamp)`, en la misma transacción que el `InheritanceTriggered` de la herencia |
| Por qué separado | El contrato que custodia los fondos no depende de Chainlink: si la automatización falla, `triggerInheritance()` sigue disponible para cualquiera |

### Funciones principales

| Función | Quién | Cuándo | Qué hace |
|---|---|---|---|
| `deposit()` / `receive()` | titular | siempre (en `TRIGGERED` no entra al reparto) | deposita ETH |
| `heartbeat()` | titular | `ACTIVE` | reinicia el temporizador |
| `setHeirs()` / `setInactivityPeriod()` | titular | `ACTIVE` | reconfigura herederos/plazo |
| `withdraw(amount)` | titular | `ACTIVE` | retira fondos |
| `triggerInheritance()` | cualquiera | `ACTIVE`, plazo vencido | pasa a `TRIGGERED`, congela `inheritedBalance` |
| `cancelTrigger()` | titular | `TRIGGERED`, `claimsCount == 0` | vuelve a `ACTIVE`, cuenta como heartbeat |
| `claim()` | heredero | `TRIGGERED` | cobra su porcentaje, una sola vez |
| `sweepDust(to)` | titular | `TRIGGERED`, todos ya cobraron | recupera el resto por redondeo |
| `checkUpkeep()` (watcher) | un servicio de automatización, fuera de la cadena | siempre (es `view`) | devuelve `true` si la herencia ya se puede activar |
| `trigger()` / `performUpkeep()` (watcher) | cualquiera; el front usa `trigger()` | `ACTIVE`, plazo vencido | llama a `triggerInheritance()` |

## Instalación

Requiere Node.js 18+.

```bash
npm install
```

Esto instala Hardhat, `@nomicfoundation/hardhat-toolbox`,
`@openzeppelin/contracts` y `@chainlink/contracts` (de este último solo se
usa la interfaz de Automation). No hace falta configurar nada más para
compilar, testear o correr la demo local.

## Cómo correr los tests

```bash
npm test
```

Las suites (`test/DigitalInheritance.test.js` y `test/InheritanceWatcher.test.js`) cubren:

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
- `InheritanceWatcher`: `checkUpkeep()` en `false` antes del plazo, después de un heartbeat y una vez activada la herencia, y en `true` apenas vence; `performUpkeep()` y `trigger()` activan la herencia con el watcher como `triggeredBy`; se propagan `TooEarly` e `InvalidState`; el titular puede cancelar un trigger hecho por el watcher; y el flujo completo hasta el reclamo de cada heredero.

83 tests, todos en verde. Cobertura de los dos contratos: 100 % de líneas, sentencias y funciones (detalle en [Cobertura](#cobertura)).

## Cobertura

```bash
npm run coverage     # equivale a npx hardhat coverage
```

Mide los dos contratos del sistema. Los mocks de `contracts/mocks/` son código auxiliar de los tests y quedan fuera de la medición (configurado en `.solcover.js`).

| Contrato | Sentencias | Ramas | Funciones | Líneas |
|---|---:|---:|---:|---:|
| `DigitalInheritance` | 100 % | 93.59 % | 100 % | 100 % |
| `InheritanceWatcher` | 100 % | 100 % | 100 % | 100 % |
| **Total** | **100 %** | **93.75 %** | **100 %** | **100 %** |

Las 5 ramas sin cubrir no se pueden provocar desde una cuenta normal:
- **`revert TransferFailed()` en `withdraw()` y `sweepDust()`**: solo ocurre si quien recibe el ETH es un contrato que lo rechaza. En `withdraw()` el que recibe es siempre el titular.
- **La rama de reentrancia de `nonReentrant` en `withdraw()` y `sweepDust()`**: solo ocurre si quien recibe el ETH vuelve a llamar al contrato. La protección contra reentrancia sí está probada en `claim()`, con `ReentrancyAttacker`.
- **`revert NoHeirs()` en `triggerInheritance()`**: es una defensa extra. El constructor y `setHeirs()` ya exigen al menos un heredero, así que nunca se llega a ese punto.

## Análisis estático (Slither)

Requiere Python 3 y [Slither](https://github.com/crytic/slither):

```bash
pip install slither-analyzer
npm run slither      # equivale a slither . ; la configuración está en slither.config.json
```

`slither.config.json` deja fuera las dependencias (`node_modules`) y los mocks de test. Sobre `DigitalInheritance` e `InheritanceWatcher`, Slither reporta 7 resultados en 3 detectores. Ninguno es sobre `InheritanceWatcher` y ninguno es de severidad alta. No quedó ningún hallazgo que requiriera corrección.

| Detector | Dónde | Clasificación | Justificación |
|---|---|---|---|
| `uninitialized-local` (1) | `_setHeirs()`, variable `sum` | Falso positivo | En Solidity una variable local `uint256` empieza en 0. `sum` es un acumulador y ese valor inicial es el correcto. |
| `timestamp` (3) | `triggerInheritance()`, `timeUntilTrigger()`, `isTriggerable()` | Aceptado | Un dead man's switch necesita medir tiempo. Un validador solo puede correr `block.timestamp` unos pocos segundos, y el plazo de inactividad se mide en días o meses: ese desvío no cambia el resultado. |
| `low-level-calls` (3) | `withdraw()`, `claim()`, `sweepDust()` | Aceptado | `call{value: ...}` es la forma recomendada de enviar ETH: `transfer` y `send` tienen un límite fijo de gas que puede fallar con billeteras inteligentes. Se chequea el resultado (`TransferFailed`) y se aplican Checks-Effects-Interactions y `nonReentrant`. |

## Cómo correr la demo

```bash
npm run demo
```

Corre `scripts/demo.js` sobre la red local en memoria de Hardhat. Hace todo
el flujo de punta a punta y va imprimiendo el estado real del contrato en
cada paso:

1. Deploy de `DigitalInheritance` con 2 herederos (60% / 40%) y de su `InheritanceWatcher`.
2. Depósito de 10 ETH por el titular.
3. Heartbeat.
4. Avance del reloj de la red (`evm_increaseTime`) para simular inactividad: `checkUpkeep()` del watcher pasa a `true`.
5. `performUpkeep()` del watcher, que llama a `triggerInheritance()`.
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
# completar PRIVATE_KEY, ETHERSCAN_API_KEY, HEIR_1 y HEIR_2 en .env (ver "Configurar el .env")
npm run deploy -- --network sepolia
```

### Despliegue actual

Red: **Ethereum Sepolia** (chain id `11155111`). Los datos completos del despliegue están en [`deployments/sepolia.json`](deployments/sepolia.json).

| Contrato | Dirección | Código verificado |
|---|---|---|
| `DigitalInheritance` | `0xe45DB9f8f759Ad34C88C22c07BC4f09a274aa6a0` | [Etherscan](https://sepolia.etherscan.io/address/0xe45DB9f8f759Ad34C88C22c07BC4f09a274aa6a0#code) |
| `InheritanceWatcher` | `0x68E5FE129B3f51e79bdCfa6eabe7019962b93422` | [Etherscan](https://sepolia.etherscan.io/address/0x68E5FE129B3f51e79bdCfa6eabe7019962b93422#code) |

Parámetros: titular `0xBDdB6C4FC08Af549d13A33455374e7fFBfD7fA70`, herederos `0x5EEa…1fEB` (60 %) y `0x5312…1D92` (40 %), plazo de inactividad de 600 s.

### Evidencia on-chain del flujo principal

Ejecutado el 18/10/2026: los deploys con `npm run deploy`, y el resto desde el front con MetaMask. Cada link abre la transacción en Etherscan.

| # | Acción | Quién | Transacción |
|:-:|---|---|---|
| 1 | Deploy de `DigitalInheritance` | Titular | [`0x6de462ec…`](https://sepolia.etherscan.io/tx/0x6de462ece6d2aa1e862f444aeca4258399f33d8c60ba6ba83e8af64bdd99147b) |
| 2 | Deploy de `InheritanceWatcher` | Titular | [`0x5cb6e2b9…`](https://sepolia.etherscan.io/tx/0x5cb6e2b91b0b3c08255e3bce1a11ecf404ff2a9ff9b38f87dbd6c8c49e36ad6d) |
| 3 | `heartbeat()` | Titular | [`0x4c6c8316…`](https://sepolia.etherscan.io/tx/0x4c6c83167f69b03fc1b4b807b0f72ee249b469b708ce6832cd136b4bacf22091) |
| 4 | `deposit()` de 1 ETH | Titular | [`0xe3a6564d…`](https://sepolia.etherscan.io/tx/0xe3a6564dda62a923850b525daaec11935c4dbfc6ab2fcb12c736ca64601e600c) |
| 5 | `triggerInheritance()` directo, tras 10 min sin heartbeat | Titular | [`0x52f7fd6e…`](https://sepolia.etherscan.io/tx/0x52f7fd6ec7e4f454e47e24a257df309b651973b1b65ad2d9c88a58fca7e364b7) |
| 6 | `cancelTrigger()`: falsa alarma, nadie había cobrado | Titular | [`0x6ae887c9…`](https://sepolia.etherscan.io/tx/0x6ae887c912455c46dd21c670ad6b1a13067dd4c2d01aa0a9b85987120c277222) |
| 7 | **`trigger()` del watcher → `triggerInheritance()`** (interacción entre contratos) | Titular | [`0x11e2c571…`](https://sepolia.etherscan.io/tx/0x11e2c571b2230bc653f80a78110fd285a10a562ee7d644cbcaed67b81165b883#eventlog) |
| 8 | `claim()`: cobra 0.6 ETH | Heredero 1 | [`0x0f176682…`](https://sepolia.etherscan.io/tx/0x0f176682ff3a676281794822ab0da76c4a99e3ddf91204912d669907217cdc4c) |
| 9 | `claim()`: cobra 0.4 ETH | Heredero 2 | [`0xdded9965…`](https://sepolia.etherscan.io/tx/0xdded9965bad87c01ab02afab8421dbd38e39320ef55b36eacff3725c975e0227) |

En la transacción 7, la pestaña **Logs** muestra los dos eventos de la interacción entre contratos: `TriggeredViaWatcher`, emitido por el watcher, e `InheritanceTriggered`, emitido por la herencia con el watcher como `triggeredBy`. Las cuentas de prueba son cuentas inteligentes de MetaMask (EIP-7702), por eso en Etherscan el campo *To* de las transacciones 3 a 9 muestra el contrato de delegación de MetaMask; los eventos de cada transacción muestran la llamada real a los contratos.

Estado final: la herencia quedó activada, los dos herederos cobraron y el contrato quedó con saldo 0.

El despliegue anterior, previo a `InheritanceWatcher`, sigue en [`0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9`](https://sepolia.etherscan.io/address/0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9) y ya no se usa.

## Seguridad

- **Checks-Effects-Interactions**: en `claim()`, `withdraw()` y `sweepDust()`
  el estado (`claimed`, `depositBalance`) se actualiza *antes* de la llamada
  externa que transfiere ETH.
- **ReentrancyGuard**: `nonReentrant` en las tres funciones que mueven valor,
  como segunda capa de defensa además del CEI. Probado explícitamente con un
  contrato atacante en los tests.
- **Control de acceso**: modificador `onlyOwner` propio sobre un
  `address public immutable owner` fijado en el deploy (se reemplazó el
  `Ownable` de OpenZeppelin, ver [Gas](#optimización-de-gas)) en todas las
  funciones administrativas. `triggerInheritance()` es intencionalmente pública —
  cualquiera puede vigilar el contrato y dispararla, lo cual evita depender
  de un oráculo o de que el titular haga algo.
- **`InheritanceWatcher` sin privilegios**: no custodia fondos, no tiene owner
  y no guarda estado. Que cualquiera pueda llamar `performUpkeep()` no abre
  ningún camino nuevo: solo llama a `triggerInheritance()`, que ya era
  pública y revalida plazo y estado. Su evento se emite antes de la llamada
  externa; si la llamada revierte, el evento se revierte con ella.
- **Errores custom**: además del ahorro de gas, dan información estructurada
  (ej. `TooEarly(secondsRemaining)`, `InsufficientBalance(requested, available)`).
- **Solidity ^0.8.20**: overflow/underflow revierten por defecto. Fuera de los
  loops, el único `unchecked` es la resta de `withdraw()`, justo después de
  comprobar que `amount` no supera el saldo.
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
  de deploy (`owner = msg.sender` en el constructor). Conocer la dirección pública de
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
- Lecturas de storage en variables locales: `withdraw()` lee `depositBalance`
  una sola vez y hace la resta en `unchecked`, porque el chequeo previo ya
  descarta el underflow. Pasó de 40.116 a 39.934 de gas (−182).
  `triggerInheritance()` emite el snapshot desde una variable local en vez de
  releer `inheritedBalance`; ahí el optimizador ya evitaba la segunda
  lectura, así que el cambio es de legibilidad y el gas queda igual (+2).

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

## Limitaciones conocidas del MVP

Comportamientos actuales que conviene conocer antes de usar el contrato con fondos reales. Los marcados con 🧪 tienen un test que los demuestra en `test/DigitalInheritance.test.js`.

| Limitación | Efecto | Mitigación prevista |
|---|---|---|
| Sin ventana de gracia después del trigger 🧪 | Un heredero que sea un contrato puede activar la herencia y cobrar en la misma transacción, sin darle tiempo al titular a cancelar | Período mínimo entre la activación y el primer `claim()` |
| Heredero que no puede recibir ETH 🧪 | Su `claim()` revierte y `sweepDust()` queda bloqueado para siempre | Retiro pendiente (pull) para esa dirección |
| `sweepDust()` es solo del titular | Si la herencia fue real, nadie más puede recuperar el remanente | Sweep abierto a cualquiera pasado un plazo |
| `inactivityPeriod` sin límites 🧪 | Con un plazo de 0, cualquiera puede activar la herencia en el bloque siguiente | Plazo mínimo y máximo |
| Depósitos después del trigger 🧪 | Lo depositado con la herencia ya activada no entra en el reparto y solo sale por `sweepDust()` | Bloquear `deposit()` fuera de `ACTIVE` |
| ETH forzado al contrato 🧪 | El ETH que entra sin pasar por `receive()`, por ejemplo con `selfdestruct`, queda atrapado | Recuperar la diferencia entre el balance real y `depositBalance` |
| Porcentajes enteros | Granularidad del 1 % y restos de pocos wei por redondeo | Basis points (10.000) |
| Solo ETH | No custodia tokens ERC-20 ni NFTs | Soporte ERC-20 y ERC-721 |
| Titular fijo, una sola clave | Si el titular pierde su clave, nadie puede hacer heartbeat, y la titularidad no se puede transferir | Recuperación social con guardianes |
| Activación manual | Chainlink Automation ya no acepta upkeeps nuevos, así que alguien tiene que apretar "Activar herencia" | Conectar el watcher a Chainlink CRE |
| Un watcher por herencia | Cada herencia necesita desplegar su propio `InheritanceWatcher` | Un watcher para varias herencias |
| Reparto *pull* | Si un heredero nunca reclama, su parte queda en el contrato | `forceDeliverUnclaimed()` |

Todas las mitigaciones están en la [Fase 2 del roadmap](#fase-2--próximas-funciones).

## Checklist de entrega

Repos del proyecto:

- **Backend (contratos):** https://github.com/MaximoBaronee/herencia-digital
- **Frontend (React):** https://github.com/johanriascos7777/front-herencia-digital

Este checklist es el mismo en ambos repos.

**Hecho**
- [x] Contrato `DigitalInheritance` con CEI, `ReentrancyGuard`, eventos y errores custom.
- [x] NatSpec completo en `/contracts`.
- [x] 83 tests unitarios en verde (incluye reentrancia e integración con el watcher).
- [x] `InheritanceWatcher`: el front activa la herencia a través de él (interacción entre contratos).
- [x] Coverage y Slither ejecutados, con resultados y hallazgos justificados en este README.
- [x] Limitaciones conocidas del MVP documentadas.
- [x] Scripts `demo`, `demo:cancel` y `deploy` (este último con herederos y plazo por variables de entorno).
- [x] Frontend base: conexión de wallet, detección de rol, dashboard y acciones.

**Backend (`herencia-digital`)**
- [x] Fondear con Sepolia ETH la wallet de despliegue.
- [x] Desplegar en Sepolia con `npm run deploy -- --network sepolia`.
- [x] Verificar el contrato en Etherscan (requiere `ETHERSCAN_API_KEY`).
- [x] Anotar la dirección desplegada en este README.
- [x] Reemplazar en el Roadmap la app Android por el frontend web en React.
- [x] Redesplegar `DigitalInheritance` + `InheritanceWatcher` con el código final y verificar ambos.
- [x] Subir al front el cambio de "Activar herencia" a través del watcher (`VITE_WATCHER_ADDRESS`).
- [x] Ejecutar el flujo completo en Sepolia y anotar los hashes en este README.

**Frontend (`front-herencia-digital`)**
- [ ] Probar el flujo completo con MetaMask contra `npx hardhat node`.
- [ ] Crear el sistema de diseño en Claude (Sistema de diseño → New design system → Using Claude Code) apuntando a este repo.
- [ ] Aplicar el diseño con el CSS mínimo necesario.
- [x] Configurar Sepolia (`VITE_CHAIN_ID`, `VITE_CHAIN_NAME`, `VITE_CONTRACT_ADDRESS`, `VITE_WATCHER_ADDRESS`) y probar contra los contratos desplegados.

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
- [x] `InheritanceWatcher`: activa la herencia llamando a `DigitalInheritance` y es compatible con la interfaz de Chainlink Automation.

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
- **Corregir las [limitaciones conocidas](#limitaciones-conocidas-del-mvp)**
  del contrato: ventana de gracia entre la activación y el primer reclamo,
  plazo de inactividad con mínimo y máximo, `deposit()` solo en `ACTIVE`,
  `sweepDust()` abierto a cualquiera pasado un plazo y recuperación del ETH
  forzado. Requieren un contrato nuevo, porque el desplegado es inmutable.

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
- El MVP ya tiene la pieza on-chain: `InheritanceWatcher` implementa la
  interfaz de Chainlink Automation. Como Chainlink dio de baja Automation
  para upkeeps nuevos, el paso siguiente es conectarlo a su reemplazo,
  Chainlink Runtime Environment (CRE), para que la activación ocurra sola
  apenas se cumple el plazo. `forceDeliverUnclaimed()` sería el paso
  siguiente, para el reparto en sí. También queda para esta fase un
  watcher único para varias herencias (hoy es uno por herencia).

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
