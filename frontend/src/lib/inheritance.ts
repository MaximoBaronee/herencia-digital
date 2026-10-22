import { ERROR_MESSAGES, ERRORS_WITH_SECONDS } from "./errorMessages";
import { BrowserProvider, Contract, EventLog, type Eip1193Provider } from "ethers";
import abi from "../abi/DigitalInheritance.json";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 31337);
export const CHAIN_NAME = (import.meta.env.VITE_CHAIN_NAME as string) ?? "Hardhat Local";
export const WATCHER_ADDRESS = import.meta.env.VITE_WATCHER_ADDRESS as string;
// Bloque del deploy: el historial busca eventos desde ahí. Sin él, solo mira los últimos 10.000 bloques.
export const DEPLOY_BLOCK = Number(import.meta.env.VITE_DEPLOY_BLOCK ?? 0);

const EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
};

/** Link a la transacción en el explorer de la red, o null en la red local */
export function txUrl(txHash: string) {
  const base = EXPLORERS[CHAIN_ID];
  return base ? `${base}/tx/${txHash}` : null;
}

// Activa la herencia a través de InheritanceWatcher (interacción entre contratos):
// el watcher llama a triggerInheritance() de DigitalInheritance. Usa la misma
// wallet conectada que el contrato principal.
export function triggerViaWatcher(contract: Contract) {
  // Los errores son de DigitalInheritance: el watcher los propaga y así decodeError los muestra por nombre
  const watcherAbi = [
    "function trigger()",
    "error TooEarly(uint256 secondsRemaining)",
    "error InvalidState(uint8 current, uint8 required)",
  ];
  const watcher = new Contract(WATCHER_ADDRESS, watcherAbi, contract.runner);
  return watcher.trigger();
}

export type HistoryKind =
  | "deposit"
  | "heartbeat"
  | "heirs"
  | "period"
  | "delay"
  | "triggered"
  | "cancelled"
  | "claimed"
  | "withdrawn"
  | "dust";

/** Un movimiento del contrato, armado a partir de sus eventos */
export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  /** Dirección que hizo la acción (o destino, en el caso del remanente) */
  actor?: string;
  /** Dirección que recibió el ETH de un cobro, si no es el propio heredero */
  to?: string;
  amount?: bigint;
  /** Nuevo plazo en segundos, solo para "period" y "delay" */
  period?: number;
  /** true si la herencia se activó a través de InheritanceWatcher */
  viaWatcher: boolean;
  /** Cuenta que llamó al watcher, cuando viaWatcher es true */
  watcherCaller?: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
  logIndex: number;
}

/** Lee los eventos de la herencia y del watcher y devuelve los movimientos, del más nuevo al más viejo */
export async function readHistory(contract: Contract): Promise<HistoryEntry[]> {
  const provider = contract.runner?.provider;
  if (!provider) return [];
  const latest = await provider.getBlockNumber();
  const fromBlock = DEPLOY_BLOCK > 0 ? DEPLOY_BLOCK : Math.max(0, latest - 10_000);

  // Quién llamó al watcher en cada transacción, para mostrarlo en la activación
  const callers = new Map<string, string>();
  if (WATCHER_ADDRESS) {
    const watcherEvents = ["event TriggeredViaWatcher(address indexed caller, uint256 timestamp)"];
    const watcher = new Contract(WATCHER_ADDRESS, watcherEvents, provider);
    for (const log of await watcher.queryFilter("TriggeredViaWatcher", fromBlock, latest)) {
      if (log instanceof EventLog) callers.set(log.transactionHash, log.args.caller);
    }
  }

  const entries: HistoryEntry[] = [];
  for (const log of await contract.queryFilter("*", fromBlock, latest)) {
    if (!(log instanceof EventLog)) continue;
    const args = log.args;
    const base = {
      id: `${log.transactionHash}-${log.index}`,
      viaWatcher: false,
      timestamp: Number(args.timestamp),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.index,
    };
    switch (log.eventName) {
      case "Deposited":
        entries.push({ ...base, kind: "deposit", actor: args.from, amount: args.amount });
        break;
      case "Heartbeat":
        entries.push({ ...base, kind: "heartbeat", actor: args.owner });
        break;
      case "HeirsUpdated":
        entries.push({ ...base, kind: "heirs" });
        break;
      case "InactivityPeriodUpdated":
        entries.push({ ...base, kind: "period", period: Number(args.newPeriod) });
        break;
      case "ClaimDelayUpdated":
        entries.push({ ...base, kind: "delay", period: Number(args.newDelay) });
        break;
      case "InheritanceTriggered": {
        const viaWatcher = !!WATCHER_ADDRESS && args.triggeredBy.toLowerCase() === WATCHER_ADDRESS.toLowerCase();
        entries.push({
          ...base,
          kind: "triggered",
          actor: args.triggeredBy,
          amount: args.totalBalance,
          viaWatcher,
          watcherCaller: viaWatcher ? callers.get(log.transactionHash) : undefined,
        });
        break;
      }
      case "TriggerCancelled":
        entries.push({ ...base, kind: "cancelled", actor: args.owner });
        break;
      case "Claimed":
        entries.push({
          ...base,
          kind: "claimed",
          actor: args.heir,
          to: args.to.toLowerCase() === args.heir.toLowerCase() ? undefined : args.to,
          amount: args.amount,
        });
        break;
      case "Withdrawn":
        entries.push({ ...base, kind: "withdrawn", actor: args.owner, amount: args.amount });
        break;
      case "DustSwept":
        entries.push({ ...base, kind: "dust", actor: args.to, amount: args.amount });
        break;
    }
  }
  return entries.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
}

