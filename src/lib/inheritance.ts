import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import abi from "../abi/DigitalInheritance.json";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 31337);
export const CHAIN_NAME = (import.meta.env.VITE_CHAIN_NAME as string) ?? "Hardhat Local";

export type Role = "owner" | "heir" | "observer";

export interface Heir {
  account: string;
  percentage: number;
}

export interface Snapshot {
  owner: string;
  triggered: boolean;
  secondsLeft: number;
  inactivityPeriod: number;
  depositBalance: bigint;
  contractBalance: bigint;
  inheritedBalance: bigint;
  claimsCount: number;
  heirs: Heir[];
  triggerable: boolean;
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

export async function readSnapshot(contract: Contract, account: string): Promise<Snapshot> {
  const [owner, status, secondsLeft, inactivityPeriod, depositBalance, contractBalance, inheritedBalance, claimsCount, heirs, triggerable, cancellable, myPercentage, myClaimed] =
    await Promise.all([
      contract.owner(),
      contract.status(),
      contract.timeUntilTrigger(),
      contract.inactivityPeriod(),
      contract.depositBalance(),
      contract.contractBalance(),
      contract.inheritedBalance(),
      contract.claimsCount(),
      contract.getHeirs(),
      contract.isTriggerable(),
      contract.canCancelTrigger(),
      contract.percentageOf(account),
      contract.claimed(account),
    ]);

  const role: Role =
    owner.toLowerCase() === account.toLowerCase() ? "owner" : Number(myPercentage) > 0 ? "heir" : "observer";

  return {
    owner,
    triggered: Number(status) === 1,
    secondsLeft: Number(secondsLeft),
    inactivityPeriod: Number(inactivityPeriod),
    depositBalance,
    contractBalance,
    inheritedBalance,
    claimsCount: Number(claimsCount),
    heirs: heirs.map((h: { account: string; percentage: bigint }) => ({
      account: h.account,
      percentage: Number(h.percentage),
    })),
    triggerable,
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
    revert?: { name?: string };
    message?: string;
    error?: { message?: string };
    info?: { error?: { message?: string } };
  };
  return e.revert?.name ?? e.reason ?? e.info?.error?.message ?? e.error?.message ?? e.shortMessage ?? e.message ?? "Error desconocido";
}
