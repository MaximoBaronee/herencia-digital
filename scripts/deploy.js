const hre = require("hardhat");
const { saveDeployment, verifyDeployment, explorerUrl } = require("./lib/deployments");

// Parámetros de ejemplo para el deploy. En un caso real, el titular definiría
// sus propios herederos, porcentajes y período de inactividad (en segundos).
const INACTIVITY_PERIOD_SECONDS = Number(process.env.INACTIVITY_PERIOD_SECONDS) || 60 * 60 * 24 * 365; // 1 año
const HEIR_PERCENTAGES = (process.env.HEIR_PERCENTAGES || "60,40").split(",").map((p) => Number(p.trim()));

// Bloques a esperar en una red pública antes de verificar, para que Etherscan
// ya tenga indexado el bytecode de los contratos recién desplegados.
const CONFIRMATIONS = 5;

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

async function deployContract(name, args) {
  const Factory = await hre.ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`${name} desplegado en: ${address}`);
  return { name, contract, address, args };
}

// Espera las confirmaciones y arma el registro de un contrato para deployments/<red>.json
async function deploymentRecord({ name, contract, address, args }) {
  const receipt = await contract.deploymentTransaction().wait(CONFIRMATIONS);
  return {
    address,
    contract: `contracts/${name}.sol:${name}`,
    constructorArguments: args,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

function printNextSteps(network, inheritanceAddress, watcherAddress) {
  console.log("\n=== Próximos pasos ===");
  const inheritanceUrl = explorerUrl(network, inheritanceAddress);
  if (inheritanceUrl) {
    console.log("Código en Etherscan (verificado si arriba no hubo errores):");
    console.log("  DigitalInheritance:", inheritanceUrl);
    console.log("  InheritanceWatcher:", explorerUrl(network, watcherAddress));
    console.log(`Chainlink Automation: registrar un upkeep "Custom logic" con target ${watcherAddress}`);
  }
  console.log("Variables para el .env.local del front:");
  console.log(`  VITE_CONTRACT_ADDRESS=${inheritanceAddress}`);
  console.log(`  VITE_WATCHER_ADDRESS=${watcherAddress}`);
}

async function main() {
  const [deployer, signer1, signer2] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const isLocalNetwork = network === "hardhat" || network === "localhost";

  // Sin PRIVATE_KEY la red queda sin cuentas: no hay quién firme el deploy
  if (!deployer) {
    throw new Error(
      `No hay cuenta para desplegar en "${network}": falta PRIVATE_KEY en .env ` +
        "(la clave privada de la cuenta titular)."
    );
  }

  // En la red local se pueden usar cuentas de prueba como herederos de ejemplo.
  // En cualquier otra red (Sepolia, etc.) solo existe la cuenta de PRIVATE_KEY,
  // así que los herederos tienen que venir por variables de entorno.
  if (!isLocalNetwork && (!process.env.HEIR_1 || !process.env.HEIR_2)) {
    throw new Error(
      `En la red "${network}" hay que definir HEIR_1 y HEIR_2 en .env: ` +
        "no hay cuentas de prueba para usar como herederos."
    );
  }

  const heirAddresses = [
    process.env.HEIR_1 || signer1.address,
    process.env.HEIR_2 || signer2.address,
  ];
  const percentages = HEIR_PERCENTAGES;

  validateParams(heirAddresses, percentages, INACTIVITY_PERIOD_SECONDS);

  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Desplegando DigitalInheritance + InheritanceWatcher...");
  console.log("Red:", network);
  console.log("Titular (owner):", deployer.address);
  console.log("Saldo del titular:", hre.ethers.formatEther(balance), "ETH");
  console.log("Herederos:", heirAddresses, "Porcentajes:", percentages);
  console.log("Período de inactividad (seg):", INACTIVITY_PERIOD_SECONDS);
  console.log();

  if (balance === 0n) {
    throw new Error(
      `La cuenta titular ${deployer.address} no tiene ETH en "${network}": ` +
        "hay que pedir Sepolia ETH en un faucet antes de desplegar."
    );
  }
  if (!isLocalNetwork && !process.env.ETHERSCAN_API_KEY) {
    console.warn("Aviso: falta ETHERSCAN_API_KEY, los contratos se van a desplegar sin verificar.\n");
  }

  const inheritance = await deployContract("DigitalInheritance", [
    INACTIVITY_PERIOD_SECONDS,
    heirAddresses,
    percentages,
  ]);
  // El watcher vigila la herencia recién creada; es el contrato que se registra en Chainlink Automation
  const watcher = await deployContract("InheritanceWatcher", [inheritance.address]);

  if (!isLocalNetwork) {
    console.log(`\nEsperando ${CONFIRMATIONS} confirmaciones antes de verificar...`);
    const deployment = {
      network,
      chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      contracts: {
        DigitalInheritance: await deploymentRecord(inheritance),
        InheritanceWatcher: await deploymentRecord(watcher),
      },
    };
    console.log("Datos del despliegue guardados en", saveDeployment(deployment));

    if (process.env.ETHERSCAN_API_KEY) {
      await verifyDeployment(hre, deployment);
    } else {
      console.log("\nFalta ETHERSCAN_API_KEY en .env: los contratos quedaron desplegados pero sin verificar.");
      console.log(`Cuando la tengas: npm run verify -- --network ${network}`);
    }
  }

  printNextSteps(network, inheritance.address, watcher.address);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
