const hre = require("hardhat");
const { ethers } = hre;
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Demo de interacción end-to-end del flujo principal:
// deploy -> deposit -> heartbeat -> (inactividad) -> trigger vía InheritanceWatcher -> claim
// Pensado para correr sobre la red local de Hardhat:
//   npx hardhat run scripts/demo.js
const INACTIVITY_PERIOD_SECONDS = 60 * 60 * 24 * 30; // 30 días, acortado para la demo

function eth(value) {
  return `${ethers.formatEther(value)} ETH`;
}

async function logState(contract, label) {
  const status = await contract.status();
  const balance = await contract.contractBalance();
  console.log(`\n[Estado: ${label}]`);
  console.log("  status:", status === 0n ? "ACTIVE" : "TRIGGERED");
  console.log("  balance del contrato:", eth(balance));
}

async function main() {
  // `keeper` hace de Chainlink Automation: en Sepolia el upkeep lo ejecuta su red de nodos
  const [owner, heir1, heir2, keeper] = await ethers.getSigners();

  console.log("=== 1. DEPLOY ===");
  console.log("Titular:", owner.address);
  console.log("Heredero 1 (60%):", heir1.address);
  console.log("Heredero 2 (40%):", heir2.address);

  const Factory = await ethers.getContractFactory("DigitalInheritance");
  const contract = await Factory.deploy(
    INACTIVITY_PERIOD_SECONDS,
    [heir1.address, heir2.address],
    [60, 40]
  );
  await contract.waitForDeployment();
  console.log("Contrato desplegado en:", await contract.getAddress());

  const Watcher = await ethers.getContractFactory("InheritanceWatcher");
  const watcher = await Watcher.deploy(await contract.getAddress());
  await watcher.waitForDeployment();
  console.log("InheritanceWatcher desplegado en:", await watcher.getAddress());

  console.log("\n=== 2. DEPOSIT ===");
  const depositAmount = ethers.parseEther("10");
  let tx = await contract.connect(owner).deposit({ value: depositAmount });
  await tx.wait();
  console.log(`El titular depositó ${eth(depositAmount)}`);
  await logState(contract, "después del depósito");

  console.log("\n=== 3. HEARTBEAT ===");
  tx = await contract.connect(owner).heartbeat();
  await tx.wait();
  console.log("Heartbeat confirmado. Segundos hasta poder activar la herencia:",
    (await contract.timeUntilTrigger()).toString());

  console.log("\n=== 4. SIMULACIÓN DE INACTIVIDAD ===");
  console.log(`Avanzando el reloj de la red ${INACTIVITY_PERIOD_SECONDS + 1} segundos...`);
  await time.increase(INACTIVITY_PERIOD_SECONDS + 1);
  console.log("¿Es triggereable ahora?", await contract.isTriggerable());
  const [upkeepNeeded] = await watcher.checkUpkeep("0x");
  console.log("checkUpkeep() del watcher (lo que consulta Chainlink Automation):", upkeepNeeded);

  console.log("\n=== 5. TRIGGER (InheritanceWatcher.performUpkeep, como lo haría Chainlink Automation) ===");
  tx = await watcher.connect(keeper).performUpkeep("0x");
  await tx.wait();
  await logState(contract, "después del trigger");
  console.log("Balance congelado para el reparto (inheritedBalance):", eth(await contract.inheritedBalance()));

  console.log("\n=== 6. CLAIM ===");
  const before1 = await ethers.provider.getBalance(heir1.address);
  tx = await contract.connect(heir1).claim();
  await tx.wait();
  const after1 = await ethers.provider.getBalance(heir1.address);
  console.log(`Heredero 1 reclamó (~${eth(after1 - before1)} recibidos, neto de gas)`);

  const before2 = await ethers.provider.getBalance(heir2.address);
  tx = await contract.connect(heir2).claim();
  await tx.wait();
  const after2 = await ethers.provider.getBalance(heir2.address);
  console.log(`Heredero 2 reclamó (~${eth(after2 - before2)} recibidos, neto de gas)`);

  await logState(contract, "después de ambos reclamos");
  console.log("\nDemo completa. Flujo principal ejecutado de punta a punta.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
