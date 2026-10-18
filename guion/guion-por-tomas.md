# 🎬 Guion del video — Herencia Digital

Video de presentación y demo del Trabajo Final (máximo **5 minutos**). Objetivo de duración: **4:50**.

Cada toma dice **qué mostrar**, con el nombre exacto de cada archivo, línea, botón o pestaña, y sugiere **qué decir**. Se graban por separado y se unen en la edición.

## ✅ Qué tiene que verse (checklist G del protocolo)

| Requisito | Dónde se cumple |
|---|---|
| Duración máxima de 5 minutos | Suma de tomas: 4:50 |
| La implementación real | Tomas 3 y 4: el código, los tests, el coverage y Slither |
| El funcionamiento real | Toma 5: el flujo completo en Sepolia desde el front |
| Evidencia real de la interacción con blockchain | Toma 6: código verificado, eventos y transacciones en Etherscan |

## 🧰 Antes de grabar

### 1. Los contratos de la demo

La **versión 2** ya está desplegada, verificada y sin usar: es la que se graba. El `.env.example` del front ya apunta a ella. Los datos están en la tabla de [datos de referencia](#-datos-de-referencia).

El flujo solo se puede hacer **una vez por contrato**: cuando los herederos cobran, la herencia queda cerrada. Si hay que repetir la grabación:

1. En `herencia-digital`, con el `.env` completo, correr `npm run deploy -- --network sepolia`. Despliega y verifica los dos contratos, e imprime las direcciones nuevas.
2. En el `.env.local` del front, reemplazar `VITE_CONTRACT_ADDRESS`, `VITE_WATCHER_ADDRESS` y `VITE_DEPLOY_BLOCK` por los valores nuevos. El bloque está en `deployments/sepolia.json` del back.
3. Reiniciar `npm run dev`.

### 2. Preparación

- [ ] Front corriendo con `npm run dev` y abierto en `localhost:5173`.
- [ ] MetaMask en la red **Sepolia**, con tres cuentas con nombre: **Titular**, **Heredero 1** y **Heredero 2**. Cada heredero necesita un poco de Sepolia ETH para el gas.
- [ ] **Desactivar "Added protection"** en cada confirmación de MetaMask.
- [ ] VS Code: cerrar todas las pestañas menos `contracts/DigitalInheritance.sol` y `contracts/InheritanceWatcher.sol`. Ocultar la barra lateral con `Ctrl + B`. Agrandar la letra con `Ctrl + =`, dos veces.
- [ ] `npm run coverage` corrido de antemano en la terminal de VS Code, porque tarda.
- [ ] Pestañas del navegador: el README del back en GitHub, el front y los dos contratos en Etherscan.
- [ ] Cerrar notificaciones.
- [ ] **Nunca mostrar en pantalla el `.env` ni una clave privada**, tampoco la pantalla de MetaMask que la muestra.
- [ ] Grabación de pantalla con micrófono: en Windows, `Win + G` u OBS.

### 3. Orden de grabación

El orden de grabación no es el del video, para aprovechar las esperas:

1. Toma **5a** (titular).
2. Durante los 10 minutos de espera: tomas **1, 2, 3 y 4**.
3. Toma **5b** (activación).
4. Durante los 2 minutos de espera: pasos **1 y 3** de la toma 6, el código verificado y la transacción de activación.
5. Toma **5c** (cobros).
6. El resto de la toma **6** y las tomas **7 y 8**.

En la edición se ordenan de la 1 a la 8.

## 🎞️ Tomas

### Toma 1 · Presentación (0:00 – 0:20)

**Mostrar:** el README del back en GitHub, arriba del todo, y la sección **"🧠 ¿Cómo funciona?"** con el diagrama.

**Decir:** "Somos [nombres del equipo] y este es Herencia Digital, un testamento automático sobre Ethereum. El titular deposita ETH y confirma cada tanto que sigue activo. Si deja de hacerlo durante el plazo que eligió, sus herederos cobran su parte, sin notarios ni intermediarios."

### Toma 2 · Por qué blockchain y arquitectura (0:20 – 0:45)

**Mostrar:** las secciones **"¿Por qué blockchain?"** y **"Arquitectura"** del README.

**Decir:** "Usamos blockchain porque nadie puede frenar el reparto cuando se cumplen las condiciones, cualquiera puede auditarlo y los fondos no pasan por un tercero. Son dos contratos: `DigitalInheritance` guarda los fondos y los reparte, e `InheritanceWatcher` activa la herencia llamando al primero."

### Toma 3 · El código en VS Code (0:45 – 1:40)

Para ir a una línea: `Ctrl + G`, escribir el número y Enter. No leer todo, solo señalar con el mouse.

| # | Archivo | Líneas | Qué señalar |
|:-:|---|---|---|
| A | `contracts/DigitalInheritance.sol` | 4 y 20 | El `import {ReentrancyGuard}` y `contract DigitalInheritance is ReentrancyGuard` |
| B | `contracts/DigitalInheritance.sol` | 49 a 100 | `MIN_INACTIVITY_PERIOD = 5 minutes` (49), `MIN_CLAIM_DELAY = 1 minutes` (52), `address public immutable owner` (68) y las siete variables, de `status` (74) a `_unclaimedPercentage` (100). El comentario de la línea 73 dice "23 bytes de 32" |
| C | `contracts/DigitalInheritance.sol` | 119 a 215 | Bajar rápido por los eventos y los errores, sin detenerse |
| D | `contracts/DigitalInheritance.sol` | 350 a 388 | `triggerInheritance()`: el `revert TooEarly` (353) y el saldo congelado (356 a 360). `cancelTrigger()`: el `revert ClaimsAlreadyStarted()` (379) |
| E | `contracts/DigitalInheritance.sol` | 393 y 558 a 582 | `claim() external nonReentrant whenTriggered` (393). En `_claim()`, los comentarios `// Checks` (559), `// Effects` (569) e `// Interactions` (579) |
| F | `contracts/InheritanceWatcher.sol` | 70 a 73 | `function trigger() public` y la línea 72: `inheritance.triggerInheritance();` |

**Decir,** una frase por paso:
- **A:** "El contrato principal hereda la protección contra reentrancia de OpenZeppelin."
- **B:** "El plazo no puede bajar de 5 minutos ni la ventana de 1. El titular es inmutable y estas siete variables comparten un solo espacio de storage, lo que ahorra gas."
- **C:** "Cada acción emite un evento, y los errores son personalizados, más baratos que los mensajes de texto."
- **D:** "Si el plazo no venció, la activación revierte. Al activarse, se congela el saldo. El titular puede cancelar, pero solo si nadie cobró."
- **E:** "Al cobrar, primero se valida, después se marca el cobro y recién al final se envía el ETH. Así nadie cobra dos veces."
- **F:** "Este es el segundo contrato: su función `trigger` llama a `triggerInheritance` del primero. Esa es la interacción entre contratos."

### Toma 4 · Calidad: tests, coverage, Slither y revisión de seguridad (1:40 – 2:10)

**Mostrar:**
1. En la terminal de VS Code, escribir `npm test` y bajar hasta **"104 passing"**. Si tarda, cortar la espera en la edición.
2. Subir hasta la salida de `npm run coverage`, corrida antes: en la fila **"All files"**, 100 en las cuatro columnas (`% Stmts`, `% Branch`, `% Funcs` y `% Lines`).
3. En el README de GitHub, las secciones **"Análisis estático (Slither)"** y **"Revisión de seguridad y correcciones (versión 2)"**.

**Decir:** "Tenemos 104 tests, incluidos contratos atacantes y una prueba con treinta escenarios aleatorios. La cobertura es del 100 %. Slither no reporta nada grave. Además, una revisión de seguridad de la primera versión encontró tres problemas, y los corregimos en esta versión."

### Toma 5 · Demo en Sepolia desde el front (2:10 – 3:25)

**5a · Titular (2:10 – 2:35)**

**Mostrar:**
1. Apretar **"Conectar wallet"** y elegir la cuenta **Titular** en MetaMask. Arriba aparece la etiqueta **"Titular"**.
2. Señalar las tarjetas **"Estado"** (`ACTIVE`), **"Tiempo para activar"** (abajo dice `Plazo: 10m 0s · Ventana: 2m 0s`) y **"Herederos"** (60 % y 40 %).
3. En la tarjeta **"Acciones"**, borrar el `0.01`, escribir `0.1` y apretar **"Depositar ETH"**. Confirmar en MetaMask.
4. Apretar **"Heartbeat"** y confirmar.

**Decir:** "Entro como titular y deposito 0.1 ETH. Con el heartbeat confirmo que sigo vivo, y el reloj vuelve a empezar. En un uso real el plazo sería de meses, por ejemplo un año. Para la demo lo pusimos en 10 minutos; el contrato no permite menos de 5, para que nadie pueda activar la herencia apenas se deposita."

> ✂️ **Corte de 10 minutos.** En la edición, un texto: "10 minutos después, sin heartbeat".

**5b · Activación (2:35 – 3:00)**

**Mostrar:**
1. En MetaMask, cambiar a la cuenta **Heredero 1**. La etiqueta pasa a **"Heredero"** y **"Tiempo para activar"** marca `0s`.
2. Apretar **"Activar herencia"**. En MetaMask, señalar que el destino es el watcher, `0x4d46…5eCC`. Confirmar.
3. Señalar que **"Estado"** pasa a `TRIGGERED`, que **"Balance"** dice `Congelado: 0.1 ETH`, que aparece **"Cobros habilitados en"** con la cuenta regresiva y que **"Reclamar mi parte"** está deshabilitado.

**Decir:** "Pasaron los 10 minutos sin señales del titular. Desde ese momento cualquiera puede activar la herencia, no solo los herederos; si nadie la activa, el contrato espera. Activarla no le paga a nadie todavía: congela el saldo y abre una ventana de impugnación de 2 minutos, que en la vida real serían días. Es el tiempo garantizado para que el titular, si estaba vivo, cancele la falsa alarma."

> ✂️ **Corte de 2 minutos.** En la edición, un texto: "2 minutos después".

**5c · Cobros e historial (3:00 – 3:25)**

**Mostrar:**
1. Con **Heredero 1**, apretar **"Reclamar mi parte"** y confirmar. El botón cambia a **"Ya reclamaste"** y la tarjeta **"Reclamos"** marca `1/2`.
2. Cambiar a **Heredero 2** y hacer lo mismo. **"Reclamos"** marca `2/2` y **"Balance"**, `0 ETH`.
3. Bajar a la tarjeta **"Historial"**: la activación tiene la etiqueta **"contrato → contrato"**, y cada fila tiene un link **"Ver en Etherscan"**.

**Decir:** "Se cerró la ventana. El primer heredero cobra el 60 %, 0.06 ETH, y el segundo el 40 %. Desde el primer cobro ya no se puede cancelar, y cada heredero cobra una sola vez."

### Toma 6 · Evidencia en Etherscan (3:25 – 4:20)

**Mostrar:**
1. **Código verificado.** Abrir `DigitalInheritance` en Etherscan, pestaña **"Contract"**: la marca verde de **"Contract Source Code Verified"**. Lo mismo con `InheritanceWatcher`. Los links están en los [datos de referencia](#-datos-de-referencia).
2. **Historia completa.** En `DigitalInheritance`, pestaña **"Events"**: `Deposited`, `Heartbeat`, `InheritanceTriggered` y los dos `Claimed`, cada uno con su transacción, su bloque y su hora.
3. **La activación.** Desde el **"Historial"** del front, abrir **"Ver en Etherscan"** de la activación. En **"Overview"**, señalar `Status: Success`, `Block`, `Timestamp`, `From` (Heredero 1) e `Interacted With (To)` (el watcher, `0x4d46…5eCC`). Después, pestaña **"Logs"**: `TriggeredViaWatcher`, emitido por el watcher, e `InheritanceTriggered`, emitido por la herencia.
4. **Un cobro.** Abrir **"Ver en Etherscan"** del cobro del Heredero 1. En **"Overview"**, la transferencia de **0.06 ETH** del contrato `0x842e…7d66` al heredero.
5. **El estado final**, si sobra tiempo. En `DigitalInheritance`, pestaña **"Contract"**, después **"Read Contract"**: `status` en `1` (TRIGGERED), `claimsCount` en `2` y `contractBalance` en `0`.

**Decir:** "Todo lo que hicimos quedó registrado en Sepolia. Los dos contratos tienen el código verificado. En la pestaña Events está la historia completa del contrato: el depósito, el heartbeat, la activación y los dos cobros, cada uno con su transacción, su bloque y su hora. Esta es la activación: la firmó el Heredero 1 y fue al watcher, y en los logs están los eventos de los dos contratos. Este es un cobro: el contrato le transfirió 0.06 ETH al heredero. Estos datos no los guarda nuestra aplicación: están en la blockchain, cualquiera puede consultarlos y nadie puede borrarlos ni modificarlos."

### Toma 7 · Limitaciones y roadmap (4:20 – 4:40)

**Mostrar:** las secciones **"Limitaciones conocidas del MVP"** y **"Roadmap"** del README del back.

**Decir:** "Documentamos lo que todavía falta, como que la clave del titular es un único punto de falla. La segunda fase suma tokens y NFTs, recuperación con guardianes y automatización con Chainlink. La tercera apunta a una auditoría externa y a desplegar en una red de capa 2."

### Toma 8 · Cierre (4:40 – 4:50)

**Mostrar:** la sección **"Despliegue actual"** del README del back, con las direcciones y los links a Etherscan.

**Decir:** "Todo el código, los tests y las transacciones reales están en los repositorios. Gracias."

## 📝 Notas de producción

- **Graba cada toma por separado** y únelas en la edición. Si una falla, repites solo esa.
- **El orden importa:** en cuanto un heredero cobra, la herencia ya no se puede cancelar. Si algo sale mal antes del primer cobro, el titular puede apretar **"Cancelar activación"** y repetir desde el heartbeat.
- **Si en Etherscan `Interacted With (To)` no muestra el contrato**, quedó activado "Added protection" en MetaMask. Los eventos de la pestaña **"Logs"** igual prueban la llamada real.
- Si MetaMask tarda en confirmar, corta o acelera esa parte.
- **Al terminar:** pasar los links de las transacciones de la toma 5 para completar la tabla de evidencia de la versión 2 en el README del back.
- **Entrega:** el nombre del archivo lleva el apellido del integrante que registró al equipo en el formulario. Se sube a la carpeta de Drive de la comisión, y el link se agrega en los dos READMEs.

## 🔗 Datos de referencia

| Dato | Valor |
|---|---|
| `DigitalInheritance`, versión 2 | [`0x842e9fA385222a636e5382B35265adad4ef07d66`](https://sepolia.etherscan.io/address/0x842e9fA385222a636e5382B35265adad4ef07d66#code) |
| `InheritanceWatcher`, versión 2 | [`0x4d46E7989185e60fE3FA2ef9633FA2316fA55eCC`](https://sepolia.etherscan.io/address/0x4d46E7989185e60fE3FA2ef9633FA2316fA55eCC#code) |
| Bloque del deploy | `11942829` |
| Cuenta titular | `0xBDdB6C4FC08Af549d13A33455374e7fFBfD7fA70` |
| Herederos | `0x5EEa…1fEB` (60 %) y `0x5312…1D92` (40 %) |
| Plazo de inactividad | 600 s |
| Ventana de impugnación | 120 s |
| Versión 1, ya usada | `0xe45DB9f8f759Ad34C88C22c07BC4f09a274aa6a0` y watcher `0x68E5FE129B3f51e79bdCfa6eabe7019962b93422` |
| Repo del back | https://github.com/MaximoBaronee/herencia-digital |
| Repo del front | https://github.com/johanriascos7777/front-herencia-digital |
