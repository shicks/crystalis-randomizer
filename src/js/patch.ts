import {Assembler} from './6502.js';
import {crc32} from './crc32.js';
import {LogType, ProgressTracker, shuffle2 as shuffleDepgraph} from './depgraph.js';
import {FetchReader} from './fetchreader.js';
import {FlagSet} from './flagset.js';
import {Random} from './random.js';
import {Rom} from './rom.js';
import {Entrance, Exit, Flag, Location, Spawn} from './rom/location.js';
import {GlobalDialog, LocalDialog} from './rom/npc.js';
import {ShopType} from './rom/shop.js';
import {seq, writeLittleEndian} from './rom/util.js';
import * as version from './version.js';

// TODO - to shuffle the monsters, we need to find the sprite palttes and
// patterns for each monster.  Each location supports up to two matchups,
// so can only support monsters that match.  Moreover, different monsters
// seem to need to be in either slot 0 or 1.

// Pull in all the patches we want to apply automatically.
// TODO - make a debugger window for patches.
// TODO - this needs to be a separate non-compiled file.
export default ({
  async apply(rom: Uint8Array, hash: {[key: string]: unknown}, path: string): Promise<void> {
    // Look for flag string and hash
    let flags;
    if (!hash.seed) {
      // TODO - send in a hash object with get/set methods
      hash.seed = parseSeed('').toString(16);
      window.location.hash += '&seed=' + hash.seed;
    }
    if (hash.flags) {
      flags = new FlagSet(String(hash.flags));
    } else {
      flags = new FlagSet('Em Gt Mr Rlpt Sbk Sct Sm Tasd');
    }
    for (const key in hash) {
      if (hash[key] === 'false') hash[key] = false;
    }
    await shuffle(rom, parseSeed(String(hash.seed)), flags, new FetchReader(path));
  },
});

export const parseSeed = (seed: string): number => {
  if (!seed) return Random.newSeed();
  if (/^[0-9a-f]{1,8}$/i.test(seed)) return Number.parseInt(seed, 16);
  return crc32(seed);
};

/**
 * Abstract out File I/O.  Node and browser will have completely
 * different implementations.
 */
export interface Reader {
  read(filename: string): Promise<string>;
}

export const shuffle = async (rom: Uint8Array,
                              seed: number,
                              flags: FlagSet,
                              reader: Reader,
                              log?: LogType,
                              progress?: ProgressTracker) => {
  // First reencode the seed, mixing in the flags for security.
  if (typeof seed !== 'number') throw new Error('Bad seed');
  const newSeed = crc32(seed.toString(16).padStart(8, '0') + String(flags)) >>> 0;

  const touchShops = true;

  const defines: {[name: string]: boolean} = {
    _ALLOW_TELEPORT_OUT_OF_TOWER: true,
    _AUTO_EQUIP_BRACELET: flags.autoEquipBracelet(),
    _BARRIER_REQUIRES_CALM_SEA: flags.barrierRequiresCalmSea(),
    _BUFF_DEOS_PENDANT: flags.buffDeosPendant(),
    _CHECK_FLAG0: true,
    _DISABLE_SHOP_GLITCH: flags.disableShopGlitch(),
    _DISABLE_STATUE_GLITCH: flags.disableStatueGlitch(),
    _DISABLE_SWORD_CHARGE_GLITCH: flags.disableSwordChargeGlitch(),
    _DISABLE_WILD_WARP: false,
    _DISPLAY_DIFFICULTY: true,
    _EXTRA_PITY_MP: true,  // TODO: allow disabling this
    _FIX_OPEL_STATUE: true,
    _FIX_SHAKING: true,
    _FIX_VAMPIRE: true,
    _LEATHER_BOOTS_GIVE_SPEED: flags.leatherBootsGiveSpeed(),
    _NERF_FLIGHT: true,
    _NERF_WILD_WARP: flags.nerfWildWarp(),
    _NEVER_DIE: flags.neverDie(),
    _NORMALIZE_SHOP_PRICES: touchShops,
    _PITY_HP_AND_MP: true,
    _PROGRESSIVE_BRACELET: true,
    _RABBIT_BOOTS_CHARGE_WHILE_WALKING: flags.rabbitBootsChargeWhileWalking(),
    _REQUIRE_HEALED_DOLPHIN_TO_RIDE: flags.requireHealedDolphinToRide(),
    _REVERSIBLE_SWAN_GATE: true,
    _SAHARA_RABBITS_REQUIRE_TELEPATHY: flags.saharaRabbitsRequireTelepathy(),
    _TELEPORT_ON_THUNDER_SWORD: flags.teleportOnThunderSword(),
  };

  const asm = new Assembler();
  const assemble = async (path: string) => {
    asm.assemble(await reader.read(path), path);
    asm.patchRom(rom);
  };

  const flagFile =
      Object.keys(defines)
          .filter(d => defines[d]).map(d => `define ${d} 1\n`).join('');
  asm.assemble(flagFile, 'flags.s');
  await assemble('preshuffle.s');

  const random = new Random(newSeed);

  // Parse the rom and apply other patches - note: must have shuffled
  // the depgraph FIRST!
  const parsed = new Rom(rom);

  makeBraceletsProgressive(parsed);
  closeCaveEntrances(parsed, flags);
  reversibleSwanGate(parsed);
  adjustGoaFortressTriggers(parsed);
  preventNpcDespawns(parsed, flags);
  if (flags.requireHealedDolphinToRide()) requireHealedDolphin(parsed);
  if (flags.saharaRabbitsRequireTelepathy()) requireTelepathyForDeo(parsed);

  adjustItemNames(parsed, flags);

  await assemble('postparse.s');

  // TODO - consider making a Transformation interface, with ordering checks
  alarmFluteIsKeyItem(parsed); // NOTE: pre-shuffle
  if (flags.teleportOnThunderSword()) {
    teleportOnThunderSword(parsed);
  } else {
    noTeleportOnThunderSword(parsed);
  }

  parsed.scalingLevels = 48;
  parsed.uniqueItemTableAddress = asm.expand('KeyItemData');

  // TODO - set omitItemGetDataSuffix and omitLocalDialogSuffix

  await shuffleDepgraph(parsed, random, log, flags, progress);

  // TODO - rewrite rescaleShops to take a Rom instead of an array...
  if (touchShops) {
    // TODO - separate logic for handling shops w/o Pn specified (i.e. vanilla
    // shops that may have been randomized)
    rescaleShops(parsed, asm, flags.bargainHunting() ? random : undefined);
  }

  rescaleMonsters(parsed);
  if (flags.shuffleMonsters()) shuffleMonsters(parsed, random);
  identifyKeyItemsForDifficultyBuffs(parsed);

  // Buff medical herb and fruit of power
  if (flags.doubleBuffMedicalHerb()) {
    rom[0x1c50c + 0x10] *= 2;  // fruit of power
    rom[0x1c4ea + 0x10] *= 3;  // medical herb
  } else if (flags.buffMedicalHerb()) {
    rom[0x1c50c + 0x10] += 16; // fruit of power
    rom[0x1c4ea + 0x10] *= 2;  // medical herb
  }

  if (flags.connectLimeTreeToLeaf()) {
    connectLimeTreeToLeaf(parsed);
  }

  addCordelWestTriggers(parsed, flags);
  if (flags.disableRabbitSkip()) fixRabbitSkip(parsed);
  if (flags.storyMode()) storyMode(parsed);

  if (flags.chargeShotsOnly()) disableStabs(parsed);

  if (flags.orbsOptional()) orbsOptional(parsed);

  misc(parsed, flags);

  // NOTE: This needs to happen BEFORE postshuffle
  await parsed.writeData();
  const crc = await postParsedShuffle(rom, random, seed, flags, asm, assemble);

  // TODO - optional flags can possibly go here, but MUST NOT use parsed.prg!

  return crc;
};

// Separate function to guarantee we no longer have access to the parsed rom...
const postParsedShuffle = async (rom: Uint8Array,
                                 random: Random,
                                 seed: number,
                                 flags: FlagSet,
                                 asm: Assembler,
                                 assemble: (path: string) => Promise<void>) => {
  await assemble('postshuffle.s');
  updateDifficultyScalingTables(rom, flags, asm);
  updateCoinDrops(rom, flags);

  shuffleRandomNumbers(rom, random);

  return stampVersionSeedAndHash(rom, seed, flags);

  // BELOW HERE FOR OPTIONAL FLAGS:

  // do any "vanity" patches here...
  // console.log('patch applied');
  // return log.join('\n');
};

const misc = (rom: Rom, flags: FlagSet) => {
  // NOTE: we still need to do some work actually adjusting
  // message texts to prevent line overflow, etc.  We should
  // also make some hooks to easily swap out items where it
  // makes sense.
  rom.messages.parts[2][2].text = `
{01:Akahana} is handed a statue.#
Thanks for finding that.
I was totally gonna sell
it for tons of cash.#
Here, have this lame
[29:Gas Mask] or something.`;
  rom.messages.parts[0][0xe].text = `It's dangerous to go alone!
Take this.`;
  if (!rom || !flags) console.log(rom, flags);
};

function makeBraceletsProgressive(rom: Rom): void {
  // tornel's trigger needs both items
  const tornel = rom.npcs[0x5f];
  const vanilla = tornel.localDialogs.get(0x21)!;
  const patched = [
    vanilla[0], // already learned teleport
    vanilla[2], // don't have tornado bracelet
    vanilla[2], // will change to don't have orb
    vanilla[1], // have bracelet, learn teleport
  ];
  patched[1].condition = ~0x206; // don't have bracelet
  patched[2].condition = ~0x205; // don't have orb
  patched[3].condition = ~0;     // default
  tornel.localDialogs.set(0x21, patched);
}

