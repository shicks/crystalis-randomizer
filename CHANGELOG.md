# Changes

## 1.2.0
(NOTE: this version is published as 1.1.4 on NPM since I accidentally
unpublished 1.2.0)
* `Wt` randomizes the trade-in items NPCs want.
* `Wu` randomizes the names of certain items.
* `Ww` randomizes wall elements.
* `Tp` randomizes color palettes.
* `Tw` randomizes wild warp locations.
* `Hh` enables "hardcore mode", removing all checkpoints and saves.
* `Dt` enables a "trainer mode" that provides nearly all required items
  up-front, provides shortcuts for changing level and scaling, and redefines
  the wild warp spots for convenient access to bosses and the tower.
* Paralysis check now requires killing Kelbesque 1.
* Flails now do projectile/shield damage.
* Changes to item shuffle:
    * Removed `Sb` flag: all unique items are now shuffled together under
      `Sk`.
    * Improved consumable boss drop handling by allowing arbitrary consumables
      to fill leftover slots once all key items are placed.
* Removed controller 2 bindings in favor of new single-controller shortcuts:
    * Start+B+A triggers "wild warp".  Pressing A+B in the opposite order warps
      "backwards" in the list.  This shortcut is considered to be fully allowed
      in races.
    * Select+B quickly switches the equipped sword.
* Shuffled boss elements *from `Me`) are now accounted for in logic.
* It's now possible to walk out of the tower by touching the crystal.
* Fixed almost all known graphical issues (still outstanding are garbled bosses
  before the fight and the mosquito on some maps).
