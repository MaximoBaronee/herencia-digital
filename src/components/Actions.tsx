import { useState } from "react";
import { parseEther } from "ethers";
import { Button } from "./Button";
import { Card } from "./Card";
import type { Snapshot } from "../lib/inheritance";

interface ActionsProps {
  snapshot: Snapshot;
  busy: boolean;
  run: (label: string, send: () => Promise<{ wait: () => Promise<unknown> }>) => Promise<void>;
  call: {
    deposit: (value: bigint) => Promise<{ wait: () => Promise<unknown> }>;
    withdraw: (amount: bigint) => Promise<{ wait: () => Promise<unknown> }>;
    heartbeat: () => Promise<{ wait: () => Promise<unknown> }>;
    triggerInheritance: () => Promise<{ wait: () => Promise<unknown> }>;
    cancelTrigger: () => Promise<{ wait: () => Promise<unknown> }>;
    claim: () => Promise<{ wait: () => Promise<unknown> }>;
  };
}

export function Actions({ snapshot, busy, run, call }: ActionsProps) {
  const [amount, setAmount] = useState("0.01");
  const isOwner = snapshot.role === "owner";
  const canClaim = snapshot.role === "heir" && snapshot.triggered && !snapshot.myClaimed;

  return (
    <Card title="Acciones">
      {isOwner && !snapshot.triggered && (
        <>
          <div className="row">
            <Button variant="primary" disabled={busy} onClick={() => run("Heartbeat", () => call.heartbeat())}>
              Heartbeat
            </Button>
          </div>
          <div className="row">
            <input
              className="input"
              value={amount}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              aria-label="Monto en ETH"
            />
            <Button disabled={busy} onClick={() => run("Depósito", () => call.deposit(parseEther(amount)))}>
              Depositar ETH
            </Button>
            <Button disabled={busy} onClick={() => run("Retiro", () => call.withdraw(parseEther(amount)))}>
              Retirar ETH
            </Button>
          </div>
        </>
      )}
      {isOwner && snapshot.triggered && (
        <Button disabled={busy || !snapshot.cancellable} onClick={() => run("Cancelar activación", () => call.cancelTrigger())}>
          Cancelar activación
        </Button>
      )}
      {!snapshot.triggered && (
        <Button disabled={busy || !snapshot.triggerable} onClick={() => run("Activar herencia", () => call.triggerInheritance())}>
          Activar herencia
        </Button>
      )}
      {snapshot.role === "heir" && (
        <Button variant="primary" disabled={busy || !canClaim} onClick={() => run("Reclamo", () => call.claim())}>
          {snapshot.myClaimed ? "Ya reclamaste" : "Reclamar mi parte"}
        </Button>
      )}
      {snapshot.role === "observer" && snapshot.triggered && (
        <span className="muted">Tu wallet no es titular ni heredera de este contrato.</span>
      )}
    </Card>
  );
}
