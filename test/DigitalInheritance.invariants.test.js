const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, setBalance } = require("@nomicfoundation/hardhat-network-helpers");

// Test de propiedades (estilo fuzzing) sobre el reparto. En vez de casos elegidos a
// mano, genera escenarios aleatorios y verifica invariantes que valen para cualquier
// entrada. Usa una semilla fija: si un escenario falla, se reproduce con la misma
// semilla, que aparece en el mensaje del assert.

const PERIOD = 600;
const CLAIM_DELAY = 120;
const RUNS = 30;

// Generador pseudoaleatorio determinista (mulberry32)
function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rand, min, max) => min + Math.floor(rand() * (max - min + 1));

// Reparte 100 en `n` porcentajes de al menos 1 cada uno
function randomPercentages(rand, n) {
  const pcts = Array(n).fill(1);
  for (let left = 100 - n; left > 0; left--) pcts[randInt(rand, 0, n - 1)] += 1;
  return pcts;
}

function shuffle(rand, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(rand, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

describe("DigitalInheritance · invariantes del reparto", function () {
  it(`en ${RUNS} escenarios aleatorios, el reparto es exacto y nunca se toca lo reservado`, async function () {
    const signers = await ethers.getSigners();
    const owner = signers[0];
    const Factory = await ethers.getContractFactory("DigitalInheritance");

    for (let run = 0; run < RUNS; run++) {
      const seed = 1000 + run;
      const rand = prng(seed);
      const tag = `semilla ${seed}`;

      // Escenario: entre 1 y 10 herederos, porcentajes y montos aleatorios, a veces con ETH forzado
      const n = randInt(rand, 1, 10);
      const heirs = signers.slice(1, 1 + n);
      const pcts = randomPercentages(rand, n);
      const deposit = rand() < 0.5 ? BigInt(randInt(rand, 1, 1_000_000)) : ethers.parseEther(String(randInt(rand, 1, 50)));
      const forced = rand() < 0.4 ? BigInt(randInt(rand, 1, 999)) : 0n;

      const contract = await Factory.connect(owner).deploy(PERIOD, CLAIM_DELAY, heirs.map((h) => h.address), pcts);
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      await contract.connect(owner).deposit({ value: deposit });
      if (forced > 0n) await setBalance(address, deposit + forced);

      await time.increase(PERIOD + 1);
      await contract.connect(heirs[0]).triggerInheritance();
      const total = deposit + forced;
      expect(await contract.inheritedBalance(), tag).to.equal(total);
      await time.increase(CLAIM_DELAY);

      let unclaimedPct = 100n;
      let paid = 0n;
      let swept = 0n;
      const reserved = () => (total * unclaimedPct) / 100n;

      for (const heir of shuffle(rand, heirs)) {
        // A veces el titular barre en medio de los cobros
        if (rand() < 0.35) {
          const balance = await ethers.provider.getBalance(address);
          // Invariante 1: lo barrible es exactamente lo que no está reservado
          expect(await contract.sweepableBalance(), tag).to.equal(balance - reserved());
          const tx = await contract.connect(owner).sweepDust(owner.address);
          swept += (await tx.wait()).logs.map((l) => contract.interface.parseLog(l)).find((e) => e.name === "DustSwept").args.amount;
          // Invariante 2: después de barrer queda justo lo reservado
          expect(await ethers.provider.getBalance(address), tag).to.equal(reserved());
        }

        const pct = BigInt(pcts[heirs.indexOf(heir)]);
        const expected = (total * pct) / 100n;
        const receipt = await (await contract.connect(heir).claim()).wait();
        const event = receipt.logs.map((l) => contract.interface.parseLog(l)).find((e) => e.name === "Claimed");

        // Invariante 3: cada heredero cobra exactamente floor(total × porcentaje / 100)
        expect(event.args.amount, tag).to.equal(expected);
        paid += expected;
        unclaimedPct -= pct;

        // Invariante 4: al contrato siempre le alcanza para lo que falta cobrar
        expect(await ethers.provider.getBalance(address), tag).to.be.greaterThanOrEqual(reserved());
      }

      // Invariante 5: con todos cobrados, el barrido final deja el contrato en 0 y no se pierde ni se crea ETH
      const final = await contract.connect(owner).sweepDust(owner.address);
      swept += (await final.wait()).logs.map((l) => contract.interface.parseLog(l)).find((e) => e.name === "DustSwept").args.amount;
      expect(await ethers.provider.getBalance(address), tag).to.equal(0);
      expect(paid + swept, tag).to.equal(total);
      expect(await contract.claimsCount(), tag).to.equal(n);
    }
  });
});
