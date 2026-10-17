const hre = require("hardhat");
const { loadDeployment, verifyDeployment } = require("./lib/deployments");

// Verifica en Etherscan los contratos de un despliegue anterior, leyendo
// direcciones y argumentos de deployments/<red>.json. Sirve si la verificación
// automática del deploy falló o si ETHERSCAN_API_KEY se cargó después:
//   npm run verify -- --network sepolia
async function main() {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("Falta ETHERSCAN_API_KEY en .env (se crea gratis en etherscan.io, sección API Keys).");
  }
  const deployment = loadDeployment(hre.network.name);
  await verifyDeployment(hre, deployment);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
