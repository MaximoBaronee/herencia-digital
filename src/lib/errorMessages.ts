/** Mensajes legibles para los custom errors de DigitalInheritance. */
export const ERROR_MESSAGES: Record<string, string> = {
  NotOwner: "Solo el titular puede hacer esto.",
  InvalidState: "Esta acción no está disponible en el estado actual del contrato.",
  ArrayLengthMismatch: "La cantidad de herederos y de porcentajes no coincide.",
  NoHeirs: "Tenés que definir al menos un heredero.",
  InvalidPercentageSum: "Los porcentajes deben sumar exactamente 100.",
  ZeroAddress: "Una de las direcciones es inválida (dirección cero).",
  DuplicateHeir: "Hay un heredero repetido en la lista.",
  TooEarly: "Todavía no pasó el plazo de inactividad.",
  NotHeir: "Esta wallet no es heredera.",
  AlreadyClaimed: "Esta wallet ya reclamó su parte.",
  InsufficientBalance: "El monto supera el saldo depositado.",
  TransferFailed: "La transferencia de ETH falló.",
  NotAllHeirsClaimed: "Todavía quedan herederos sin reclamar.",
  DirectDepositNotAllowed: "Usá el botón Depositar: no se acepta ETH directo.",
  ClaimsAlreadyStarted: "Ya no se puede cancelar: un heredero ya cobró.",
  ReentrancyGuardReentrantCall: "Llamada reentrante bloqueada.",
};
