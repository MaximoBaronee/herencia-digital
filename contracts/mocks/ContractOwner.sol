// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DigitalInheritance} from "../DigitalInheritance.sol";

/// @title ContractOwner
/// @notice Contrato usado SOLO en tests: despliega su propio `DigitalInheritance`, así
///         que es su titular. Al recibir ETH puede aceptarlo, rechazarlo o intentar
///         volver a entrar al contrato, para probar los caminos de `withdraw()` y
///         `sweepDust()` que una cuenta normal no puede provocar.
/// @dev No forma parte del sistema en producción, vive en /contracts/mocks.
contract ContractOwner {
    /// @notice Qué hace el contrato cuando recibe ETH
    enum Mode {
        Accept,
        Reject,
        Reenter
    }

    /// @notice Herencia de la que este contrato es titular
    DigitalInheritance public immutable inheritance;

    /// @notice Comportamiento actual al recibir ETH
    Mode public mode;

    /// @notice Despliega la herencia con este contrato como titular
    /// @param period Plazo de inactividad, en segundos
    /// @param delay Ventana de impugnación, en segundos
    /// @param heirs Direcciones de los herederos
    /// @param percentages Porcentaje de cada heredero
    constructor(uint40 period, uint40 delay, address[] memory heirs, uint8[] memory percentages) {
        inheritance = new DigitalInheritance(period, delay, heirs, percentages);
    }

    /// @notice Cambia el comportamiento al recibir ETH
    /// @param newMode Nuevo comportamiento
    function setMode(Mode newMode) external {
        mode = newMode;
    }

    /// @notice Deposita en la herencia el ETH recibido
    function deposit() external payable {
        inheritance.deposit{value: msg.value}();
    }

    /// @notice Retira fondos de la herencia como titular
    /// @param amount Monto a retirar, en wei
    function withdraw(uint256 amount) external {
        inheritance.withdraw(amount);
    }

    /// @notice Recupera el ETH no reservado de la herencia como titular
    /// @param to Destino del ETH
    function sweepDust(address payable to) external {
        inheritance.sweepDust(to);
    }

    /// @notice Acepta, rechaza o intenta reentrar según `mode`
    receive() external payable {
        if (mode == Mode.Reject) revert("ContractOwner: no acepta ETH");
        if (mode == Mode.Reenter) {
            // Intento de reentrada: `nonReentrant` tiene que bloquearlo
            if (inheritance.status() == DigitalInheritance.Status.ACTIVE) {
                inheritance.withdraw(0);
            } else {
                inheritance.sweepDust(payable(address(this)));
            }
        }
    }
}
