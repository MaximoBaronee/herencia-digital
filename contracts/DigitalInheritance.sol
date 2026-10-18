// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DigitalInheritance - Herencia digital con Dead Man's Switch
/// @notice Custodia ETH y lo distribuye entre herederos designados si el titular no
///         confirma actividad (heartbeat) dentro de un plazo configurable.
/// @dev Patrón Checks-Effects-Interactions + ReentrancyGuard en toda función que
///      mueve valor. Todo el estado de control entra en un único slot de storage.
///      Flujo: ACTIVE --(vence el plazo de inactividad)--> TRIGGERED --(se cierra la
///      ventana de impugnación)--> cobros de los herederos.
///      Roles:
///      - Titular (`owner`): deposita, retira, hace heartbeat, configura herederos y
///        plazos, cancela una activación mientras nadie cobró y recupera el ETH que no
///        está reservado para los herederos.
///      - Herederos: cobran su porcentaje una vez cerrada la ventana de impugnación.
///      - Cualquier cuenta o contrato (por ejemplo `InheritanceWatcher`): activa la
///        herencia cuando venció el plazo de inactividad.
contract DigitalInheritance is ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Tipos
    // ---------------------------------------------------------------------

    /// @notice Estado del ciclo de vida del contrato
    enum Status {
        ACTIVE,
        TRIGGERED
    }

    /// @notice Heredero y su porcentaje, tal como los devuelve `getHeirs()`
    struct Heir {
        address account;
        uint8 percentage;
    }

    /// @notice Datos de un heredero guardados en storage
    /// @dev `uint8` + `bool` empaquetan en un único slot: `claim()` lee y escribe un solo slot
    struct HeirInfo {
        uint8 percentage;
        bool claimed;
    }

    // ---------------------------------------------------------------------
    // Constantes
    // ---------------------------------------------------------------------

    /// @notice Plazo de inactividad mínimo, para que la herencia nunca pueda activarse de inmediato
    uint40 public constant MIN_INACTIVITY_PERIOD = 5 minutes;

    /// @notice Ventana de impugnación mínima entre la activación y el primer cobro
    uint40 public constant MIN_CLAIM_DELAY = 1 minutes;

    /// @dev Base de los porcentajes: la suma de los herederos debe dar exactamente este valor
    uint8 private constant TOTAL_PERCENTAGE = 100;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Dirección del titular, fijada una única vez en el deploy
    /// @dev `immutable`: se graba en el bytecode del contrato, no en storage.
    ///      Leerla no cuesta SLOAD (a diferencia del `Ownable` de OpenZeppelin,
    ///      que guarda el owner en storage porque permite transferirlo). Acá
    ///      no tiene sentido que el titular sea transferible, así que se gana
    ///      gas en cada función `onlyOwner` y se saca bytecode innecesario
    ///      (`transferOwnership`, `renounceOwnership`) del contrato deployado.
    address public immutable owner;

    /// @notice Estado del ciclo de vida: ACTIVE mientras corre el plazo, TRIGGERED
    ///         una vez activada la herencia
    /// @dev Las siete variables de estado de control se declaran seguidas y en tipos
    ///      chicos para compartir un único slot: 1 + 5 + 5 + 5 + 5 + 1 + 1 = 23 bytes de 32.
    Status public status;

    /// @notice Timestamp (segundos Unix) de la última prueba de vida del titular:
    ///         el deploy, `heartbeat()` o `cancelTrigger()`
    /// @dev `uint40` alcanza para timestamps hasta el año ~36.800
    uint40 public lastHeartbeat;

    /// @notice Segundos de inactividad tolerados desde `lastHeartbeat` antes de que
    ///         cualquiera pueda activar la herencia
    uint40 public inactivityPeriod;

    /// @notice Timestamp de la activación de la herencia; 0 mientras está ACTIVE
    uint40 public triggeredAt;

    /// @notice Ventana de impugnación: segundos entre la activación y el primer cobro posible.
    ///         Durante ese tiempo el titular puede cancelar una activación por error.
    uint40 public claimDelay;

    /// @notice Cantidad de herederos que ya cobraron desde la última activación
    /// @dev Cabe en `uint8`: cada heredero tiene al menos 1 % y la suma es 100, así que
    ///      nunca hay más de 100 herederos.
    uint8 public claimsCount;

    /// @dev Suma de los porcentajes de los herederos que todavía no cobraron. Vale 100
    ///      al activar la herencia y baja con cada cobro. Define cuánto ETH queda
    ///      reservado para los herederos (ver `_reservedForHeirs()`).
    uint8 private _unclaimedPercentage;

    /// @notice Balance congelado en el momento de la activación; es la base fija sobre
    ///         la que se calcula el monto de cada heredero (evita que el orden de los
    ///         cobros cambie lo que recibe cada uno)
    uint256 public inheritedBalance;

    /// @dev Direcciones de los herederos en el orden en que se cargaron. Solo se recorre
    ///      en `_setHeirs()` (para limpiar el set anterior) y en `getHeirs()`.
    address[] private _heirAccounts;

    /// @dev Porcentaje y estado de cobro de cada heredero, en un solo slot por dirección.
    ///      Es la única copia del porcentaje: un porcentaje 0 significa "no es heredero".
    mapping(address => HeirInfo) private _heirInfo;

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
    /// @notice Se cambió la ventana de impugnación
    /// @param newDelay Nueva ventana en segundos
    /// @param timestamp Marca de tiempo del bloque
    event ClaimDelayUpdated(uint40 newDelay, uint256 timestamp);
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
    /// @param to Dirección que recibió el ETH (el heredero, o la que eligió con `claimTo()`)
    /// @param amount Monto cobrado en wei
    /// @param timestamp Marca de tiempo del bloque
    event Claimed(address indexed heir, address indexed to, uint256 amount, uint256 timestamp);
    /// @notice El titular retiró fondos
    /// @param owner Titular del contrato
    /// @param amount Monto retirado en wei
    /// @param timestamp Marca de tiempo del bloque
    event Withdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    /// @notice El titular recuperó el ETH que no está reservado para los herederos
    /// @param to Destino del ETH recuperado
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
    /// @notice Un heredero tiene porcentaje 0
    /// @param heir Dirección con porcentaje 0
    error ZeroPercentage(address heir);
    /// @notice Se intentó usar la dirección cero
    error ZeroAddress();
    /// @notice La misma dirección figura más de una vez como heredero
    /// @param heir Dirección repetida
    error DuplicateHeir(address heir);
    /// @notice El plazo es menor que el mínimo permitido
    /// @param provided Plazo recibido, en segundos
    /// @param minimum Plazo mínimo, en segundos
    error PeriodTooShort(uint256 provided, uint256 minimum);
    /// @notice Todavía no se cumplió el período de inactividad
    /// @param secondsRemaining Segundos que faltan
    error TooEarly(uint256 secondsRemaining);
    /// @notice La ventana de impugnación sigue abierta: todavía no se puede cobrar
    /// @param secondsRemaining Segundos que faltan para poder cobrar
    error ClaimsNotOpenYet(uint256 secondsRemaining);
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
    /// @notice Solo el titular puede enviar ETH directamente al contrato
    error DirectDepositNotAllowed();
    /// @notice Ya hubo al menos un cobro, la activación no se puede cancelar
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

    /// @dev Exige que el contrato esté en estado ACTIVE. Lee `status` una sola vez.
    modifier whenActive() {
        Status current = status;
        if (current != Status.ACTIVE) revert InvalidState(current, Status.ACTIVE);
        _;
    }

    /// @dev Exige que el contrato esté en estado TRIGGERED. Lee `status` una sola vez.
    modifier whenTriggered() {
        Status current = status;
        if (current != Status.TRIGGERED) revert InvalidState(current, Status.TRIGGERED);
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor y receive
    // ---------------------------------------------------------------------

    /// @notice Despliega el contrato y define el set inicial de herederos
    /// @dev El estado arranca en ACTIVE, que es el valor por defecto del enum.
    /// @param initialInactivityPeriod Segundos de inactividad tolerados antes de poder activar la herencia
    /// @param initialClaimDelay Segundos de la ventana de impugnación entre la activación y el primer cobro
    /// @param heirAddresses Direcciones de los herederos iniciales
    /// @param percentages Porcentajes asociados a cada heredero (cada uno al menos 1, deben sumar 100)
    constructor(
        uint40 initialInactivityPeriod,
        uint40 initialClaimDelay,
        address[] memory heirAddresses,
        uint8[] memory percentages
    ) {
        _checkPeriod(initialInactivityPeriod, MIN_INACTIVITY_PERIOD);
        _checkPeriod(initialClaimDelay, MIN_CLAIM_DELAY);
        owner = msg.sender;
        inactivityPeriod = initialInactivityPeriod;
        claimDelay = initialClaimDelay;
        lastHeartbeat = uint40(block.timestamp);
        _setHeirs(heirAddresses, percentages);
    }

    /// @notice Acepta ETH enviado directamente (sin llamar a `deposit()`), solo del titular
    ///         y solo mientras la herencia no está activada
    /// @dev Evita que entren fondos de terceros como si fueran parte de la herencia.
    receive() external payable whenActive {
        if (msg.sender != owner) revert DirectDepositNotAllowed();
        emit Deposited(msg.sender, msg.value, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Funciones externas
    // ---------------------------------------------------------------------

    /// @notice Permite al titular depositar ETH en el contrato
    /// @dev Solo el titular y solo en ACTIVE. No escribe storage: el saldo de la herencia
    ///      es el balance real del contrato.
    function deposit() external payable onlyOwner whenActive {
        emit Deposited(msg.sender, msg.value, block.timestamp);
    }

    /// @notice El titular confirma que sigue activo y reinicia el temporizador de inactividad
    /// @dev Solo el titular y solo en ACTIVE. Con la herencia ya activada, la prueba
    ///      de vida es `cancelTrigger()`.
    function heartbeat() external onlyOwner whenActive {
        lastHeartbeat = uint40(block.timestamp);
        emit Heartbeat(msg.sender, block.timestamp);
    }

    /// @notice Reemplaza la lista de herederos y sus porcentajes
    /// @dev Solo el titular, y solo mientras el contrato esté ACTIVE. Recibe `calldata`
    ///      y lo pasa a `_setHeirs()`, que trabaja en `memory` porque también la usa el
    ///      constructor, donde `calldata` no existe: es una copia chica y evita duplicar
    ///      la validación.
    /// @param heirAddresses Direcciones de los nuevos herederos
    /// @param percentages Porcentaje de cada heredero, en el mismo orden (cada uno al menos 1, deben sumar 100)
    function setHeirs(address[] calldata heirAddresses, uint8[] calldata percentages)
        external
        onlyOwner
        whenActive
    {
        _setHeirs(heirAddresses, percentages);
    }

    /// @notice Actualiza el período de inactividad tolerado antes de poder activar la herencia
    /// @dev Solo el titular, y solo mientras el contrato esté ACTIVE.
    /// @param newPeriod Nuevo período de inactividad, en segundos (al menos `MIN_INACTIVITY_PERIOD`)
    function setInactivityPeriod(uint40 newPeriod) external onlyOwner whenActive {
        _checkPeriod(newPeriod, MIN_INACTIVITY_PERIOD);
        inactivityPeriod = newPeriod;
        emit InactivityPeriodUpdated(newPeriod, block.timestamp);
    }

    /// @notice Actualiza la ventana de impugnación entre la activación y el primer cobro
    /// @dev Solo el titular, y solo mientras el contrato esté ACTIVE: una activación en
    ///      curso conserva la ventana con la que empezó.
    /// @param newDelay Nueva ventana, en segundos (al menos `MIN_CLAIM_DELAY`)
    function setClaimDelay(uint40 newDelay) external onlyOwner whenActive {
        _checkPeriod(newDelay, MIN_CLAIM_DELAY);
        claimDelay = newDelay;
        emit ClaimDelayUpdated(newDelay, block.timestamp);
    }

    /// @notice El titular retira parcial o totalmente los fondos del contrato
    /// @dev Solo el titular y solo en ACTIVE: una vez activada la herencia, los
    ///      fondos quedan reservados para los herederos.
    /// @param amount Monto a retirar, en wei
    function withdraw(uint256 amount) external onlyOwner nonReentrant whenActive {
        // Checks
        uint256 available = address(this).balance;
        if (amount > available) revert InsufficientBalance(amount, available);

        // Effects: no hay saldo interno que actualizar, el evento se emite antes de la llamada
        emit Withdrawn(msg.sender, amount, block.timestamp);

        // Interactions
        (bool ok, ) = payable(owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Activa la herencia si se cumplió el período de inactividad
    /// @dev Se deja permissionless a propósito: cualquiera (típicamente un heredero)
    ///      puede vigilar el contrato y dispararlo, sin depender de un oráculo
    ///      centralizado ni de que el titular haga algo. `InheritanceWatcher` lo
    ///      llama para que ocurra apenas vence el plazo, sin que este contrato
    ///      dependa de Chainlink. Congela el balance y abre la ventana de impugnación.
    function triggerInheritance() external whenActive {
        uint256 deadline = uint256(lastHeartbeat) + uint256(inactivityPeriod);
        if (block.timestamp <= deadline) {
            revert TooEarly(deadline - block.timestamp);
        }

        uint256 snapshot = address(this).balance;
        status = Status.TRIGGERED;
        triggeredAt = uint40(block.timestamp);
        _unclaimedPercentage = TOTAL_PERCENTAGE;
        inheritedBalance = snapshot;

        emit InheritanceTriggered(block.timestamp, msg.sender, snapshot);
    }

    /// @notice Permite al titular cancelar una herencia disparada por error
    ///         (ej. viaje largo, pérdida temporal de señal) y volver el
    ///         contrato a ACTIVE, siempre que ningún heredero haya cobrado aún.
    /// @dev La ventana de impugnación (`claimDelay`) garantiza que el titular siempre
    ///      tenga tiempo para cancelar: nadie puede cobrar en la misma transacción ni
    ///      en el mismo bloque de la activación. Una vez que hubo un primer cobro, la
    ///      cancelación queda bloqueada para siempre (ver `ClaimsAlreadyStarted`).
    ///      Permitir cancelar después de un cobro dejaría al contrato con una
    ///      contabilidad inconsistente (ese heredero ya se llevó ETH que
    ///      correspondía solo si la herencia era real). Tratar el primer cobro
    ///      como punto de no retorno elimina esa carrera. El llamado a esta
    ///      función también cuenta como prueba de vida: reinicia `lastHeartbeat`,
    ///      igual que `heartbeat()`.
    function cancelTrigger() external onlyOwner whenTriggered {
        if (claimsCount != 0) revert ClaimsAlreadyStarted();

        status = Status.ACTIVE;
        lastHeartbeat = uint40(block.timestamp);
        triggeredAt = 0;
        _unclaimedPercentage = 0;
        inheritedBalance = 0;

        emit TriggerCancelled(msg.sender, block.timestamp);
    }

    /// @notice Un heredero cobra la porción de ETH que le corresponde
    /// @dev Solo herederos del set actual, una vez cada uno, en TRIGGERED y con la
    ///      ventana de impugnación cerrada. Monto: `inheritedBalance * porcentaje / 100`.
    function claim() external nonReentrant whenTriggered {
        _claim(payable(msg.sender));
    }

    /// @notice Como `claim()`, pero el ETH va a otra dirección elegida por el heredero
    /// @dev Sirve si la dirección del heredero no puede recibir ETH (por ejemplo, un
    ///      contrato sin `receive`): su parte no queda bloqueada.
    /// @param to Dirección que recibe el ETH
    function claimTo(address payable to) external nonReentrant whenTriggered {
        if (to == address(0)) revert ZeroAddress();
        _claim(to);
    }

    /// @notice Envía a `to` el ETH que no está reservado para los herederos: los restos
    ///         de redondeo y el ETH que haya llegado por fuera de `deposit()`
    /// @dev Solo el titular y solo en TRIGGERED. No necesita que todos hayan cobrado:
    ///      la parte de quien todavía no cobró sigue reservada (ver `_reservedForHeirs()`),
    ///      así que un heredero que nunca cobra no bloquea el barrido.
    /// @param to Destino del ETH recuperado
    function sweepDust(address payable to) external onlyOwner nonReentrant whenTriggered {
        if (to == address(0)) revert ZeroAddress();

        uint256 amount = address(this).balance - _reservedForHeirs();
        emit DustSwept(to, amount, block.timestamp);

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ---------------------------------------------------------------------
    // Funciones externas de lectura
    // ---------------------------------------------------------------------

    /// @notice Devuelve la lista completa de herederos actuales
    /// @return heirs Arreglo de herederos con su porcentaje, en el orden en que se cargaron
    function getHeirs() external view returns (Heir[] memory heirs) {
        uint256 len = _heirAccounts.length;
        heirs = new Heir[](len);
        for (uint256 i = 0; i < len; ) {
            address account = _heirAccounts[i];
            heirs[i] = Heir({account: account, percentage: _heirInfo[account].percentage});
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Cantidad de herederos configurados
    /// @return Largo de la lista de herederos
    function getHeirCount() external view returns (uint256) {
        return _heirAccounts.length;
    }

    /// @notice Porcentaje asignado a una dirección
    /// @param account Dirección a consultar
    /// @return Porcentaje (0 si no es heredero)
    function percentageOf(address account) external view returns (uint8) {
        return _heirInfo[account].percentage;
    }

    /// @notice Indica si una dirección es heredera
    /// @param account Dirección a consultar
    /// @return `true` si figura en la lista de herederos
    function isHeir(address account) external view returns (bool) {
        return _heirInfo[account].percentage != 0;
    }

    /// @notice Indica si un heredero ya cobró su porción
    /// @param account Dirección a consultar
    /// @return `true` si esa dirección ya cobró
    function claimed(address account) external view returns (bool) {
        return _heirInfo[account].claimed;
    }

    /// @notice true si `cancelTrigger()` puede ejecutarse en este momento
    /// @return `true` si el contrato está TRIGGERED y nadie cobró todavía
    function canCancelTrigger() external view returns (bool) {
        return status == Status.TRIGGERED && claimsCount == 0;
    }

    /// @notice Segundos restantes hasta que `triggerInheritance()` sea ejecutable (0 si ya se puede)
    /// @return Segundos restantes
    function timeUntilTrigger() external view returns (uint256) {
        uint256 deadline = uint256(lastHeartbeat) + uint256(inactivityPeriod);
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    /// @notice Indica si `triggerInheritance()` puede ejecutarse ahora
    /// @return `true` si está ACTIVE y venció el plazo de inactividad
    function isTriggerable() external view returns (bool) {
        uint256 deadline = uint256(lastHeartbeat) + uint256(inactivityPeriod);
        return status == Status.ACTIVE && block.timestamp > deadline;
    }

    /// @notice Momento a partir del cual los herederos pueden cobrar
    /// @return Timestamp en que se cierra la ventana de impugnación, o 0 si la herencia no está activada
    function claimsOpenAt() external view returns (uint256) {
        if (status != Status.TRIGGERED) return 0;
        return uint256(triggeredAt) + uint256(claimDelay);
    }

    /// @notice ETH que `sweepDust()` enviaría ahora
    /// @return Balance no reservado para los herederos, o 0 si la herencia no está activada
    function sweepableBalance() external view returns (uint256) {
        if (status != Status.TRIGGERED) return 0;
        return address(this).balance - _reservedForHeirs();
    }

    /// @notice Balance real en ETH que tiene el contrato
    /// @return Balance en wei
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ---------------------------------------------------------------------
    // Funciones privadas
    // ---------------------------------------------------------------------

    /// @dev Valida y guarda la lista de herederos: sin duplicados, sin dirección cero,
    ///      cada porcentaje al menos 1 y la suma exactamente 100
    /// @param heirAddresses Direcciones de los herederos
    /// @param percentages Porcentaje de cada heredero, en el mismo orden
    function _setHeirs(address[] memory heirAddresses, uint8[] memory percentages) private {
        uint256 len = heirAddresses.length;
        if (len == 0) revert NoHeirs();
        if (len != percentages.length) revert ArrayLengthMismatch();

        // Limpia el set anterior de herederos antes de cargar el nuevo
        uint256 oldLen = _heirAccounts.length;
        for (uint256 i = 0; i < oldLen; ) {
            delete _heirInfo[_heirAccounts[i]];
            // `i` está acotado por la cantidad de herederos (100 como máximo):
            // nunca desborda, así que el chequeo de overflow es gasto innecesario.
            unchecked {
                ++i;
            }
        }
        delete _heirAccounts;

        uint256 sum = 0;
        for (uint256 i = 0; i < len; ) {
            address account = heirAddresses[i];
            uint8 pct = percentages[i];

            if (account == address(0)) revert ZeroAddress();
            if (pct == 0) revert ZeroPercentage(account);
            if (_heirInfo[account].percentage != 0) revert DuplicateHeir(account);

            _heirInfo[account] = HeirInfo({percentage: pct, claimed: false});
            _heirAccounts.push(account);
            sum += pct;
            unchecked {
                ++i;
            }
        }

        if (sum != TOTAL_PERCENTAGE) revert InvalidPercentageSum(sum);

        emit HeirsUpdated(heirAddresses, percentages, block.timestamp);
    }

    /// @dev Lógica común de `claim()` y `claimTo()`: valida, marca el cobro y transfiere
    ///      (Checks-Effects-Interactions)
    /// @param to Dirección que recibe el ETH
    function _claim(address payable to) private {
        // Checks
        uint256 opensAt = uint256(triggeredAt) + uint256(claimDelay);
        if (block.timestamp < opensAt) revert ClaimsNotOpenYet(opensAt - block.timestamp);

        HeirInfo memory info = _heirInfo[msg.sender];
        if (info.percentage == 0) revert NotHeir();
        if (info.claimed) revert AlreadyClaimed();

        uint256 amount = (inheritedBalance * info.percentage) / TOTAL_PERCENTAGE;

        // Effects
        _heirInfo[msg.sender].claimed = true;
        // Ninguna de las dos operaciones puede desbordar: cada heredero cobra una sola
        // vez, hay a lo sumo 100 herederos y sus porcentajes suman exactamente 100.
        unchecked {
            claimsCount += 1;
            _unclaimedPercentage -= info.percentage;
        }
        emit Claimed(msg.sender, to, amount, block.timestamp);

        // Interactions
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @dev ETH reservado para los herederos que todavía no cobraron. Redondea igual que
    ///      `_claim()`, así que nunca reserva menos de lo que esos herederos van a cobrar:
    ///      floor(B·a/100) + floor(B·b/100) <= floor(B·(a+b)/100).
    /// @return Monto reservado en wei
    function _reservedForHeirs() private view returns (uint256) {
        return (inheritedBalance * _unclaimedPercentage) / TOTAL_PERCENTAGE;
    }

    /// @dev Revierte si un plazo es menor que el mínimo permitido
    /// @param value Plazo a validar, en segundos
    /// @param minimum Plazo mínimo, en segundos
    function _checkPeriod(uint40 value, uint40 minimum) private pure {
        if (value < minimum) revert PeriodTooShort(value, minimum);
    }
}