const closeCaveEntrances = (rom: Rom, flags: FlagSet) => {

  // Clear tiles 1,2,3,4 for blockable caves in tilesets 90, 94, and 9c
  rom.swapMetatiles([0x90],
                    [0x07, [0x01, 0x00], ~0xc1],
                    [0x0e, [0x02, 0x00], ~0xc1],
                    [0x20, [0x03, 0x0a], ~0xd7],
                    [0x21, [0x04, 0x0a], ~0xd7]);
  rom.swapMetatiles([0x94, 0x9c],
                    [0x68, [0x01, 0x00], ~0xc1],
                    [0x83, [0x02, 0x00], ~0xc1],
                    [0x88, [0x03, 0x0a], ~0xd7],
                    [0x89, [0x04, 0x0a], ~0xd7]);

  // Now replace the tiles with the blockable ones
  rom.screens[0x0a].tiles[0x3][0x8] = 0x01;
  rom.screens[0x0a].tiles[0x3][0x9] = 0x02;
  rom.screens[0x0a].tiles[0x4][0x8] = 0x03;
  rom.screens[0x0a].tiles[0x4][0x9] = 0x04;

  rom.screens[0x15].tiles[0x7][0x9] = 0x01;
  rom.screens[0x15].tiles[0x7][0xa] = 0x02;
  rom.screens[0x15].tiles[0x8][0x9] = 0x03;
  rom.screens[0x15].tiles[0x8][0xa] = 0x04;

  rom.screens[0x19].tiles[0x4][0x8] = 0x01;
  rom.screens[0x19].tiles[0x4][0x9] = 0x02;
  rom.screens[0x19].tiles[0x5][0x8] = 0x03;
  rom.screens[0x19].tiles[0x5][0x9] = 0x04;

  rom.screens[0x3e].tiles[0x5][0x6] = 0x01;
  rom.screens[0x3e].tiles[0x5][0x7] = 0x02;
  rom.screens[0x3e].tiles[0x6][0x6] = 0x03;
  rom.screens[0x3e].tiles[0x6][0x7] = 0x04;

  // NOTE: flag 2ef is ALWAYS set - use it as a baseline.
  const flagsToClear = [
    [0x03, 0x30], // valley of wind, zebu's cave
    [0x14, 0x30], // cordel west, vampire cave
    [0x15, 0x30], // cordel east, vampire cave
    [0x40, 0x00], // waterfall north, prison cave
    [0x40, 0x14], // waterfall north, fog lamp
    [0x41, 0x74], // waterfall south, kirisa
    [0x47, 0x10], // kirisa meadow
    [0x94, 0x00], // cave to desert
    [0x98, 0x41],
  ];
  for (const [loc, yx] of flagsToClear) {
    rom.locations[loc].flags.push(Flag.of({yx, flag: 0x2ef}));
  }

  const replaceFlag = (loc: number, yx: number, flag: number) => {
    for (const f of rom.locations[loc].flags) {
      if (f.yx === yx) {
        f.flag = flag;
        return;
      }
    }
    throw new Error(`Could not find flag to replace at ${loc}:${yx}`);
  };

  if (flags.paralysisRequiresPrisonKey()) { // close off reverse entrances
    // NOTE: we could also close it off until boss killed...?
    //  - const vampireFlag = ~rom.npcSpawns[0xc0].conditions[0x0a][0];
    //  -> kelbesque for the other one.
    const windmillFlag = 0x2ee;
    replaceFlag(0x14, 0x30, windmillFlag);
    replaceFlag(0x15, 0x30, windmillFlag);

    replaceFlag(0x40, 0x00, 0x2d8); // key to prison flag
    const explosion = Spawn.of({y: 0x060, x: 0x060, type: 4, id: 0x2c});
    const keyTrigger = Spawn.of({y: 0x070, x: 0x070, type: 2, id: 0xad});
    rom.locations[0x40].spawns.splice(1, 0, explosion);
    rom.locations[0x40].spawns.push(keyTrigger);
  }

  // rom.locations[0x14].tileEffects = 0xb3;

  // d7 for 3?

  // TODO - this ended up with message 00:03 and an action that gave bow of moon!

  // rom.triggers[0x19].message.part = 0x1b;
  // rom.triggers[0x19].message.index = 0x08;
  // rom.triggers[0x19].flags.push(0x2f6, 0x2f7, 0x2f8);
};

// @ts-ignore: not yet used
const eastCave = (rom: Rom) => {
  // NOTE: 0x9c can become 0x99 in top left or 0x97 in top right or bottom middle for a cave exit
  const screens1 = [[0x9c, 0x84, 0x80, 0x83, 0x9c],
                    [0x80, 0x81, 0x83, 0x86, 0x80],
                    [0x83, 0x88, 0x89, 0x80, 0x80],
                    [0x81, 0x8c, 0x85, 0x82, 0x84],
                    [0x9a, 0x85, 0x9c, 0x98, 0x86]];
  const screens2 = [[0x9c, 0x84, 0x9b, 0x80, 0x9b],
                    [0x80, 0x81, 0x81, 0x80, 0x81],
                    [0x80, 0x87, 0x8b, 0x8a, 0x86],
                    [0x80, 0x8c, 0x80, 0x85, 0x84],
                    [0x9c, 0x86, 0x80, 0x80, 0x9a]];
  // TODO fill up graphics, etc --> $1a, $1b, $05 / $88, $b5 / $14, $02
  // Think aobut exits and entrances...?
  console.log(rom, screens1, screens2);
};

const adjustGoaFortressTriggers = (rom: Rom) => {
  // Move Kelbesque 2 one tile left.
  rom.locations[0xa9].spawns[0].x -= 8;
  // Remove sage screen locks (except Kensu).
  rom.locations[0xaa].spawns.splice(1, 1); // zebu screen lock trigger
  rom.locations[0xac].spawns.splice(2, 1); // tornel screen lock trigger
  rom.locations[0xb9].spawns.splice(2, 1); // asina screen lock trigger
};

const alarmFluteIsKeyItem = (rom: Rom) => {
  // Person 14 (Zebu's student): secondary item -> alarm flute
  rom.npcs[0x14].data[1] = 0x31; // NOTE: Clobbers shuffled item!!!
  // Move alarm flute to third row
  rom.itemGets[0x31].inventoryRowStart = 0x20;
  // Ensure alarm flute cannot be dropped
  // rom.prg[0x21021] = 0x43; // TODO - rom.items[0x31].???
  rom.items[0x31].unique = true;
  // Ensure alarm flute cannot be sold
  rom.items[0x31].basePrice = 0;

  // Remove alarm flute from shops (replace with other items)
  // NOTE - we could simplify this whole thing by just hardcoding indices.
  //      - if this is guaranteed to happen early, it's all the same.
  const replacements = [
    [0x21, 0.72], // fruit of power, 72% of cost
    [0x1f, 0.9], // lysis plant, 90% of cost
  ];
  let j = 0;
  for (const shop of rom.shops) {
    if (shop.type !== ShopType.TOOL) continue;
    for (let i = 0, len = shop.contents.length; i < len; i++) {
      if (shop.contents[i] !== 0x31) continue;
      const [item, priceRatio] = replacements[(j++) % replacements.length];
      shop.contents[i] = item;
      if (rom.shopDataTablesAddress) {
        // NOTE: this is broken - need a controlled way to convert price formats
        shop.prices[i] = Math.round(shop.prices[i] * priceRatio);
      }
    }
  }

  // Change flute of lime chest's (now-unused) itemget to have medical herb
  rom.itemGets[0x5b].itemId = 0x1d;
  // Change the actual spawn for that chest to be the mirrored shield chest
  rom.locations[0x57].spawns[0x19 - 0xd].id = 0x10;

  // TODO - require new code for two uses
};

const reversibleSwanGate = (rom: Rom) => {
  // Allow opening Swan from either side by adding a pair of guards on the
  // opposite side of the gate.
  rom.locations[0x73].spawns.push(
    // NOTE: Soldiers must come in pairs (with index ^1 from each other)
    Spawn.of({xt: 0x0a, yt: 0x02, type: 1, id: 0x2d}), // new soldier
    Spawn.of({xt: 0x0b, yt: 0x02, type: 1, id: 0x2d}), // new soldier
    Spawn.of({xt: 0x0e, yt: 0x0a, type: 2, id: 0xb3}), // new trigger: erase guards
  );

  // Guards ($2d) at swan gate ($73) ~ set 10d after opening gate => condition for despawn
  rom.npcs[0x2d].localDialogs.get(0x73)![0].flags.push(0x10d);

  // Despawn guard trigger requires 10d
  rom.trigger(0xb3).conditions.push(0x10d);
};

