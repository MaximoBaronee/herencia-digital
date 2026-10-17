require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ quiet: true });

// Si SEPOLIA_RPC_URL queda vacío se usa un RPC público, así el .env solo necesita
// la clave del titular, la API key de Etherscan y los herederos.
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // red local en memoria, usada por defecto en tests y en el script de demo
    },
    // La red existe siempre: si falta PRIVATE_KEY, scripts/deploy.js lo avisa con un
    // mensaje claro en vez del error genérico de Hardhat "network doesn't exist".
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
