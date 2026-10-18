// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {DigitalInheritance} from "./DigitalInheritance.sol";

/// @title InheritanceWatcher - Vigía de una herencia, compatible con Chainlink Automation
/// @notice Vigila un contrato `DigitalInheritance` y activa la herencia apenas vence el
///         plazo de inactividad del titular. Chainlink Automation consulta `checkUpkeep()`
///         fuera de la cadena y, cuando devuelve `true`, ejecuta `performUpkeep()`, que
///         llama a `triggerInheritance()`.
/// @dev Adaptador sin storage ni fondos: no custodia ETH, no tiene owner ni privilegios.
///      Tenerlo separado deja al contrato que custodia los fondos sin dependencias
///      externas: si Chainlink no está disponible, cualquiera puede seguir llamando
///      `triggerInheritance()` directamente.
///      Roles: cualquier cuenta o contrato (incluido el forwarder de Chainlink
///      Automation) puede llamar `trigger()` y `performUpkeep()`. La validación del
///      plazo y del estado la hace siempre `DigitalInheritance`.
///      Un watcher por herencia, coherente con que cada titular registre y fondee su
///      propio upkeep. Un watcher para varias herencias queda para Fase 2.
contract InheritanceWatcher is AutomationCompatibleInterface {
    /// @notice Contrato de herencia que vigila este watcher
    /// @dev `immutable`: se fija en el deploy y no ocupa storage
    DigitalInheritance public immutable inheritance;

    /// @notice Se activó la herencia a través del watcher
    /// @param caller Quien ejecutó la activación: una cuenta o el forwarder de Chainlink Automation
    /// @param timestamp Marca de tiempo del bloque
    event TriggeredViaWatcher(address indexed caller, uint256 timestamp);

    /// @notice Se intentó crear el watcher apuntando a la dirección cero
    error ZeroAddress();

    /// @notice Crea el watcher para una herencia ya desplegada
    /// @param inheritance_ Dirección del contrato `DigitalInheritance` a vigilar
    constructor(address payable inheritance_) {
        if (inheritance_ == address(0)) revert ZeroAddress();
        inheritance = DigitalInheritance(inheritance_);
    }

    // Orden de funciones por visibilidad: external, external view y public.

    /// @notice Lo ejecuta Chainlink Automation cuando `checkUpkeep()` devolvió `true`
    /// @dev El parámetro `performData` no se usa. No hace falta confiar en quien llama:
    ///      `triggerInheritance()` vuelve a validar el plazo y revierte si no corresponde.
    function performUpkeep(bytes calldata) external override {
        trigger();
    }

    /// @notice Lo consulta Chainlink Automation fuera de la cadena para saber si tiene que actuar
    /// @dev El parámetro `checkData` no se usa: el watcher ya sabe qué herencia vigila.
    /// @return upkeepNeeded `true` si la herencia puede activarse ahora
    /// @return performData Vacío: `performUpkeep()` no necesita datos
    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = inheritance.isTriggerable();
        performData = "";
    }

    /// @notice Activa la herencia vigilada
    /// @dev Permissionless, igual que `triggerInheritance()`. Es `public` porque también la
    ///      usa `performUpkeep()`. Si el plazo no venció o la herencia ya estaba activada,
    ///      el revert de `DigitalInheritance` (`TooEarly` o `InvalidState`) se propaga tal
    ///      cual. El evento se emite antes de la llamada externa: si la llamada revierte,
    ///      el evento se revierte con ella.
    function trigger() public {
        emit TriggeredViaWatcher(msg.sender, block.timestamp);
        inheritance.triggerInheritance();
    }
}