const preventNpcDespawns = (rom: Rom, flags: FlagSet) => {
  // Leaf elder in house ($0d @ $c0) ~ sword of wind redundant flag
  rom.npcs[0x0d].localDialogs.get(0xc0)![2].flags = [];

  // Windmill guard ($14 @ $0e) shouldn't despawn after abduction (038),
  // but instead after giving the item (232).
  rom.npcs[0x14].spawnConditions.get(0x0e)![1] = ~0x232; // replace flag ~038 => ~232
  rom.npcs[0x14].localDialogs.get(0x0e)![0].flags = []; // remove redundant flag ~ windmill key

  // Akahana ($16) ~ shield ring redundant flag
  rom.npcs[0x16].localDialogs.get(0x57)![0].flags = [];
  rom.npcs[0x88].localDialogs.get(0x57)![0].flags = []; // NOTE: need to keep these in sync
  // Don't disappear after getting barrier
  rom.npcs[0x16].spawnConditions.get(0x57)!.shift(); // remove 051 NOT learned barrier
  rom.npcs[0x88].spawnConditions.get(0x57)!.pop(); // remove 051 NOT learned barrier

  const reverseDialog = (ds: LocalDialog[]) => {
    ds.reverse();
    for (let i = 0; i < ds.length; i++) {
      const next = ds[i + 1];
      ds[i].condition = next ? ~next.condition : ~0;
    }
  };

  // Oak elder ($1d) ~ sword of fire redundant flag
  const oakElderDialog = rom.npcs[0x1d].localDialogs.get(-1)!;
  oakElderDialog[4].flags = [];
  // Make sure that we try to give the item from *all* post-insect dialogs
  oakElderDialog[0].message.action = 0x03;
  oakElderDialog[1].message.action = 0x03;
  oakElderDialog[2].message.action = 0x03;
  oakElderDialog[3].message.action = 0x03;

  // Oak mother ($1e) ~ insect flute redundant flag
  // TODO - rearrange these flags a bit (maybe ~045, ~0a0 ~041 - so reverse)
  //      - will need to change ballOfFire and insectFlute in depgraph
  const oakMotherDialog = rom.npcs[0x1e].localDialogs.get(-1)!;
  (() => {
    const [killedInsect, gotItem, getItem, findChild] = oakMotherDialog;
    findChild.condition = ~0x045;
    getItem.condition = ~0x227;
    getItem.flags = [];
    gotItem.condition = ~0;
    rom.npcs[0x1e].localDialogs.set(-1, [findChild, getItem, killedInsect, gotItem]);
  })();
  /// oakMotherDialog[2].flags = [];
  // // Ensure we always give item after insect.
  // oakMotherDialog[0].message.action = 0x03;
  // oakMotherDialog[1].message.action = 0x03;
  // reverseDialog(oakMotherDialog);

  // Reverse the other oak dialogs, too.
  for (const i of [0x20, 0x21, 0x22, 0x7c, 0x7d]) {
    reverseDialog(rom.npcs[i].localDialogs.get(-1)!);
  }

  // Swap the first two oak child dialogs.
  const oakChildDialog = rom.npcs[0x1f].localDialogs.get(-1)!;
  oakChildDialog.unshift(...oakChildDialog.splice(1, 1));

  // Throne room back door guard ($33 @ $df) should have same spawn condition as queen
  // (020 NOT queen not in throne room AND 01b NOT viewed mesia recording)
  rom.npcs[0x33].spawnConditions.set(0xdf,  [~0x020, ~0x01b]);

  // Front palace guard ($34) vacation message keys off 01b instead of 01f
  rom.npcs[0x34].localDialogs.get(-1)![1].condition = 0x01b;

  // Queen's ($38) dialog needs quite a bit of work
  const queen = rom.npcs[0x38];
  const queenDialog = queen.localDialogs.get(-1)!;
  // Give item (flute of lime) even if got the sword of water
  queenDialog[3].message.action = 0x03; // "you found sword" => action 3
  queenDialog[4].flags.push(0x09c);     // set 09c queen going away
  // Queen spawn condition depends on 01b (mesia recording) not 01f (ball of water)
  // This ensures you have both sword and ball to get to her (???)
  queen.spawnConditions.get(0xdf)![1] = ~0x01b;  // throne room: 01b NOT mesia recording
  queen.spawnConditions.get(0xe1)![0] = 0x01b;   // back room: 01b mesia recording
  queenDialog[1].condition = 0x01b;     // reveal condition: 01b mesia recording

  // Fortune teller ($39) should also not spawn based on mesia recording rather than orb
  rom.npcs[0x39].spawnConditions.get(0xd8)![1] = ~0x01b;  // fortune teller room: 01b NOT

  // Clark ($44) moves after talking to him (08d) rather than calming sea (08f).
  // TODO - change 08d to whatever actual item he gives, then remove both flags
  rom.npcs[0x44].spawnConditions.set(0xe9, [~0x08d]); // zombie town basement
  rom.npcs[0x44].spawnConditions.set(0xe4, [0x08d]);  // joel shed
  rom.npcs[0x44].localDialogs.get(0xe9)![1].flags.pop(); // remove redundant itemget flag

  // Brokahana ($54) ~ warrior ring redundant flag
  rom.npcs[0x54].localDialogs.get(-1)![2].flags = [];

  // Deo ($5a) ~ pendant redundant flag
  rom.npcs[0x5a].localDialogs.get(-1)![1].flags = [];

  // Zebu ($5e) cave dialog (@ $10)
  rom.npcs[0x5e].localDialogs.set(0x10, [
    LocalDialog.of(~0x03a, [0x00, 0x1a], [0x03a]), // 03a NOT talked to zebu in cave -> Set 03a
    LocalDialog.of( 0x00d, [0x00, 0x1d]), // 00d leaf villagers rescued
    LocalDialog.of( 0x038, [0x00, 0x1c]), // 038 leaf attacked
    LocalDialog.of( 0x241, [0x00, 0x1d]), // [241] learned refresh
    LocalDialog.of( 0x00a, [0x00, 0x1b, 0x03]), // 00a windmill key used -> teach refresh
    LocalDialog.of(~0x000, [0x00, 0x1d]),
  ]);
  // Don't despawn on getting barrier
  rom.npcs[0x5e].spawnConditions.get(0x10)!.pop(); // remove 051 NOT learned barrier

  // Tornel ($5f) in sabre west ($21) ~ teleport redundant flag
  rom.npcs[0x5f].localDialogs.get(0x21)![1].flags = [];
  // Don't despawn on getting barrier
  rom.npcs[0x5f].spawnConditions.delete(0x21); // remove 051 NOT learned barrier

  // Stom ($60): don't despawn on getting barrier
  rom.npcs[0x60].spawnConditions.delete(0x1e); // remove 051 NOT learned barrier

  // Asina ($62) in back room ($e1) gives flute of lime
  const asina = rom.npcs[0x62];
  asina.data[1] = 0x28;
  asina.localDialogs.get(0xe1)![0].message.action = 0x11;
  asina.localDialogs.get(0xe1)![2].message.action = 0x11;
  // Prevent despawn from back room after defeating sabera (~$8f)
  asina.spawnConditions.get(0xe1)!.pop();

  // Kensu in cabin ($68 @ $61) needs to be available even after visiting Joel.
  // Change him to just disappear after setting the rideable dolphin flag (09b),
  // and to not even show up at all unless the fog lamp was returned (021).
  rom.npcs[0x68].spawnConditions.set(0x61, [~0x09b, 0x021]);
  rom.npcs[0x68].localDialogs.get(-1)![0].message.action = 0x02; // disappear

  // Kensu in lighthouse ($74/$7e @ $62) ~ pendant redundant flag
  rom.npcs[0x74].localDialogs.get(0x62)![0].flags = [];
  rom.npcs[0x7e].localDialogs.get(0x62)![0].flags = [];

  // Azteca ($83) in pyramid ~ bow of truth redundant flag
  rom.npcs[0x83].localDialogs.get(-1)![0].condition = ~0x240;  // 240 NOT bow of truth
  rom.npcs[0x83].localDialogs.get(-1)![0].flags = [];

  // Remove useless spawn condition from Mado 1
  rom.npcs[0xc4].spawnConditions.delete(0xf2); // always spawn

  // Draygon 2 ($cb @ location $a6) should despawn after being defeated.
  rom.npcs[0xcb].spawnConditions.set(0xa6, [~0x28d]); // key on back wall destroyed

  // Fix Zebu to give key to stxy even if thunder sword is gotten (just switch the
  // order of the first two).  Also don't bother setting 03b since the new ItemGet
  // logic obviates the need.
  const zebuShyron = rom.npcs[0x5e].localDialogs.get(0xf2)!;
  zebuShyron.unshift(...zebuShyron.splice(1, 1));
  zebuShyron[0].flags = [];

  // Shyron massacre ($80) requires key to stxy
  rom.trigger(0x80).conditions.push(0x234); // 234 key to stxy

  // Enter shyron ($81) should set warp no matter what
  rom.trigger(0x81).conditions = [];

  if (flags.barrierRequiresCalmSea()) {
    // Learn barrier ($84) requires calm sea
    rom.trigger(0x84).conditions.push(0x283); // 283 calmed the sea
    // TODO - consider not setting 051 and changing the condition to match the item
  }
  rom.trigger(0x84).flags = [];

  // Add an extra condition to the Leaf abduction trigger (behind zebu).  This ensures
  // all the items in Leaf proper (elder and student) are gotten before they disappear.
  rom.trigger(0x8c).conditions.push(0x037); // 03a talked to zebu in cave

  // Paralysis trigger ($b2) ~ remove redundant itemget flag
  rom.trigger(0xb2).conditions[0] = ~0x242;
  rom.trigger(0xb2).flags.shift(); // remove 037 learned paralysis

  // Learn refresh trigger ($b4) ~ remove redundant itemget flag
  rom.trigger(0xb4).conditions[0] = ~0x241;
  rom.trigger(0xb4).flags = []; // remove 039 learned refresh

  // Portoa palace guard movement trigger ($bb) stops on 01b (mesia) not 01f (orb)
  rom.trigger(0xbb).conditions[1] = ~0x01b;

  // Remove redundant trigger 8a (slot 16) in zombietown ($65)
  const zombieTown = rom.locations[0x65];
  if (zombieTown.spawns[0x16 - 0x0d].id === 0x8a) {
    // TODO - make a "delete if" helper function - delete if trigger 8a
    // possibly use array.filter?
    zombieTown.spawns.splice(0x16 - 0x0d, 1);
  }
};

const requireHealedDolphin = (rom: Rom) => {
  // Normally the fisherman ($64) spawns in his house ($d6) if you have
  // the shell flute (236).  Here we also add a requirement on the healed
  // dolphin slot (025), which we keep around since it's actually useful.
  rom.npcs[0x64].spawnConditions.set(0xd6, [0x236, 0x025]);
  // Also fix daughter's dialog ($7b).
  const daughterDialog = rom.npcs[0x7b].localDialogs.get(-1)!;
  daughterDialog.unshift(daughterDialog[0].clone());
  daughterDialog[0].condition = ~0x025;
  daughterDialog[1].condition = ~0x236;
};

const requireTelepathyForDeo = (rom: Rom) => {
  // Not having telepathy (243) will trigger a "kyu kyu" (1a:12, 1a:13) for
  // both generic bunnies (59) and deo (5a).
  rom.npcs[0x59].globalDialogs.push(GlobalDialog.of(~0x243, [0x1a, 0x12]));
  rom.npcs[0x5a].globalDialogs.push(GlobalDialog.of(~0x243, [0x1a, 0x13]));
};

const teleportOnThunderSword = (rom: Rom) => {
  // itemget 03 sword of thunder => set 2fd shyron warp point
  rom.itemGets[0x03].flags.push(0x2fd);
  // dialog 62 asina in f2/f4 shyron -> action 1f (teleport to start)
  //   - note: f2 and f4 dialogs are linked.
  for (const i of [0, 1, 3]) {
    for (const loc of [0xf2, 0xf4]) {
      rom.npcs[0x62].localDialogs.get(loc)![i].message.action = 0x1f;
    }
  }
};

const noTeleportOnThunderSword = (rom: Rom) => {
  // Change sword of thunder's action to bbe the same as other swords (16)
  rom.itemGets[0x03].acquisitionAction.action = 0x16;
};

const adjustItemNames = (rom: Rom, flags: FlagSet) => {
  if (flags.leatherBootsGiveSpeed()) {
    // rename leather boots to speed boots
    const leatherBoots = rom.items[0x2f]!;
    leatherBoots.menuName = 'Speed Boots';
    leatherBoots.messageName = 'Speed Boots';
  }

  // rename balls to orbs
  for (let i = 0x05; i < 0x0c; i += 2) {
    rom.items[i].menuName = rom.items[i].menuName.replace('Ball', 'Orb');
    rom.items[i].messageName = rom.items[i].messageName.replace('Ball', 'Orb');
  }
};

