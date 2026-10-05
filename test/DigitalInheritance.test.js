const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const ONE_DAY = 24 * 60 * 60;
const ONE_YEAR = 365 * ONE_DAY;

describe("DigitalInheritance", function () {
  async function deployFixture() {
    const [owner, heir1, heir2, heir3, stranger] = await ethers.getSigners();

    const heirAddresses = [heir1.address, heir2.address];
    const percentages = [60, 40];

    const Factory = await ethers.getContractFactory("DigitalInheritance");
    const contract = await Factory.connect(owner).deploy(
      ONE_YEAR,
      heirAddresses,
      percentages
    );
    await contract.waitForDeployment();

    return { contract, owner, heir1, heir2, heir3, stranger, heirAddresses, percentages };
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

    it("rechaza el deploy si los porcentajes no suman 100", async function () {
      const [owner, heir1, heir2] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(
        Factory.connect(owner).deploy(
          ONE_YEAR,
          [heir1.address, heir2.address],
          [60, 30]
        )
      ).to.be.revertedWithCustomError(Factory, "InvalidPercentageSum");
    });

    it("rechaza el deploy sin herederos", async function () {
      const [owner] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(
        Factory.connect(owner).deploy(ONE_YEAR, [], [])
      ).to.be.revertedWithCustomError(Factory, "NoHeirs");
    });

    it("rechaza direcciones duplicadas en los herederos", async function () {
      const [owner, heir1] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("DigitalInheritance");
      await expect(
        Factory.connect(owner).deploy(
          ONE_YEAR,
          [heir1.address, heir1.address],
          [50, 50]
        )
      ).to.be.revertedWithCustomError(Factory, "DuplicateHeir");
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

      expect(await contract.depositBalance()).to.equal(amount);
      expect(await contract.contractBalance()).to.equal(amount);
    });

    it("el titular puede depositar enviando ETH directo (receive)", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1");

      await owner.sendTransaction({ to: await contract.getAddress(), value: amount });

      expect(await contract.depositBalance()).to.equal(amount);
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

      const after = await contract.lastHeartbeat();
      expect(after).to.be.greaterThan(before);
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
  });

  // -------------------------------------------------------------------
  // Gestión de herederos y plazo
  // -------------------------------------------------------------------
  describe("setHeirs / setInactivityPeriod", function () {
    it("el titular puede reemplazar la lista de herederos", async function () {
      const { contract, owner, heir3 } = await loadFixture(deployFixture);

      await expect(
        contract.connect(owner).setHeirs([heir3.address], [100])
      ).to.emit(contract, "HeirsUpdated");

      expect(await contract.getHeirCount()).to.equal(1);
      expect(await contract.isHeir(heir3.address)).to.equal(true);
    });

    it("rechaza porcentajes que no suman 100", async function () {
      const { contract, owner, heir1, heir2 } = await loadFixture(deployFixture);
      await expect(
        contract.connect(owner).setHeirs([heir1.address, heir2.address], [50, 60])
      ).to.be.revertedWithCustomError(contract, "InvalidPercentageSum");
    });

    it("rechaza dirección cero como heredero", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await expect(
        contract.connect(owner).setHeirs([ethers.ZeroAddress], [100])
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
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
  });

  // -------------------------------------------------------------------
  // Retiro
  // -------------------------------------------------------------------
  describe("withdraw", function () {
    it("el titular puede retirar parcialmente", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("5");
      await contract.connect(owner).deposit({ value: deposit });

      await expect(contract.connect(owner).withdraw(ethers.parseEther("2")))
        .to.emit(contract, "Withdrawn")
        .withArgs(owner.address, ethers.parseEther("2"), anyValue);

      expect(await contract.depositBalance()).to.equal(ethers.parseEther("3"));
    });

    it("rechaza retirar más de lo depositado", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("1") });

      await expect(
        contract.connect(owner).withdraw(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(contract, "InsufficientBalance");
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

      await time.increase(ONE_YEAR + 1);
      await contract.connect(heir1).triggerInheritance();

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

      expect(await contract.status()).to.equal(1); // TRIGGERED
    });

    it("congela un snapshot del balance en inheritedBalance", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("10");
      await contract.connect(owner).deposit({ value: deposit });

      await time.increase(ONE_YEAR + 1);
      await contract.connect(heir1).triggerInheritance();

      expect(await contract.inheritedBalance()).to.equal(deposit);
    });

    it("no permite triggerear dos veces", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      await time.increase(ONE_YEAR + 1);
      await contract.connect(heir1).triggerInheritance();

      await expect(
        contract.connect(heir1).triggerInheritance()
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });
  });

  // -------------------------------------------------------------------
  // cancelTrigger
  // -------------------------------------------------------------------
  describe("cancelTrigger", function () {
    async function triggeredNoClaimsFixture() {
      const base = await deployFixture();
      const { contract, owner } = base;
      await contract.connect(owner).deposit({ value: ethers.parseEther("10") });
      await time.increase(ONE_YEAR + 1);
      await contract.connect(owner).triggerInheritance();
      return base;
    }

    it("el titular puede cancelar si nadie reclamó todavía", async function () {
      const { contract, owner } = await loadFixture(triggeredNoClaimsFixture);

      await expect(contract.connect(owner).cancelTrigger())
        .to.emit(contract, "TriggerCancelled")
        .withArgs(owner.address, anyValue);

      expect(await contract.status()).to.equal(0); // ACTIVE
      expect(await contract.inheritedBalance()).to.equal(0);
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

    it("tras cancelar, vuelven a funcionar heartbeat, withdraw y setHeirs", async function () {
      const { contract, owner } = await loadFixture(triggeredNoClaimsFixture);
      await contract.connect(owner).cancelTrigger();

      await expect(contract.connect(owner).heartbeat()).to.emit(contract, "Heartbeat");
      await expect(contract.connect(owner).withdraw(ethers.parseEther("1"))).to.emit(
        contract,
        "Withdrawn"
      );
    });

    it("tras cancelar, se puede volver a activar la herencia más adelante", async function () {
      const { contract, owner, heir1 } = await loadFixture(triggeredNoClaimsFixture);
      await contract.connect(owner).cancelTrigger();

      await time.increase(ONE_YEAR + 1);
      await expect(contract.connect(heir1).triggerInheritance()).to.emit(
        contract,
        "InheritanceTriggered"
      );
      expect(await contract.status()).to.equal(1); // TRIGGERED
    });

    it("rechaza cancelar si el contrato está ACTIVE", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await expect(
        contract.connect(owner).cancelTrigger()
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });

    it("un tercero no puede cancelar", async function () {
      const { contract, stranger } = await loadFixture(triggeredNoClaimsFixture);
      await expect(
        contract.connect(stranger).cancelTrigger()
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("BLOQUEA la cancelación en cuanto un heredero ya reclamó (punto de no retorno)", async function () {
      const { contract, owner, heir1 } = await loadFixture(triggeredNoClaimsFixture);

      await contract.connect(heir1).claim();

      await expect(
        contract.connect(owner).cancelTrigger()
      ).to.be.revertedWithCustomError(contract, "ClaimsAlreadyStarted");

      // el contrato queda irreversiblemente en TRIGGERED
      expect(await contract.status()).to.equal(1);
    });

    it("canCancelTrigger refleja correctamente si todavía se puede cancelar", async function () {
      const { contract, owner, heir1 } = await loadFixture(triggeredNoClaimsFixture);
      expect(await contract.canCancelTrigger()).to.equal(true);

      await contract.connect(heir1).claim();
      expect(await contract.canCancelTrigger()).to.equal(false);
    });
  });

  // -------------------------------------------------------------------
  // Claim
  // -------------------------------------------------------------------
  describe("claim", function () {
    async function triggeredFixture() {
      const base = await deployFixture();
      const { contract, owner } = base;
      const deposit = ethers.parseEther("10"); // heir1: 60% = 6 ETH, heir2: 40% = 4 ETH
      await contract.connect(owner).deposit({ value: deposit });
      await time.increase(ONE_YEAR + 1);
      await contract.connect(owner).triggerInheritance();
      return { ...base, deposit };
    }

    it("un heredero reclama el porcentaje que le corresponde", async function () {
      const { contract, heir1 } = await loadFixture(triggeredFixture);

      const before = await ethers.provider.getBalance(heir1.address);
      const tx = await contract.connect(heir1).claim();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(heir1.address);

      const expectedAmount = ethers.parseEther("6"); // 60% de 10 ETH
      expect(after - before + gasCost).to.equal(expectedAmount);
      expect(await contract.claimed(heir1.address)).to.equal(true);
    });

    it("distribuye correctamente entre varios herederos", async function () {
      const { contract, heir1, heir2 } = await loadFixture(triggeredFixture);

      await contract.connect(heir1).claim();
      const before2 = await ethers.provider.getBalance(heir2.address);
      const tx = await contract.connect(heir2).claim();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const after2 = await ethers.provider.getBalance(heir2.address);

      expect(after2 - before2 + gasCost).to.equal(ethers.parseEther("4")); // 40% de 10 ETH
    });

    it("rechaza el doble reclamo", async function () {
      const { contract, heir1 } = await loadFixture(triggeredFixture);
      await contract.connect(heir1).claim();
      await expect(
        contract.connect(heir1).claim()
      ).to.be.revertedWithCustomError(contract, "AlreadyClaimed");
    });

    it("rechaza el reclamo de quien no es heredero", async function () {
      const { contract, stranger } = await loadFixture(triggeredFixture);
      await expect(
        contract.connect(stranger).claim()
      ).to.be.revertedWithCustomError(contract, "NotHeir");
    });

    it("rechaza el reclamo si todavía no se activó la herencia", async function () {
      const { contract, heir1 } = await loadFixture(deployFixture);
      await expect(
        contract.connect(heir1).claim()
      ).to.be.revertedWithCustomError(contract, "InvalidState");
    });

    it("resiste un intento de reentrancia en claim()", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);

      // Se agrega el contrato atacante como heredero junto con heir1
      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      // Necesitamos la dirección del contrato antes de desplegarlo para setHeirs;
      // usamos getCreateAddress para predecirla de forma determinística.
      const nonce = await ethers.provider.getTransactionCount(owner.address);

      // Desplegamos primero el atacante apuntando al contrato principal
      const attacker = await AttackerFactory.deploy(await contract.getAddress());
      await attacker.waitForDeployment();

      await contract
        .connect(owner)
        .setHeirs([heir1.address, await attacker.getAddress()], [50, 50]);
      await contract.connect(owner).deposit({ value: ethers.parseEther("2") });

      await time.increase(ONE_YEAR + 1);
      await contract.connect(owner).triggerInheritance();

      // El ataque debe revertir: ReentrancyGuard + CEI evitan el doble cobro
      await expect(attacker.attack()).to.be.reverted;
    });
  });

  // -------------------------------------------------------------------
  // sweepDust
  // -------------------------------------------------------------------
  describe("sweepDust", function () {
    it("rechaza el sweep si no todos los herederos reclamaron", async function () {
      const { contract, owner, heir1 } = await loadFixture(deployFixture);
      await contract.connect(owner).deposit({ value: ethers.parseEther("1") });
      await time.increase(ONE_YEAR + 1);
      await contract.connect(owner).triggerInheritance();
      await contract.connect(heir1).claim();

      await expect(
        contract.connect(owner).sweepDust(owner.address)
      ).to.be.revertedWithCustomError(contract, "NotAllHeirsClaimed");
    });

    it("permite al titular recuperar el remanente tras todos los reclamos", async function () {
      const { contract, owner, heir1, heir2 } = await loadFixture(deployFixture);
      // 1 wei con porcentajes 60/40 deja resto por redondeo
      await contract.connect(owner).deposit({ value: 5 });
      await time.increase(ONE_YEAR + 1);
      await contract.connect(owner).triggerInheritance();
      await contract.connect(heir1).claim(); // 60% de 5 = 3
      await contract.connect(heir2).claim(); // 40% de 5 = 2

      expect(await contract.depositBalance()).to.equal(0);
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

    it("timeUntilTrigger baja a 0 tras cumplirse el plazo", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.timeUntilTrigger()).to.be.greaterThan(0);

      await time.increase(ONE_YEAR + 1);
      expect(await contract.timeUntilTrigger()).to.equal(0);
    });
  });
});
