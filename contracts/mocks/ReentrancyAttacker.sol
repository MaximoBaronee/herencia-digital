// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DigitalInheritance} from "../DigitalInheritance.sol";

/// @title ReentrancyAttacker
/// @notice Contrato usado SOLO en tests para verificar que `claim()` resiste
///         un intento de reentrancia. Se registra como heredero y, al recibir
///         ETH dentro de `claim()`, intenta volver a llamar `claim()` antes de
///         que termine la primera ejecución.
/// @dev No forma parte del sistema en producción, vive en /contracts/mocks.
contract ReentrancyAttacker {
    DigitalInheritance public immutable target;
    bool public attacked;

    constructor(address payable _target) {
        target = DigitalInheritance(_target);
    }

    function attack() external {
        target.claim();
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Intento de reentrada: en un contrato vulnerable esto drenaría fondos.
            // Con CEI + ReentrancyGuard, esta llamada debe revertir.
            target.claim();
        }
    }
}