// Add the statue of onyx and possibly the teleport block trigger to Cordel West
const addCordelWestTriggers = (rom: Rom, flags: FlagSet) => {
  for (const spawn of rom.locations[0x15].spawns) {
    if (spawn.isChest() || (flags.disableTeleportSkip() && spawn.isTrigger())) {
      // Copy if (1) it's the chest, or (2) we're disabling teleport skip
      rom.locations[0x14].spawns.push(spawn.clone());
    }
  }
};

const fixRabbitSkip = (rom: Rom) => {
  for (const spawn of rom.locations[0x28].spawns) {
    if (spawn.isTrigger() && spawn.id === 0x86) {
      if (spawn.x === 0x740) {
        spawn.x += 16;
        spawn.y += 16;
      }
    }
  }
};

const storyMode = (rom: Rom) => {
  // shuffle has already happened, need to use shuffled flags from
  // NPC spawn conditions...
  rom.npcs[0xcb].spawnConditions.set(0xa6, [
    // Note: if bosses are shuffled we'll need to detect this...
    ~rom.npcs[0xc2].spawnConditions.get(0x28)![0], // Kelbesque 1
    ~rom.npcs[0x84].spawnConditions.get(0x6e)![0], // Sabera 1
    ~rom.triggers[0x9a & 0x7f].conditions[1], // Mado 1
    ~rom.npcs[0xc5].spawnConditions.get(0xa9)![0], // Kelbesque 2
    ~rom.npcs[0xc6].spawnConditions.get(0xac)![0], // Sabera 2
    ~rom.npcs[0xc7].spawnConditions.get(0xb9)![0], // Mado 2
    ~rom.npcs[0xc8].spawnConditions.get(0xb6)![0], // Karmine
    ~rom.npcs[0xcb].spawnConditions.get(0x9f)![0], // Draygon 1
    0x200, // Sword of Wind
    0x201, // Sword of Fire
    0x202, // Sword of Water
    0x203, // Sword of Thunder
    // TODO - statues of moon and sun may be relevant if entrance shuffle?
    // TODO - vampires and insect?
  ]);
};

// Hard mode flag: Hc - zero out the sword's collision plane
const disableStabs = (rom: Rom) => {
  for (const o of [0x08, 0x09, 0x27]) {
    rom.objects[o].collisionPlane = 0;
  }
};

const orbsOptional = (rom: Rom) => {
  for (const obj of [0x10, 0x14, 0x18, 0x1d]) {
    // 1. Loosen terrain susceptibility of level 1 shots
    rom.objects[obj].terrainSusceptibility &= ~0x04;
    // 2. Increase the level to 2
    rom.objects[obj].level = 2;
  }
};

// Programmatically add a hole between valley of wind and lime tree valley
const connectLimeTreeToLeaf = (rom: Rom) => {
  const valleyOfWind = rom.locations[0x03];
  const limeTree = rom.locations[0x42];

  valleyOfWind.screens[5][4] = 0x10; // new exit
  limeTree.screens[1][0] = 0x1a; // new exit
  limeTree.screens[2][0] = 0x0c; // nicer mountains

  const windEntrance =
      valleyOfWind.entrances.push(Entrance.of({x: 0x4ef, y: 0x578})) - 1;
  const limeEntrance =
      limeTree.entrances.push(Entrance.of({x: 0x010, y: 0x1c0})) - 1;

  valleyOfWind.exits.push(
      Exit.of({x: 0x4f0, y: 0x560, dest: 0x42, entrance: limeEntrance}),
      Exit.of({x: 0x4f0, y: 0x570, dest: 0x42, entrance: limeEntrance}));
  limeTree.exits.push(
      Exit.of({x: 0x000, y: 0x1b0, dest: 0x03, entrance: windEntrance}),
      Exit.of({x: 0x000, y: 0x1c0, dest: 0x03, entrance: windEntrance}));
};

// Stamp the ROM
export const stampVersionSeedAndHash = (rom: Uint8Array, seed: number, flags: FlagSet) => {
  // Use up to 26 bytes starting at PRG $25ea8
  // Would be nice to store (1) commit, (2) flags, (3) seed, (4) hash
  // We can use base64 encoding to help some...
  // For now just stick in the commit and seed in simple hex
  const crc = crc32(rom);
  const crcString = crc.toString(16).padStart(8, '0').toUpperCase();
  const hash = version.STATUS === 'unstable' ?
      version.HASH.substring(0, 7).padStart(7, '0').toUpperCase() + '     ' :
      version.VERSION.substring(0, 12).padEnd(12, ' ');
  const seedStr = seed.toString(16).padStart(8, '0').toUpperCase();
  const embed = (addr: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      rom[addr + 0x10 + i] = text.charCodeAt(i);
    }
  };
  const intercalate = (s1: string, s2: string): string => {
    const out = [];
    for (let i = 0; i < s1.length || i < s2.length; i++) {
      out.push(s1[i] || ' ');
      out.push(s2[i] || ' ');
    }
    return out.join('');
  };

  embed(0x277cf, intercalate('  VERSION     SEED      ',
                             `  ${hash}${seedStr}`));
  let flagString = String(flags);

  // if (flagString.length > 36) flagString = flagString.replace(/ /g, '');
  let extraFlags;
  if (flagString.length > 46) {
    if (flagString.length > 92) throw new Error('Flag string way too long!');
    extraFlags = flagString.substring(46, 92).padEnd(46, ' ');
    flagString = flagString.substring(0, 46);
  }
  // if (flagString.length <= 36) {
  //   // attempt to break it more favorably

  // }
  //   flagString = ['FLAGS ',
  //                 flagString.substring(0, 18).padEnd(18, ' '),
  //                 '      ',

  // }

  flagString = flagString.padEnd(46, ' ');

  embed(0x277ff, intercalate(flagString.substring(0, 23), flagString.substring(23)));
  if (extraFlags) {
    embed(0x2782f, intercalate(extraFlags.substring(0, 23), extraFlags.substring(23)));
  }

  embed(0x27885, intercalate(crcString.substring(0, 4), crcString.substring(4)));

  // embed(0x25ea8, `v.${hash}   ${seed}`);
  embed(0x25716, 'RANDOMIZER');
  if (version.STATUS === 'unstable') embed(0x2573c, 'BETA');
  // NOTE: it would be possible to add the hash/seed/etc to the title
  // page as well, but we'd need to replace the unused letters in bank
  // $1d with the missing numbers (J, Q, W, X), as well as the two
  // weird squares at $5b and $5c that don't appear to be used.  Together
  // with using the letter 'O' as 0, that's sufficient to cram in all the
  // numbers and display arbitrary hex digits.

  return crc;
};

const patchBytes = (rom: Uint8Array, address: number, bytes: number[]) => {
  for (let i = 0; i < bytes.length; i++) {
    rom[address + i] = bytes[i];
  }
};

const patchWords = (rom: Uint8Array, address: number, words: number[]) => {
  for (let i = 0; i < 2 * words.length; i += 2) {
    rom[address + i] = words[i >>> 1] & 0xff;
    rom[address + i + 1] = words[i >>> 1] >>> 8;
  }
};

// goes with enemy stat recomputations in postshuffle.s
const updateCoinDrops = (rom: Uint8Array, flags: FlagSet) => {
  rom = rom.subarray(0x10);
  if (flags.disableShopGlitch()) {
    // bigger gold drops if no shop glitch, particularly at the start
    // - starts out fibonacci, then goes linear at 600
    patchWords(rom, 0x34bde, [
        0,   5,  10,  15,  25,  40,  65,  105,
      170, 275, 445, 600, 700, 800, 900, 1000,
    ]);
  } else {
    // this table is basically meaningless b/c shop glitch
    patchWords(rom, 0x34bde, [
        0,   1,   2,   4,   8,  16,  30,  50,
      100, 200, 300, 400, 500, 600, 700, 800,
    ]);
  }
};

// goes with enemy stat recomputations in postshuffle.s
const updateDifficultyScalingTables = (rom: Uint8Array, flags: FlagSet, asm: Assembler) => {
  rom = rom.subarray(0x10);

  // Currently this is three $30-byte tables, which we start at the beginning
  // of the postshuffle ComputeEnemyStats.
  const diff = seq(48, x => x);

  // PAtk = 5 + Diff * 15/32
  // DiffAtk table is 8 * PAtk = round(40 + (Diff * 15 / 4))
  patchBytes(rom, asm.expand('DiffAtk'),
             diff.map(d => Math.round(40 + d * 15 / 4)));

  // NOTE: Old DiffDef table (4 * PDef) was 12 + Diff * 3, but we no longer
  // use this table since nerfing armors.
  // (PDef = 3 + Diff * 3/4)
  // patchBytes(rom, asm.expand('DiffDef'),
  //            diff.map(d => 12 + d * 3));

  // NOTE: This is the armor-nerfed DiffDef table.
  // PDef = 2 + Diff / 2
  // DiffDef table is 4 * PDef = 8 + Diff * 2
  // patchBytes(rom, asm.expand('DiffDef'),
  //            diff.map(d => 8 + d * 2));

  // NOTE: For armor cap at 3 * Lvl, set PDef = Diff
  patchBytes(rom, asm.expand('DiffDef'),
             diff.map(d => d * 4));

  // DiffHP table is PHP = min(255, 48 + round(Diff * 11 / 2))
  const phpStart = flags.decreaseEnemyDamage() ? 16 : 48;
  const phpIncr = flags.decreaseEnemyDamage() ? 6 : 5.5;
  patchBytes(rom, asm.expand('DiffHP'),
             diff.map(d => Math.min(255, phpStart + Math.round(d * phpIncr))));

  // DiffExp table is ExpB = compress(floor(4 * (2 ** ((16 + 9 * Diff) / 32))))
  // where compress maps values > 127 to $80|(x>>4)

  const expFactor = flags.expScalingFactor();
  patchBytes(rom, asm.expand('DiffExp'), diff.map(d => {
    const exp = Math.floor(4 * (2 ** ((16 + 9 * d) / 32)) * expFactor);
    return exp < 0x80 ? exp : Math.min(0xff, 0x80 + (exp >> 4));
  }));

  // // Halve shield and armor defense values
  // patchBytes(rom, 0x34bc0, [
  //   // Armor defense
  //   0, 1, 3, 5, 7, 9, 12, 10, 16,
  //   // Shield defense
  //   0, 1, 3, 4, 6, 9, 8, 12, 16,
  // ]);

  // Adjust shield and armor defense values
  patchBytes(rom, 0x34bc0, [
    // Armor defense
    0, 2, 6, 10, 14, 18, 32, 24, 20,
    // Shield defense
    0, 2, 6, 10, 14, 18, 16, 32, 20,
  ]);
};

