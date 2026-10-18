const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const ONE_DAY = 24 * 60 * 60;
const ONE_YEAR = 365 * ONE_DAY;
// Ventana de impugnación: tiempo entre la activación y el primer cobro
const CLAIM_DELAY = ONE_DAY;

describe("InheritanceWatcher", function () {
  async function deployFixture() {
    // `keeper` representa a quien ejecuta el upkeep: en Sepolia es el
    // forwarder de Chainlink Automation, acá una cuenta cualquiera.
    const [owner, heir1, heir2, keeper] = await ethers.getSigners();

    const Inheritance = await ethers.getContractFactory("DigitalInheritance");
    const inheritance = await Inheritance.connect(owner).deploy(
      ONE_YEAR,
      CLAIM_DELAY,
      [heir1.address, heir2.address],
      [60, 40]
    );
    await inheritance.waitForDeployment();

    const Watcher = await ethers.getContractFactory("InheritanceWatcher");
    const watcher = await Watcher.deploy(await inheritance.getAddress());
    await watcher.waitForDeployment();

    return { inheritance, watcher, owner, heir1, heir2, keeper };
  }

  // Herencia con fondos y con el plazo de inactividad ya vencido
  async function expiredFixture() {
    const base = await deployFixture();
    const deposit = ethers.parseEther("10"); // heir1: 60% = 6 ETH, heir2: 40% = 4 ETH
    await base.inheritance.connect(base.owner).deposit({ value: deposit });
    await time.increase(ONE_YEAR + 1);
    return { ...base, deposit };
  }

  // -------------------------------------------------------------------
  // Deploy
  // -------------------------------------------------------------------
  describe("Deploy", function () {
    it("guarda la dirección de la herencia que vigila", async function () {
      const { inheritance, watcher } = await loadFixture(deployFixture);
      expect(await watcher.inheritance()).to.equal(await inheritance.getAddress());
    });

    it("rechaza la dirección cero", async function () {
      const Watcher = await ethers.getContractFactory("InheritanceWatcher");
      await expect(Watcher.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        Watcher,
        "ZeroAddress"
      );
    });
  });

  // -------------------------------------------------------------------
  // checkUpkeep (lo consulta Chainlink Automation fuera de la cadena)
  // -------------------------------------------------------------------
  describe("checkUpkeep", function () {
    it("devuelve false mientras no venció el plazo", async function () {
      const { watcher } = await loadFixture(deployFixture);
      const [upkeepNeeded, performData] = await watcher.checkUpkeep("0x");

      expect(upkeepNeeded).to.equal(false);
      expect(performData).to.equal("0x");
    });

    it("devuelve true apenas vence el plazo", async function () {
      const { watcher } = await loadFixture(expiredFixture);
      const [upkeepNeeded] = await watcher.checkUpkeep("0x");
      expect(upkeepNeeded).to.equal(true);
    });

    it("un heartbeat del titular lo vuelve a false", async function () {
      const { inheritance, watcher, owner } = await loadFixture(expiredFixture);
      await inheritance.connect(owner).heartbeat();

      const [upkeepNeeded] = await watcher.checkUpkeep("0x");
      expect(upkeepNeeded).to.equal(false);
    });

    it("vuelve a false una vez activada la herencia", async function () {
      const { watcher } = await loadFixture(expiredFixture);
      await watcher.performUpkeep("0x");

      const [upkeepNeeded] = await watcher.checkUpkeep("0x");
      expect(upkeepNeeded).to.equal(false);
    });
  });

  // -------------------------------------------------------------------
  // performUpkeep / trigger (interacción con DigitalInheritance)
  // -------------------------------------------------------------------
  describe("performUpkeep / trigger", function () {
    it("performUpkeep activa la herencia y emite los eventos de ambos contratos", async function () {
      const { inheritance, watcher, keeper, deposit } = await loadFixture(expiredFixture);

      await expect(watcher.connect(keeper).performUpkeep("0x"))
        .to.emit(watcher, "TriggeredViaWatcher")
        .withArgs(keeper.address, anyValue)
        .and.to.emit(inheritance, "InheritanceTriggered")
        // para DigitalInheritance, quien activó la herencia es el watcher
        .withArgs(anyValue, await watcher.getAddress(), deposit);

      expect(await inheritance.status()).to.equal(1); // TRIGGERED
      expect(await inheritance.inheritedBalance()).to.equal(deposit);
    });

    it("trigger() hace lo mismo sin pasar por la interfaz de Chainlink", async function () {
      const { inheritance, watcher, keeper } = await loadFixture(expiredFixture);

      await expect(watcher.connect(keeper).trigger())
        .to.emit(watcher, "TriggeredViaWatcher")
        .withArgs(keeper.address, anyValue);

      expect(await inheritance.status()).to.equal(1); // TRIGGERED
    });

    it("propaga TooEarly si todavía no venció el plazo", async function () {
      const { inheritance, watcher } = await loadFixture(deployFixture);
      await expect(watcher.performUpkeep("0x")).to.be.revertedWithCustomError(
        inheritance,
        "TooEarly"
      );
    });

    it("propaga InvalidState si la herencia ya estaba activada", async function () {
      const { inheritance, watcher } = await loadFixture(expiredFixture);
      await watcher.performUpkeep("0x");

      await expect(watcher.performUpkeep("0x")).to.be.revertedWithCustomError(
        inheritance,
        "InvalidState"
      );
    });

    it("el titular puede cancelar un trigger del watcher si nadie cobró todavía", async function () {
      const { inheritance, watcher, owner } = await loadFixture(expiredFixture);
      await watcher.performUpkeep("0x");

      await expect(inheritance.connect(owner).cancelTrigger()).to.emit(
        inheritance,
        "TriggerCancelled"
      );
      // cancelar cuenta como prueba de vida: el watcher deja de pedir el upkeep
      const [upkeepNeeded] = await watcher.checkUpkeep("0x");
      expect(upkeepNeeded).to.equal(false);
    });

    it("flujo completo: plazo vencido, upkeep y reclamo de cada heredero", async function () {
      const { inheritance, watcher, heir1, heir2 } = await loadFixture(expiredFixture);

      const [upkeepNeeded, performData] = await watcher.checkUpkeep("0x");
      expect(upkeepNeeded).to.equal(true);
      await watcher.performUpkeep(performData);

      // los herederos cobran recién cuando se cierra la ventana de impugnación
      await expect(inheritance.connect(heir1).claim()).to.be.revertedWithCustomError(
        inheritance,
        "ClaimsNotOpenYet"
      );
      await time.increase(CLAIM_DELAY);

      await expect(inheritance.connect(heir1).claim())
        .to.emit(inheritance, "Claimed")
        .withArgs(heir1.address, heir1.address, ethers.parseEther("6"), anyValue);
      await expect(inheritance.connect(heir2).claim())
        .to.emit(inheritance, "Claimed")
        .withArgs(heir2.address, heir2.address, ethers.parseEther("4"), anyValue);

      expect(await inheritance.contractBalance()).to.equal(0);
    });
  });
});