export type Role = "owner" | "heir" | "observer";

export interface Heir {
  account: string;
  percentage: number;
}

export interface Snapshot {
  owner: string;
  triggered: boolean;
  /** Segundos hasta que se pueda activar la herencia, al momento de la lectura */
  secondsLeft: number;
  inactivityPeriod: number;
  /** Ventana de impugnación configurada, en segundos */
  claimDelay: number;
  /** Segundos hasta que se cierre la ventana de impugnación (0 si ya se puede cobrar o no está activada) */
  claimsSecondsLeft: number;
  contractBalance: bigint;
  inheritedBalance: bigint;
  claimsCount: number;
  heirs: Heir[];
  triggerable: boolean;
  /** true si la herencia está activada y la ventana de impugnación ya se cerró */
  claimsOpen: boolean;
  cancellable: boolean;
  role: Role;
  myPercentage: number;
  myClaimed: boolean;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No se detectó una wallet (instala MetaMask)");
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + CHAIN_ID.toString(16) }],
    });
  }
  const signer = await provider.getSigner();
  const contract = new Contract(CONTRACT_ADDRESS, abi, signer);
  return { signer, contract, account: await signer.getAddress() };
}

export async function restoreWallet() {
  if (!window.ethereum) return null;

  const provider = new BrowserProvider(window.ethereum);
  const accounts = (await provider.send("eth_accounts", [])) as string[];
  if (accounts.length === 0) return null;

  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) return null;

  const signer = await provider.getSigner(accounts[0]);
  const contract = new Contract(CONTRACT_ADDRESS, abi, signer);
  return { signer, contract, account: await signer.getAddress() };
}

export async function readSnapshot(contract: Contract, account: string): Promise<Snapshot> {
  const [owner, status, secondsLeft, inactivityPeriod, claimDelay, claimsOpenAt, contractBalance, inheritedBalance, claimsCount, heirs, triggerable, cancellable, myPercentage, myClaimed, latestBlock] =
    await Promise.all([
      contract.owner(),
      contract.status(),
      contract.timeUntilTrigger(),
      contract.inactivityPeriod(),
      contract.claimDelay(),
      contract.claimsOpenAt(),
      contract.contractBalance(),
      contract.inheritedBalance(),
      contract.claimsCount(),
      contract.getHeirs(),
      contract.isTriggerable(),
      contract.canCancelTrigger(),
      contract.percentageOf(account),
      contract.claimed(account),
      contract.runner?.provider?.getBlock("latest"),
    ]);

  const role: Role =
    owner.toLowerCase() === account.toLowerCase() ? "owner" : Number(myPercentage) > 0 ? "heir" : "observer";

  const triggered = Number(status) === 1;
  // La ventana se mide contra el reloj de la cadena, no el de la compu
  const chainNow = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
  const claimsSecondsLeft = triggered ? Math.max(0, Number(claimsOpenAt) - chainNow) : 0;

  return {
    owner,
    triggered,
    secondsLeft: Number(secondsLeft),
    inactivityPeriod: Number(inactivityPeriod),
    claimDelay: Number(claimDelay),
    claimsSecondsLeft,
    contractBalance,
    inheritedBalance,
    claimsCount: Number(claimsCount),
    heirs: heirs.map((h: { account: string; percentage: bigint }) => ({
      account: h.account,
      percentage: Number(h.percentage),
    })),
    triggerable,
    claimsOpen: triggered && claimsSecondsLeft === 0,
    cancellable,
    role,
    myPercentage: Number(myPercentage),
    myClaimed,
  };
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return "0s";
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [d && `${d}d`, (d || h) && `${h}h`, (d || h || m) && `${m}m`, `${s}s`].filter(Boolean).join(" ");
}

export function decodeError(error: unknown): string {
  const e = error as {
    reason?: string;
    shortMessage?: string;
    revert?: { name?: string; args?: unknown[] };
    message?: string;
    error?: { message?: string };
    info?: { error?: { message?: string } };
  };
  const name = e.revert?.name;
  const firstArg = e.revert?.args?.[0];
  if (name && ERROR_MESSAGES[name]) {
    if (ERRORS_WITH_SECONDS.has(name) && typeof firstArg === "bigint") {
      return `${ERROR_MESSAGES[name]} Faltan ${formatDuration(Number(firstArg))}.`;
    }
    return ERROR_MESSAGES[name];
  }
  return name ?? e.reason ?? e.info?.error?.message ?? e.error?.message ?? e.shortMessage ?? e.message ?? "Error desconocido";
}