const rescaleShops = (rom: Rom, asm: Assembler, random?: Random) => {
  // Populate rescaled prices into the various rom locations.
  // Specifically, we read the available item IDs out of the
  // shop tables and then compute new prices from there.
  // If `random` is passed then the base price to buy each
  // item at any given shop will be adjusted to anywhere from
  // 50% to 150% of the base price.  The pawn shop price is
  // always 50% of the base price.

  rom.shopCount = 11; // 11 of all types of shop for some reason.
  rom.shopDataTablesAddress = asm.expand('ShopData');

  // NOTE: This isn't in the Rom object yet...
  writeLittleEndian(rom.prg, asm.expand('InnBasePrice'), 20);

  for (const shop of rom.shops) {
    if (shop.type === ShopType.PAWN) continue;
    for (let i = 0, len = shop.prices.length; i < len; i++) {
      if (shop.contents[i] < 0x80) {
        shop.prices[i] = random ? random.nextNormal(1, 0.3, 0.5, 1.5) : 1;
      } else if (shop.type !== ShopType.INN) {
        shop.prices[i] = 0;
      } else {
        // just set the one price
        shop.prices[i] = random ? random.nextNormal(1, 0.5, 0.375, 1.625) : 1;
      }
    }
  }

  // Also fill the scaling tables.
  const diff = seq(48, x => x);
  // Tool shops scale as 2 ** (Diff / 10), store in 8ths
  patchBytes(rom.prg, asm.expand('ToolShopScaling'),
             diff.map(d => Math.round(8 * (2 ** (d / 10)))));
  // Armor shops scale as 2 ** ((47 - Diff) / 12), store in 8ths
  patchBytes(rom.prg, asm.expand('ArmorShopScaling'),
             diff.map(d => Math.round(8 * (2 ** ((47 - d) / 12)))));

  // Set the item base prices.
  for (let i = 0x0d; i < 0x27; i++) {
    rom.items[i].basePrice = BASE_PRICES[i];
  }

  // TODO - separate flag for rescaling monsters???
};

// Map of base prices.  (Tools are positive, armors are ones-complement.)
const BASE_PRICES: {[itemId: number]: number} = {
  // Armors
  0x0d: 4,    // carapace shield
  0x0e: 16,   // bronze shield
  0x0f: 50,   // platinum shield
  0x10: 325,  // mirrored shield
  0x11: 1000, // ceramic shield
  0x12: 2000, // sacred shield
  0x13: 4000, // battle shield
  0x15: 6,    // tanned hide
  0x16: 20,   // leather armor
  0x17: 75,   // bronze armor
  0x18: 250,  // platinum armor
  0x19: 1000, // soldier suit
  0x1a: 4800, // ceramic suit
  // Tools
  0x1d: 25,   // medical herb
  0x1e: 30,   // antidote
  0x1f: 45,   // lysis plant
  0x20: 40,   // fruit of lime
  0x21: 36,   // fruit of power
  0x22: 200,  // magic ring
  0x23: 150,  // fruit of repun
  0x24: 80,   // warp boots
  0x26: 300,  // opel statue
  // 0x31: 50, // alarm flute
};

/////////
/////////
/////////

const rescaleMonsters = (rom: Rom) => {

  // TODO - find anything sharing the same memory and update them as well
  const unscaledMonsters = new Set<number>(Object.keys(rom.objects).map(Number));
  for (const [id] of SCALED_MONSTERS) {
    unscaledMonsters.delete(id);
  }
  for (const [id, monster] of SCALED_MONSTERS) {
    for (const other of unscaledMonsters) {
      if (rom.objects[id].base === rom.objects[other].base) {
        SCALED_MONSTERS.set(other, monster);
        unscaledMonsters.delete(id);
      }
    }
  }

  for (const [id, {sdef, swrd, hits, satk, dgld, sexp}] of SCALED_MONSTERS) {
    // indicate that this object needs scaling
    const o = rom.objects[id].data;
    const boss =
        [0x57, 0x5e, 0x68, 0x7d, 0x88, 0x97, 0x9b, 0x9e].includes(id) ? 1 : 0;
    o[2] |= 0x80; // recoil
    o[6] = hits; // HP
    o[7] = satk;  // ATK
    // Sword: 0..3 (wind - thunder) preserved, 4 (crystalis) => 7
    o[8] = sdef | swrd << 4; // DEF
    o[9] = o[9] & 0xe0 | boss;
    o[16] = o[16] & 0x0f | dgld << 4; // GLD
    o[17] = sexp; // EXP
  }

  // Fix Sabera 1's elemental defense to no longer allow thunder
  rom.objects[0x7d].elements |= 0x08;

  // rom.writeObjectData();
};

const shuffleMonsters = (rom: Rom, random: Random) => {
  // TODO: once we have location names, compile a spoiler of shuffled monsters
  const pool = new MonsterPool({});
  for (const loc of rom.locations) {
    if (loc.used) pool.populate(loc);
  }
  pool.shuffle(random);
};

const identifyKeyItemsForDifficultyBuffs = (rom: Rom) => {
  // // Tag key items for difficulty buffs
  // for (const get of rom.itemGets) {
  //   const item = ITEMS.get(get.itemId);
  //   if (!item || !item.key) continue;
  //   get.key = true;
  // }
  // // console.log(report);
  for (let i = 0; i < 0x49; i++) {
    // NOTE - special handling for alarm flute until we pre-patch
    const unique = (rom.prg[0x20ff0 + i] & 0x40) || i === 0x31;
    const bit = 1 << (i & 7);
    const addr = 0x1e110 + (i >>> 3);
    rom.prg[addr] = rom.prg[addr] & ~bit | (unique ? bit : 0);
  }
};

interface MonsterData {
  id: number;
  type: string;
  name: string;
  sdef: number;
  swrd: number;
  hits: number;
  satk: number;
  dgld: number;
  sexp: number;
}

/* tslint:disable:trailing-comma whitespace */

