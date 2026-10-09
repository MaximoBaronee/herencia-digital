const hre = require("hardhat");

// Parámetros de ejemplo para el deploy. En un caso real, el titular definiría
// sus propios herederos, porcentajes y período de inactividad (en segundos).
const INACTIVITY_PERIOD_SECONDS = Number(process.env.INACTIVITY_PERIOD_SECONDS) || 60 * 60 * 24 * 365; // 1 año

async function main() {
  const [deployer, signer1, signer2] = await hre.ethers.getSigners();

  const heirAddresses = [
    process.env.HEIR_1 || signer1.address,
    process.env.HEIR_2 || signer2.address,
  ];
  const percentages = [60, 40];

  console.log("Desplegando DigitalInheritance...");
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
  console.error(error);
  process.exitCode = 1;
});
