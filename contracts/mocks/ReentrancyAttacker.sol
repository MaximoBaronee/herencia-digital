// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DigitalInheritance} from "../DigitalInheritance.sol";

/// @title ReentrancyAttacker
/// @notice Contrato usado SOLO en tests para verificar que `claim()` y `claimTo()`
///         resisten un intento de reentrancia. Se registra como heredero y, al
///         recibir ETH dentro del cobro, intenta volver a cobrar antes de que
///         termine la primera ejecución.
/// @dev No forma parte del sistema en producción, vive en /contracts/mocks.
contract ReentrancyAttacker {
    DigitalInheritance public immutable target;
    bool public attacked;
    bool public useClaimTo;

    constructor(address payable _target) {
        target = DigitalInheritance(_target);
    }

    function attack() external {
        target.claim();
    }

    function attackWithClaimTo() external {
        useClaimTo = true;
        target.claimTo(payable(address(this)));
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Intento de reentrada: en un contrato vulnerable esto drenaría fondos.
            // Con CEI + ReentrancyGuard, esta llamada debe revertir.
            if (useClaimTo) {
                target.claimTo(payable(address(this)));
            } else {
                target.claim();
            }
        }
    }
}
