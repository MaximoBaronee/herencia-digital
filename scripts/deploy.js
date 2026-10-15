const hre = require("hardhat");

// Parámetros de ejemplo para el deploy. En un caso real, el titular definiría
// sus propios herederos, porcentajes y período de inactividad (en segundos).
const INACTIVITY_PERIOD_SECONDS = Number(process.env.INACTIVITY_PERIOD_SECONDS) || 60 * 60 * 24 * 365; // 1 año
const HEIR_PERCENTAGES = (process.env.HEIR_PERCENTAGES || "60,40").split(",").map((p) => Number(p.trim()));

// Replica en el script las mismas validaciones que hace el constructor del
// contrato, para fallar con un mensaje claro antes de gastar gas en un deploy
// que igual revertiría.
function validateParams(heirAddresses, percentages, inactivityPeriod) {
  const errors = [];

  if (heirAddresses.length === 0) errors.push("Hace falta al menos un heredero (HEIR_1).");
  if (heirAddresses.length !== percentages.length) {
    errors.push(
      `Hay ${heirAddresses.length} herederos y ${percentages.length} porcentajes (HEIR_PERCENTAGES); deben coincidir.`
    );
  }

  heirAddresses.forEach((address, i) => {
    if (!hre.ethers.isAddress(address)) errors.push(`HEIR_${i + 1} no es una dirección válida: ${address}`);
    else if (address === hre.ethers.ZeroAddress) errors.push(`HEIR_${i + 1} no puede ser la dirección cero.`);
  });
  if (new Set(heirAddresses.map((a) => a.toLowerCase())).size !== heirAddresses.length) {
    errors.push("Hay direcciones de herederos repetidas.");
  }

  if (percentages.some((p) => !Number.isInteger(p) || p < 0 || p > 100)) {
    errors.push(`HEIR_PERCENTAGES debe contener enteros entre 0 y 100: ${percentages.join(",")}`);
  } else {
    const sum = percentages.reduce((acc, p) => acc + p, 0);
    if (sum !== 100) errors.push(`Los porcentajes deben sumar 100 (suman ${sum}).`);
  }

  if (!Number.isInteger(inactivityPeriod) || inactivityPeriod <= 0) {
    errors.push(`INACTIVITY_PERIOD_SECONDS debe ser un entero positivo: ${inactivityPeriod}`);
  }

  if (errors.length > 0) {
    throw new Error("Parámetros de deploy inválidos:\n  - " + errors.join("\n  - "));
  }
}

async function main() {
  const [deployer, signer1, signer2] = await hre.ethers.getSigners();
  const isLocalNetwork = hre.network.name === "hardhat" || hre.network.name === "localhost";

  // En la red local se pueden usar cuentas de prueba como herederos de ejemplo.
  // En cualquier otra red (Sepolia, etc.) solo existe la cuenta de PRIVATE_KEY,
  // así que los herederos tienen que venir por variables de entorno.
  if (!isLocalNetwork && (!process.env.HEIR_1 || !process.env.HEIR_2)) {
    throw new Error(
      `En la red "${hre.network.name}" hay que definir HEIR_1 y HEIR_2 en .env: ` +
        "no hay cuentas de prueba para usar como herederos."
    );
  }

  const heirAddresses = [
    process.env.HEIR_1 || signer1.address,
    process.env.HEIR_2 || signer2.address,
  ];
  const percentages = HEIR_PERCENTAGES;

  validateParams(heirAddresses, percentages, INACTIVITY_PERIOD_SECONDS);

  console.log("Desplegando DigitalInheritance...");
  console.log("Red:", hre.network.name);
  console.log("Titular:", deployer.address);
  console.log("Herederos:", heirAddresses, "Porcentajes:", percentages);
  console.log("Período de inactividad (seg):", INACTIVITY_PERIOD_SECONDS);

  const Factory = await hre.ethers.getContractFactory("DigitalInheritance");
  const contract = await Factory.deploy(
    INACTIVITY_PERIOD_SECONDS,
    heirAddresses,
    percentages
  );
  await contract.waitForDeployment();

  console.log("\nDigitalInheritance desplegado en:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
