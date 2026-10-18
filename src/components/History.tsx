import { formatEther } from "ethers";
import { formatDuration, shortAddress, txUrl, type HistoryEntry } from "../lib/inheritance";
import { Badge } from "./Badge";

interface HistoryProps {
  entries: HistoryEntry[] | null;
  error: string | null;
  /** Nombre legible de una dirección: "Titular", "Heredero 1", "InheritanceWatcher"... */
  nameOf: (address: string) => string;
}

function describe(entry: HistoryEntry, nameOf: (address: string) => string) {
  const who = entry.actor ? nameOf(entry.actor) : "";
  const eth = entry.amount !== undefined ? `${formatEther(entry.amount)} ETH` : "";
  switch (entry.kind) {
    case "deposit":
      return `${who} depositó ${eth}`;
    case "heartbeat":
      return `${who} hizo heartbeat (prueba de vida)`;
    case "heirs":
      return "Herederos configurados";
    case "period":
      return `Plazo de inactividad cambiado a ${formatDuration(entry.period ?? 0)}`;
    case "triggered":
      return entry.viaWatcher
        ? `${entry.watcherCaller ? nameOf(entry.watcherCaller) : "Alguien"} activó la herencia a través de InheritanceWatcher: ${eth} congelados para los herederos`
        : `${who} activó la herencia: ${eth} congelados para los herederos`;
    case "cancelled":
      return `${who} canceló la activación`;
    case "claimed":
      return `${who} cobró ${eth}`;
    case "withdrawn":
      return `${who} retiró ${eth}`;
    case "dust":
      return `Remanente de ${eth} enviado a ${who}`;
  }
}

export function History({ entries, error, nameOf }: HistoryProps) {
  if (error) return <p className="muted">No se pudo leer el historial: {error}</p>;
  if (!entries) return <p className="muted">Cargando historial...</p>;
  if (entries.length === 0) return <p className="muted">Todavía no hay movimientos.</p>;

  return (
    <ul className="history">
      {entries.map((entry) => {
        const url = txUrl(entry.txHash);
        return (
          <li className="history__item" key={entry.id}>
            <div className="history__main">
              <span>{describe(entry, nameOf)}</span>
              {entry.viaWatcher && <Badge tone="success">contrato → contrato</Badge>}
            </div>
            <div className="history__meta">
              <span className="muted">{new Date(entry.timestamp * 1000).toLocaleString()}</span>
              {url ? (
                <a className="mono" href={url} target="_blank" rel="noreferrer">
                  Ver en Etherscan {shortAddress(entry.txHash)}
                </a>
              ) : (
                <span className="mono muted">{shortAddress(entry.txHash)}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
