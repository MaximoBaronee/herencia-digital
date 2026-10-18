# 🎬 Guion del video — Herencia Digital

Video de presentación y demo del Trabajo Final (máximo **5 minutos**). Objetivo de duración: **4:40**.

Cada toma dice **qué mostrar** y sugiere **qué decir**. Se graban por separado y se unen en la edición.

## ✅ Qué tiene que verse (checklist G del protocolo)

| Requisito | Dónde se cumple |
|---|---|
| Duración máxima de 5 minutos | Suma de tomas: 4:40 |
| La implementación real | Tomas 3 y 4: el código, los tests, el coverage y Slither |
| El funcionamiento real | Toma 6: el flujo completo en Sepolia desde el front |
| Evidencia real de la interacción con blockchain | Tomas 5 y 6: código verificado y transacciones en Etherscan, más el historial del front |

## 🧰 Antes de grabar

### 1. Una instancia nueva de los contratos para la demo

Los contratos actuales ya completaron el flujo: la herencia está activada y los dos herederos cobraron, así que **en ese contrato no se puede repetir**. Para grabar el flujo en vivo hace falta una instancia nueva, con el mismo código:

1. En `herencia-digital`, con el `.env` completo, correr `npm run deploy -- --network sepolia`. Despliega y verifica los dos contratos, e imprime las direcciones nuevas.
2. En el `.env.local` del front, reemplazar `VITE_CONTRACT_ADDRESS`, `VITE_WATCHER_ADDRESS` y `VITE_DEPLOY_BLOCK` por los valores nuevos. El bloque está en `deployments/sepolia.json` del back.
3. Reiniciar `npm run dev` y completar las direcciones en la tabla de [datos de referencia](#-datos-de-referencia).

### 2. Preparación

- [ ] Front corriendo con `npm run dev` y abierto en `localhost:5173`.
- [ ] MetaMask en la red **Sepolia**, con tres cuentas con nombre: **Titular**, **Heredero 1** y **Heredero 2**. Cada heredero necesita un poco de Sepolia ETH para el gas del reclamo.
- [ ] **Desactivar "Added protection"** en cada confirmación de MetaMask.
- [ ] Pestañas listas: README del back, VS Code con los dos contratos, terminal en `herencia-digital` y Etherscan de los contratos nuevos.
- [ ] `npm run coverage` corrido de antemano, para no esperar en cámara.
- [ ] Letra grande en terminal y editor. Cerrar notificaciones.
- [ ] **Nunca mostrar en pantalla el `.env` ni una clave privada**, tampoco la pantalla de MetaMask que la muestra.
- [ ] Grabación de pantalla con micrófono: en Windows, `Win + G` u OBS; en macOS, `Cmd + Shift + 5`.

## 🎞️ Tomas

### Toma 1 · Presentación (0:00 – 0:25)

**Mostrar:** el README del back, arriba del todo, y el diagrama de "¿Cómo funciona?".

**Decir:** "Herencia Digital es un testamento automático sobre Ethereum. El titular deposita ETH y confirma cada tanto que sigue activo. Si deja de hacerlo durante el plazo que eligió, sus herederos cobran su parte, sin notarios ni intermediarios."

### Toma 2 · Por qué blockchain y arquitectura (0:25 – 0:55)

**Mostrar:** las secciones "¿Por qué blockchain?" y "Arquitectura" del README.

**Decir:** "Usamos blockchain porque nadie puede impedir el reparto una vez que se cumplen las condiciones, cualquiera puede auditarlo y los fondos no pasan por un tercero. Son dos contratos: `DigitalInheritance` custodia los fondos y los reparte, e `InheritanceWatcher` activa la herencia llamando al primero."

### Toma 3 · El código (0:55 – 1:45)

**Mostrar,** en VS Code y sin leer todo:
1. `DigitalInheritance.sol`: `status` y los dos `uint40` que comparten un slot de storage, y el titular `immutable`.
2. Los errores custom y los eventos.
3. `claim()`: primero actualiza el estado y recién después transfiere, con `nonReentrant`.
4. `InheritanceWatcher.sol`: `trigger()` llamando a `triggerInheritance()`.

**Decir:** "Ordenamos el storage para que tres variables entren en un solo slot y el titular es inmutable, lo que ahorra gas en cada llamada. Usamos errores custom y eventos para cada operación. En `claim()` aplicamos Checks-Effects-Interactions y el `ReentrancyGuard` de OpenZeppelin. El watcher es la interacción entre contratos: cuando vence el plazo, llama a la herencia."

### Toma 4 · Calidad: tests, coverage y Slither (1:45 – 2:15)

**Mostrar:**
1. En la terminal, `npm test` hasta el **83 passing**.
2. El resultado de `npm run coverage`.
3. La tabla de Slither del README.

**Decir:** "Tenemos 83 tests, incluidos contratos atacantes que intentan reentrar o rechazar pagos. La cobertura es del 100 % en líneas y funciones. Slither reporta siete hallazgos, todos revisados y justificados en el README."

### Toma 5 · Contratos verificados (2:15 – 2:30)

**Mostrar:** los dos contratos nuevos en Etherscan, pestaña **Contract**, con la marca verde de código verificado.

**Decir:** "Los dos contratos están desplegados en Sepolia y verificados: cualquiera puede leer el código que corre."

### Toma 6 · Demo en Sepolia desde el front (2:30 – 4:00)

**6a · Titular (2:30 – 3:00).** Conectar con la cuenta **Titular**. Señalar el rol, el estado, el plazo y los herederos 60/40. Depositar `0.1` ETH y hacer **Heartbeat**.

**Decir:** "Entro como titular, deposito 0.1 ETH y confirmo que sigo activo. Para la demo el plazo es de 10 minutos."

> ✂️ **Corte.** Esperar 10 minutos sin hacer heartbeat. En la edición, un texto: "10 minutos después".

**6b · Activación (3:00 – 3:30).** Cambiar a la cuenta **Heredero 1** y apretar **Activar herencia**. En MetaMask, mostrar que el destino es el **Watcher**. Después abrir la transacción en Etherscan, pestaña **Logs**: aparecen `TriggeredViaWatcher`, del watcher, e `InheritanceTriggered`, de la herencia.

**Decir:** "Pasó el plazo sin señales del titular. Cualquiera puede activar la herencia. El botón llama al watcher y el watcher llama a la herencia: en Etherscan se ven los eventos de los dos contratos en la misma transacción."

**6c · Reclamos e historial (3:30 – 4:00).** Con **Heredero 1**, **Reclamar mi parte** (0.06 ETH). Con **Heredero 2**, lo mismo (0.04 ETH). Bajar a la tarjeta **Historial** y abrir un link a Etherscan.

**Decir:** "Cada heredero cobra su porcentaje una sola vez. El historial muestra cada movimiento con su transacción en Etherscan, y marca la activación que pasó de contrato a contrato."

### Toma 7 · Limitaciones y roadmap (4:00 – 4:25)

**Mostrar:** las secciones "Limitaciones conocidas del MVP" y "Roadmap" del README del back.

**Decir:** "Documentamos las limitaciones del MVP, como la falta de una ventana de gracia después de la activación. La Fase 2 suma tokens ERC-20 y NFTs, recuperación social con guardianes y automatización con Chainlink. La Fase 3 apunta a auditoría externa y despliegue en una L2."

### Toma 8 · Cierre (4:25 – 4:40)

**Mostrar:** la tabla de evidencia on-chain y los links a los dos repos, en el README del back.

**Decir:** "Todo el código, los tests y las transacciones reales están en los repositorios. Gracias."

## 📝 Notas de producción

- **Graba cada toma por separado** y únelas en la edición. Si una falla, repites solo esa.
- **El orden importa:** en cuanto un heredero cobra, la herencia ya no se puede cancelar. Si algo sale mal antes del primer reclamo, el titular puede apretar **Cancelar activación** y repetir.
- **Si sobran 15 segundos,** después de la toma 4 se puede correr `npm run demo:cancel` para mostrar la cancelación por falsa alarma.
- Si MetaMask tarda en confirmar, corta o acelera esa parte.
- **Al terminar:** avisar para actualizar los dos READMEs y el `.env.example` del front con las direcciones y transacciones de la instancia nueva.
- **Entrega:** el nombre del archivo lleva el apellido del integrante que registró al equipo en el formulario. Se sube a la carpeta de Drive de la comisión, y el link se agrega en los dos READMEs.

## 🔗 Datos de referencia

| Dato | Valor |
|---|---|
| `DigitalInheritance` de la demo | completar después del deploy |
| `InheritanceWatcher` de la demo | completar después del deploy |
| Primera ejecución completa, ya usada | `0xe45DB9f8f759Ad34C88C22c07BC4f09a274aa6a0` y watcher `0x68E5FE129B3f51e79bdCfa6eabe7019962b93422` |
| Cuenta titular | `0xBDdB6C4FC08Af549d13A33455374e7fFBfD7fA70` |
| Herederos | `0x5EEa…1fEB` (60 %) y `0x5312…1D92` (40 %) |
| Plazo de inactividad | 600 s |
| Repo del back | https://github.com/MaximoBaronee/herencia-digital |
| Repo del front | https://github.com/johanriascos7777/front-herencia-digital |