const SCALED_MONSTERS: Map<number, MonsterData> = new Map([
  // ID  TYPE  NAME                       SDEF SWRD HITS SATK DGLD SEXP
  [0x3f, 'p', 'Sorceror shot',              ,   ,   ,    19,  ,    ,],
  [0x4b, 'm', 'wraith??',                   2,  ,   2,   22,  4,   61],
  [0x4f, 'm', 'wraith',                     1,  ,   2,   20,  4,   61],
  [0x50, 'm', 'Blue Slime',                 ,   ,   1,   16,  2,   32],
  [0x51, 'm', 'Weretiger',                  ,   ,   1,   21,  4,   40],
  [0x52, 'm', 'Green Jelly',                4,  ,   3,   16,  4,   36],
  [0x53, 'm', 'Red Slime',                  6,  ,   4,   16,  4,   48],
  [0x54, 'm', 'Rock Golem',                 6,  ,   11,  24,  6,   85],
  [0x55, 'm', 'Blue Bat',                   ,   ,   ,    4,   ,    32],
  [0x56, 'm', 'Green Wyvern',               4,  ,   4,   24,  6,   52],
  [0x57, 'b', 'Vampire',                    3,  ,   12,  18,  ,    ,],
  [0x58, 'm', 'Orc',                        3,  ,   4,   21,  4,   57],
  [0x59, 'm', 'Red Flying Swamp Insect',    3,  ,   1,   21,  4,   57],
  [0x5a, 'm', 'Blue Mushroom',              2,  ,   1,   21,  4,   44],
  [0x5b, 'm', 'Swamp Tomato',               3,  ,   2,   35,  4,   52],
  [0x5c, 'm', 'Flying Meadow Insect',       3,  ,   3,   23,  4,   81],
  [0x5d, 'm', 'Swamp Plant',                ,   ,   ,    ,    ,    36],
  [0x5e, 'b', 'Insect',                     ,   1,  8,   6,   ,    ,],
  [0x5f, 'm', 'Large Blue Slime',           5,  ,   3,   20,  4,   52],
  [0x60, 'm', 'Ice Zombie',                 5,  ,   7,   14,  4,   57],
  [0x61, 'm', 'Green Living Rock',          ,   ,   1,   9,   4,   28],
  [0x62, 'm', 'Green Spider',               4,  ,   4,   22,  4,   44],
  [0x63, 'm', 'Red/Purple Wyvern',          3,  ,   4,   30,  4,   65],
  [0x64, 'm', 'Draygonia Soldier',          6,  ,   11,  36,  4,   89],
  // ID  TYPE  NAME                       SDEF SWRD HITS SATK DGLD SEXP
  [0x65, 'm', 'Ice Entity',                 3,  ,   2,   24,  4,   52],
  [0x66, 'm', 'Red Living Rock',            ,   ,   1,   13,  4,   40],
  [0x67, 'm', 'Ice Golem',                  7,  2,  11,  28,  4,   81],
  [0x68, 'b', 'Kelbesque',                  4,  6,  12,  29,  ,    ,],
  [0x69, 'm', 'Giant Red Slime',            7,  ,   40,  90,  4,   102],
  [0x6a, 'm', 'Troll',                      2,  ,   3,   24,  4,   65],
  [0x6b, 'm', 'Red Jelly',                  2,  ,   2,   14,  4,   44],
  [0x6c, 'm', 'Medusa',                     3,  ,   4,   36,  8,   77],
  [0x6d, 'm', 'Red Crab',                   2,  ,   1,   21,  4,   44],
  [0x6e, 'm', 'Medusa Head',                ,   ,   1,   29,  4,   36],
  [0x6f, 'm', 'Evil Bird',                  ,   ,   2,   30,  6,   65],
  [0x71, 'm', 'Red/Purple Mushroom',        3,  ,   5,   19,  6,   69],
  [0x72, 'm', 'Violet Earth Entity',        3,  ,   3,   18,  6,   61],
  [0x73, 'm', 'Mimic',                      ,   ,   3,   26,  15,  73],
  [0x74, 'm', 'Red Spider',                 3,  ,   4,   22,  6,   48],
  [0x75, 'm', 'Fishman',                    4,  ,   6,   19,  5,   61],
  [0x76, 'm', 'Jellyfish',                  ,   ,   3,   14,  3,   48],
  [0x77, 'm', 'Kraken',                     5,  ,   11,  25,  7,   73],
  [0x78, 'm', 'Dark Green Wyvern',          4,  ,   5,   21,  5,   61],
  [0x79, 'm', 'Sand Monster',               5,  ,   8,   6,   4,   57],
  [0x7b, 'm', 'Wraith Shadow 1',            ,   ,   ,    9,   7,   44],
  [0x7c, 'm', 'Killer Moth',                ,   ,   2,   35,  ,    77],
  [0x7d, 'b', 'Sabera',                     3,  7,  13,  24,  ,    ,],
  [0x80, 'm', 'Draygonia Archer',           1,  ,   3,   20,  6,   61],
  // ID  TYPE  NAME                       SDEF SWRD HITS SATK DGLD SEXP
  [0x81, 'm', 'Evil Bomber Bird',           ,   ,   1,   19,  4,   65],
  [0x82, 'm', 'Lavaman/blob',               3,  ,   3,   24,  6,   85],
  [0x84, 'm', 'Lizardman (w/ flail(',       2,  ,   3,   30,  6,   81],
  [0x85, 'm', 'Giant Eye',                  3,  ,   5,   33,  4,   81],
  [0x86, 'm', 'Salamander',                 2,  ,   4,   29,  8,   77],
  [0x87, 'm', 'Sorceror',                   2,  ,   5,   31,  6,   65],
  [0x88, 'b', 'Mado',                       4,  8,  10,  30,  ,    ,],
  [0x89, 'm', 'Draygonia Knight',           2,  ,   3,   24,  4,   77],
  [0x8a, 'm', 'Devil',                      ,   ,   1,   18,  4,   52],
  [0x8b, 'b', 'Kelbesque 2',                4,  6,  11,  27,  ,    ,],
  [0x8c, 'm', 'Wraith Shadow 2',            ,   ,   ,    17,  4,   48],
  [0x90, 'b', 'Sabera 2',                   5,  7,  21,  27,  ,    ,],
  [0x91, 'm', 'Tarantula',                  3,  ,   3,   21,  6,   73],
  [0x92, 'm', 'Skeleton',                   ,   ,   4,   30,  6,   69],
  [0x93, 'b', 'Mado 2',                     4,  8,  11,  25,  ,    ,],
  [0x94, 'm', 'Purple Giant Eye',           4,  ,   10,  23,  6,   102],
  [0x95, 'm', 'Black Knight (w/ flail)',    3,  ,   7,   26,  6,   89],
  [0x96, 'm', 'Scorpion',                   3,  ,   5,   29,  2,   73],
  [0x97, 'b', 'Karmine',                    4,  ,   14,  26,  ,    ,],
  [0x98, 'm', 'Sandman/blob',               3,  ,   5,   36,  6,   98],
  [0x99, 'm', 'Mummy',                      5,  ,   19,  36,  6,   110],
  [0x9a, 'm', 'Tomb Guardian',              7,  ,   60,  37,  6,   106],
  [0x9b, 'b', 'Draygon',                    5,  6,  16,  41,  ,    ,],
  [0x9e, 'b', 'Draygon 2',                  7,  6,  28,  40,  ,    ,],
  // ID  TYPE  NAME                       SDEF SWRD HITS SATK DGLD SEXP
  [0xa0, 'm', 'Ground Sentry (1)',          4,  ,   12,  26,  ,    /*73*/],
  [0xa1, 'm', 'Tower Defense Mech (2)',     5,  ,   16,  36,  ,    /*85*/],
  [0xa2, 'm', 'Tower Sentinel',             ,   ,   2,   ,    ,    /*32*/],
  [0xa3, 'm', 'Air Sentry',                 3,  ,   4,   26,  ,    /*65*/],
  [0xa4, 'b', 'Dyna',                       6,  5,  16,  ,    ,    ,],
  [0xa5, 'b', 'Vampire 2',                  3,  ,   12,  27,  ,    ,],
  [0xb4, 'b', 'dyna pod',                   15, ,   255, 26,  ,    ,],
  [0xb8, 'p', 'dyna counter',               ,   ,   ,    26,  ,    ,],
  [0xb9, 'p', 'dyna laser',                 ,   ,   ,    26,  ,    ,],
  [0xba, 'p', 'dyna bubble',                ,   ,   ,    36,  ,    ,],
  [0xbc, 'm', 'vamp2 bat',                  ,   ,   ,    16,  ,    15],
  [0xbf, 'p', 'draygon2 fireball',          ,   ,   ,    26,  ,    ,],
  [0xc1, 'm', 'vamp1 bat',                  ,   ,   ,    16,  ,    15],
  [0xc3, 'p', 'giant insect spit',          ,   ,   ,    35,  ,    ,],
  [0xc4, 'm', 'summoned insect',            4,  ,   2,   42,  ,    98],
  [0xc5, 'p', 'kelby1 rock',                ,   ,   ,    22,  ,    ,],
  [0xc6, 'p', 'sabera1 balls',              ,   ,   ,    19,  ,    ,],
  [0xc7, 'p', 'kelby2 fireballs',           ,   ,   ,    11,  ,    ,],
  [0xc8, 'p', 'sabera2 fire',               ,   ,   1,   6,   ,    ,],
  [0xc9, 'p', 'sabera2 balls',              ,   ,   ,    17,  ,    ,],
  [0xca, 'p', 'karmine balls',              ,   ,   ,    25,  ,    ,],
  [0xcb, 'p', 'sun/moon statue fireballs',  ,   ,   ,    39,  ,    ,],
  [0xcc, 'p', 'draygon1 lightning',         ,   ,   ,    37,  ,    ,],
  [0xcd, 'p', 'draygon2 laser',             ,   ,   ,    36,  ,    ,],
  // ID  TYPE  NAME                       SDEF SWRD HITS SATK DGLD SEXP
  [0xce, 'p', 'draygon2 breath',            ,   ,   ,    36,  ,    ,],
  [0xe0, 'p', 'evil bomber bird bomb',      ,   ,   ,    2,   ,    ,],
  [0xe2, 'p', 'summoned insect bomb',       ,   ,   ,    47,  ,    ,],
  [0xe3, 'p', 'paralysis beam',             ,   ,   ,    23,  ,    ,],
  [0xe4, 'p', 'stone gaze',                 ,   ,   ,    33,  ,    ,],
  [0xe5, 'p', 'rock golem rock',            ,   ,   ,    24,  ,    ,],
  [0xe6, 'p', 'curse beam',                 ,   ,   ,    10,  ,    ,],
  [0xe7, 'p', 'mp drain web',               ,   ,   ,    11,  ,    ,],
  [0xe8, 'p', 'fishman trident',            ,   ,   ,    15,  ,    ,],
  [0xe9, 'p', 'orc axe',                    ,   ,   ,    24,  ,    ,],
  [0xea, 'p', 'Swamp Pollen',               ,   ,   ,    37,  ,    ,],
  [0xeb, 'p', 'paralysis powder',           ,   ,   ,    17,  ,    ,],
  [0xec, 'p', 'draygonia solider sword',    ,   ,   ,    28,  ,    ,],
  [0xed, 'p', 'ice golem rock',             ,   ,   ,    20,  ,    ,],
  [0xee, 'p', 'troll axe',                  ,   ,   ,    27,  ,    ,],
  [0xef, 'p', 'kraken ink',                 ,   ,   ,    24,  ,    ,],
  [0xf0, 'p', 'draygonia archer arrow',     ,   ,   ,    12,  ,    ,],
  [0xf1, 'p', '??? unused',                 ,   ,   ,    16,  ,    ,],
  [0xf2, 'p', 'draygonia knight sword',     ,   ,   ,    9,   ,    ,],
  [0xf3, 'p', 'moth residue',               ,   ,   ,    19,  ,    ,],
  [0xf4, 'p', 'ground sentry laser',        ,   ,   ,    13,  ,    ,],
  [0xf5, 'p', 'tower defense mech laser',   ,   ,   ,    23,  ,    ,],
  [0xf6, 'p', 'tower sentinel laser',       ,   ,   ,    8,   ,    ,],
  [0xf7, 'p', 'skeleton shot',              ,   ,   ,    11,  ,    ,],
  // ID  TYPE  NAME                       SDEF SWRD HITS SATK DGLD SEXP
  [0xf8, 'p', 'lavaman shot',               ,   ,   ,    14,  ,    ,],
  [0xf9, 'p', 'black knight flail',         ,   ,   ,    18,  ,    ,],
  [0xfa, 'p', 'lizardman flail',            ,   ,   ,    21,  ,    ,],
  [0xfc, 'p', 'mado shuriken',              ,   ,   ,    36,  ,    ,],
  [0xfd, 'p', 'guardian statue missile',    ,   ,   ,    23,  ,    ,],
  [0xfe, 'p', 'demon wall fire',            ,   ,   ,    23,  ,    ,],
].map(([id, type, name, sdef=0, swrd=0, hits=0, satk=0, dgld=0, sexp=0]) =>
      [id, {id, type, name, sdef, swrd, hits, satk, dgld, sexp}])) as any;

/* tslint:enable:trailing-comma whitespace */

// When dealing with constraints, it's basically ksat
//  - we have a list of requirements that are ANDed together
//  - each is a list of predicates that are ORed together
//  - each predicate has a continuation for when it's picked
//  - need a way to thin the crowd, efficiently check compat, etc
// Predicate is a four-element array [pat0,pat1,pal2,pal3]
// Rather than a continuation we could go through all the slots again

// class Constraints {
//   constructor() {
//     // Array of pattern table options.  Null indicates that it can be anything.
//     //
//     this.patterns = [[null, null]];
//     this.palettes = [[null, null]];
//     this.flyers = 0;
//   }

//   requireTreasureChest() {
//     this.requireOrderedSlot(0, TREASURE_CHEST_BANKS);
//   }

//   requireOrderedSlot(slot, set) {

//     if (!this.ordered) {

//     }
// // TODO
//     this.pat0 = intersect(this.pat0, set);

//   }

// }

// const intersect = (left, right) => {
//   if (!right) throw new Error('right must be nontrivial');
//   if (!left) return right;
//   const out = new Set();
//   for (const x of left) {
//     if (right.has(x)) out.add(x);
//   }
//   return out;
// }

