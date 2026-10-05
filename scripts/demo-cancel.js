const hre = require("hardhat");
const { ethers } = hre;
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Demo del "botón de pánico": el titular está vivo pero se quedó sin señal
// (viaje largo, por ejemplo) y el temporizador se vence. Un tercero dispara
// la herencia de buena fe. El titular vuelve a tener señal a tiempo -es decir,
// ANTES de que algún heredero reclame- y cancela con cancelTrigger().
// Corre con: npx hardhat run scripts/demo-cancel.js
const INACTIVITY_PERIOD_SECONDS = 60 * 60 * 24 * 30; // 30 días, acortado para la demo

function eth(value) {
  return `${ethers.formatEther(value)} ETH`;
}

async function main() {
  const [owner, heir1, heir2, watcher] = await ethers.getSigners();

  console.log("=== 1. DEPLOY + DEPOSIT ===");
  const Factory = await ethers.getContractFactory("DigitalInheritance");
  const contract = await Factory.deploy(
    INACTIVITY_PERIOD_SECONDS,
    [heir1.address, heir2.address],
    [60, 40]
  );
  await contract.waitForDeployment();
  await (await contract.connect(owner).deposit({ value: ethers.parseEther("10") })).wait();
  console.log("Contrato:", await contract.getAddress());
  console.log("Depósito inicial: 10 ETH");

  console.log("\n=== 2. EL TITULAR PIERDE SEÑAL (viaje largo, sin heartbeat) ===");
  console.log(`Avanzando el reloj ${INACTIVITY_PERIOD_SECONDS + 1} segundos sin heartbeat...`);
  await time.increase(INACTIVITY_PERIOD_SECONDS + 1);

  console.log("\n=== 3. UN TERCERO DISPARA LA HERENCIA DE BUENA FE ===");
  await (await contract.connect(watcher).triggerInheritance()).wait();
  console.log("status:", (await contract.status()) === 1n ? "TRIGGERED" : "ACTIVE");
  console.log("¿Todavía se puede cancelar? (canCancelTrigger):", await contract.canCancelTrigger());

  console.log("\n=== 4. EL TITULAR RECUPERA SEÑAL A TIEMPO (nadie reclamó todavía) ===");
  console.log("Intentando heartbeat() normal primero (para mostrar que está bloqueado)...");
  try {
    await contract.connect(owner).heartbeat();
  } catch (err) {
    console.log("  -> heartbeat() revierte como se espera:", err.shortMessage || err.message);
  }

  console.log("Llamando a cancelTrigger()...");
  await (await contract.connect(owner).cancelTrigger()).wait();
  console.log("status:", (await contract.status()) === 0n ? "ACTIVE" : "TRIGGERED");
  console.log("La herencia quedó cancelada. El titular sigue siendo dueño de:", eth(await contract.contractBalance()));

  console.log("\n=== 5. LA VIDA SIGUE: heartbeat y withdraw vuelven a funcionar ===");
  await (await contract.connect(owner).heartbeat()).wait();
  console.log("Heartbeat normal OK. Segundos hasta el próximo posible trigger:",
    (await contract.timeUntilTrigger()).toString());

  console.log("\n--- Bonus: qué pasa si el titular llega TARDE (un heredero ya cobró) ---");
  await time.increase(INACTIVITY_PERIOD_SECONDS + 1);
  await (await contract.connect(watcher).triggerInheritance()).wait();
  await (await contract.connect(heir1).claim()).wait();
  console.log("Heredero 1 ya reclamó su parte.");
  try {
    await contract.connect(owner).cancelTrigger();
  } catch (err) {
    console.log("  -> cancelTrigger() ahora revierte (punto de no retorno):", err.shortMessage || err.message);
  }

  console.log("\nDemo completa: cancelTrigger() protege al titular vivo, pero deja de ser posible ni bien alguien cobró.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
