/** Mensajes legibles para los custom errors de DigitalInheritance. */
export const ERROR_MESSAGES: Record<string, string> = {
  NotOwner: "Solo el titular puede hacer esto.",
  InvalidState: "Esta acción no está disponible en el estado actual del contrato.",
  ArrayLengthMismatch: "La cantidad de herederos y de porcentajes no coincide.",
  NoHeirs: "Tenés que definir al menos un heredero.",
  InvalidPercentageSum: "Los porcentajes deben sumar exactamente 100.",
  ZeroPercentage: "Cada heredero tiene que tener al menos 1 %.",
  ZeroAddress: "Una de las direcciones es inválida (dirección cero).",
  DuplicateHeir: "Hay un heredero repetido en la lista.",
  PeriodTooShort: "El plazo es menor que el mínimo permitido.",
  TooEarly: "Todavía no pasó el plazo de inactividad.",
  ClaimsNotOpenYet: "Todavía no se puede cobrar: la ventana de impugnación sigue abierta.",
  NotHeir: "Esta wallet no es heredera.",
  AlreadyClaimed: "Esta wallet ya reclamó su parte.",
  InsufficientBalance: "El monto supera el saldo del contrato.",
  TransferFailed: "La transferencia de ETH falló.",
  DirectDepositNotAllowed: "Usá el botón Depositar: no se acepta ETH directo.",
  ClaimsAlreadyStarted: "Ya no se puede cancelar: un heredero ya cobró.",
  ReentrancyGuardReentrantCall: "Llamada reentrante bloqueada.",
};

/** Errores cuyo primer argumento son los segundos que faltan */
export const ERRORS_WITH_SECONDS = new Set(["TooEarly", "ClaimsNotOpenYet"]);
