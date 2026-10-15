// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DigitalInheritance} from "../DigitalInheritance.sol";

/// @title RejectingHeir
/// @notice Contrato usado SOLO en tests: se registra como heredero pero
///         rechaza todo el ETH que recibe. Sirve para verificar qué pasa
///         cuando la dirección de un heredero no puede cobrar (su `claim()`
///         revierte con `TransferFailed` y `sweepDust()` queda bloqueado).
/// @dev No forma parte del sistema en producción, vive en /contracts/mocks.
contract RejectingHeir {
    DigitalInheritance public immutable target;

    constructor(address payable _target) {
        target = DigitalInheritance(_target);
    }

    function claim() external {
        target.claim();
    }

    receive() external payable {
        revert("RejectingHeir: no acepta ETH");
    }
}
