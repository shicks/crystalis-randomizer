export default (nes) => {
  window.onspawn = () => {};
  window.onspawned = () => {};
  window.onlocation = () => {};
  window.slots = [];
  nes.debug.breakAt(0x3c25d, 'prg', 'x', () => {
    const id = nes.cpu.ram[0x11];
    const slot = nes.cpu.ram[0x10];
    window.spawningId = id;
    window.spawningSlot = slot;
    window.slots[slot] = id;
    return window.onspawn(id, slot);
  });

  // useful to see what *actually* spawned...
  nes.debug.breakAt(0x3c263, 'prg', 'x', () => {
    return window.onspawned(window.spawningId, window.spawningSlot);
  });
  nes.debug.breakAt(0x3c2b3, 'prg', 'x', () => {
    return window.onspawned(window.spawningId, window.spawningSlot);
  });
  nes.debug.breakAt(0x3c40d, 'prg', 'x', () => {
    return window.onspawned(window.spawningId, window.spawningSlot);
  });

  nes.debug.breakAt(0x6c, 'ram', 'w', () => {
    return window.onlocation(nes.cpu.ram[0x6c]);
  });

  window.levelUp = (incr = 0) => {
    nes.cpu.ram[0x706] = 1;
    nes.cpu.ram[0x707] = 0;
    nes.cpu.ram[0x421] = Math.min(nes.cpu.ram[0x421] + incr, 15);
  };

  window.max = () => {
    window.levelUp(14);
    nes.cpu.ram[0x3c1] = nes.cpu.ram[0x708] = 0xff;
    nes.cpu.ram[0x702] = nes.cpu.ram[0x703] = 0xff;
    nes.cpu.write(0x6430, 0x00);
    nes.cpu.write(0x6431, 0x01);
    nes.cpu.write(0x6432, 0x02);
    nes.cpu.write(0x6433, 0x03);
    nes.cpu.write(0x6434, 0x19);
    nes.cpu.write(0x6435, 0x1a);
    nes.cpu.write(0x6436, 0x1b);
    nes.cpu.write(0x6437, 0x1c);
    nes.cpu.write(0x6438, 0x11);
    nes.cpu.write(0x6439, 0x12);
    nes.cpu.write(0x643a, 0x13);
    nes.cpu.write(0x643b, 0x14);
    nes.cpu.write(0x643c, 0x06);
    nes.cpu.write(0x643d, 0x08);
    nes.cpu.write(0x643e, 0x0a);
    nes.cpu.write(0x643f, 0x0c);
  }

  window.hex = (x) => '$' + x.toString(16).padStart(2, 0);
  window.seq = (n, f) => new Array(n).fill(0).map((x, i) => f(i));

  window.watchSpawns = () => {
    window.onspawned = (id,slot)=>console.log(`spawned ${hex(id)} at ${hex(slot)
         }: ${seq(32,i=>hex(nes.cpu.ram[0x300+32*i+slot]))}`);
  };

  window.watchDamage = () => {
    nes.debug.breakAt(0x35357, 'prg', 'x', () => console.log(`hit by ${
         hex(nes.cpu.REG_Y)}: ${hex(slots[nes.cpu.REG_Y])}`));
  };

  window.warp = (loc, entrance = 0) => {
    nes.cpu.ram[0x6c] = loc;
    nes.cpu.ram[0x6d] = entrance;
    nes.cpu.ram[0x41] = 1;
  };

  class Flag {
    constructor(id, addr, mask) {
      this.id = id;
      this.addr = (id >> 3) + 0x6480;
      this.mask = 1 << (id & 7);
    }

    get() {
      return !!(nes.cpu.load(this.addr) & this.mask);
    }

    set() {
      nes.cpu.write(this.addr, nes.cpu.load(this.addr) | this.mask);
    }

    clear() {
      nes.cpu.write(this.addr, nes.cpu.load(this.addr) & ~this.mask);
    }

    toString() {
      return `Flag ${this.id.toString(16).padStart(3,0)} (${this.addr.toString(16)}:${this.mask.toString(16).padStart(2,0)}): ${this.get()}`;
    }
  }

  window.flag = (id) => {
    return new Flag(id);
  };

  window.itemget = {
    swordOfWind: () => getItem(nes, 0x00),
    swordOfFire: () => getItem(nes, 0x01),
    swordOfWater: () => getItem(nes, 0x02),
    swordOfThunder: () => getItem(nes, 0x03),
    crystalis: () => getItem(nes, 0x04),
    ballOfWind: () => getItem(nes, 0x05),
    tornadoBracelet: () => getItem(nes, 0x06),
    ballOfFire: () => getItem(nes, 0x07),
    flameBracelet: () => getItem(nes, 0x08),
    ballOfWater: () => getItem(nes, 0x09),
    blizzardBracelet: () => getItem(nes, 0x0a),
    ballOfThunder: () => getItem(nes, 0x0b),
    stormBracelet: () => getItem(nes, 0x0c),
    sacredShield: () => getItem(nes, 0x12),
    battleShield: () => getItem(nes, 0x13),
    psychoShield: () => getItem(nes, 0x14),
    battleArmor: () => getItem(nes, 0x1b),
    psychoArmor: () => getItem(nes, 0x1c),
    medicalHerb: () => getItem(nes, 0x1d),
    antidote: () => getItem(nes, 0x1e),
    lysisPlant: () => getItem(nes, 0x1f),
    fruitOfLime: () => getItem(nes, 0x20),
    fruitOfPower: () => getItem(nes, 0x21),
    magicRing: () => getItem(nes, 0x22),
    fruitOfRepun: () => getItem(nes, 0x23),
    warpBoots: () => getItem(nes, 0x24),
    statueOfOnyx: () => getItem(nes, 0x25),
    opelStatue: () => getItem(nes, 0x26),
    insectFlute: () => getItem(nes, 0x27),
    fluteOfLime: () => getItem(nes, 0x28),
    gasMask: () => getItem(nes, 0x29),
    powerRing: () => getItem(nes, 0x2a),
    warriorRing: () => getItem(nes, 0x2b),
    ironNecklace: () => getItem(nes, 0x2c),
    deosPendant: () => getItem(nes, 0x2d),
    rabbitBoots: () => getItem(nes, 0x2e),
    leatherBoots: () => getItem(nes, 0x2f),
    shieldRing: () => getItem(nes, 0x30),
    alarmFlute: () => getItem(nes, 0x31),
    windmillKey: () => getItem(nes, 0x32),
    keyToPrison: () => getItem(nes, 0x33),
    keyToStyx: () => getItem(nes, 0x34),
    fogLamp: () => getItem(nes, 0x35),
    shellFlute: () => getItem(nes, 0x36),
    eyeGlasses: () => getItem(nes, 0x37),
    brokenStatue: () => getItem(nes, 0x38),
    glowingLamp: () => getItem(nes, 0x39),
    statueOfGold: () => getItem(nes, 0x3a),
    lovePendant: () => getItem(nes, 0x3b),
    kirisaPlant: () => getItem(nes, 0x3c),
    ivoryStatue: () => getItem(nes, 0x3d),
    bowOfMoon: () => getItem(nes, 0x3e),
    bowOfSun: () => getItem(nes, 0x3f),
    bowOfTruth: () => getItem(nes, 0x40),
    refresh: () => getItem(nes, 0x41),
    paralysis: () => getItem(nes, 0x42),
    telepathy: () => getItem(nes, 0x43),
    teleport: () => getItem(nes, 0x44),
    recover: () => getItem(nes, 0x45),
    barrier: () => getItem(nes, 0x46),
    change: () => getItem(nes, 0x47),
    flight: () => getItem(nes, 0x48),
  };
};


const getItem = (nes, item) => {
  // look up the position in the chart...
  const addr = (nes.rom.rom[0x1db00 + 2 * item] |
                nes.rom.rom[0x1db01 + 2 * item]) + 0x14000;
  const offset = 0x6430 + nes.rom.rom[addr];
  for (let i = 0; i < nes.rom.rom[addr + 1]; i++) {
    if (nes.cpu.read(offset + i) != 0xff) continue;
    nes.cpu.write(offset + i, item);
    // TODO - actually set the flags?  also the extended one?
    break;
  }
};
