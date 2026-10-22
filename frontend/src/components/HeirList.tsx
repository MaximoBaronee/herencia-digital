import { shortAddress, type Heir } from "../lib/inheritance";

interface HeirListProps {
  heirs: Heir[];
  me: string;
}

export function HeirList({ heirs, me }: HeirListProps) {
  return (
    <ul className="heirs">
      {heirs.map((heir) => (
        <li className="heirs__item" key={heir.account}>
          <span className="mono">
            {shortAddress(heir.account)}
            {heir.account.toLowerCase() === me.toLowerCase() ? " (tú)" : ""}
          </span>
          <span className="mono">{heir.percentage}%</span>
        </li>
      ))}
    </ul>
  );
}