interface MonsterConstraint {
  id: number;
  pat: number;
  pal2: number | undefined;
  pal3: number | undefined;
  patBank: number | undefined;
}

// A pool of monster spawns, built up from the locations in the rom.
// Passes through the locations twice, first to build and then to
// reassign monsters.
class MonsterPool {

  // available monsters
  readonly monsters: MonsterConstraint[] = [];
  // used monsters - as a backup if no available monsters fit
  readonly used: MonsterConstraint[] = [];
  // all locations
  readonly locations: {location: Location, slots: number[]}[] = [];

  constructor(readonly report: {[loc: number]: string[], [key: string]: (string|number)[]}) {}

  // TODO - monsters w/ projectiles may have a specific bank they need to appear in,
  // since the projectile doesn't know where it came from...?
  //   - for now, just assume if it has a child then it must keep same pattern bank!

  populate(location: Location) {
    const {maxFlyers = 0, nonFlyers = {}, skip = false, fixedSlots = {}, ...unexpected} =
          MONSTER_ADJUSTMENTS[location.id] || {};
    for (const u of Object.keys(unexpected)) {
      throw new Error(
          `Unexpected property '${u}' in MONSTER_ADJUSTMENTS[${location.id}]`);
    }
    if (skip === true || !location.spritePatterns || !location.spritePalettes) return;
    const monsters = [];
    const slots = [];
    // const constraints = {};
    // let treasureChest = false;
    let slot = 0x0c;
    for (const spawn of location.spawns) {
      ++slot;
      if (!spawn.isMonster()) continue;
      const id = spawn.monsterId;
      if (id in UNTOUCHED_MONSTERS || !SCALED_MONSTERS.has(id) ||
          SCALED_MONSTERS.get(id)!.type !== 'm') continue;
      const object = location.rom.objects[id];
      if (!object) continue;
      const patBank = spawn.patternBank;
      const pat = location.spritePatterns[patBank];
      const pal = object.palettes(true);
      const pal2 = pal.includes(2) ? location.spritePalettes[0] : undefined;
      const pal3 = pal.includes(3) ? location.spritePalettes[1] : undefined;
      monsters.push({id, pat, pal2, pal3, patBank});
      (this.report[`start-${id.toString(16)}`] = this.report[`start-${id.toString(16)}`] || [])
          .push('$' + location.id.toString(16));
      slots.push(slot);
    }
    if (!monsters.length) return;
    if (!skip) this.locations.push({location, slots});
    this.monsters.push(...monsters);
  }

  shuffle(random: Random) {
    this.report['pre-shuffle locations'] = this.locations.map(l => l.location.id);
    this.report['pre-shuffle monsters'] = this.monsters.map(m => m.id);
    random.shuffle(this.locations);
    random.shuffle(this.monsters);
    this.report['post-shuffle locations'] = this.locations.map(l => l.location.id);
    this.report['post-shuffle monsters'] = this.monsters.map(m => m.id);
    while (this.locations.length) {
      const {location, slots} = this.locations.pop()!;
      const report: string[] = this.report['$' + location.id.toString(16).padStart(2, '0')] = [];
      const {maxFlyers = 0, nonFlyers = {}, fixedSlots = {}} =
            MONSTER_ADJUSTMENTS[location.id] || {};
      // Keep track of pattern and palette slots we've pinned.
      // It might be nice to have a mode where palette conflicts are allowed,
      // and we just go with one or the other, though this could lead to poisonous
      // blue slimes and non-poisonous red slimes by accident.
      let pat0 = fixedSlots.pat0 || null;
      let pat1 = fixedSlots.pat1 || null;
      let pal2 = fixedSlots.pal2 || null;
      let pal3 = fixedSlots.pal3 || null;
      let flyers = maxFlyers; // count down...

      // Determine location constraints
      let treasureChest = false;
      for (const spawn of location.spawns) {
        if (spawn.isChest()) treasureChest = true;
        if (!spawn.isMonster()) continue;
        const id = spawn.monsterId;
        if (id === 0x7e || id === 0x7f || id === 0x9f) {
          pat1 = 0x62;
        } else if (id === 0x8f) {
          pat0 = 0x61;
        }
      }
      // Cordel East and Kirisa Meadow have chests but don't need to actually draw them
      // (though we may need to make sure it doesn't end up with some nonsense tile that
      // ends up above the background).
      if (location.id === 0x15 || location.id === 0x47) treasureChest = false;

      report.push(`Initial pass: ${[treasureChest, pat0, pat1, pal2, pal3].join(', ')}`);

      const tryAddMonster = (m: MonsterConstraint) => {
        const flyer = FLYERS.has(m.id);
        const moth = MOTHS_AND_BATS.has(m.id);
        if (flyer) {
          // TODO - add a small probability of adding it anyway, maybe
          // based on the map area?  25 seems a good threshold.
          if (!flyers) return false;
          --flyers;
        }
        if (pal2 != null && m.pal2 != null && pal2 !== m.pal2 ||
            pal3 != null && m.pal3 != null && pal3 !== m.pal3) {
          return false;
        }
        // whether we can put this one in pat0
        const pat0ok = !treasureChest || TREASURE_CHEST_BANKS.has(m.pat);
        let patSlot;
        if (location.rom.objects[m.id].child || RETAIN_SLOTS.has(m.id)) {
          // if there's a child, make sure to keep it in the same pattern slot
          patSlot = m.patBank;
          const prev = patSlot ? pat1 : pat0;
          if (prev != null && prev !== m.pat) return false;
          if (patSlot) {
            pat1 = m.pat;
          } else if (pat0ok) {
            pat0 = m.pat;
          } else {
            return false;
          }

          // TODO - if [pat0,pat1] were an array this would be a whole lot easier.
          report.push(`  Adding ${m.id.toString(16)}: pat(${patSlot}) <-  ${m.pat.toString(16)}`);
        } else {
          if (pat0 == null && pat0ok || pat0 === m.pat) {
            pat0 = m.pat;
            patSlot = 0;
            report.push(`  Adding ${m.id.toString(16)}: pat0 <-  ${m.pat.toString(16)}`);
          } else if (pat1 == null || pat1 === m.pat) {
            pat1 = m.pat;
            patSlot = 1;
            report.push(`  Adding ${m.id.toString(16)}: pat1 <-  ${m.pat.toString(16)}`);
          } else {
            return false;
          }
        }
        if (m.pal2 != null) pal2 = m.pal2;
        if (m.pal3 != null) pal3 = m.pal3;
        // @ts-ignore: debugging
        report.push(`    ${Object.keys(m).map(k => `${k}: ${m[k] && m[k].toString(16)}`).join(', ')}`);
        report.push(`    pal: ${(m.pal2 || 0).toString(16)} ${(m.pal3 || 0).toString(16)}`);

        // Pick the slot only after we know for sure that it will fit.
        let eligible = 0;
        if (flyer || moth) {
          // look for a flyer slot if possible.
          for (let i = 0; i < slots.length; i++) {
            if (slots[i] in nonFlyers) {
              eligible = i;
              break;
            }
          }
        } else {
          // Prefer non-flyer slots, but adjust if we get a flyer.
          for (let i = 0; i < slots.length; i++) {
            if (slots[i] in nonFlyers) continue;
            eligible = i;
            break;
          }
        }
        (this.report[`mon-${m.id.toString(16)}`] = this.report[`mon-${m.id.toString(16)}`] || [])
            .push('$' + location.id.toString(16));
        const slot = slots[eligible];
        const spawn = location.spawns[slot - 0x0d];
        if (slot in nonFlyers) {
          spawn.y += nonFlyers[slot][0] * 16;
          spawn.x += nonFlyers[slot][1] * 16;
        }
        spawn.patternBank = patSlot || 0;
        spawn.monsterId = m.id;
        report.push(`    slot ${slot.toString(16)}: ${spawn}`);

        // TODO - anything else need splicing?

        slots.splice(eligible, 1);
        return true;
      };

      if (flyers) {
        // look for an eligible flyer in the first 40.  If it's there, add it first.
        for (let i = 0; i < Math.min(40, this.monsters.length); i++) {
          if (FLYERS.has(this.monsters[i].id)) {
            if (tryAddMonster(this.monsters[i])) {
              this.monsters.splice(i, 1);
            }
          }
          random.shuffle(this.monsters);
        }

        // maybe added a single flyer, to make sure we don't run out.  Now just work normally

        // decide if we're going to add any flyers.

        // also consider allowing a single random flyer to be added out of band if
        // the size of the map exceeds 25?

        // probably don't add flyers to used?

      }

      // iterate over monsters until we find one that's allowed...
      // NOTE: fill the non-flyer slots first (except if we pick a flyer??)
      //   - may need to weight flyers slightly higher or fill them differently?
      //     otherwise we'll likely not get them when we're allowed...?
      //   - or just do the non-flyer *locations* first?
      // - or just fill up flyers until we run out... 100% chance of first flyer,
      //   50% chance of getting a second flyer if allowed...
      for (let i = 0; i < this.monsters.length; i++) {
        if (!slots.length) break;
        if (tryAddMonster(this.monsters[i])) {
          const [used] = this.monsters.splice(i, 1);
          if (!FLYERS.has(used.id)) this.used.push(used);
          i--;
        }
      }

      // backup list
      for (let i = 0; i < this.used.length; i++) {
        if (!slots.length) break;
        if (tryAddMonster(this.used[i])) {
          this.used.push(...this.used.splice(i, 1));
          i--;
        }
      }
      if (pat0 != null) location.spritePatterns[0] = pat0;
      if (pat1 != null) location.spritePatterns[1] = pat1;
      if (pal2 != null) location.spritePalettes[0] = pal2;
      if (pal3 != null) location.spritePalettes[1] = pal3;

      if (slots.length) {
        report.push(`Failed to fill location ${location.id.toString(16)}: ${slots.length} remaining`);
        for (const slot of slots) {
          const spawn = location.spawns[slot - 0x0d];
          spawn.x = spawn.y = 0;
        }
      }
    }
  }
}

const FLYERS: Set<number> = new Set([0x59, 0x5c, 0x6e, 0x6f, 0x81, 0x8a, 0xa3, 0xc4]);
const MOTHS_AND_BATS: Set<number> = new Set([0x55, /* swamp plant */ 0x5d, 0x7c, 0xbc, 0xc1]);
// const SWIMMERS: Set<number> = new Set([0x75, 0x76]);
// const STATIONARY: Set<number> = new Set([0x77, 0x87]);  // kraken, sorceror

