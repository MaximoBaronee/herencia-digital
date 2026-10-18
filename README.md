# Herencia Digital con Dead Man's Switch

Trabajo Final — Blockchain / Web3.

Contrato inteligente que custodia ETH y lo distribuye automáticamente entre
herederos designados si el titular deja de confirmar actividad (heartbeat)
durante un período configurable.

## 🚀 Puesta en marcha

> 💡 **El "back" no se enciende.** Los contratos ya viven en la blockchain de Sepolia y funcionan 24/7 sin que tengas nada corriendo. Este repo lo usas para **compilar, probar y desplegar**.
> - `DigitalInheritance`: [`0x842e9fA385222a636e5382B35265adad4ef07d66`](https://sepolia.etherscan.io/address/0x842e9fA385222a636e5382B35265adad4ef07d66#code)
> - `InheritanceWatcher`: [`0x4d46E7989185e60fE3FA2ef9633FA2316fA55eCC`](https://sepolia.etherscan.io/address/0x4d46E7989185e60fE3FA2ef9633FA2316fA55eCC#code)

### 🆕 Primera vez (recién clonado)

```bash
git clone https://github.com/MaximoBaronee/herencia-digital.git
cd herencia-digital
npm install          # 1️⃣ instala Hardhat, OpenZeppelin y Chainlink (requiere Node.js 18+)
npm test             # 2️⃣ compila solo y corre los 104 tests ✅
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
| `HEIR_PERCENTAGES` | — | Porcentajes separados por coma, en el orden de los herederos, cada uno al menos 1. Vacío = `60,40` | — |
| `INACTIVITY_PERIOD_SECONDS` | — | Plazo de inactividad en segundos, mínimo 300. Vacío = 1 año. Para la demo: `600` | — |
| `CLAIM_DELAY_SECONDS` | — | Ventana de impugnación en segundos, mínimo 60: espera entre la activación y el primer cobro. Vacío = 7 días. Para la demo: `120` | — |

> ⚠️ **Usar como titular una cuenta solo de pruebas, nunca una con fondos reales.** Quien tenga esa clave controla la cuenta y el contrato. No compartirla por chat ni pegarla en otro archivo. Si el proyecto está en una carpeta sincronizada (OneDrive, Dropbox, Google Drive), el `.env` también se copia a esa nube: otra razón para usar una cuenta de pruebas.

**¿Quién es el owner?** La cuenta de `PRIVATE_KEY`. El constructor guarda como titular a quien firma el deploy, y no se puede cambiar después. Por eso la clave del `.env` tiene que ser la de la cuenta con la que después se va a depositar y hacer heartbeat desde el front. `InheritanceWatcher` no tiene owner.

### 🚢 Desplegar y verificar en Sepolia

Con el `.env` completo:

```bash
npm run deploy -- --network sepolia
```

Antes de gastar gas, el script valida todo y corta con un mensaje claro si algo falta: la clave del titular, saldo de Sepolia ETH, `HEIR_1` y `HEIR_2`, direcciones válidas y distintas entre sí, porcentajes de al menos 1 que sumen 100, y plazos que respeten los mínimos del contrato.

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
                                  ▼
                       ⏳ ventana de impugnación (claimDelay): nadie puede cobrar todavía
                                  │
                ┌─────────────────┴──────────────────┐
                ▼                                    ▼
      ↩️ cancelTrigger()                    🎁 claim() de cada heredero
   (solo el titular, y solo si                (al cerrarse la ventana; cada uno
    nadie cobró todavía)                       cobra su %, una sola vez)
```

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| 👑 **Titular** | quien desplegó el contrato | `deposit`, `heartbeat`, `withdraw`, `setHeirs`, `setInactivityPeriod`, `setClaimDelay`, `cancelTrigger`, `sweepDust` |
| 👨‍👩‍👧 **Heredero** | direcciones con un % asignado | `claim()` o `claimTo()` cuando la herencia está activada y se cerró la ventana de impugnación |
| 👀 **Observador** | cualquier otra wallet | `triggerInheritance()` si el plazo venció, y leer el estado |
| 🤖 **Watcher** | el contrato `InheritanceWatcher` | lo usa el botón "Activar herencia" del front: `trigger()` → `triggerInheritance()` |

### 🎬 Ejemplo: el caso de Ana

> Ana (titular) deja **1 ETH** para sus hermanos **Bruno (60 %)** y **Carla (40 %)**, con un plazo de **30 días** de inactividad y una ventana de impugnación de **7 días**.

| Día | Qué pasa | Estado |
|:-:|---|:-:|
| 0 | Ana despliega el contrato y llama `deposit()` con 1 ETH | 🟢 ACTIVE |
| 10 | Ana llama `heartbeat()`: el reloj de 30 días **vuelve a empezar** | 🟢 ACTIVE |
| 40 | Ana no responde: pasaron más de 30 días desde su último heartbeat | 🟡 plazo vencido |
| 41 | Carla (o cualquiera) llama `triggerInheritance()`: el balance de 1 ETH queda congelado y empieza la ventana de impugnación | 🔴 TRIGGERED |
| 48 | Se cierra la ventana: Bruno llama `claim()` y recibe **0.6 ETH** | 🔴 TRIGGERED |
| 49 | Carla llama `claim()` y recibe **0.4 ETH** | 🔴 TRIGGERED |

**¿Y si fue una falsa alarma?** Durante la ventana de impugnación, del día 41 al 48, nadie puede cobrar: si Ana vuelve, llama `cancelTrigger()` y todo regresa a 🟢 ACTIVE sin perder fondos. Pero **en cuanto un heredero cobra, ya no hay vuelta atrás**.

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
    ReentrancyAttacker.sol    # mock: heredero que intenta reentrar en claim() y claimTo()
    RejectingHeir.sol         # mock: heredero que rechaza ETH (cobra con claimTo)
    TriggerAndClaimHeir.sol   # mock: heredero que intenta activar y cobrar en una sola tx
    ContractOwner.sol         # mock: titular contrato que rechaza ETH o intenta reentrar
test/
  DigitalInheritance.test.js            # suite de tests unitarios (Hardhat + Chai)
  DigitalInheritance.invariants.test.js # test de propiedades con escenarios aleatorios
  InheritanceWatcher.test.js            # tests del watcher e integración entre los dos contratos
scripts/
  deploy.js                   # despliega DigitalInheritance + InheritanceWatcher y los verifica
  verify.js                   # reintenta la verificación en Etherscan sin redesplegar
  lib/deployments.js          # guarda y lee deployments/<red>.json, y verifica
  demo.js                     # flujo completo end-to-end con logs de estado
  demo-cancel.js              # escenario de falsa alarma con cancelTrigger()
deployments/
  sepolia.json                # despliegue actual: direcciones, argumentos y hashes (lo genera deploy.js)
  sepolia-v1.json             # despliegue de la versión 1, conservado como registro
```

**Flujo principal:**

```
deploy → deposit → heartbeat (periódico) → ... inactividad ...
       → triggerInheritance() (directo, o vía InheritanceWatcher, que es lo que usa el front)
       → ... ventana de impugnación (claimDelay) ...
       → claim() por cada heredero
```

**Máquina de estados** (`Status`):

```
                 triggerInheritance()
        ┌────────────────────────────────►
ACTIVE                                       TRIGGERED ──(claimDelay)──► cobros habilitados
        ◄────────────────────────────────
          cancelTrigger()  (solo si nadie
          cobró todavía: claimsCount==0)
```

- `deposit()`, `heartbeat()`, `withdraw()`, `setHeirs()`, `setInactivityPeriod()`, `setClaimDelay()` → solo en `ACTIVE`.
- `claim()`, `claimTo()`, `sweepDust()`, `cancelTrigger()` → solo en `TRIGGERED`. Los cobros, además, recién cuando se cierra la ventana de impugnación.
- Ni bien hay un primer cobro, `cancelTrigger()` queda bloqueada para
  siempre: el trigger pasa a ser irreversible (ver [Seguridad](#seguridad)).

### Contrato: `DigitalInheritance.sol`

| Elemento | Detalle |
|---|---|
| Herencia | `ReentrancyGuard` (OZ). El titular es un `address public immutable owner`, control de acceso propio (ver [Gas](#optimización-de-gas)) |
| Storage packing | Las siete variables de control (`status`, tres `uint40` de tiempo, `claimDelay`, `claimsCount` y el porcentaje pendiente) comparten 1 slot |
| Herederos | `address[]` para recorrerlos y `mapping(address => HeirInfo)`: porcentaje y "ya cobró" en 1 slot por heredero. El porcentaje se guarda una sola vez |
| Saldo | El saldo de la herencia es el balance real del contrato: no hay contabilidad interna que se pueda desfasar |
| Errores | Custom errors (`error X()`) en vez de `require(string)` → menor costo de gas y de bytecode |
| Eventos | `Deposited`, `Heartbeat`, `HeirsUpdated`, `InactivityPeriodUpdated`, `ClaimDelayUpdated`, `InheritanceTriggered`, `TriggerCancelled`, `Claimed`, `Withdrawn`, `DustSwept` |
| Orden del código | Funciones ordenadas por visibilidad, como recomienda la guía de estilo de Solidity: constructor y `receive`, externas, externas de lectura y privadas |

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
| `deposit()` / `receive()` | titular | `ACTIVE` | deposita ETH |
| `heartbeat()` | titular | `ACTIVE` | reinicia el temporizador |
| `setHeirs()` / `setInactivityPeriod()` / `setClaimDelay()` | titular | `ACTIVE` | reconfigura herederos y plazos, respetando los mínimos |
| `withdraw(amount)` | titular | `ACTIVE` | retira fondos |
| `triggerInheritance()` | cualquiera | `ACTIVE`, plazo vencido | pasa a `TRIGGERED`, congela `inheritedBalance` y abre la ventana de impugnación |
| `cancelTrigger()` | titular | `TRIGGERED`, nadie cobró | vuelve a `ACTIVE`, cuenta como heartbeat |
| `claim()` | heredero | `TRIGGERED`, ventana cerrada | cobra su porcentaje, una sola vez |
| `claimTo(to)` | heredero | `TRIGGERED`, ventana cerrada | como `claim()`, pero el ETH va a otra dirección |
| `sweepDust(to)` | titular | `TRIGGERED` | recupera el ETH no reservado para los herederos: restos de redondeo y ETH forzado |
| `claimsOpenAt()` / `sweepableBalance()` | cualquiera | siempre (`view`) | cuándo se cierra la ventana y cuánto se puede barrer |
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

Las suites cubren:

- Deploy y validación de parámetros iniciales: porcentajes, herederos duplicados, dirección cero, arrays de distinto largo, plazos mínimos y estado inicial.
- Depósitos por `deposit()` y por `receive()`, que un tercero no pueda depositar, y que no se pueda depositar con la herencia activada.
- Heartbeat: quién puede llamarlo, cómo pospone el trigger y que no se pueda usar en `TRIGGERED`.
- Herederos y plazos: que los herederos reemplazados dejen de serlo, que no haya porcentajes en 0, que se respeten los mínimos y que nada se pueda cambiar en `TRIGGERED`.
- Retiro de fondos por el titular, incluyendo límites y que se bloquee tras el trigger.
- `triggerInheritance()`: que sea permissionless, que respete el plazo (incluido el límite exacto del deadline y los segundos restantes que informa `TooEarly`), que no se pueda disparar dos veces, que funcione con balance 0 y que reparta también el ETH forzado.
- **Ventana de impugnación**: nadie cobra antes de que se cierre, `ClaimsNotOpenYet` informa los segundos que faltan, el titular puede cancelar durante la ventana, y un heredero contrato (`TriggerAndClaimHeir`) ya no puede activar y cobrar en la misma transacción.
- `cancelTrigger()`: que funcione solo si nadie cobró, que reinicie `lastHeartbeat` y que quede bloqueada para siempre en cuanto hay un primer cobro.
- `claim()` y `claimTo()`: reparto proporcional correcto e independiente del orden de los cobros, anti doble cobro, que solo cobren herederos, y que un heredero cuya dirección rechaza ETH (`RejectingHeir`) cobre con `claimTo()` sin bloquear a nadie.
- **Reentrancia**: un contrato atacante (`ReentrancyAttacker`) intenta cobrar dos veces desde su `receive()`, por `claim()` y por `claimTo()`; el test verifica que la transacción revierte gracias al patrón Checks-Effects-Interactions + `ReentrancyGuard`.
- `sweepDust()`: recupera solo lo no reservado, nunca la parte de quien no cobró; incluye los restos de redondeo y el ETH forzado.
- **Titular contrato** (`ContractOwner`): `withdraw()` y `sweepDust()` revierten si el destino rechaza ETH, y bloquean la reentrada del titular.
- Vistas: `getHeirs`, `percentageOf`, `isHeir`, `claimed`, `isTriggerable`, `timeUntilTrigger`, `claimsOpenAt`, `sweepableBalance` y los mínimos.
- `InheritanceWatcher`: `checkUpkeep()` en `false` antes del plazo, después de un heartbeat y una vez activada la herencia, y en `true` apenas vence; `performUpkeep()` y `trigger()` activan la herencia con el watcher como `triggeredBy`; se propagan `TooEarly` e `InvalidState`; y el flujo completo hasta el cobro de cada heredero.
- **Propiedades con entradas aleatorias** (`DigitalInheritance.invariants.test.js`): en 30 escenarios con entre 1 y 10 herederos, porcentajes, montos y ETH forzado aleatorios, y barridos intercalados con los cobros, verifica que cada heredero cobre exactamente su parte, que el barrido nunca toque lo reservado y que el contrato termine en 0 sin crear ni perder ETH. Usa una semilla fija, así cualquier falla se puede reproducir.

104 tests, todos en verde. Cobertura de los dos contratos: 100 % en todas las métricas (detalle en [Cobertura](#cobertura)).

## Cobertura

```bash
npm run coverage     # equivale a npx hardhat coverage
```

Mide los dos contratos del sistema. Los mocks de `contracts/mocks/` son código auxiliar de los tests y quedan fuera de la medición (configurado en `.solcover.js`).

| Contrato | Sentencias | Ramas | Funciones | Líneas |
|---|---:|---:|---:|---:|
| `DigitalInheritance` | 100 % | 100 % | 100 % | 100 % |
| `InheritanceWatcher` | 100 % | 100 % | 100 % | 100 % |
| **Total** | **100 %** | **100 %** | **100 %** | **100 %** |

Están cubiertas incluso las ramas que una cuenta normal no puede provocar, como un titular que rechaza ETH o que intenta reentrar: las prueba el mock `ContractOwner`.

## Análisis estático (Slither)

Requiere Python 3 y [Slither](https://github.com/crytic/slither):

```bash
pip install slither-analyzer
npm run slither      # equivale a slither . ; la configuración está en slither.config.json
```

`slither.config.json` deja fuera las dependencias (`node_modules`) y los mocks de test. Sobre `DigitalInheritance` e `InheritanceWatcher`, Slither reporta 7 resultados en 2 detectores. Ninguno es sobre `InheritanceWatcher`, ninguno es de severidad alta o media, y no quedó ningún hallazgo que requiriera corrección.

| Detector | Dónde | Clasificación | Justificación |
|---|---|---|---|
| `timestamp` (4) | `triggerInheritance()`, `timeUntilTrigger()`, `isTriggerable()` y la ventana de impugnación en `_claim()` | Aceptado | Un dead man's switch necesita medir tiempo. Un validador solo puede correr `block.timestamp` unos pocos segundos, y los plazos se miden en minutos, días o meses: ese desvío no cambia el resultado. |
| `low-level-calls` (3) | `withdraw()`, `_claim()` y `sweepDust()` | Aceptado | `call{value: ...}` es la forma recomendada de enviar ETH: `transfer` y `send` tienen un límite fijo de gas que puede fallar con billeteras inteligentes. Se chequea el resultado (`TransferFailed`) y se aplican Checks-Effects-Interactions y `nonReentrant`. |

La versión 1 tenía además un falso positivo de `uninitialized-local` sobre la variable `sum` de `_setHeirs()`. Se eliminó inicializándola de forma explícita en 0.

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
6. Ventana de impugnación: un cobro inmediato revierte con `ClaimsNotOpenYet`, y el reloj avanza hasta que se cierra.
7. `claim()` de cada heredero, mostrando los balances antes/después.

Hay una segunda demo dedicada al escenario de falsa alarma:

```bash
npm run demo:cancel
```

`scripts/demo-cancel.js` simula que el titular pierde señal (no manda
heartbeat), un tercero dispara la herencia de buena fe, y el titular
recupera señal **durante la ventana de impugnación**, cuando ningún heredero
puede cobrar todavía → `cancelTrigger()` revierte todo a `ACTIVE` sin pérdida de fondos. Al final muestra también el
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
| `DigitalInheritance` | `0x842e9fA385222a636e5382B35265adad4ef07d66` | [Etherscan](https://sepolia.etherscan.io/address/0x842e9fA385222a636e5382B35265adad4ef07d66#code) |
| `InheritanceWatcher` | `0x4d46E7989185e60fE3FA2ef9633FA2316fA55eCC` | [Etherscan](https://sepolia.etherscan.io/address/0x4d46E7989185e60fE3FA2ef9633FA2316fA55eCC#code) |

Parámetros: titular `0xBDdB6C4FC08Af549d13A33455374e7fFBfD7fA70`, herederos `0x5EEa…1fEB` (60 %) y `0x5312…1D92` (40 %), plazo de inactividad de 600 s y ventana de impugnación de 120 s, cortos para poder mostrar el flujo en el video. Transacciones de deploy: [`0x2cd19a98…`](https://sepolia.etherscan.io/tx/0x2cd19a9802ee90fb726d0b05e844beb87d6125e47dbce4ef7905b132f397d660) y [`0x75f847fb…`](https://sepolia.etherscan.io/tx/0x75f847fbd248178d240fd42fa8abc6f57821ab30cd5785d1259da3cad3cc1fec). El bytecode desplegado coincide con el código de este repo.

### Evidencia on-chain del flujo principal

**Versión 2, la actual:** _pendiente_. El flujo completo se ejecuta al grabar el video, y sus transacciones se agregan acá.

**Versión 1:** ejecutado el 18/10/2026 sobre los contratos `0xe45D…a6a0` y `0x68E5…3422`, antes de las correcciones de la [revisión de seguridad](#revisión-de-seguridad-y-correcciones-versión-2). Los deploys se hicieron con `npm run deploy`, y el resto desde el front con MetaMask. Cada link abre la transacción en Etherscan.

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

Estado final de la versión 1: la herencia quedó activada, los dos herederos cobraron y el contrato quedó con saldo 0. Su registro está en [`deployments/sepolia-v1.json`](deployments/sepolia-v1.json).

El primer despliegue, previo a `InheritanceWatcher`, sigue en [`0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9`](https://sepolia.etherscan.io/address/0xF7DE6Dd4dB383cDb0E3A40eb676c0a57F1A1DCE9). Ninguno de los dos despliegues anteriores se usa.

## Seguridad

- **Checks-Effects-Interactions**: en `claim()`, `claimTo()`, `withdraw()` y
  `sweepDust()` el estado (`claimed`, `claimsCount`, el porcentaje pendiente)
  y el evento se actualizan *antes* de la llamada externa que transfiere ETH.
- **ReentrancyGuard**: `nonReentrant` en las cuatro funciones que mueven valor,
  como segunda capa de defensa además del CEI. Probado explícitamente con
  contratos atacantes en los tests, tanto de heredero como de titular.
- **Ventana de impugnación** (`claimDelay`): entre la activación y el primer
  cobro hay un plazo mínimo de 1 minuto, configurable por el titular. Nadie
  puede activar y cobrar en la misma transacción, y el titular siempre tiene
  tiempo de cancelar una activación por error.
- **Reserva de los herederos**: `sweepDust()` solo puede llevarse lo que no
  está reservado para quien todavía no cobró. La reserva redondea igual que
  los cobros, así que nunca queda por debajo de lo que falta pagar; lo
  verifica el test de propiedades con escenarios aleatorios.
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
  loops, el único `unchecked` está en `_claim()`, sobre `claimsCount` y el
  porcentaje pendiente: cada heredero cobra una sola vez, hay a lo sumo 100
  herederos y sus porcentajes suman 100, así que no pueden desbordar.
- **Saldo = balance real**: el contrato no lleva un saldo interno aparte. Así
  el ETH que entra por fuera de `deposit()` (por ejemplo con `selfdestruct`)
  se reparte o se puede barrer, en vez de quedar atrapado.
- **Snapshot de balance** (`inheritedBalance`): el reparto se calcula sobre
  una foto fija tomada en `triggerInheritance()`, así el orden en que
  cobran los herederos no afecta el monto que le toca a cada uno.
- **Restos de redondeo**: al ser porcentajes enteros con división entera, puede
  quedar un resto de pocos *wei* sin repartir; `sweepDust()` se lo asigna al
  titular, sin esperar a que cobren todos.

### Revisión de seguridad y correcciones (versión 2)

Una revisión de la versión 1 encontró tres problemas. Ninguno permitía robar
fondos, pero los tres se corrigieron antes de desplegar la versión 2:

| # | Severidad | Hallazgo en la versión 1 | Corrección en la versión 2 |
|:-:|---|---|---|
| 1 | Media | Un heredero contrato podía activar la herencia y cobrar en la misma transacción. Con eso bloqueaba la cancelación sin darle tiempo real al titular. | Ventana de impugnación (`claimDelay`) entre la activación y el primer cobro. El test con `TriggerAndClaimHeir` ahora verifica que ese ataque revierte. |
| 2 | Media | Un heredero cuya dirección rechaza ETH perdía su parte y además bloqueaba `sweepDust()` para siempre. | `claimTo()` le permite cobrar en otra dirección, y `sweepDust()` ya no espera a que cobren todos: barre solo lo no reservado. |
| 3 | Baja | El ETH forzado al contrato no entraba en la contabilidad interna, así que no se repartía ni se podía recuperar. | Se eliminó el saldo interno: el contrato usa su balance real, y `sweepDust()` recupera ese ETH. |

La misma revisión marcó tres riesgos menores, también resueltos: el plazo de
inactividad podía ser 0 (ahora tiene un mínimo de 5 minutos), se podía
depositar con la herencia ya activada (ahora solo en `ACTIVE`) y faltaban
pruebas de propiedades (ahora hay un test con escenarios aleatorios). La
revisión validó como correctas la protección contra reentrancia, el doble
cobro, el overflow y el control de acceso.

### `cancelTrigger()` y el punto de no retorno

`triggerInheritance()` lo puede disparar cualquiera (para no depender de un
oráculo), lo cual significa que puede dispararse por una falsa alarma: el
titular está vivo pero no mandó heartbeat a tiempo (viaje, pérdida de señal,
etc.). Sin una salida, esa falsa alarma sería irreversible e injusta.
`cancelTrigger()` resuelve eso, pero con una restricción clave:

> **Una vez que un heredero ya cobró, `cancelTrigger()` queda bloqueada para
> siempre** (revierte con `ClaimsAlreadyStarted`). Para que eso no deje al
> titular sin margen, la ventana de impugnación garantiza que nadie pueda
> cobrar durante `claimDelay` segundos después de la activación.

Se evaluaron dos alternativas:

1. **Permitir cancelar siempre**, incluso con claims parciales ya hechos.
   Se descartó: el heredero que ya cobró se queda con ETH que solo le
   correspondía si la herencia era real, y el balance ya quedó
   reducido por ese cobro — el contrato volvería a `ACTIVE` con una
   contabilidad que ya no coincide con lo que el titular cree tener. Peor
   aún, crea un incentivo perverso: a cualquier heredero le conviene
   reclamar *apenas* ve el trigger, aunque sospeche que es falsa alarma,
   para asegurarse su parte antes de que el titular llegue a cancelar.
2. **Bloquear la cancelación en el primer cobro** (la que se
   implementó). El trigger pasa a ser reversible mientras nadie cobró, e
   irreversible en cuanto empieza el reparto. Es más simple, no requiere que
   el titular reponga fondos para "deshacer" cobros ya hechos, y con la
   ventana de impugnación elimina la carrera entre heredero y titular: durante
   esa ventana nadie puede cobrar, así que el titular siempre tiene tiempo.

Efecto práctico: el titular tiene al menos `claimDelay` segundos para
reaccionar a una activación por error. Pasada la ventana puede cancelar
mientras nadie haya cobrado, pero una vez que un heredero cobra, el proceso
ya no se puede frenar. Llamar a `cancelTrigger()` también actúa como
heartbeat (reinicia `lastHeartbeat`).

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

**Versión 2: menos storage.** Las correcciones de la versión 2 también
bajaron el gas de casi todas las operaciones. Promedios de la suite de tests,
salvo donde se indica:

| Función | Versión 1 | Versión 2 | Diferencia |
|---|---:|---:|---:|
| `deposit()` | 45.223 | 25.152 | **−20.071** |
| `claim()` | 83.871 | 45.784 | **−38.087** |
| `setHeirs()` | 92.041 | 67.360 | **−24.681** |
| `withdraw()` | 39.934 | 34.910 | −5.024 |
| `triggerInheritance()` (máximo) | 54.786 | 50.634 | −4.152 |
| `cancelTrigger()` | 30.309 | 28.397 | −1.912 |
| Deploy con 2 herederos | 1.601.814 | 1.840.608 | +238.794 (una sola vez) |

**Por qué:**
- `deposit()` ya no escribe storage: el saldo de la herencia es el balance
  real del contrato, así que solo emite el evento.
- Cada heredero ocupa un solo slot (`HeirInfo`: porcentaje y "ya cobró"), en
  vez de un mapping de porcentaje, otro de pertenencia y otro de cobro.
  `claim()` lee y escribe ese único slot.
- `claimsCount` y el porcentaje pendiente pasaron a `uint8` y entraron en el
  mismo slot que el estado y los tiempos, que ya se leía en cada operación.
- El deploy cuesta más porque el contrato tiene más funciones: la ventana de
  impugnación, `claimTo()` y las vistas nuevas. Se paga una sola vez.

**Otras optimizaciones aplicadas** (además de las ya mencionadas en
[Arquitectura](#arquitectura)):
- Errores custom en vez de `require(string)` en todo el contrato — evita
  codificar y guardar el string del mensaje en cada revert.
- `unchecked { ++i; }` en los loops del contrato, porque el índice está
  acotado por la cantidad de herederos (100 como máximo) — nunca puede
  desbordar, así que el chequeo de overflow que Solidity 0.8 agrega por
  defecto en cada incremento es gasto innecesario ahí.
- `claimsCount` en vez de loopear los herederos para saber si
  `cancelTrigger()` todavía es seguro (ver [Decisiones de diseño](#decisiones-de-diseño)).
- Lecturas de storage en variables locales: los modifiers leen `status` una
  sola vez, `withdraw()` lee el balance una sola vez, y `triggerInheritance()`
  emite el snapshot desde una variable local en vez de releer storage.

## Decisiones de diseño

- Se usó `uint8` para el porcentaje (en vez de basis points) porque la
  consigna original pide que sumen exactamente 100; queda documentado como
  mejora de precisión en el roadmap.
- `HeirsUpdated` emite `address[]` y `uint8[]` en paralelo en lugar de un
  array de structs, porque los eventos con arrays de structs son más caros
  y más incómodos de indexar desde el front/subgraph.
- `receive()` solo acepta ETH si viene del titular y con la herencia sin
  activar, para que no entren fondos de terceros como si fueran parte de la herencia.
- `claimsCount` (contador) reemplaza a un loop sobre los herederos para
  decidir si `cancelTrigger()` es seguro: es una comparación directa, más
  barata en gas.
- La reserva de los herederos se calcula con el porcentaje que falta cobrar
  (`inheritedBalance × pendiente / 100`) en vez de guardar un monto por
  heredero: un solo número, y nunca reserva de menos.
- No se permiten herederos con 0 %: no tienen nada que cobrar y, con el
  porcentaje como única marca de pertenencia, simplifican el storage.
- **La herencia es de un solo uso**: una vez que los herederos cobraron, el
  contrato queda cerrado. Para otra herencia, o para repetir una demo, se
  despliega una instancia nueva con `npm run deploy`. Se evaluó permitir
  "reiniciar" el contrato, y se descartó: agrega una función con poder sobre
  los fondos en un estado donde se presume que el titular ya no está, y no
  aporta nada que un deploy nuevo no resuelva.

## Limitaciones conocidas del MVP

Comportamientos actuales que conviene conocer antes de usar el contrato con fondos reales.

| Limitación | Efecto | Mitigación prevista |
|---|---|---|
| `sweepDust()` es solo del titular | Si la herencia fue real, nadie más puede recuperar los restos de redondeo, que son de pocos wei | Sweep abierto a cualquiera pasado un plazo |
| Sin plazo máximo | El titular puede fijar un plazo de inactividad enorme, que en la práctica desactiva la herencia | Plazo máximo configurable |
| La ventana de impugnación depende del titular | Si el titular no se entera de una activación por error durante la ventana, el primer cobro la vuelve irreversible | Avisos fuera de la cadena al titular cuando se activa la herencia |
| Heredero que no puede firmar | Si un heredero es un contrato que no rechaza ETH pero tampoco puede llamar a `claim()`, su parte queda reservada sin que nadie la cobre. No bloquea a los demás | `forceDeliverUnclaimed()` |
| Porcentajes enteros | Granularidad del 1 % y restos de pocos wei por redondeo | Basis points (10.000) |
| Solo ETH | No custodia tokens ERC-20 ni NFTs | Soporte ERC-20 y ERC-721 |
| Titular fijo, una sola clave | Si el titular pierde su clave, nadie puede hacer heartbeat, y la titularidad no se puede transferir | Recuperación social con guardianes |
| Activación manual | Chainlink Automation ya no acepta upkeeps nuevos, así que alguien tiene que apretar "Activar herencia" | Conectar el watcher a Chainlink CRE |
| Un watcher por herencia | Cada herencia necesita desplegar su propio `InheritanceWatcher` | Un watcher para varias herencias |
| Reparto *pull* | Si un heredero nunca cobra, su parte queda reservada en el contrato | `forceDeliverUnclaimed()` |

Todas las mitigaciones están en la [Fase 2 del roadmap](#fase-2--próximas-funciones).

**Corregidas en la versión 2**, cada una con su test: la falta de ventana de gracia después de la activación, el heredero que rechaza ETH y bloqueaba el barrido, el plazo de inactividad que podía ser 0, los depósitos después de la activación y el ETH forzado que quedaba atrapado. El detalle está en [Revisión de seguridad y correcciones](#revisión-de-seguridad-y-correcciones-versión-2).

## Checklist de entrega

Repos del proyecto:

- **Backend (contratos):** https://github.com/MaximoBaronee/herencia-digital
- **Frontend (React):** https://github.com/johanriascos7777/front-herencia-digital

Este checklist es el mismo en ambos repos.

**Entregables**
- **Video de presentación y demo:** _pendiente_
- **Whitepaper:** _pendiente_

**Contratos (`herencia-digital`)**
- [x] `DigitalInheritance` con Checks-Effects-Interactions, `ReentrancyGuard`, eventos, errores custom y NatSpec completo.
- [x] `InheritanceWatcher`: interacción entre contratos; el front activa la herencia a través de él.
- [x] Versión 2 con las correcciones de la revisión de seguridad: ventana de impugnación, `claimTo()`, barrido sin bloqueos y plazos mínimos.
- [x] 104 tests en verde, incluidos reentrancia, contratos atacantes, integración entre los dos contratos y un test de propiedades con escenarios aleatorios.
- [x] Coverage del 100 % y Slither ejecutados, con resultados y hallazgos justificados en el README del back.
- [x] Contratos desplegados y verificados en Sepolia, con direcciones y links al código.
- [x] Flujo completo ejecutado en Sepolia con la versión 1, con los hashes en el README del back.
- [ ] Flujo completo con la versión 2, grabado en el video, con sus hashes en el README del back.
- [x] Scripts `demo`, `demo:cancel`, `deploy` (despliega y verifica) y `verify`.
- [x] Limitaciones conocidas del MVP y roadmap documentados.

**Frontend (`front-herencia-digital`)**
- [x] Conexión de wallet, detección de rol, dashboard y acciones.
- [x] **Activar herencia** a través de `InheritanceWatcher`.
- [x] Historial de movimientos con links a Etherscan.
- [x] Mensajes legibles para los errores del contrato y sesión de la wallet restaurada al recargar.
- [x] Adaptado a la versión 2: cuenta regresiva de la ventana de impugnación y `.env.example` con los contratos actuales.
- [ ] Opcional: aplicar el sistema de diseño con el CSS mínimo necesario.
- [ ] Opcional: publicar el front, por ejemplo en Vercel.

**Entrega**
- [x] Repos públicos, con commits de los tres integrantes desde su propia cuenta.
- [ ] Grabar el video, de 5 minutos como máximo, siguiendo el [guion](https://github.com/johanriascos7777/front-herencia-digital/blob/main/guion/guion-por-tomas.md).
- [ ] Escribir el whitepaper.
- [ ] Subir el video y el whitepaper a la carpeta de Drive de la comisión, con el apellido de quien registró al equipo en el nombre de cada archivo.
- [ ] Agregar los links del video y del whitepaper en los dos READMEs.

## Roadmap

### Fase 1 — MVP (este entregable)
- [x] Contrato `DigitalInheritance` con el flujo completo.
- [x] Tests unitarios, incluyendo test de reentrancia.
- [x] Scripts de deploy e interacción (demo end-to-end).
- [x] Documentación técnica.
- [x] Frontend web mínimo (React + ethers) en repo aparte.
- [x] Despliegue y verificación en Sepolia.
- [x] `InheritanceWatcher`: activa la herencia llamando a `DigitalInheritance` y es compatible con la interfaz de Chainlink Automation.
- [x] Versión 2 tras una revisión de seguridad: ventana de impugnación, `claimTo()`, barrido sin bloqueos, plazos mínimos y test de propiedades con escenarios aleatorios.

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
- **Resolver las [limitaciones conocidas](#limitaciones-conocidas-del-mvp)**
  que siguen abiertas: plazo de inactividad máximo, `sweepDust()` abierto a
  cualquiera pasado un plazo y avisos al titular cuando se activa la
  herencia. Requieren un contrato nuevo, porque el desplegado es inmutable.

**Reparto forzado tras período de gracia (`forceDeliverUnclaimed()`) — feature opcional/premium.**
Hoy el reparto es 100% *pull*: cada heredero tiene que llamar `claim()` para
cobrar. Es la decisión correcta para el MVP (evita que un solo heredero con
una dirección que revierte trabe el reparto de todos, y evita el límite de
gas de un `for` que paga a todos de una), pero deja abierta una pregunta
legítima: ¿qué pasa si el heredero nunca se entera y nunca reclama? La
respuesta para Fase 2 es un mecanismo configurable, no un cambio al modelo
por defecto:
- Se agrega un `claimGracePeriod` (además del `inactivityPeriod`) y se
  usa `triggeredAt`, que ya existe desde la versión 2. Vencido ese plazo sin que un heredero reclame,
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
