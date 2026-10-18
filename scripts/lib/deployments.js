const fs = require("fs");
const path = require("path");

// Un JSON por red con lo que se desplegó: direcciones, argumentos del
// constructor y hashes de las transacciones. Sirve para verificar más tarde
// sin redesplegar y como registro de qué código está on-chain.
const DEPLOYMENTS_DIR = path.join(__dirname, "..", "..", "deployments");

const EXPLORERS = {
  sepolia: "https://sepolia.etherscan.io",
};

function deploymentFile(network) {
  return path.join(DEPLOYMENTS_DIR, `${network}.json`);
}

function saveDeployment(deployment) {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const file = deploymentFile(deployment.network);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2) + "\n");
  return path.relative(process.cwd(), file);
}

function loadDeployment(network) {
  const file = deploymentFile(network);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No existe ${path.relative(process.cwd(), file)}: primero hay que desplegar con ` +
        `"npm run deploy -- --network ${network}".`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// URL donde se ve el código verificado; null si la red no tiene explorer configurado
function explorerUrl(network, address) {
  const base = EXPLORERS[network];
  return base ? `${base}/address/${address}#code` : null;
}

// Etherscan a veces tarda más que las confirmaciones en indexar el bytecode de un
// contrato recién desplegado y responde "does not have bytecode". En ese caso se
// reintenta unas veces antes de rendirse.
const VERIFY_ATTEMPTS = 6;
const VERIFY_RETRY_DELAY_MS = 20_000;

async function verifyContract(hre, name, info, retryDelayMs) {
  for (let attempt = 1; ; attempt++) {
    try {
      await hre.run("verify:verify", {
        address: info.address,
        contract: info.contract,
        constructorArguments: info.constructorArguments,
      });
      return;
    } catch (error) {
      const notIndexedYet = /does not have bytecode/i.test(error.message);
      if (!notIndexedYet || attempt === VERIFY_ATTEMPTS) throw error;
      console.log(
        `Etherscan todavía no indexó ${name}. Reintento ${attempt + 1}/${VERIFY_ATTEMPTS} ` +
          `en ${retryDelayMs / 1000} s...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

// Verifica en Etherscan cada contrato del despliegue. Si uno falla, sigue con el
// resto y deja el proceso con código de error para que el fallo no pase inadvertido.
// Un contrato ya verificado no es un error: hardhat-verify lo informa y sigue.
async function verifyDeployment(hre, deployment, { retryDelayMs = VERIFY_RETRY_DELAY_MS } = {}) {
  for (const [name, info] of Object.entries(deployment.contracts)) {
    console.log(`\nVerificando ${name} (${info.address})...`);
    try {
      await verifyContract(hre, name, info, retryDelayMs);
    } catch (error) {
      console.error(`No se pudo verificar ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

module.exports = { saveDeployment, loadDeployment, explorerUrl, verifyDeployment };
