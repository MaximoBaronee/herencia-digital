import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, type Contract } from "ethers";
import { Actions } from "./components/Actions";
import { Badge } from "./components/Badge";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { HeirList } from "./components/HeirList";
import { History } from "./components/History";
import { Stat } from "./components/Stat";
import {
  CHAIN_NAME,
  CONTRACT_ADDRESS,
  WATCHER_ADDRESS,
  connectWallet,
  decodeError,
  formatDuration,
  readHistory,
  readSnapshot,
  restoreWallet,
  shortAddress,
  triggerViaWatcher,
  type HistoryEntry,
  type Snapshot,
} from "./lib/inheritance";

type Message = { kind: "ok" | "error"; text: string } | null;

const ROLE_LABEL = { owner: "Titular", heir: "Heredero", observer: "Observador" } as const;

export default function App() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [account, setAccount] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [readAt, setReadAt] = useState(() => Date.now());
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refresh = useCallback(async (c: Contract, a: string) => {
    setSnapshot(await readSnapshot(c, a));
    setReadAt(Date.now());
    // El historial se carga aparte para no demorar el resto del dashboard
    readHistory(c).then(
      (entries) => {
        setHistory(entries);
        setHistoryError(null);
      },
      (error) => setHistoryError(decodeError(error)),
    );
  }, []);

  const nameOf = useCallback(
    (address: string) => {
      const a = address.toLowerCase();
      const you = a === account.toLowerCase() ? " (tú)" : "";
      if (snapshot && a === snapshot.owner.toLowerCase()) return `Titular${you}`;
      const heirIndex = snapshot ? snapshot.heirs.findIndex((h) => h.account.toLowerCase() === a) : -1;
      if (heirIndex >= 0) return `Heredero ${heirIndex + 1}${you}`;
      if (WATCHER_ADDRESS && a === WATCHER_ADDRESS.toLowerCase()) return "InheritanceWatcher";
      return `${shortAddress(address)}${you}`;
    },
    [snapshot, account],
  );

  const connect = async () => {
    try {
      const wallet = await connectWallet();
      setContract(wallet.contract);
      setAccount(wallet.account);
      await refresh(wallet.contract, wallet.account);
      setMessage(null);
    } catch (error) {
      setMessage({ kind: "error", text: decodeError(error) });
    }
  };

  const disconnect = async () => {
    if (!window.ethereum) return;
    setDisconnecting(true);
    setMessage(null);
    try {
      await window.ethereum.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
      setContract(null);
      setAccount("");
      setSnapshot(null);
      setHistory(null);
    } catch (error) {
      setMessage({ kind: "error", text: decodeError(error) });
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;

    void restoreWallet()
      .then(async (wallet) => {
        if (!wallet || !active) return;
        setContract(wallet.contract);
        setAccount(wallet.account);
        await refresh(wallet.contract, wallet.account);
      })
      .catch((error) => {
        if (active) setMessage({ kind: "error", text: decodeError(error) });
      })
      .finally(() => {
        if (active) setRestoring(false);
      });

    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!window.ethereum) return;
    const reload = () => window.location.reload();
    const provider = window.ethereum as unknown as { on?: (event: string, cb: () => void) => void };
    provider.on?.("accountsChanged", reload);
    provider.on?.("chainChanged", reload);
  }, []);

  const run = useCallback(
    async (label: string, send: () => Promise<{ wait: () => Promise<unknown> }>) => {
      if (!contract) return;
      setBusy(true);
      setMessage(null);
      try {
        const tx = await send();
        await tx.wait();
        await refresh(contract, account);
        setMessage({ kind: "ok", text: `${label} confirmado` });
      } catch (error) {
        setMessage({ kind: "error", text: decodeError(error) });
      } finally {
        setBusy(false);
      }
    },
    [contract, account, refresh],
  );

  const call = useMemo(
    () => ({
      deposit: (value: bigint) => contract!.deposit({ value }),
      withdraw: (amount: bigint) => contract!.withdraw(amount),
      heartbeat: () => contract!.heartbeat(),
      triggerInheritance: () => triggerViaWatcher(contract!),
      cancelTrigger: () => contract!.cancelTrigger(),
      claim: () => contract!.claim(),
    }),
    [contract],
  );

  const secondsLeft = snapshot ? Math.max(0, snapshot.secondsLeft - Math.floor((now - readAt) / 1000)) : 0;

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Herencia Digital</h1>
        <div className="row">
          <Badge>{CHAIN_NAME}</Badge>
          {snapshot && <Badge tone="accent">{ROLE_LABEL[snapshot.role]}</Badge>}
          {account ? (
            <>
              <span className="mono muted">{shortAddress(account)}</span>
              <Button disabled={disconnecting} onClick={disconnect}>
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </Button>
            </>
          ) : (
            <Button variant="primary" disabled={restoring} onClick={connect}>
              {restoring ? "Restaurando wallet..." : "Conectar wallet"}
            </Button>
          )}
        </div>
      </header>

      {!CONTRACT_ADDRESS && (
        <div className="banner banner--error">Falta VITE_CONTRACT_ADDRESS en .env.local</div>
      )}
      {message && <div className={`banner banner--${message.kind}`}>{message.text}</div>}

      {snapshot && (
        <>
          <div className="grid">
            <Stat
              title="Estado"
              value={snapshot.triggered ? "TRIGGERED" : "ACTIVE"}
              hint={`Contrato ${shortAddress(CONTRACT_ADDRESS)}`}
            />
            <Stat
              title="Balance"
              value={`${formatEther(snapshot.contractBalance)} ETH`}
              hint={snapshot.triggered ? `Congelado: ${formatEther(snapshot.inheritedBalance)} ETH` : undefined}
            />
            <Stat
              title={snapshot.triggered ? "Reclamos" : "Tiempo para activar"}
              value={snapshot.triggered ? `${snapshot.claimsCount}/${snapshot.heirs.length}` : formatDuration(secondsLeft)}
              hint={`Plazo: ${formatDuration(snapshot.inactivityPeriod)}`}
            />
          </div>
          <Card title="Herederos">
            <HeirList heirs={snapshot.heirs} me={account} />
          </Card>
          <Actions snapshot={snapshot} busy={busy} run={run} call={call} />
          <Card title="Historial">
            <History entries={history} error={historyError} nameOf={nameOf} />
          </Card>
        </>
      )}
    </main>
  );
}
