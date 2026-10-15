// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DigitalInheritance} from "../DigitalInheritance.sol";

/// @title TriggerAndClaimHeir
/// @notice Contrato usado SOLO en tests: se registra como heredero y, en una
///         única transacción, activa la herencia y reclama su parte. Sirve
///         para documentar que entre `triggerInheritance()` y el primer
///         `claim()` no hay ninguna ventana en la que el titular pueda
///         ejecutar `cancelTrigger()`.
/// @dev No forma parte del sistema en producción, vive en /contracts/mocks.
contract TriggerAndClaimHeir {
    DigitalInheritance public immutable target;

    constructor(address payable _target) {
        target = DigitalInheritance(_target);
    }

    function triggerAndClaim() external {
        target.triggerInheritance();
        target.claim();
    }

    receive() external payable {}
}
