/**
 * config.js — Network parameters, contract addresses, and RPC endpoints.
 */

const getEnv = (key, fallback) => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

export const SUPPORTED_CHAINS = {
  421614: {
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    currency: "ETH"
  },
  31337: {
    name: "Anvil Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: "",
    currency: "ETH"
  }
};

export const CONTRACT_ADDRESSES = {
  registry: getEnv("VITE_REGISTRY_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3"),
  staking: getEnv("VITE_STAKING_ADDRESS", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"),
  htlc: getEnv("VITE_HTLC_ADDRESS", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"),
  credentials: getEnv("VITE_CREDENTIALS_ADDRESS", "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"),
  jurorSelection: getEnv("VITE_JUROR_SELECTION_ADDRESS", "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"),
  voting: getEnv("VITE_VOTING_ADDRESS", "0x0165878A594ca255338adfa4d48449f69242Eb8F"),
  arbitratedBounty: getEnv("VITE_ARBITRATED_BOUNTY_ADDRESS", "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853")
};
