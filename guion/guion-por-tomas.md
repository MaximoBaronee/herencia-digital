# 🎬 Guion del video — Herencia Digital

Video de presentación y demo del Trabajo Final (máximo **5 minutos**). Objetivo de duración: **4:45**.

Cada toma dice **qué mostrar** y sugiere **qué decir**. Se graban por separado y se unen en la edición.

## ✅ Qué tiene que verse (checklist G del protocolo)

| Requisito | Dónde se cumple |
|---|---|
| Duración máxima de 5 minutos | Suma de tomas: 4:45 |
| La implementación real | Tomas 3 y 4: el código, los tests, el coverage y Slither |
| El funcionamiento real | Toma 6: el flujo completo en Sepolia desde el front |
| Evidencia real de la interacción con blockchain | Tomas 5 y 6: código verificado y transacciones en Etherscan, más el historial del front |

## 🧰 Antes de grabar

### 1. Los contratos de la demo

La **versión 2** ya está desplegada, verificada y sin usar: es la que se graba. El `.env.example` del front ya apunta a ella. Los datos están en la tabla de [datos de referencia](#-datos-de-referencia).

El flujo solo se puede hacer **una vez por contrato**: cuando los herederos cobran, la herencia queda cerrada. Si hay que repetir la grabación:

1. En `herencia-digital`, con el `.env` completo, correr `npm run deploy -- --network sepolia`. Despliega y verifica los dos contratos, e imprime las direcciones nuevas.
2. En el `.env.local` del front, reemplazar `VITE_CONTRACT_ADDRESS`, `VITE_WATCHER_ADDRESS` y `VITE_DEPLOY_BLOCK` por los valores nuevos. El bloque está en `deployments/sepolia.json` del back.
3. Reiniciar `npm run dev`.

### 2. Preparación

- [ ] Front corriendo con `npm run dev` y abierto en `localhost:5173`.
- [ ] MetaMask en la red **Sepolia**, con tres cuentas con nombre: **Titular**, **Heredero 1** y **Heredero 2**. Cada heredero necesita un poco de Sepolia ETH para el gas del reclamo.
- [ ] **Desactivar "Added protection"** en cada confirmación de MetaMask.
- [ ] Pestañas listas: README del back, VS Code con los dos contratos, terminal en `herencia-digital` y Etherscan de los contratos.
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
1. `DigitalInheritance.sol`: las siete variables de control que comparten un slot de storage, y el titular `immutable`.
2. Los errores custom y los eventos.
3. `_claim()`: el chequeo de la ventana de impugnación, y que primero actualiza el estado y recién después transfiere, con `nonReentrant`.
4. `InheritanceWatcher.sol`: `trigger()` llamando a `triggerInheritance()`.

**Decir:** "Ordenamos el storage para que siete variables entren en un solo slot y el titular es inmutable, lo que ahorra gas en cada llamada. Usamos errores custom y eventos para cada operación. Al cobrar aplicamos Checks-Effects-Interactions y el `ReentrancyGuard` de OpenZeppelin, y nadie puede cobrar hasta que se cierre la ventana de impugnación. El watcher es la interacción entre contratos: cuando vence el plazo, llama a la herencia."

### Toma 4 · Calidad: tests, coverage, Slither y revisión de seguridad (1:45 – 2:20)

**Mostrar:**
1. En la terminal, `npm test` hasta el **104 passing**.
2. El resultado de `npm run coverage`: 100 % en todas las métricas.
3. Las secciones "Análisis estático (Slither)" y "Revisión de seguridad y correcciones" del README.

**Decir:** "Tenemos 104 tests, incluidos contratos atacantes y un test de propiedades que prueba el reparto en treinta escenarios aleatorios. La cobertura es del 100 %. Slither no reporta nada grave, y una revisión de seguridad de la primera versión encontró tres problemas que corregimos en esta versión: por ejemplo, la ventana de impugnación."

### Toma 5 · Contratos verificados (2:20 – 2:35)

**Mostrar:** los dos contratos en Etherscan, pestaña **Contract**, con la marca verde de código verificado.

**Decir:** "Los dos contratos están desplegados en Sepolia y verificados: cualquiera puede leer el código que corre."

### Toma 6 · Demo en Sepolia desde el front (2:35 – 4:15)

**6a · Titular (2:35 – 3:05).** Conectar con la cuenta **Titular**. Señalar el rol, el estado, el plazo, la ventana y los herederos 60/40. Depositar `0.1` ETH y hacer **Heartbeat**.

**Decir:** "Entro como titular, deposito 0.1 ETH y confirmo que sigo activo. Para la demo el plazo es de 10 minutos y la ventana de impugnación, de 2."

> ✂️ **Corte.** Esperar 10 minutos sin hacer heartbeat. En la edición, un texto: "10 minutos después".

**6b · Activación (3:05 – 3:40).** Cambiar a la cuenta **Heredero 1** y apretar **Activar herencia**. En MetaMask, mostrar que el destino es el **Watcher**. Mostrar el panel: "Cobros habilitados en 2m" y el botón de reclamo deshabilitado. Abrir la transacción en Etherscan, pestaña **Logs**: aparecen `TriggeredViaWatcher`, del watcher, e `InheritanceTriggered`, de la herencia.

**Decir:** "Pasó el plazo sin señales del titular. Cualquiera puede activar la herencia. El botón llama al watcher y el watcher llama a la herencia: en Etherscan se ven los eventos de los dos contratos en la misma transacción. Ahora corre la ventana de impugnación: si el titular estaba vivo, todavía puede cancelar."

> ✂️ **Corte.** Esperar 2 minutos. En la edición, un texto: "2 minutos después".

**6c · Cobros e historial (3:40 – 4:15).** Con **Heredero 1**, **Reclamar mi parte** (0.06 ETH). Con **Heredero 2**, lo mismo (0.04 ETH). Bajar a la tarjeta **Historial** y abrir un link a Etherscan.

**Decir:** "Se cerró la ventana y cada heredero cobra su porcentaje, una sola vez. El historial muestra cada movimiento con su transacción en Etherscan, y marca la activación que pasó de contrato a contrato."

### Toma 7 · Limitaciones y roadmap (4:15 – 4:35)

**Mostrar:** las secciones "Limitaciones conocidas del MVP" y "Roadmap" del README del back.

**Decir:** "Documentamos las limitaciones que siguen abiertas, como la clave del titular como único punto de falla. La Fase 2 suma tokens ERC-20 y NFTs, recuperación social con guardianes y automatización con Chainlink. La Fase 3 apunta a auditoría externa y despliegue en una L2."

### Toma 8 · Cierre (4:35 – 4:45)

**Mostrar:** la tabla de evidencia on-chain y los links a los dos repos, en el README del back.

**Decir:** "Todo el código, los tests y las transacciones reales están en los repositorios. Gracias."

## 📝 Notas de producción

- **Graba cada toma por separado** y únelas en la edición. Si una falla, repites solo esa.
- **El orden importa:** en cuanto un heredero cobra, la herencia ya no se puede cancelar. Si algo sale mal antes del primer cobro, el titular puede apretar **Cancelar activación** y repetir desde el heartbeat.
- **Si sobran 15 segundos,** después de la toma 4 se puede correr `npm run demo:cancel` para mostrar la cancelación por falsa alarma.
- Si MetaMask tarda en confirmar, corta o acelera esa parte.
- **Al terminar:** pasar los links de las transacciones de la toma 6 para completar la tabla de evidencia de la versión 2 en el README del back.
- **Entrega:** el nombre del archivo lleva el apellido del integrante que registró al equipo en el formulario. Se sube a la carpeta de Drive de la comisión, y el link se agrega en los dos READMEs.

## 🔗 Datos de referencia

| Dato | Valor |
|---|---|
| `DigitalInheritance`, versión 2 | `0x842e9fA385222a636e5382B35265adad4ef07d66` |
| `InheritanceWatcher`, versión 2 | `0x4d46E7989185e60fE3FA2ef9633FA2316fA55eCC` |
| Bloque del deploy | `11942829` |
| Cuenta titular | `0xBDdB6C4FC08Af549d13A33455374e7fFBfD7fA70` |
| Herederos | `0x5EEa…1fEB` (60 %) y `0x5312…1D92` (40 %) |
| Plazo de inactividad | 600 s |
| Ventana de impugnación | 120 s |
| Versión 1, ya usada | `0xe45DB9f8f759Ad34C88C22c07BC4f09a274aa6a0` y watcher `0x68E5FE129B3f51e79bdCfa6eabe7019962b93422` |
| Repo del back | https://github.com/MaximoBaronee/herencia-digital |
| Repo del front | https://github.com/johanriascos7777/front-herencia-digital |
