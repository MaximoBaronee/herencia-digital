// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DigitalInheritance - Herencia digital con Dead Man's Switch
/// @notice Custodia ETH y lo distribuye automáticamente entre herederos designados
///         si el titular no confirma actividad (heartbeat) dentro de un plazo configurable.
/// @dev Patrón Checks-Effects-Interactions + ReentrancyGuard en toda función que
///      mueve valor. Structs y variables ordenadas para empaquetar storage y ahorrar gas.
contract DigitalInheritance is ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Tipos
    // ---------------------------------------------------------------------

    /// @notice Estado del ciclo de vida del contrato
    enum Status {
        ACTIVE,
        TRIGGERED
    }

    /// @notice Heredero y su porcentaje asignado (0-100)
    /// @dev `address` (20 bytes) + `uint8` (1 byte) empaquetan en un único slot de storage
    struct Heir {
        address account;
        uint8 percentage;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Dirección del titular, fijada una única vez en el deploy
    /// @dev `immutable`: se graba en el bytecode del contrato, no en storage.
    ///      Leerla no cuesta SLOAD (a diferencia del `Ownable` de OpenZeppelin,
    ///      que guarda el owner en storage porque permite transferirlo). Acá
    ///      no tiene sentido que el titular sea transferible, así que se gana
    ///      gas en las 7 funciones `onlyOwner` y se saca bytecode innecesario
    ///      (`transferOwnership`, `renounceOwnership`) del contrato deployado.
    address public immutable owner;

    /// @dev `status` + `lastHeartbeat` + `inactivityPeriod` empaquetan en un único
    ///      slot (1 + 5 + 5 = 11 bytes de 32) porque se declaran consecutivos y
    ///      cada uno entra en un tipo más chico que uint256.
    Status public status;
    uint40 public lastHeartbeat;
    uint40 public inactivityPeriod;

    /// @notice ETH depositado y aún no reclamado, según la contabilidad interna
    uint256 public depositBalance;

    /// @notice Snapshot del balance en el momento del trigger; es la base fija
    ///         sobre la que se calcula el monto de cada heredero (evita que el
    ///         orden de los claims afecte el monto de los que reclaman después)
    uint256 public inheritedBalance;

    Heir[] private _heirs;
    mapping(address => uint8) private _percentageOf;
    mapping(address => bool) private _isHeir;
    mapping(address => bool) public claimed;

    /// @notice Cantidad de herederos que ya reclamaron desde el último trigger.
    /// @dev Se usa para (a) saber si `cancelTrigger()` todavía es seguro y
    ///      (b) reemplazar el loop de `sweepDust()` por una comparación O(1).
    uint256 public claimsCount;

    uint8 private constant TOTAL_PERCENTAGE = 100;

    // ---------------------------------------------------------------------
    // Eventos
    // ---------------------------------------------------------------------

    /// @notice Se depositó ETH en el contrato
    /// @param from Quien depositó (siempre el titular)
    /// @param amount Monto depositado en wei
    /// @param timestamp Marca de tiempo del bloque
    event Deposited(address indexed from, uint256 amount, uint256 timestamp);
    /// @notice El titular confirmó actividad
    /// @param owner Titular del contrato
    /// @param timestamp Marca de tiempo del bloque
    event Heartbeat(address indexed owner, uint256 timestamp);
    /// @notice Se reemplazó la lista de herederos
    /// @param heirs Direcciones de los herederos
    /// @param percentages Porcentaje de cada heredero, en el mismo orden
    /// @param timestamp Marca de tiempo del bloque
    event HeirsUpdated(address[] heirs, uint8[] percentages, uint256 timestamp);
    /// @notice Se cambió el período de inactividad
    /// @param newPeriod Nuevo período en segundos
    /// @param timestamp Marca de tiempo del bloque
    event InactivityPeriodUpdated(uint40 newPeriod, uint256 timestamp);
    /// @notice Se activó la herencia y se congeló el balance a repartir
    /// @param timestamp Marca de tiempo del bloque
    /// @param triggeredBy Quien ejecutó la activación
    /// @param totalBalance Balance congelado para el reparto, en wei
    event InheritanceTriggered(uint256 timestamp, address indexed triggeredBy, uint256 totalBalance);
    /// @notice El titular canceló una activación hecha antes de que cobrara algún heredero
    /// @param owner Titular del contrato
    /// @param timestamp Marca de tiempo del bloque
    event TriggerCancelled(address indexed owner, uint256 timestamp);
    /// @notice Un heredero cobró su porción
    /// @param heir Heredero que cobró
    /// @param amount Monto cobrado en wei
    /// @param timestamp Marca de tiempo del bloque
    event Claimed(address indexed heir, uint256 amount, uint256 timestamp);
    /// @notice El titular retiró fondos
    /// @param owner Titular del contrato
    /// @param amount Monto retirado en wei
    /// @param timestamp Marca de tiempo del bloque
    event Withdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    /// @notice El titular recuperó el remanente por redondeo
    /// @param to Destino del remanente
    /// @param amount Monto transferido en wei
    /// @param timestamp Marca de tiempo del bloque
    event DustSwept(address indexed to, uint256 amount, uint256 timestamp);

    // ---------------------------------------------------------------------
    // Errores personalizados (más baratos en gas que require con string)
    // ---------------------------------------------------------------------

    /// @notice La función no puede ejecutarse en el estado actual
    /// @param current Estado actual
    /// @param required Estado requerido
    error InvalidState(Status current, Status required);
    /// @notice Los arrays de herederos y porcentajes tienen distinto largo
    error ArrayLengthMismatch();
    /// @notice La lista de herederos está vacía
    error NoHeirs();
    /// @notice Los porcentajes no suman exactamente 100
    /// @param sum Suma recibida
    error InvalidPercentageSum(uint256 sum);
    /// @notice Se intentó usar la dirección cero
    error ZeroAddress();
    /// @notice La misma dirección figura más de una vez como heredero
    /// @param heir Dirección repetida
    error DuplicateHeir(address heir);
    /// @notice Todavía no se cumplió el período de inactividad
    /// @param secondsRemaining Segundos que faltan
    error TooEarly(uint256 secondsRemaining);
    /// @notice El llamador no es heredero
    error NotHeir();
    /// @notice El heredero ya cobró
    error AlreadyClaimed();
    /// @notice El monto pedido supera el balance disponible
    /// @param requested Monto pedido
    /// @param available Monto disponible
    error InsufficientBalance(uint256 requested, uint256 available);
    /// @notice Falló la transferencia de ETH
    error TransferFailed();
    /// @notice Todavía hay herederos que no cobraron
    error NotAllHeirsClaimed();
    /// @notice Solo el titular puede enviar ETH directamente al contrato
    error DirectDepositNotAllowed();
    /// @notice Ya hubo al menos un claim, la activación no se puede cancelar
    error ClaimsAlreadyStarted();
    /// @notice El llamador no es el titular
    error NotOwner();

    // ---------------------------------------------------------------------
    // Modificadores
    // ---------------------------------------------------------------------

    /// @dev Restringe la ejecución al titular
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev Exige que el contrato esté en estado ACTIVE
    modifier whenActive() {
        if (status != Status.ACTIVE) revert InvalidState(status, Status.ACTIVE);
        _;
    }

    /// @dev Exige que el contrato esté en estado TRIGGERED
    modifier whenTriggered() {
        if (status != Status.TRIGGERED) revert InvalidState(status, Status.TRIGGERED);
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @notice Despliega el contrato y define el set inicial de herederos
    /// @param initialInactivityPeriod Segundos de inactividad tolerados antes de poder activar la herencia
    /// @param heirAddresses Direcciones de los herederos iniciales
    /// @param percentages Porcentajes asociados a cada heredero (deben sumar 100)
    constructor(
        uint40 initialInactivityPeriod,
        address[] memory heirAddresses,
        uint8[] memory percentages
    ) {
        owner = msg.sender;
        inactivityPeriod = initialInactivityPeriod;
        lastHeartbeat = uint40(block.timestamp);
        status = Status.ACTIVE;
        _setHeirs(heirAddresses, percentages);
    }

    // ---------------------------------------------------------------------
    // Depósitos
    // ---------------------------------------------------------------------

    /// @notice Permite al titular depositar ETH en el contrato
    function deposit() external payable onlyOwner {
        _deposit();
    }

    /// @dev Acepta ETH enviado directamente (sin llamar a `deposit()`) solo si viene del titular.
    ///      Evita que fondos de terceros entren sin ser contabilizados como herencia.
    receive() external payable {
        if (msg.sender != owner) revert DirectDepositNotAllowed();
        _deposit();
    }

    /// @dev Contabiliza el ETH recibido y emite `Deposited`
    function _deposit() private {
        depositBalance += msg.value;
        emit Deposited(msg.sender, msg.value, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Heartbeat
    // ---------------------------------------------------------------------

    /// @notice El titular confirma que sigue activo y reinicia el temporizador de inactividad
    function heartbeat() external onlyOwner whenActive {
        lastHeartbeat = uint40(block.timestamp);
        emit Heartbeat(msg.sender, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Administración de herederos y plazo
    // ---------------------------------------------------------------------

    /// @notice Reemplaza la lista de herederos y sus porcentajes
    /// @dev Solo puede llamarse mientras el contrato esté ACTIVE
    /// @param heirAddresses Direcciones de los nuevos herederos
    /// @param percentages Porcentaje de cada heredero, en el mismo orden (deben sumar 100)
    function setHeirs(address[] calldata heirAddresses, uint8[] calldata percentages)
        external
        onlyOwner
        whenActive
    {
        _setHeirs(heirAddresses, percentages);
    }

    /// @dev Valida y guarda la lista de herederos: sin duplicados, sin dirección cero y con porcentajes que suman 100
    function _setHeirs(address[] memory heirAddresses, uint8[] memory percentages) private {
        uint256 len = heirAddresses.length;
        if (len == 0) revert NoHeirs();
        if (len != percentages.length) revert ArrayLengthMismatch();

        // Limpia el set anterior de herederos (mappings auxiliares) antes de cargar el nuevo
        uint256 oldLen = _heirs.length;
        for (uint256 i = 0; i < oldLen; ) {
            address old = _heirs[i].account;
            delete _isHeir[old];
            delete _percentageOf[old];
            // `i` está acotado por `oldLen` (cantidad de herederos, siempre chica);
            // nunca desborda uint256, así que el chequeo de overflow de Solidity
            // 0.8 en el incremento es gasto innecesario en cada vuelta.
            unchecked {
                ++i;
            }
        }
        delete _heirs;

        uint256 sum;
        for (uint256 i = 0; i < len; ) {
            address account = heirAddresses[i];
            uint8 pct = percentages[i];

            if (account == address(0)) revert ZeroAddress();
            if (_isHeir[account]) revert DuplicateHeir(account);

            _isHeir[account] = true;
            _percentageOf[account] = pct;
            _heirs.push(Heir({account: account, percentage: pct}));
            sum += pct;
            unchecked {
                ++i;
            }
        }

        if (sum != TOTAL_PERCENTAGE) revert InvalidPercentageSum(sum);

        emit HeirsUpdated(heirAddresses, percentages, block.timestamp);
    }

    /// @notice Actualiza el período de inactividad tolerado antes de poder activar la herencia
    /// @param newPeriod Nuevo período de inactividad, en segundos
    function setInactivityPeriod(uint40 newPeriod) external onlyOwner whenActive {
        inactivityPeriod = newPeriod;
        emit InactivityPeriodUpdated(newPeriod, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Retiro por el titular
    // ---------------------------------------------------------------------

    /// @notice El titular retira parcial o totalmente los fondos depositados
    /// @param amount Monto a retirar, en wei
    function withdraw(uint256 amount) external onlyOwner nonReentrant whenActive {
        if (amount > depositBalance) revert InsufficientBalance(amount, depositBalance);

        // Effects
        depositBalance -= amount;

        // Interactions
        (bool ok, ) = payable(owner).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, amount, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Trigger de herencia
    // ---------------------------------------------------------------------

    /// @notice Activa la herencia si se cumplió el período de inactividad
    /// @dev Se deja permissionless a propósito: cualquiera (típicamente un heredero)
    ///      puede vigilar el contrato y dispararlo, sin depender de un oráculo
    ///      centralizado ni de que el titular haga algo. En Fase 2 se contempla
    ///      integrar Chainlink Automation para automatizarlo por completo.
    function triggerInheritance() external whenActive {
        uint256 deadline = uint256(lastHeartbeat) + uint256(inactivityPeriod);
        if (block.timestamp <= deadline) {
            revert TooEarly(deadline - block.timestamp);
        }
        if (_heirs.length == 0) revert NoHeirs();

        status = Status.TRIGGERED;
        inheritedBalance = depositBalance;

        emit InheritanceTriggered(block.timestamp, msg.sender, inheritedBalance);
    }

    /// @notice Permite al titular cancelar una herencia disparada por error
    ///         (ej. viaje largo, pérdida temporal de señal) y volver el
    ///         contrato a ACTIVE, siempre que ningún heredero haya cobrado aún.
    /// @dev Decisión de diseño deliberada: una vez que hubo un primer `claim()`,
    ///      la cancelación queda bloqueada para siempre (ver `ClaimsAlreadyStarted`).
    ///      Permitir cancelar después de un claim dejaría al contrato con una
    ///      contabilidad inconsistente (ese heredero ya se llevó ETH que
    ///      correspondía solo si la herencia era real) y crearía un incentivo
    ///      perverso: a un heredero le convendría reclamar apenas ve el trigger,
    ///      aunque sospeche que es una falsa alarma, para asegurarse su parte
    ///      antes de que el titular llegue a cancelar. Tratar el primer claim
    ///      como punto de no retorno elimina esa carrera. El llamado a esta
    ///      función también cuenta como prueba de vida: reinicia `lastHeartbeat`,
    ///      igual que `heartbeat()`.
    function cancelTrigger() external onlyOwner whenTriggered {
        if (claimsCount > 0) revert ClaimsAlreadyStarted();

        status = Status.ACTIVE;
        lastHeartbeat = uint40(block.timestamp);
        inheritedBalance = 0;

        emit TriggerCancelled(msg.sender, block.timestamp);
    }

    /// @notice true si `cancelTrigger()` puede ejecutarse en este momento
    /// @return `true` si el contrato está TRIGGERED y nadie reclamó todavía
    function canCancelTrigger() external view returns (bool) {
        return status == Status.TRIGGERED && claimsCount == 0;
    }

    // ---------------------------------------------------------------------
    // Reclamo por herederos
    // ---------------------------------------------------------------------

    /// @notice Un heredero reclama la porción de ETH que le corresponde
    function claim() external nonReentrant whenTriggered {
        if (!_isHeir[msg.sender]) revert NotHeir();
        if (claimed[msg.sender]) revert AlreadyClaimed();

        uint256 amount = (inheritedBalance * _percentageOf[msg.sender]) / TOTAL_PERCENTAGE;

        // Effects (antes de la interacción externa: Checks-Effects-Interactions)
        claimed[msg.sender] = true;
        claimsCount += 1;
        depositBalance -= amount;

        // Interactions
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Claimed(msg.sender, amount, block.timestamp);
    }

    /// @notice Una vez que todos los herederos reclamaron, envía al titular el
    ///         remanente que pudo quedar en el contrato por redondeo entero de
    ///         porcentajes (ej. 33/33/34 sobre montos no divisibles exactos)
    /// @param to Destino del remanente
    function sweepDust(address payable to) external onlyOwner nonReentrant whenTriggered {
        if (to == address(0)) revert ZeroAddress();
        if (claimsCount != _heirs.length) revert NotAllHeirsClaimed();

        uint256 amount = depositBalance;
        depositBalance = 0;

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit DustSwept(to, amount, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Vistas
    // ---------------------------------------------------------------------

    /// @notice Devuelve la lista completa de herederos actuales
    /// @return Arreglo de herederos con su porcentaje
    function getHeirs() external view returns (Heir[] memory) {
        return _heirs;
    }

    /// @notice Cantidad de herederos configurados
    /// @return Largo de la lista de herederos
    function getHeirCount() external view returns (uint256) {
        return _heirs.length;
    }

    /// @notice Porcentaje asignado a una dirección
    /// @param account Dirección a consultar
    /// @return Porcentaje (0 si no es heredero)
    function percentageOf(address account) external view returns (uint8) {
        return _percentageOf[account];
    }

    /// @notice Indica si una dirección es heredera
    /// @param account Dirección a consultar
    /// @return `true` si figura en la lista de herederos
    function isHeir(address account) external view returns (bool) {
        return _isHeir[account];
    }

    /// @notice Segundos restantes hasta que `triggerInheritance()` sea ejecutable (0 si ya se puede)
    /// @return Segundos restantes
    function timeUntilTrigger() external view returns (uint256) {
        uint256 deadline = uint256(lastHeartbeat) + uint256(inactivityPeriod);
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    /// @notice Indica si `triggerInheritance()` puede ejecutarse ahora
    /// @return `true` si está ACTIVE, venció el plazo y hay herederos
    function isTriggerable() external view returns (bool) {
        uint256 deadline = uint256(lastHeartbeat) + uint256(inactivityPeriod);
        return status == Status.ACTIVE && block.timestamp > deadline && _heirs.length > 0;
    }

    /// @notice Balance real en ETH que tiene el contrato (para contrastar contra `depositBalance`)
    /// @return Balance en wei
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
