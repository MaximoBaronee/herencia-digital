// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DigitalInheritance} from "../DigitalInheritance.sol";

/// @title RejectingHeir
/// @notice Contrato usado SOLO en tests: se registra como heredero pero
///         rechaza todo el ETH que recibe. Sirve para verificar que su
///         `claim()` revierte con `TransferFailed`, que puede cobrar igual
///         con `claimTo()` hacia otra dirección y que no bloquea a nadie más.
/// @dev No forma parte del sistema en producción, vive en /contracts/mocks.
contract RejectingHeir {
    DigitalInheritance public immutable target;

    constructor(address payable _target) {
        target = DigitalInheritance(_target);
    }

    function claim() external {
        target.claim();
    }

    function claimTo(address payable to) external {
        target.claimTo(to);
    }

    receive() external payable {
        revert("RejectingHeir: no acepta ETH");
    }
}
