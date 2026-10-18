const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
  setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const ONE_DAY = 24 * 60 * 60;
const ONE_YEAR = 365 * ONE_DAY;
// Ventana de impugnación de los tests: tiempo entre la activación y el primer cobro
const CLAIM_DELAY = ONE_DAY;
const MIN_INACTIVITY_PERIOD = 5 * 60;
const MIN_CLAIM_DELAY = 60;
const TRIGGERED = 1;

describe("DigitalInheritance", function () {
  async function deployFixture() {
    const [owner, heir1, heir2, heir3, stranger] = await ethers.getSigners();

    const heirAddresses = [heir1.address, heir2.address];
    const percentages = [60, 40];

    const Factory = await ethers.getContractFactory("DigitalInheritance");
    const contract = await Factory.connect(owner).deploy(
      ONE_YEAR,
      CLAIM_DELAY,
      heirAddresses,
      percentages
    );
    await contract.waitForDeployment();

    return { contract, Factory, owner, heir1, heir2, heir3, stranger, heirAddresses, percentages };
  }

  // Vence el plazo de inactividad y activa la herencia
  async function expireAndTrigger(contract, caller) {
    await time.increase(ONE_YEAR + 1);
    await contract.connect(caller).triggerInheritance();
  }

  // Deja pasar la ventana de impugnación para que los herederos puedan cobrar
  async function openClaims() {
    await time.increase(CLAIM_DELAY);
  }

  // -------------------------------------------------------------------
  // Deploy
  // -------------------------------------------------------------------
  describe("Deploy", function () {
    it("configura al deployer como titular (owner)", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("arranca en estado ACTIVE con los herederos definidos", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.status()).to.equal(0); // ACTIVE
      expect(await contract.getHeirCount()).to.equal(2);
    });

    it("inicializa los plazos y lastHeartbeat con el timestamp del deploy", async function () {
      const { contract } = await loadFixture(deployFixture);
      const deployedAt = await time.latest();

      expect(await contract.inactivityPeriod()).to.equal(ONE_YEAR);
      expect(await contract.claimDelay()).to.equal(CLAIM_DELAY);
      expect(await contract.lastHeartbeat()).to.equal(deployedAt);
      expect(await contract.triggeredAt()).to.equal(0);
      expect(await contract.claimsCount()).to.equal(0);
      expect(await contract.contractBalance()).to.equal(0);
    });

    it("rechaza el deploy si los porcentajes no suman 100", async function () {
      const [owner, heir1, heir2] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(
        Factory.connect(owner).deploy(ONE_YEAR, CLAIM_DELAY, [heir1.address, heir2.address], [60, 30])
      ).to.be.revertedWithCustomError(Factory, "InvalidPercentageSum");
    });

    it("rechaza el deploy sin herederos", async function () {
      const [owner] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(
        Factory.connect(owner).deploy(ONE_YEAR, CLAIM_DELAY, [], [])
      ).to.be.revertedWithCustomError(Factory, "NoHeirs");
    });

    it("rechaza direcciones duplicadas en los herederos", async function () {
      const [owner, heir1] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(
        Factory.connect(owner).deploy(ONE_YEAR, CLAIM_DELAY, [heir1.address, heir1.address], [50, 50])
      ).to.be.revertedWithCustomError(Factory, "DuplicateHeir");
    });

    it("rechaza un plazo de inactividad menor al mínimo", async function () {
      const [owner, heir1] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(Factory.connect(owner).deploy(0, CLAIM_DELAY, [heir1.address], [100]))
        .to.be.revertedWithCustomError(Factory, "PeriodTooShort")
        .withArgs(0, MIN_INACTIVITY_PERIOD);
    });

    it("rechaza una ventana de impugnación menor al mínimo", async function () {
      const [owner, heir1] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(Factory.connect(owner).deploy(ONE_YEAR, 0, [heir1.address], [100]))
        .to.be.revertedWithCustomError(Factory, "PeriodTooShort")
        .withArgs(0, MIN_CLAIM_DELAY);
    });
  });

  // -------------------------------------------------------------------
  // Depósitos
  // -------------------------------------------------------------------
  describe("Depósitos", function () {
    it("el titular puede depositar vía deposit()", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("2");

      await expect(contract.connect(owner).deposit({ value: amount }))
        .to.emit(contract, "Deposited")
        .withArgs(owner.address, amount, anyValue);

      expect(await contract.contractBalance()).to.equal(amount);
    });

    it("el titular puede depositar enviando ETH directo (receive)", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1");

      await expect(owner.sendTransaction({ to: await contract.getAddress(), value: amount }))
        .to.emit(contract, "Deposited")
        .withArgs(owner.address, amount, anyValue);

      expect(await contract.contractBalance()).to.equal(amount);
    });

    it("un tercero NO puede depositar vía deposit()", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await expect(
        contract.connect(stranger).deposit({ value: 1 })
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("un tercero NO puede enviar ETH directo al contrato", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await expect(
        stranger.sendTransaction({ to: await contract.getAddress(), value: 1 })
      ).to.be.revertedWithCustomError(contract, "DirectDepositNotAllowed");
    });

    it("no se puede depositar con la herencia ya activada, ni por deposit() ni directo", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      await expireAndTrigger(contract, heir1);

      await expect(
        contract.connect(owner).deposit({ value: 1 })
      ).to.be.revertedWithCustomError(contract, "InvalidState");
      await expect(
        owner.sendTransaction({ to: await contract.getAddress(), value: 1 })
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });
  });

  // -------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------
  describe("Heartbeat", function () {
    it("el titular puede hacer heartbeat y actualiza lastHeartbeat", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const before = await contract.lastHeartbeat();

      await time.increase(ONE_DAY);
      await expect(contract.connect(owner).heartbeat()).to.emit(contract, "Heartbeat");

      expect(await contract.lastHeartbeat()).to.be.greaterThan(before);
    });

    it("un tercero no puede hacer heartbeat", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await expect(
        contract.connect(stranger).heartbeat()
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("el heartbeat pospone correctamente el trigger", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);

      await time.increase(ONE_YEAR - ONE_DAY);
      await contract.connect(owner).heartbeat();

      await time.increase(ONE_YEAR - ONE_DAY); // todavía no pasó otro año completo
      await expect(contract.connect(heir1).triggerInheritance()).to.be.revertedWithCustomError(
        contract,
        "TooEarly"
      );
    });

    it("no se puede hacer heartbeat en TRIGGERED (hay que cancelar primero)", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      await expireAndTrigger(contract, heir1);

      await expect(contract.connect(owner).heartbeat())
        .to.be.revertedWithCustomError(contract, "InvalidState")
        .withArgs(TRIGGERED, 0);
    });
  });

  // -------------------------------------------------------------------
  // Gestión de herederos y plazos
  // -------------------------------------------------------------------
  describe("setHeirs / setInactivityPeriod / setClaimDelay", function () {
    it("el titular puede reemplazar la lista de herederos", async function () {
      const { contract, owner, heir3 } = await loadFixture(deployFixture);

      await expect(
        contract.connect(owner).setHeirs([heir3.address], [100])
      ).to.emit(contract, "HeirsUpdated");

      expect(await contract.getHeirCount()).to.equal(1);
      expect(await contract.isHeir(heir3.address)).to.equal(true);
    });

    it("emite HeirsUpdated con las listas completas de direcciones y porcentajes", async function () {
      const { contract, owner, heir1, heir3 } = await loadFixture(deployFixture);

      await expect(contract.connect(owner).setHeirs([heir1.address, heir3.address], [25, 75]))
        .to.emit(contract, "HeirsUpdated")
        .withArgs([heir1.address, heir3.address], [25, 75], anyValue);
    });

    it("al reemplazar la lista, los herederos anteriores dejan de serlo", async function () {
      const { contract, owner, heir1, heir2, heir3 } = await loadFixture(deployFixture);
      await contract.connect(owner).setHeirs([heir3.address], [100]);

      expect(await contract.isHeir(heir1.address)).to.equal(false);
      expect(await contract.isHeir(heir2.address)).to.equal(false);
      expect(await contract.percentageOf(heir1.address)).to.equal(0);
      expect(await contract.percentageOf(heir2.address)).to.equal(0);

      // y ya no pueden cobrar una vez activada la herencia
      await expireAndTrigger(contract, heir3);
      await openClaims();
      await expect(
        contract.connect(heir1).claim()
      ).to.be.revertedWithCustomError(contract, "NotHeir");
    });

    it("rechaza arrays de herederos y porcentajes de distinto largo", async function () {
      const { contract, owner, heir1, heir2 } = await loadFixture(deployFixture);
      await expect(
        contract.connect(owner).setHeirs([heir1.address, heir2.address], [100])
      ).to.be.revertedWithCustomError(contract, "ArrayLengthMismatch");
    });

    it("rechaza porcentajes que no suman 100", async function () {
      const { contract, owner, heir1, heir2 } = await loadFixture(deployFixture);
      await expect(contract.connect(owner).setHeirs([heir1.address, heir2.address], [50, 60]))
        .to.be.revertedWithCustomError(contract, "InvalidPercentageSum")
        .withArgs(110);
    });

    it("rechaza dirección cero como heredero", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await expect(
        contract.connect(owner).setHeirs([ethers.ZeroAddress], [100])
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("rechaza un heredero con porcentaje 0", async function () {
      const { contract, owner, heir1, heir3 } = await loadFixture(deployFixture);
      await expect(contract.connect(owner).setHeirs([heir1.address, heir3.address], [100, 0]))
        .to.be.revertedWithCustomError(contract, "ZeroPercentage")
        .withArgs(heir3.address);
    });

    it("solo el titular puede modificar herederos", async function () {
      const { contract, stranger, heir3 } = await loadFixture(deployFixture);
      await expect(
        contract.connect(stranger).setHeirs([heir3.address], [100])
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("el titular puede actualizar el período de inactividad", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const newPeriod = 30 * ONE_DAY;
      await expect(contract.connect(owner).setInactivityPeriod(newPeriod))
        .to.emit(contract, "InactivityPeriodUpdated")
        .withArgs(newPeriod, anyValue);
      expect(await contract.inactivityPeriod()).to.equal(newPeriod);
    });

    it("un tercero no puede cambiar el período de inactividad", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await expect(
        contract.connect(stranger).setInactivityPeriod(ONE_DAY)
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("rechaza un período de inactividad menor al mínimo", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await expect(contract.connect(owner).setInactivityPeriod(MIN_INACTIVITY_PERIOD - 1))
        .to.be.revertedWithCustomError(contract, "PeriodTooShort")
        .withArgs(MIN_INACTIVITY_PERIOD - 1, MIN_INACTIVITY_PERIOD);
    });

    it("con el plazo mínimo, la herencia no se puede activar antes de que pase", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      await contract.connect(owner).setInactivityPeriod(MIN_INACTIVITY_PERIOD);

      await time.increase(MIN_INACTIVITY_PERIOD - 10);
      await expect(
        contract.connect(heir1).triggerInheritance()
      ).to.be.revertedWithCustomError(contract, "TooEarly");
    });

    it("el titular puede actualizar la ventana de impugnación", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const newDelay = 3 * ONE_DAY;
      await expect(contract.connect(owner).setClaimDelay(newDelay))
        .to.emit(contract, "ClaimDelayUpdated")
        .withArgs(newDelay, anyValue);
      expect(await contract.claimDelay()).to.equal(newDelay);
    });

    it("rechaza una ventana de impugnación menor al mínimo o puesta por un tercero", async function () {
      const { contract, owner, stranger } = await loadFixture(deployFixture);
      await expect(contract.connect(owner).setClaimDelay(MIN_CLAIM_DELAY - 1))
        .to.be.revertedWithCustomError(contract, "PeriodTooShort")
        .withArgs(MIN_CLAIM_DELAY - 1, MIN_CLAIM_DELAY);
      await expect(
        contract.connect(stranger).setClaimDelay(ONE_DAY)
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("en TRIGGERED no se pueden modificar ni los herederos ni los plazos", async function () {
      const { contract, owner, heir1, heir3 } = await loadFixture(deployFixture);
      await expireAndTrigger(contract, heir1);

      await expect(
        contract.connect(owner).setHeirs([heir3.address], [100])
      ).to.be.revertedWithCustomError(contract, "InvalidState");
      await expect(
        contract.connect(owner).setInactivityPeriod(ONE_DAY)
      ).to.be.revertedWithCustomError(contract, "InvalidState");
      await expect(
        contract.connect(owner).setClaimDelay(ONE_DAY)
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });
  });

  // -------------------------------------------------------------------
  // Retiro
  // -------------------------------------------------------------------
  describe("withdraw", function () {
    it("el titular puede retirar parcialmente", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("5") });

      await expect(contract.connect(owner).withdraw(ethers.parseEther("2")))
        .to.emit(contract, "Withdrawn")
        .withArgs(owner.address, ethers.parseEther("2"), anyValue);

      expect(await contract.contractBalance()).to.equal(ethers.parseEther("3"));
    });

    it("rechaza retirar más de lo que tiene el contrato", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("1") });

      await expect(contract.connect(owner).withdraw(ethers.parseEther("2")))
        .to.be.revertedWithCustomError(contract, "InsufficientBalance")
        .withArgs(ethers.parseEther("2"), ethers.parseEther("1"));
    });

    it("un tercero no puede retirar", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await expect(
        contract.connect(stranger).withdraw(1)
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("no se puede retirar una vez activada la herencia", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("1") });
      await expireAndTrigger(contract, heir1);

      await expect(
        contract.connect(owner).withdraw(1)
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });
  });

  // -------------------------------------------------------------------
  // Trigger
  // -------------------------------------------------------------------
  describe("triggerInheritance", function () {
    it("rechaza el trigger antes de cumplirse el plazo", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      await expect(
        contract.connect(heir1).triggerInheritance()
      ).to.be.revertedWithCustomError(contract, "TooEarly");
    });

    it("cualquiera puede activar la herencia tras el plazo de inactividad", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await time.increase(ONE_YEAR + 1);

      await expect(contract.connect(stranger).triggerInheritance())
        .to.emit(contract, "InheritanceTriggered");

      expect(await contract.status()).to.equal(TRIGGERED);
    });

    it("congela el balance en inheritedBalance y registra el momento de la activación", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("10");
      await contract.connect(owner).deposit({ value: deposit });

      await expireAndTrigger(contract, heir1);
      const triggeredAt = await time.latest();

      expect(await contract.inheritedBalance()).to.equal(deposit);
      expect(await contract.triggeredAt()).to.equal(triggeredAt);
    });

    it("no permite triggerear dos veces", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      await expireAndTrigger(contract, heir1);

      await expect(contract.connect(heir1).triggerInheritance())
        .to.be.revertedWithCustomError(contract, "InvalidState")
        .withArgs(TRIGGERED, 0);
    });

    it("justo en el deadline sigue siendo TooEarly(0); un segundo después ya se puede", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      const deadline = Number(
        (await contract.lastHeartbeat()) + (await contract.inactivityPeriod())
      );

      // la condición es estricta: block.timestamp tiene que superar el deadline
      await time.setNextBlockTimestamp(deadline);
      await expect(contract.connect(heir1).triggerInheritance())
        .to.be.revertedWithCustomError(contract, "TooEarly")
        .withArgs(0);

      await time.setNextBlockTimestamp(deadline + 1);
      await expect(contract.connect(heir1).triggerInheritance()).to.emit(
        contract,
        "InheritanceTriggered"
      );
    });

    it("TooEarly informa exactamente los segundos que faltan", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      const deadline =
        (await contract.lastHeartbeat()) + (await contract.inactivityPeriod());

      await time.setNextBlockTimestamp(Number(deadline) - ONE_DAY);
      await expect(contract.connect(heir1).triggerInheritance())
        .to.be.revertedWithCustomError(contract, "TooEarly")
        .withArgs(ONE_DAY);
    });

    it("emite InheritanceTriggered con quién lo disparó y el balance congelado", async function () {
      const { contract, owner, stranger } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("3");
      await contract.connect(owner).deposit({ value: deposit });
      await time.increase(ONE_YEAR + 1);

      await expect(contract.connect(stranger).triggerInheritance())
        .to.emit(contract, "InheritanceTriggered")
        .withArgs(anyValue, stranger.address, deposit);
    });

    it("se puede activar sin fondos: el snapshot queda en 0 y los cobros son de 0", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      await time.increase(ONE_YEAR + 1);

      await expect(contract.connect(heir1).triggerInheritance())
        .to.emit(contract, "InheritanceTriggered")
        .withArgs(anyValue, heir1.address, 0);
      await openClaims();

      await expect(contract.connect(heir1).claim())
        .to.emit(contract, "Claimed")
        .withArgs(heir1.address, heir1.address, 0, anyValue);
      expect(await contract.claimed(heir1.address)).to.equal(true);
    });

    it("el ETH que entra sin pasar por receive() también se reparte", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("1") });

      // simula ETH forzado (ej. selfdestruct hacia el contrato), que receive() no puede frenar
      await setBalance(await contract.getAddress(), ethers.parseEther("1.5"));
      await expireAndTrigger(contract, heir1);

      // el saldo de la herencia es el balance real: no queda ETH sin contabilizar
      expect(await contract.inheritedBalance()).to.equal(ethers.parseEther("1.5"));
    });
  });

  // -------------------------------------------------------------------
  // Ventana de impugnación
  // -------------------------------------------------------------------
  describe("ventana de impugnación", function () {
    async function triggeredFixture() {
      const base = await deployFixture();
      await base.contract.connect(base.owner).deposit({ value: ethers.parseEther("10") });
      await expireAndTrigger(base.contract, base.heir1);
      return { ...base, triggeredAt: await time.latest() };
    }

    it("nadie puede cobrar mientras la ventana está abierta", async function () {
      const { contract, heir1 } = await loadFixture(triggeredFixture);

      await time.increase(CLAIM_DELAY / 2);
      await expect(contract.connect(heir1).claim()).to.be.revertedWithCustomError(
        contract,
        "ClaimsNotOpenYet"
      );
    });

    it("ClaimsNotOpenYet informa los segundos que faltan, y al cerrarse la ventana ya se puede cobrar", async function () {
      const { contract, heir1, triggeredAt } = await loadFixture(triggeredFixture);
      const opensAt = triggeredAt + CLAIM_DELAY;

      await time.setNextBlockTimestamp(opensAt - 10);
      await expect(contract.connect(heir1).claim())
        .to.be.revertedWithCustomError(contract, "ClaimsNotOpenYet")
        .withArgs(10);

      await time.setNextBlockTimestamp(opensAt);
      await expect(contract.connect(heir1).claim()).to.emit(contract, "Claimed");
    });

    it("claimsOpenAt devuelve el cierre de la ventana, y 0 si la herencia no está activada", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      expect(await contract.claimsOpenAt()).to.equal(0);

      await expireAndTrigger(contract, heir1);
      const triggeredAt = await time.latest();
      expect(await contract.claimsOpenAt()).to.equal(triggeredAt + CLAIM_DELAY);
    });

    it("el titular puede cancelar durante la ventana", async function () {
      const { contract, owner } = await loadFixture(triggeredFixture);

      await expect(contract.connect(owner).cancelTrigger()).to.emit(contract, "TriggerCancelled");
      expect(await contract.status()).to.equal(0); // ACTIVE
    });

    it("un heredero contrato ya no puede activar y cobrar en la misma transacción", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);

      const Factory = await ethers.getContractFactory("TriggerAndClaimHeir");
      const heirContract = await Factory.deploy(await contract.getAddress());
      await heirContract.waitForDeployment();

      await contract
        .connect(owner)
        .setHeirs([heir1.address, await heirContract.getAddress()], [50, 50]);
      await contract.connect(owner).deposit({ value: ethers.parseEther("2") });
      await time.increase(ONE_YEAR + 1);

      // el cobro revierte dentro de la misma transacción, así que la activación también
      await expect(heirContract.triggerAndClaim()).to.be.revertedWithCustomError(
        contract,
        "ClaimsNotOpenYet"
      );
      expect(await contract.status()).to.equal(0); // sigue ACTIVE
    });
  });

  // -------------------------------------------------------------------
  // cancelTrigger
  // -------------------------------------------------------------------
  describe("cancelTrigger", function () {
    async function triggeredNoClaimsFixture() {
      const base = await deployFixture();
      await base.contract.connect(base.owner).deposit({ value: ethers.parseEther("10") });
      await expireAndTrigger(base.contract, base.owner);
      return base;
    }

    it("el titular puede cancelar si nadie cobró todavía", async function () {
      const { contract, owner } = await loadFixture(triggeredNoClaimsFixture);

      await expect(contract.connect(owner).cancelTrigger())
        .to.emit(contract, "TriggerCancelled")
        .withArgs(owner.address, anyValue);

      expect(await contract.status()).to.equal(0); // ACTIVE
      expect(await contract.inheritedBalance()).to.equal(0);
      expect(await contract.triggeredAt()).to.equal(0);
      expect(await contract.claimsOpenAt()).to.equal(0);
    });

    it("cancelTrigger reinicia lastHeartbeat (cuenta como prueba de vida)", async function () {
      const { contract, owner } = await loadFixture(triggeredNoClaimsFixture);

      await time.increase(ONE_DAY);
      const beforeCancel = await time.latest();
      await contract.connect(owner).cancelTrigger();

      expect(await contract.lastHeartbeat()).to.be.greaterThanOrEqual(beforeCancel);
      // el temporizador vuelve a empezar: ya no es triggereable de inmediato
      expect(await contract.isTriggerable()).to.equal(false);
    });

    it("se puede cancelar aunque la ventana ya se haya cerrado, mientras nadie haya cobrado", async function () {
      const { contract, owner } = await loadFixture(triggeredNoClaimsFixture);
      await openClaims();

      await expect(contract.connect(owner).cancelTrigger()).to.emit(contract, "TriggerCancelled");
    });

    it("tras cancelar, vuelven a funcionar heartbeat, withdraw y setHeirs", async function () {
      const { contract, owner, heir3 } = await loadFixture(triggeredNoClaimsFixture);
      await contract.connect(owner).cancelTrigger();

      await expect(contract.connect(owner).heartbeat()).to.emit(contract, "Heartbeat");
      await expect(contract.connect(owner).withdraw(ethers.parseEther("1"))).to.emit(
        contract,
        "Withdrawn"
      );
      await expect(contract.connect(owner).setHeirs([heir3.address], [100])).to.emit(
        contract,
        "HeirsUpdated"
      );
    });

    it("tras cancelar, los herederos ya no pueden cobrar", async function () {
      const { contract, owner, heir1 } = await loadFixture(triggeredNoClaimsFixture);
      await contract.connect(owner).cancelTrigger();

      await expect(
        contract.connect(heir1).claim()
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });

    it("un nuevo trigger tras cancelar toma un snapshot fresco del balance", async function () {
      const { contract, owner, heir1 } = await loadFixture(triggeredNoClaimsFixture);
      await contract.connect(owner).cancelTrigger();
      await contract.connect(owner).withdraw(ethers.parseEther("4"));

      await expireAndTrigger(contract, heir1);

      expect(await contract.inheritedBalance()).to.equal(ethers.parseEther("6"));
    });

    it("tras cancelar, se puede volver a activar la herencia más adelante", async function () {
      const { contract, owner, heir1 } = await loadFixture(triggeredNoClaimsFixture);
      await contract.connect(owner).cancelTrigger();

      await time.increase(ONE_YEAR + 1);
      await expect(contract.connect(heir1).triggerInheritance()).to.emit(
        contract,
        "InheritanceTriggered"
      );
      expect(await contract.status()).to.equal(TRIGGERED);
    });

    it("rechaza cancelar si el contrato está ACTIVE", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await expect(contract.connect(owner).cancelTrigger())
        .to.be.revertedWithCustomError(contract, "InvalidState")
        .withArgs(0, TRIGGERED);
    });

    it("un tercero no puede cancelar", async function () {
      const { contract, stranger } = await loadFixture(triggeredNoClaimsFixture);
      await expect(
        contract.connect(stranger).cancelTrigger()
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("BLOQUEA la cancelación en cuanto un heredero ya cobró (punto de no retorno)", async function () {
      const { contract, owner, heir1 } = await loadFixture(triggeredNoClaimsFixture);
      await openClaims();
      await contract.connect(heir1).claim();

      await expect(
        contract.connect(owner).cancelTrigger()
      ).to.be.revertedWithCustomError(contract, "ClaimsAlreadyStarted");

      // el contrato queda irreversiblemente en TRIGGERED
      expect(await contract.status()).to.equal(TRIGGERED);
    });

    it("canCancelTrigger refleja correctamente si todavía se puede cancelar", async function () {
      const { contract, heir1 } = await loadFixture(triggeredNoClaimsFixture);
      expect(await contract.canCancelTrigger()).to.equal(true);

      await openClaims();
      await contract.connect(heir1).claim();
      expect(await contract.canCancelTrigger()).to.equal(false);
    });
  });

  // -------------------------------------------------------------------
  // Claim
  // -------------------------------------------------------------------
  describe("claim / claimTo", function () {
    async function claimableFixture() {
      const base = await deployFixture();
      const deposit = ethers.parseEther("10"); // heir1: 60% = 6 ETH, heir2: 40% = 4 ETH
      await base.contract.connect(base.owner).deposit({ value: deposit });
      await expireAndTrigger(base.contract, base.owner);
      await openClaims();
      return { ...base, deposit };
    }

    it("un heredero cobra el porcentaje que le corresponde", async function () {
      const { contract, heir1 } = await loadFixture(claimableFixture);

      const before = await ethers.provider.getBalance(heir1.address);
      const tx = await contract.connect(heir1).claim();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(heir1.address);

      expect(after - before + gasCost).to.equal(ethers.parseEther("6")); // 60% de 10 ETH
      expect(await contract.claimed(heir1.address)).to.equal(true);
    });

    it("distribuye correctamente entre varios herederos", async function () {
      const { contract, heir1, heir2 } = await loadFixture(claimableFixture);

      await contract.connect(heir1).claim();
      const before2 = await ethers.provider.getBalance(heir2.address);
      const tx = await contract.connect(heir2).claim();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const after2 = await ethers.provider.getBalance(heir2.address);

      expect(after2 - before2 + gasCost).to.equal(ethers.parseEther("4")); // 40% de 10 ETH
      expect(await contract.contractBalance()).to.equal(0);
    });

    it("emite Claimed con el monto y actualiza claimsCount y el balance", async function () {
      const { contract, heir1, deposit } = await loadFixture(claimableFixture);
      const expectedAmount = ethers.parseEther("6");

      await expect(contract.connect(heir1).claim())
        .to.emit(contract, "Claimed")
        .withArgs(heir1.address, heir1.address, expectedAmount, anyValue);

      expect(await contract.claimsCount()).to.equal(1);
      expect(await contract.contractBalance()).to.equal(deposit - expectedAmount);
    });

    it("el monto de cada heredero no depende del orden de los cobros", async function () {
      const { contract, heir1, heir2 } = await loadFixture(claimableFixture);

      // heir2 cobra primero: su 40% se calcula sobre el snapshot, no sobre lo que queda
      await expect(contract.connect(heir2).claim())
        .to.emit(contract, "Claimed")
        .withArgs(heir2.address, heir2.address, ethers.parseEther("4"), anyValue);
      await expect(contract.connect(heir1).claim())
        .to.emit(contract, "Claimed")
        .withArgs(heir1.address, heir1.address, ethers.parseEther("6"), anyValue);
    });

    it("rechaza el doble cobro", async function () {
      const { contract, heir1 } = await loadFixture(claimableFixture);
      await contract.connect(heir1).claim();
      await expect(
        contract.connect(heir1).claim()
      ).to.be.revertedWithCustomError(contract, "AlreadyClaimed");
    });

    it("rechaza el cobro de quien no es heredero", async function () {
      const { contract, stranger } = await loadFixture(claimableFixture);
      await expect(
        contract.connect(stranger).claim()
      ).to.be.revertedWithCustomError(contract, "NotHeir");
    });

    it("rechaza el cobro si todavía no se activó la herencia", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      await expect(contract.connect(heir1).claim())
        .to.be.revertedWithCustomError(contract, "InvalidState")
        .withArgs(0, TRIGGERED);
    });

    it("claimTo envía la parte del heredero a otra dirección", async function () {
      const { contract, heir1, stranger } = await loadFixture(claimableFixture);

      const before = await ethers.provider.getBalance(stranger.address);
      await expect(contract.connect(heir1).claimTo(stranger.address))
        .to.emit(contract, "Claimed")
        .withArgs(heir1.address, stranger.address, ethers.parseEther("6"), anyValue);

      expect(await ethers.provider.getBalance(stranger.address)).to.equal(before + ethers.parseEther("6"));
      expect(await contract.claimed(heir1.address)).to.equal(true);
      await expect(
        contract.connect(heir1).claim()
      ).to.be.revertedWithCustomError(contract, "AlreadyClaimed");
    });

    it("claimTo rechaza la dirección cero", async function () {
      const { contract, heir1 } = await loadFixture(claimableFixture);
      await expect(
        contract.connect(heir1).claimTo(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("claimTo rechaza el cobro si todavía no se activó la herencia", async function () {
      const { contract, heir1, stranger } = await loadFixture(deployFixture);
      await expect(contract.connect(heir1).claimTo(stranger.address))
        .to.be.revertedWithCustomError(contract, "InvalidState")
        .withArgs(0, TRIGGERED);
    });

    it("resiste un intento de reentrancia en claim()", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);

      // Se agrega el contrato atacante como heredero junto con heir1
      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await AttackerFactory.deploy(await contract.getAddress());
      await attacker.waitForDeployment();

      await contract
        .connect(owner)
        .setHeirs([heir1.address, await attacker.getAddress()], [50, 50]);
      await contract.connect(owner).deposit({ value: ethers.parseEther("2") });
      await expireAndTrigger(contract, owner);
      await openClaims();

      // El ataque debe revertir: ReentrancyGuard + CEI evitan el doble cobro
      await expect(attacker.attack()).to.be.reverted;
      expect(await contract.contractBalance()).to.equal(ethers.parseEther("2"));
    });

    it("resiste un intento de reentrancia en claimTo()", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);

      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await AttackerFactory.deploy(await contract.getAddress());
      await attacker.waitForDeployment();

      await contract
        .connect(owner)
        .setHeirs([heir1.address, await attacker.getAddress()], [50, 50]);
      await contract.connect(owner).deposit({ value: ethers.parseEther("2") });
      await expireAndTrigger(contract, owner);
      await openClaims();

      await expect(attacker.attackWithClaimTo()).to.be.revertedWithCustomError(
        contract,
        "TransferFailed"
      );
      expect(await contract.claimed(await attacker.getAddress())).to.equal(false);
    });

    it("un heredero cuya dirección rechaza ETH no pierde su parte ni bloquea a nadie", async function () {
      const { contract, owner, heir1, stranger } = await loadFixture(deployFixture);

      const Factory = await ethers.getContractFactory("RejectingHeir");
      const rejecting = await Factory.deploy(await contract.getAddress());
      await rejecting.waitForDeployment();

      await contract
        .connect(owner)
        .setHeirs([heir1.address, await rejecting.getAddress()], [50, 50]);
      await contract.connect(owner).deposit({ value: ethers.parseEther("2") });
      await expireAndTrigger(contract, owner);
      await openClaims();

      // cobrar en su propia dirección falla...
      await expect(rejecting.claim()).to.be.revertedWithCustomError(contract, "TransferFailed");
      // ...pero el resto cobra igual y el titular puede barrer lo no reservado
      await contract.connect(heir1).claim();
      await expect(contract.connect(owner).sweepDust(owner.address))
        .to.emit(contract, "DustSwept")
        .withArgs(owner.address, 0, anyValue);
      // y el heredero cobra su parte en otra dirección
      await expect(rejecting.claimTo(stranger.address))
        .to.emit(contract, "Claimed")
        .withArgs(await rejecting.getAddress(), stranger.address, ethers.parseEther("1"), anyValue);
      expect(await contract.contractBalance()).to.equal(0);
    });
  });

  // -------------------------------------------------------------------
  // sweepDust
  // -------------------------------------------------------------------
  describe("sweepDust", function () {
    // 7 wei con porcentajes 60/40: heir1 cobra 4, heir2 cobra 2 y queda 1 wei de resto
    async function sevenWeiFixture() {
      const base = await deployFixture();
      await base.contract.connect(base.owner).deposit({ value: 7 });
      await expireAndTrigger(base.contract, base.owner);
      await openClaims();
      return base;
    }

    it("nunca toca la parte de quien todavía no cobró", async function () {
      const { contract, owner, heir1, heir2 } = await loadFixture(sevenWeiFixture);

      // antes de cualquier cobro, todo está reservado
      expect(await contract.sweepableBalance()).to.equal(0);

      await contract.connect(heir1).claim(); // 60% de 7 = 4
      // quedan 3 wei: 2 reservados para heir2 y 1 de resto
      expect(await contract.sweepableBalance()).to.equal(1);
      await expect(contract.connect(owner).sweepDust(owner.address))
        .to.emit(contract, "DustSwept")
        .withArgs(owner.address, 1, anyValue);

      // heir2 cobra completo después del barrido
      await expect(contract.connect(heir2).claim())
        .to.emit(contract, "Claimed")
        .withArgs(heir2.address, heir2.address, 2, anyValue);
      expect(await contract.contractBalance()).to.equal(0);
    });

    it("permite al titular recuperar el remanente tras todos los cobros", async function () {
      const { contract, owner, heir1, heir2, stranger } = await loadFixture(sevenWeiFixture);
      await contract.connect(heir1).claim(); // 4
      await contract.connect(heir2).claim(); // 2
      expect(await contract.contractBalance()).to.equal(1);

      // se envía a una cuenta que no paga gas en esta tx para comparar el balance exacto
      const before = await ethers.provider.getBalance(stranger.address);
      await expect(contract.connect(owner).sweepDust(stranger.address))
        .to.emit(contract, "DustSwept")
        .withArgs(stranger.address, 1, anyValue);

      expect(await ethers.provider.getBalance(stranger.address)).to.equal(before + 1n);
      expect(await contract.contractBalance()).to.equal(0);
    });

    it("recupera el ETH que entra sin pasar por receive() después de la activación", async function () {
      const { contract, owner, heir1, heir2 } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("1") });
      await expireAndTrigger(contract, owner);

      // simula ETH forzado después del snapshot
      await setBalance(await contract.getAddress(), ethers.parseEther("1.5"));
      await openClaims();
      await contract.connect(heir1).claim(); // 0.6 ETH
      await contract.connect(heir2).claim(); // 0.4 ETH

      await expect(contract.connect(owner).sweepDust(owner.address))
        .to.emit(contract, "DustSwept")
        .withArgs(owner.address, ethers.parseEther("0.5"), anyValue);
      expect(await contract.contractBalance()).to.equal(0);
    });

    it("sweepableBalance es 0 mientras la herencia no está activada", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("1") });
      expect(await contract.sweepableBalance()).to.equal(0);
    });

    it("rechaza la dirección cero como destino", async function () {
      const { contract, owner } = await loadFixture(sevenWeiFixture);
      await expect(
        contract.connect(owner).sweepDust(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("un tercero no puede hacer el sweep", async function () {
      const { contract, stranger } = await loadFixture(sevenWeiFixture);
      await expect(
        contract.connect(stranger).sweepDust(stranger.address)
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("rechaza el sweep en estado ACTIVE", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await expect(
        contract.connect(owner).sweepDust(owner.address)
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });
  });

  // -------------------------------------------------------------------
  // Titular que es un contrato: caminos que una cuenta normal no provoca
  // -------------------------------------------------------------------
  describe("titular contrato (ContractOwner)", function () {
    async function contractOwnerFixture() {
      const [, heir1, heir2] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("ContractOwner");
      const holder = await Factory.deploy(ONE_YEAR, CLAIM_DELAY, [heir1.address, heir2.address], [60, 40]);
      await holder.waitForDeployment();
      const contract = await ethers.getContractAt("DigitalInheritance", await holder.inheritance());
      await holder.deposit({ value: 7 });
      return { holder, contract, heir1, heir2 };
    }

    const REJECT = 1;
    const REENTER = 2;

    it("withdraw revierte con TransferFailed si el titular rechaza ETH", async function () {
      const { holder, contract } = await loadFixture(contractOwnerFixture);
      await holder.setMode(REJECT);
      await expect(holder.withdraw(1)).to.be.revertedWithCustomError(contract, "TransferFailed");
    });

    it("withdraw bloquea la reentrada del titular", async function () {
      const { holder, contract } = await loadFixture(contractOwnerFixture);
      await holder.setMode(REENTER);
      // la reentrada revierte por nonReentrant y eso hace fallar la transferencia original
      await expect(holder.withdraw(1)).to.be.revertedWithCustomError(contract, "TransferFailed");
      expect(await contract.contractBalance()).to.equal(7);
    });

    it("sweepDust revierte con TransferFailed si el destino rechaza ETH", async function () {
      const { holder, contract, heir1, heir2 } = await loadFixture(contractOwnerFixture);
      await time.increase(ONE_YEAR + 1);
      await contract.connect(heir1).triggerInheritance();
      await openClaims();
      await contract.connect(heir1).claim();
      await contract.connect(heir2).claim();

      await holder.setMode(REJECT);
      await expect(holder.sweepDust(await holder.getAddress())).to.be.revertedWithCustomError(
        contract,
        "TransferFailed"
      );
    });

    it("sweepDust bloquea la reentrada del titular", async function () {
      const { holder, contract, heir1, heir2 } = await loadFixture(contractOwnerFixture);
      await time.increase(ONE_YEAR + 1);
      await contract.connect(heir1).triggerInheritance();
      await openClaims();
      await contract.connect(heir1).claim();
      await contract.connect(heir2).claim();

      await holder.setMode(REENTER);
      await expect(holder.sweepDust(await holder.getAddress())).to.be.revertedWithCustomError(
        contract,
        "TransferFailed"
      );
      expect(await contract.contractBalance()).to.equal(1);
    });
  });

  // -------------------------------------------------------------------
  // Vistas auxiliares
  // -------------------------------------------------------------------
  describe("Vistas", function () {
    it("isTriggerable refleja correctamente el estado", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.isTriggerable()).to.equal(false);

      await time.increase(ONE_YEAR + 1);
      expect(await contract.isTriggerable()).to.equal(true);
    });

    it("isTriggerable vuelve a false una vez activada la herencia", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      await expireAndTrigger(contract, heir1);

      expect(await contract.isTriggerable()).to.equal(false);
    });

    it("timeUntilTrigger baja a 0 tras cumplirse el plazo", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.timeUntilTrigger()).to.be.greaterThan(0);

      await time.increase(ONE_YEAR + 1);
      expect(await contract.timeUntilTrigger()).to.equal(0);
    });

    it("getHeirs devuelve cada heredero con su porcentaje, en orden", async function () {
      const { contract, heirAddresses, percentages } = await loadFixture(deployFixture);
      const heirs = await contract.getHeirs();

      expect(heirs.length).to.equal(heirAddresses.length);
      heirs.forEach((heir, i) => {
        expect(heir.account).to.equal(heirAddresses[i]);
        expect(heir.percentage).to.equal(percentages[i]);
      });
    });

    it("percentageOf, isHeir y claimed devuelven 0 y false para quien no es heredero", async function () {
      const { contract, heir1, stranger } = await loadFixture(deployFixture);

      expect(await contract.percentageOf(heir1.address)).to.equal(60);
      expect(await contract.isHeir(heir1.address)).to.equal(true);
      expect(await contract.percentageOf(stranger.address)).to.equal(0);
      expect(await contract.isHeir(stranger.address)).to.equal(false);
      expect(await contract.claimed(stranger.address)).to.equal(false);
    });

    it("expone los plazos mínimos como constantes públicas", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.MIN_INACTIVITY_PERIOD()).to.equal(MIN_INACTIVITY_PERIOD);
      expect(await contract.MIN_CLAIM_DELAY()).to.equal(MIN_CLAIM_DELAY);
    });
  });
});