* Made `Hd` (buffed Dyna fight) a little harder.
* Removed `Rl` flag (it's now always on).
* Warp boots or teleport is now guaranteed for all checks around Shyron after
  warping there via the Sword of Thunder.
* Fixed a major random number generator glitch.
* Fixed some broken triggers and dialogs:
    * Leaf villagers can no longer get stranded on Mt. Sabre.
    * Prevent Draygon 2 from respawning in story mode.
    * Walking out of the initial cave is no longer required to ensure all caves
      are open.
* Degraded some tracker features (it can no longer show off-logic checks),
  but added some rudimentary handling for random elements and trade-ins.
* Added permalink capability.
* Misc improvements:
    * New underlying logic engine.

## 1.1.3
* `Me` flag shuffles monster weaknesses (but not accounted in logic).
* `Mt` shuffles tower monsters into the rest of the game.
* `Hz` turns on "blackout mode" in caves.
* `Hd` makes Dyna into a real boss fight, with killable side pods.
* `Tm` randomizes music.
* Sword charge damage is normalized: Wind and Water charges do 3/6/8
  damage, Fire and Thunder do 3/5/7 damage (on top of the normal base
  damage from the sword's power level).
* Orbs and bracelets are fully progressive: the orb will always be found
  before the bracelet.
    * Tornel on Mt. Sabre requires finding both the Orb and Bracelet.
* Defeating the insect is no longer sufficient for the insect flute check
  (rescuing the child is now required).
* Mimics are always inital spawns, rather than timer spawns.
* Fixed some graphical glitches, but introduced some new ones (in particular,
  garbled chests are no longer guaranteed to be mimics).
* Misc improvements:
    * Introduced better data structure abstractions.
    * Changed a few dialog messages.
    * Moved from JavaScript to TypeScript.
    * More robust testing.

## 1.1.2
* Fixed `Hg` swamp run to require sword to be in-logic.
* Fixed `Rd` flag logic to not make unwinnable seeds.

## 1.1.1
* Fixed `Em` and `Hm` flags.
* Added some analytics to the homepage.

## 1.1.0
* `Rl` flag ("no free lunch") now closes the back entrance to Mt Sabre North,
  requiring the Prison Key to open it (from either side), as well as the back
  entrance to the sealed cave (which can only be opened by starting the
  windmill).
* Made Alarm Flute a key item, given by the student.  Alarm Flute and
  Flute of Lime are now reusable.  The Flute of Lime chest has been
  replaced with a Mirrored Shield.  Leaf's tool shop sells a Fruit of
  Power instead of Alarm Flute, and Joel's tool shop sells a Lysis
  Plant, and Goa's tool shop sells a Fruit of Power instead of its
  Lysis Plant.
* Shop prices are now always normalized by scaling level.
    * Flag `Ps` will shuffle contents between shops.
* Disable some glitches:
    * `Fs` flag disables the shop glitch
    * `Ft` flag disables glitching through statues
    * `Fr` and `Fp` disable rabbit and teleport skips, respectively.
    * `Gs` changed to `Gc` for sword charge glitch
    * `Tw` changed to `Fw` for consistency with other "fixes"
* Buffed Fruit of Power to 48 in non-hard mode (`Hm`) and 64 in easy
  mode (`Em`), providing slightly better balance.
* Flag `Tb` consolidates various bonus item tweaks:
    * Speed boots (formerly `Ts`)
    * Deo's pendant buff (formerly `Td`)
    * NEW: Rabbit boots charge to level 2 while walking.
* New Easy Mode flags:
    * Flag `Es` guarantees a starting sword from Leaf elder
    * Flag `Ed` decreases enemy attack power, particularly in early game
    * Flag `Ex` increases experience drops (and `Hx` decreases them)
* New "Story mode" flag `Rs` requires killing all bosses (not counting vampire
  or insect) and having all four swords before Draygon 2 will spawn.
* New flag `Rr` requires telepathy to get item from Deo.
* New flag `Ro` makes orbs and bracelets optional for destroying walls and
  forming bridges.
* Stabbing while flying no longer damages ground enemies.
    * Also added new hard mode flag `Hc` that disables stabs entirely.
* Restore armors back to original defense values, but rearrange a bit:
    * Sacred Shield now prevents curse instead of paralysis.
    * Ceramic Shield now prevents paralysis.
    * Psycho Armor and Psycho Shield now only provide 20 DEF instead of 32.
    * Battle Armor provides 24 DEF instead of 20.
    * Ceramic Armor and Battle Shield provide 32 DEF instead of (respectively)
      20 and 24.
    * Armor and shield base prices are adjusted so that they scale
      proportionally.
    * Increased Platinum and Mirrored Shield defenses by 2 each.
    * Armor defense capped at 3 * Level
* Opel Statue now clears status effects (and fixes a base-game bug
  where it would soft-lock while riding the dolphin).
* Fix various soft-locks
    * Don't require humanly-impossible swamp run in hard-mode logic.
    * Saving or checkpointing in really awkward situations now ensure loaded
      games have a minimum of 5 HP and 1 MP (20 MP if swordless).
    * Patched queen dialog to always disappear after talking to her.
* Minor tweaks:
    * Fix some issues with Vampire 2 (specifically, too-easy scaling and including
      invulnerability to fire in logic).
    * Cause Statue of Onyx location to spawn on both versions of the map.
    * Defragmented several data tables for better access.


## 1.0.1
* Item shuffle is now done using "assumed fill".
* `Rf` (early flight) option has been removed since we can now bias
  the assumed fill algorithm to give flight at a random time.
* `Gp` (assume teleport skip) option has been added to allow the logic
  to require using flight to skip the teleport trigger at the entrance
  to Mt Sabre North.  This is included in the "advanced" preset.
* Opel statue no longer needs to be equipped to work.  Equipping it
  no longer blocks using quest items or stops storm attacks, though
  there's never a reason to do so.
* Linked to glitch explanation videos in help page.
* Fixed a few bugs:
    * Warp Boots disappearing or ending up in wrong row due to garbage
      data written into the ItemGetData table.
    * Portoa Queen's item (vanilla Flute of Lime) was being eaten but
      the previous bug masked it.
    * Ghetto flight logic forgot to guarantee Rabbit Boots.
    * Dolphin spawn requires talking to Asina but previously the graph
      expected it after getting Ball of Water.

## 1.0.0
* Initial release