// constrains pat0 if map has a treasure chest on it
const TREASURE_CHEST_BANKS = new Set([
  0x5e, 0x5f, 0x60, 0x61, 0x64, 0x65, 0x66, 0x67,
  0x68, 0x69, 0x6a, 0x6c, 0x6d, 0x6e, 0x6f, 0x70,
  0x74, 0x75, 0x76, 0x77,
]);

interface MonsterAdjustment {
  maxFlyers?: number;
  skip?: boolean;
  tower?: boolean;
  fixedSlots?: {pat0?: number, pat1?: number, pal2?: number, pal3?: number};
  nonFlyers?: {[id: number]: [number, number]};
}
const MONSTER_ADJUSTMENTS: {[loc: number]: MonsterAdjustment} = {
  [0x03]: { // Valley of Wind
    fixedSlots: {
      pat1: 0x60, // required by windmill
    },
    maxFlyers: 2,
  },
  [0x07]: { // Sealed Cave 4
    nonFlyers: {
      [0x0f]: [0, -3],  // bat
      [0x10]: [-10, 0], // bat
      [0x11]: [0, 4],   // bat
    },
  },
  [0x14]: { // Cordel West
    maxFlyers: 2,
  },
  [0x15]: { // Cordel East
    maxFlyers: 2,
  },
  [0x1a]: { // Swamp
    // skip: 'add',
    fixedSlots: {
      pal3: 0x23,
      pat1: 0x4f,
    },
    maxFlyers: 2,
    nonFlyers: { // TODO - might be nice to keep puffs working?
      [0x10]: [4, 0],
      [0x11]: [5, 0],
      [0x12]: [4, 0],
      [0x13]: [5, 0],
      [0x14]: [4, 0],
      [0x15]: [4, 0],
    },
  },
  [0x1b]: { // Amazones
    // Random blue slime should be ignored
    skip: true,
  },
  [0x20]: { // Mt Sabre West Lower
    maxFlyers: 1,
  },
  [0x21]: { // Mt Sabre West Upper
    fixedSlots: {
      pat1: 0x50,
      // pal2: 0x06, // might be fine to change tornel's color...
    },
    maxFlyers: 1,
  },
  [0x27]: { // Mt Sabre West Cave 7
    nonFlyers: {
      [0x0d]: [0, 0x10], // random enemy stuck in wall
    },
  },
  [0x28]: { // Mt Sabre North Main
    maxFlyers: 1,
  },
  [0x29]: { // Mt Sabre North Middle
    maxFlyers: 1,
  },
  [0x2b]: { // Mt Sabre North Cave 2
    nonFlyers: {
      [0x14]: [0x20, -8], // bat
    },
  },
  [0x40]: { // Waterfall Valley North
    maxFlyers: 2,
    nonFlyers: {
      [0x13]: [12, -0x10], // medusa head
    },
  },
  [0x41]: { // Waterfall Valley South
    maxFlyers: 2,
    nonFlyers: {
      [0x15]: [0, -6], // medusa head
    },
  },
  [0x42]: { // Lime Tree Valley
    maxFlyers: 2,
    nonFlyers: {
      [0x0d]: [0, 8], // evil bird
      [0x0e]: [-8, 8], // evil bird
    },
  },
  [0x47]: { // Kirisa Meadow
    maxFlyers: 1,
    nonFlyers: {
      [0x0d]: [-8, -8],
    },
  },
  [0x4a]: { // Fog Lamp Cave 3
    maxFlyers: 1,
    nonFlyers: {
      [0x0e]: [4, 0],  // bat
      [0x0f]: [0, -3], // bat
      [0x10]: [0, 4],  // bat
    },
  },
  [0x4c]: { // Fog Lamp Cave 4
    // maxFlyers: 1,
  },
  [0x4d]: { // Fog Lamp Cave 5
    maxFlyers: 1,
  },
  [0x4e]: { // Fog Lamp Cave 6
    maxFlyers: 1,
  },
  [0x4f]: { // Fog Lamp Cave 7
    // maxFlyers: 1,
  },
  [0x57]: { // Waterfall Cave 4
    fixedSlots: {
      pat1: 0x4d,
    },
  },
  [0x59]: { // Tower Floor 1
    skip: true,
  },
  [0x5a]: { // Tower Floor 2
    skip: true,
  },
  [0x5b]: { // Tower Floor 3
    skip: true,
  },
  [0x60]: { // Angry Sea
    fixedSlots: {
      pal3: 0x08,
      pat1: 0x52, // (as opposed to pat0)
    },
    maxFlyers: 2,
    skip: true, // not sure how to randomize these well
  },
  [0x64]: { // Underground Channel
    fixedSlots: {
      pal3: 0x08,
      pat1: 0x52, // (as opposed to pat0)
    },
    skip: true,
  },
  [0x68]: { // Evil Spirit Island 1
    fixedSlots: {
      pal3: 0x08,
      pat1: 0x52, // (as opposed to pat0)
    },
    skip: true,
  },
  [0x69]: { // Evil Spirit Island 2
    maxFlyers: 1,
    nonFlyers: {
      [0x17]: [4, 6],  // medusa head
    },
  },
  [0x6a]: { // Evil Spirit Island 3
    maxFlyers: 1,
    nonFlyers: {
      [0x15]: [0, 0x18],  // medusa head
    },
  },
  [0x6c]: { // Sabera Palace 1
    maxFlyers: 1,
    nonFlyers: {
      [0x17]: [0, 0x18], // evil bird
    },
  },
  [0x6d]: { // Sabera Palace 2
    maxFlyers: 1,
    nonFlyers: {
      [0x11]: [0x10, 0], // moth
      [0x1b]: [0, 0],    // moth - ok already
      [0x1c]: [6, 0],    // moth
    },
  },
  [0x78]: { // Goa Valley
    maxFlyers: 1,
    nonFlyers: {
      [0x16]: [-8, -8], // evil bird
    },
  },
  [0x7c]: { // Mt Hydra
    maxFlyers: 1,
    nonFlyers: {
      [0x15]: [-0x27, 0x54], // evil bird
    },
  },
  [0x84]: { // Mt Hydra Cave 7
    nonFlyers: {
      [0x12]: [0, -4],
      [0x13]: [0, 4],
      [0x14]: [-6, 0],
      [0x15]: [14, 12],
    },
  },
  [0x88]: { // Styx 1
    maxFlyers: 1,
  },
  [0x89]: { // Styx 2
    maxFlyers: 1,
  },
  [0x8a]: { // Styx 1
    maxFlyers: 1,
    nonFlyers: {
      [0x0d]: [7, 0], // moth
      [0x0e]: [0, 0], // moth - ok
      [0x0f]: [7, 3], // moth
      [0x10]: [0, 6], // moth
      [0x11]: [11, -0x10], // moth
    },
  },
  [0x8f]: { // Goa Fortress - Oasis Cave Entrance
    skip: true,
  },
  [0x90]: { // Desert 1
    maxFlyers: 2,
    nonFlyers: {
      [0x14]: [-0xb, -3], // bomber bird
      [0x15]: [0, 0x10],  // bomber bird
    },
  },
  [0x91]: { // Oasis Cave
    maxFlyers: 2,
    nonFlyers: {
      [0x18]: [0, 14],    // insect
      [0x19]: [4, -0x10], // insect
    },
  },
  [0x98]: { // Desert 2
    maxFlyers: 2,
    nonFlyers: {
      [0x14]: [-6, 6],    // devil
      [0x15]: [0, -0x10], // devil
    },
  },
  [0x9e]: { // Pyramid Front - Main
    maxFlyers: 2,
  },
  [0xa2]: { // Pyramid Back - Branch
    maxFlyers: 1,
    nonFlyers: {
      [0x12]: [0, 11], // moth
      [0x13]: [6, 0],  // moth
    },
  },
  [0xa5]: { // Pyramid Back - Hall 2
    nonFlyers: {
      [0x17]: [6, 6],   // moth
      [0x18]: [-6, 0],  // moth
      [0x19]: [-1, -7], // moth
    },
  },
  [0xa6]: { // Draygon 2
    // Has a few blue slimes that aren't real and should be ignored.
    skip: true,
  },
  [0xa8]: { // Goa Fortress - Entrance
    skip: true,
  },
  [0xa9]: { // Goa Fortress - Kelbesque
    maxFlyers: 2,
    nonFlyers: {
      [0x16]: [0x1a, -0x10], // devil
      [0x17]: [0, 0x20],     // devil
    },
  },
  [0xab]: { // Goa Fortress - Sabera
    maxFlyers: 2,
    nonFlyers: {
      [0x0d]: [1, 0],  // insect
      [0x0e]: [2, -2], // insect
    },
  },

  [0xad]: { // Goa Fortress - Mado 1
    maxFlyers: 2,
    nonFlyers: {
      [0x18]: [0, 8],  // devil
      [0x19]: [0, -8], // devil
    },
  },
  [0xaf]: { // Goa Fortress - Mado 3
    nonFlyers: {
      [0x0d]: [0, 0],  // moth - ok
      [0x0e]: [0, 0],  // broken - but replace?
      [0x13]: [0x3b, -0x26], // shadow - embedded in wall
      // TODO - 0x0e glitched, don't randomize
    },
  },
  [0xb4]: { // Goa Fortress - Karmine 5
    maxFlyers: 2,
    nonFlyers: {
      [0x11]: [6, 0],  // moth
      [0x12]: [0, 6],  // moth
    },
  },
  [0xd7]: { // Portoa Palace - Entry
    // There's a random slime in this room that would cause glitches
    skip: true,
  },
};

const RETAIN_SLOTS: Set<number> = new Set([0x50, 0x53]);

const UNTOUCHED_MONSTERS: {[id: number]: boolean} = { // not yet +0x50 in these keys
  [0x7e]: true, // vertical platform
  [0x7f]: true, // horizontal platform
  [0x83]: true, // glitch in $7c (hydra)
  [0x8d]: true, // glitch in location $ab (sabera 2)
  [0x8e]: true, // broken?, but sits on top of iron wall
  [0x8f]: true, // shooting statue
  [0x9f]: true, // vertical platform
  [0xa6]: true, // glitch in location $af (mado 2)
};

const shuffleRandomNumbers = (rom: Uint8Array, random: Random) => {
  const table = rom.subarray(0x357e4 + 0x10, 0x35824 + 0x10);
  random.shuffle(table);
};
