import {assemble, buildRomPatch} from './6502.js';
import {Rom} from './rom.js';
import {Random} from './random.js';
import {shuffle2 as shuffleDepgraph} from './depgraph.js';
import {crc32} from './crc32.js';
import {FlagSet} from './flagset.js';
import * as version from './version.js';

// TODO - to shuffle the monsters, we need to find the sprite palttes and
// patterns for each monster.  Each location supports up to two matchups,
// so can only support monsters that match.  Moreover, different monsters
// seem to need to be in either slot 0 or 1.

// Pull in all the patches we want to apply automatically.
// TODO - make a debugger window for patches.
export default ({
  async apply(rom, hash) {
    // Look for flag string and hash
    let flags;
    if (!hash['seed']) {
      // TODO - send in a hash object with get/set methods
      hash['seed'] = parseSeed('').toString(16);
      window.location.hash += '&seed=' + hash['seed'];
    }
    if (hash['flags']) {
      flags = new FlagSet(hash['flags']);
    } else {
      flags = new FlagSet('Em Gt Mr Rlpt Sbk Sct Sm Tasd');
    }
    for (const key in hash) {
      if (hash[key] === 'false') hash[key] = false;
    }
    await shuffle(rom, parseSeed(hash['seed']), flags);
  }
});

export const parseSeed = (/** string */ seed) => /** number */ {
  if (!seed) return Math.floor(Math.random() * 0x100000000);
  if (/^[0-9a-f]{1,8}$/i.test(seed)) return Number.parseInt(seed, 16);
  return crc32(seed);
}

export const shuffle = async (rom, seed, flags, log = undefined, progress = undefined) => {
  // First turn the seed into something useful.
  if (typeof seed !== 'number') throw new Error('Bad seed');
  const newSeed = crc32(seed.toString(16).padStart(8, 0) + String(flags)) >>> 0;

  // Rearrange things first before anything else happens!
  watchForFlag0.apply(rom);
  rearrangeTriggersAndNpcs.apply(rom);
  if (flags.check('Rd')) requireHealedDolphinToRide.apply(rom);
  if (flags.check('Rp')) connectLeafToLimeTree.apply(rom);
  openSwanFromEitherSide.apply(rom);

  const random = new Random(newSeed);
  await shuffleDepgraph(rom, random, log, flags, progress);

  // Parse the rom and apply other patches.
  const parsed = new Rom(rom);
  rescaleMonsters(rom, parsed);
  if (flags.check('Mr')) shuffleMonsters(rom, parsed, random);
  identifyKeyItemsForDifficultyBuffs(parsed);

  fixShaking.apply(rom);
  //preventSwordClobber.apply(rom);
  upgradeBallsToBracelets.apply(rom);
  preventNpcDespawns.apply(rom);
  allowTeleportOutOfTower.apply(rom);
  if (flags.check('Td')) buffDeosPendant.apply(rom);
  if (flags.check('Rl')) {
    // TODO - paralysis requires prison key
    barrierRequiresCalmSea.apply(rom);
  }
  scaleDifficultyLib.apply(rom);
  nerfArmors.apply(rom);
  fixVampire.apply(rom);
  displayDifficulty.apply(rom);
  itemLib.apply(rom);

  if (flags.check('Em')) {
    buffMedicalHerb3x.apply(rom);
  } else if (!flags.check('Hm')) {
    buffMedicalHerb2x.apply(rom);
  }

  if (flags.check('Rt')) {
    asinaTeleportsToMezameShrine.apply(rom);
  } else {
    noTeleportOnThunderSword.apply(rom);
  }

  //quickChangeItems.apply(rom);

  // These need to be at the bottom because the modify previous patches.
  if (flags.check('Ts')) leatherBootsForSpeed.apply(rom);
  //installInGameTimer.apply(rom); - this is a tough one.
  if (flags.check('Di')) neverDie.apply(rom);
  if (flags.check('Ta')) autoEquipBracelet.apply(rom);
  if (flags.check('Tw')) nerfWildWarp.apply(rom);

  return stampVersionSeedAndHash(rom, seed, flags);

  // BELOW HERE FOR OPTIONAL FLAGS:

  // do any "vanity" patches here...
  // console.log('patch applied');
  // return log.join('\n');
};

// Stamp the ROM
export const stampVersionSeedAndHash = (rom, seed, flags) => {
  // Use up to 26 bytes starting at PRG $25ea8
  // Would be nice to store (1) commit, (2) flags, (3) seed, (4) hash
  // We can use base64 encoding to help some...
  // For now just stick in the commit and seed in simple hex
  const crc = crc32(rom).toString(16).padStart(8, 0).toUpperCase();
  const hash = version.STATUS == 'unstable' ?
      version.HASH.substring(0, 7).padStart(7, 0).toUpperCase() + '     ' :
      version.VERSION.substring(0, 12).padEnd(12, ' ');
  seed = seed.toString(16).padStart(8, 0).toUpperCase();
  const embed = (addr, text) => {
    for (let i = 0; i < text.length; i++) {
      rom[addr + 0x10 + i] = text.charCodeAt(i);
    }
  };
  const intercalate = (s1, s2) => {
    const out = [];
    for (let i = 0; i < s1.length || i < s2.length; i++) {
      out.push(s1[i] || ' ');
      out.push(s2[i] || ' ');
    }
    return out.join('');
  };

  embed(0x277cf, intercalate('  VERSION     SEED      ',
                             `  ${hash}${seed}`));
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

  embed(0x27885, intercalate(crc.substring(0, 4), crc.substring(4)));

  // embed(0x25ea8, `v.${hash}   ${seed}`);
  embed(0x25716, 'RANDOMIZER');
  if (version.STATUS == 'unstable') embed(0x2573c, 'BETA');
  // NOTE: it would be possible to add the hash/seed/etc to the title
  // page as well, but we'd need to replace the unused letters in bank
  // $1d with the missing numbers (J, Q, W, X), as well as the two
  // weird squares at $5b and $5c that don't appear to be used.  Together
  // with using the letter 'O' as 0, that's sufficient to cram in all the
  // numbers and display arbitrary hex digits.

  return crc;
};

export const watchForFlag0 = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000

;;;; TODO - REMOVE THIS ONCE IT'S SOLVED
.org $3cb62 ; main game mode jump 08
  jsr CheckFlag0
.org $3fe80
ReadControllersWithDirections:
.org $3d347
InitiateDialog:

.org $3fdd0 ; !!! - note itemLib (I think) uses this space, too
CheckFlag0:
  lda $6480
  lsr
  bcc +
   asl
   sta $6480
   lda #$00
   sta $20
   sta $21
   ldx #$0c
-   lda $6140,x
    eor #$ff
    sta $6140,x
    dex
   bpl -
   jsr InitiateDialog
+ jmp ReadControllersWithDirections

`, 'watchForFlag0'));

export const openSwanFromEitherSide = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000
.bank $18000 $8000:$4000

.org $192e7
  .byte $a3,$ab  ; 73 swan gate
.org $1aba3 ; empty space at end of npcdata
  .byte $00,$ff,$09,$6b,$ff
  .byte $04,$01,$02,$b3
  .byte $04,$0a,$04,$2c
  .byte $07,$06,$01,$2d
  .byte $07,$09,$01,$2d
  .byte $02,$0a,$01,$2d ; new soldier (they need to come in pairs)
  .byte $02,$0b,$01,$2d ; new soldier
  .byte $0a,$0e,$02,$b3 ; new trigger to erase guards
  .byte $ff
.org $1ac00
`, 'openSwanFromEitherSide'));


export const connectLeafToLimeTree = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000
.bank $14000 $8000:$4000

;; Valley of Wind
.org $145dd
  .byte $e7,$93 ; new valley of wind entrance table
  .byte $22,$86 ; move exit table up a little
.org $14605
  .byte $10
.org $153e7
  .byte $80,$03,$df,$06
  .byte $40,$01,$60,$01
  .byte $80,$02,$70,$00
  .byte $c8,$01,$98,$01
  .byte $98,$01,$98,$01
  .byte $a8,$00,$90,$03
  .byte $ef,$04,$78,$05 ; new entrance from lime tree
.org $14622
  .byte $4f,$56,$42,$02 ; new exit to lime tree valley
  .byte $4f,$57,$42,$02

;; Lime Tree Valley
.org $1544c
  .byte $12,$86 ; new entrance table (inside v.wind area)
  .byte $67,$94 ; move exit table up a little
.org $14612 ; lime tree entrances
  .byte $ef,$02,$78,$01
  .byte $80,$01,$30,$00
  .byte $10,$00,$c0,$01 ; new entrance from valley of wind
.org $1545a
  .byte $1a ; left-middle screen
.org $1545d
  .byte $0c ; bottom-left (just nicer matched mountains)
.org $15467
  .byte $00,$1b,$03,$06 ; new exits to valley of wind
  .byte $00,$1c,$03,$06

;; Waterfall Valley South
.org $153dd
  .byte $60,$93 ; share layout and graphics tables w/ north half
  .byte $92,$93
;;.org $153e7  ;; Newly-freed space
;;.org $1541e



  ; find/make a free block for some new exit/entrance tables
`, 'connectLeafToLimeTree'));
// is this the right connection to make?  maybe waterfall valley is better?
//  - a full-on any-road would also be reasonable - just add an outside
//    four-way cross...
// TODO - reclaim some space


// Move several triggers unconditionally to make a little
// bit more space for them.  This gives a consistent view
// regardless of whether they are actually patched or not.
// These changes should not be user-visible at all.
export const rearrangeTriggersAndNpcs = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000
.bank $1c000 $8000:$4000

define Difficulty $64a2
define ShouldRedisplayDifficulty $64a3

;; Move Draygon's spawn condition up about $100 bytes to make 3 bytes
;; extra space for a spawn flag check for Draygon 2.
.org $1c776         ; cb draygon 1 and 2
  .byte $54,$88     ; ($1c854)
.org $1c854
  .byte $9f,$a1,$0b ; pyramid front: 10b NOT defeated draygon 1
  .byte $ff,$ff,$ff
  .byte $ff

;; Move 'Learn Barrier' trigger into 'Shyron Massacre' to get 2 extra
;; bytes for the 'Calmed Sea' condition.
.org $1e182      ; 84 learn barrier
  .byte $00,$a2  ; ($1e200)

.org $1e200
  .byte $20,$51  ; Condition: 051 NOT learned barrier
  .byte $a0,$00  ; Condition: 000 NOT false
  .byte $5b,$b2  ; Message: 1d:12  Action: 0b
  .byte $40,$51  ; Set: 051 learned barrier
.org $1e208

;; Move 'Shyron Massacre' trigger to the unused space in triggers
;; 87 and 88 to get 2 extra bytes (leaves 8 more bytes in that spot).
.org $1e17a      ; 80 shyron massacre
  .byte $32,$a2  ; ($1e232)
.org $1e232
  .byte $20,$27  ; Condition: 027 NOT shyron massacre
  .byte $00,$5f  ; Condition: 05f sword of thunder
  .byte $80,$3b  ; Condition: 03b talked to zebu in shyron -> SLOT(key to styx)
  .byte $03,$b3  ; Message: 1d:13
  .byte $40,$27  ; Set: 027 shyron massacre
.org $1e244

;; Reorder Zebu cave dialog to spawn windmill guard first
;; Alternatively: consider just having him always spawned?
;; NOTE: this reordering requires adjusting the offset for
;; the refresh give condition.
.org $1d76c ; zebu dialog 10 cave
  .byte $60,$3a,$00,$1a,$00 ; 03a NOT talked to zebu in cave -> 00:1a
  .byte         $40,$3a     ;     Set: 03a talked to zebu in cave
  .byte $00,$0d,$00,$1d,$00 ; 00d leaf villagers rescued -> 00:1d
  .byte $00,$38,$00,$1c,$00 ; 038 leaf attacked -> 00:1c
  .byte $00,$39,$00,$1d,$00 ; 039 learned refresh -> 00:1d
  .byte $40,$0a,$18,$1b,$00 ; 00a windmill key used -> 00:1b (action 03)
  .byte         $c0,$00     ;     Clear: 000 (set on item get instead)
;;.byte         $40,$39     ;     Set: 039 learned refresh

;; Give key to styx regardless of whether sword of thunder found
;; Also don't duplicate-set 03b, it's already handled by ItemGet.
.org $1d78e ; zebu dialog f2 shyron temple
  .byte $60,$3b,$8a,$97,$22,$c0,$00  ; 03b NOT -> 14:17 (action 11)
  .byte $00,$2d,$02,$c3,$22          ; 02d -> 16:03

;; Windmill guard shouldn't despawn on massacre
.org $1c7d6
  .byte $00 ; no despawn at all

;; Don't check unwritten 104 flag for mado spawn
.org $1c93a
  .byte $a0,$00

;; Remove redundant dialog itemget flag sets
.org $1cb67 ; sword of wind
  .byte $c0,$00
.org $1cde1 ; sword of fire
  .byte $c0,$00
.org $1ce0c ; insect flute
  .byte $c0,$00
.org $1d5db ; warrior ring
  .byte $c0,$00
.org $1d662 ; deo
  .byte $c0,$00
.org $1d6ee ; shield ring
  .byte $c0,$00
.org $1ccdf ; windmill key
  .byte $c0,$00
;.org $1d798 ; key to styx (zebu)
;  .byte $c0,$00
.org $1e208 ; key to styx (trigger)
  .byte $a0,$00
.org $1d3b4 ; eye glasses (clark)
  .byte $a0,$00
.org $1d852 ; kensu lighthouse
  .byte $c0,$00

; Move NpcDialog_2d to the unused space at 1d1fd..1f21b
.org $1c9b7
  .byte $fd,$91
.org $1d1fd
  .byte $80,$00,$00,$00
  .byte $28,$00
  .byte $73,$05
  .byte $ff
  ;; 00: 28 Mt Sabre North - Main
  .byte $a0,$00,$08,$b0,$00 ; default -> 05:10 (action 01)
  ;; 05: 73 Swan - Gate
  .byte $40,$2a,$42,$75,$05 ; 02a change:soldier -> 13:15 (action 08)
  .byte         $41,$0d     ;     Set: 10d
  .byte $a0,$00,$0a,$74,$05 ; default -> 13:14 (action 01) -> @ 05
.org $1d21b

.org $1e34c ; trigger b3: despawn swan guards
  .byte $81,$0d ; 10d talked to guards from other side -> despawn

;; NOTE: we could use 2 less bytes if necessary by moving a smaller
;; entry here that's otherwise adjacent to some free space.  Or
;; just defrag that table.
.org $1db06
  .byte $79,$8f ; ItemGetData_03 pointer
.org $1cf79 ; space freed by moving Dialog_2d
ItemGetData_03: ; sword of thunder
  .byte $03,$80 ; slot
  .byte $08,$00 ; action 01 -> teleport to shyron
  .byte $02,$fd ; Set: 2fd warp:shyron
  .byte $40,$5f ; Set: 05f chest:03:sword of thunder
  .byte $ff
.org $1cf82
  ; 15 bytes still available
.org $1cf91


;; queen will try to give flute of lime even if got sword first
.org $1cfab ; queen "you found sword of water" message action
  .byte $19 ; add action 03
;.org $3d1f5 ; call to WaitForDialogToBeDismissed
;  jsr PatchAsinaReveal

;; asina will also give flute of lime if queen never did (after recover)
.org $098f9
  .byte $28 ; asina persondata[1] -> flute of lime
.org $1d80a
  .byte $89 ; asina love pendant dialog -> give second item
.org $1d816
  .byte $89 ; asina default dialog -> give second item

.org $3ff44
; TODO - 60 bytes we could use here (now 36)
PatchGrantItemInRegisterA:
  ;; Version of GrantItemInRegisterA that bails out if the
  ;; item is already owned.
  sta $057f
  lsr
  lsr
  lsr
  tax
  lda $057f
  and #$07
  tay
  lda $64c0,x
  and $3c000,y ; powers of two
  beq +
   pla
   pla
+ rts
.org $3ff5c

;;PatchAsinaReveal:
;;  jsr WaitForDialogToBeDismissed
;;  jmp DialogFollowupActionJump_03
.org $3ff62
; this space is used by nerfArmors
;.org $3ff77
;.org $3ff80

;.org $3d225
;DialogFollowupActionJump_03:
;.org $3d354
;WaitForDialogToBeDismissed:


.org $3d223 ; part of DialogFollowupActionJump_11 (give 2nd item)
  bpl GrantItemInRegisterA ; change from bne to handle sword of wind

.org $3d22b
GrantItemInRegisterA:
  jsr PatchGrantItemInRegisterA

;; If LookingAt is $1f and the item goes into the $20 row then we can't
;; just reject - instead, add the item to an overflow chest.
;; We use the bytes at 64b8..64bf to store the overflow.

;; asina reveal depends on mesia recording (01b), not ball of water (01f)
;; - this ensures you have both sword and ball to get to her --> ???
.org $1c81f
  .byte $1b
.org $1c822
  .byte $1b
.org $1c82a
  .byte $1b
.org $1cf9c
  .byte $1b
.org $1d047
  .byte $1b
.org $1e389
  .byte $1b


;; bow of truth extra triggers
.org $1d8dc ;; Azteca dialog
  .byte $80,$00,$c0,$00

;; refresh triggers
;.org $1d780
;  .byte $c0,$00
.org $1e358
  .byte $c0,$00

;; paralysis triggers
.org $1e34a
  .byte $c0,$00

;; teleport triggers
.org $1d7d0
  .byte $c0,$00

;; barrier triggers
.org $1c7e2
  .byte $20,$00 ; akahana cave
.org $1c7ef
  .byte $a0,$00 ; akahana stoned
.org $1c886
  .byte $a0,$00 ; zebu
.org $1c898
  .byte $a0,$00 ; tornel
.org $1c8ac
  .byte $a0,$00 ; stom
.org $1e222
  .byte $c0,$00 ; trigger set flag

;; insect/dwarf items
;; Change all the post-insect messages to action 03
.org $1cdc6
  .byte $18
.org $1cdcb
  .byte $18
.org $1cdd2
  .byte $18
.org $1cdd9
  .byte $18
.org $1cdff
  .byte $18
.org $1ce04
  .byte $18

;; kensu in the cabin needs to be available even after visiting joel.
;; just have him disappear after setting the flag. but also require
;; having returned the fog lamp before he shows up - this requires
;; moving him up a word.
.org $1c6b0
  .byte $f6,$88 ; pointer to kensu 68
.org $1c8f6
  .byte $61,$20,$9b,$80,$21,$ff
.org $1d867
  .byte $12,$21 ; message 11:01 (action 02 disappear)


;; Treasure chest spawns don't need to be so complicated.
;; Instead, just use the new dedicated ItemGet flags 200..27f
.org $1c5c3
  ;; Read the flag 200+chest, where chest is in $23
  lda #$a2
  sta $61
  lda $23
  sta $62
  lda #$61
  sta $24
  lda #$00
  sta $25
  tay
  jsr ReadFlagFromBytePair_24y
  beq +
   inc $20
+ rts
.org $1c5de

;; Patches to ItemGet to update the dedicated flag and
;; leave room for calling the difficulty methods
.org $1c287
  jsr ItemGet_PickSlotAndAdd
.org $1c299
  jmp ItemGetFollowup
.org $1c29c
ItemGet_PickSlotAndAdd:  ; move this up 4 bytes
  sty $62
  nop
  nop
.org $1c2a0

.org $1c26f
ItemGet:
.org $1c135
ReadFlagFromBytePair_24y:
.org $1c112
SetOrClearFlagsFromBytePair_24y:

;; Freed from the chest spawn pointer table
.org $1dc82
.org $1dd64

;; Freed from the chest spawn data
.org $1e106
ItemGetRedisplayDifficulty:
  rts  ; change to nop to enable this code
  lda #$01
  sta ShouldRedisplayDifficulty
  rts
.org $1e110
ItemGetFollowup:
  ;; We have room to exactly copy this behavior, but it does appear
  ;; to be dead.
  lda ($24),y
  pha  ; later -> pla and if pl then repeat ItemGet with A -> $23
   ;; Maybe increase difficulty (if last element is FE)
   bpl +
   lsr
   bcs +
    lda Difficulty
    cmp #$2f
    bcs +
     inc Difficulty
     jsr ItemGetRedisplayDifficulty
   ;; Always set the dedicated 200+chest flag.
+  lda #$42
   sta $61
   ;; $62 is already the item number, saved from earlier
   lda #$61
   sta $24
   lda #$00
   sta $25
   tay
   jsr SetOrClearFlagsFromBytePair_24y
  ;; Now finish by maybe chaining to another item if positive
  pla
  bmi +
   sta $23
   jmp ItemGet
+ rts

ItemGet_FindOpenSlotWithOverflow:
  tay ; copied from 1c2a8
  bmi +
   pla ; make the call into this actually a jump...
   pla
   stx $61  ; save this for now
   jsr ItemGet_FindOpenSlot
   ;; if 23 nonzero then we failed to find a slot
   ;; if 61 is 20 then we really need to put it somewhere
   ;; in that case, add it to the overflow.  when we
   ;; delete a key item, it will fall in
   lda $23
    beq +
   lda $61
   cmp #$20
    bne +
   ;; need to find a place
   ldx #$07
-   lda $64b8,x
    beq ++
    dex
    bpl -
+ rts
++  lda $29
    sta $64b8,x
    lda #$00
    sta $23
    rts

;; TODO - still plenty of space here

.org $1e179 ; 1e17a is above...


.org $1c308
ItemGet_FindOpenSlot:
.org $1c2a8
  jsr ItemGet_FindOpenSlotWithOverflow


;; Replace "drop item" code for key items to use an overflow buffer

.bank $20000 $8000:$2000

.org $20372
  jsr CheckDroppable

.org $20434
  jsr MaybeDrop
  nop
  nop

.org $20ff0
InvItemData:

.org $21471 ; unused space, 130 or so bytes
CheckDroppable:
  ;; Loads A with something that has the :40 bit set if the item
  ;; is not droppable.
  lda $64bf
  beq +
   ;; there's overflow, so allow deleting if selecting from 3rd row
   lda $6427
   and #$38
   cmp #$10
   bne +
    lda #$00
    rts
+ lda InvItemData,x
  rts
MaybeDrop:  ; 21486
  txa
  and #$f0
  cmp #$20
  beq +
   lda #$ff
   sta $6430,x
   rts
  ;; This is a key item and we have overflow.
  ;; Substitute the overflow and cycle...
+ lda $6430,x
  pha
   lda $64bf
   sta $6430,x
   ldx #$07
-   lda $64b7,x
    beq +
    sta $64b8,x
    dex
    bne -
+ pla
  sta $64b8,x
  rts
FillQuestItemsFromBuffer: ; 214af
  ;; If there's anything in the buffer and any space in the inventory,
  ;; fill them in.  Just take the most recently added ones, not worrying
  ;; about cycling the queue (that's only needed for dropping).
  ldy #$08     ; predecrement, so start at $64c0
-  dey
   bmi +       ; buffer is full
   lda $64b8,y
  bne -        ; occupied, decrement and look at the next
  ;; If y == #$08 then buffer is empty - return.
+ iny
  cpy #$08
  beq +
  ;; Look for open spots in the quest item row
  ldx #$08
-   dex
    bmi +
    lda $6450,x
   bpl -
   ;; We're looking at an open slot in x and an available item in y
   lda $64b8,y
   sta $6450,x
   lda #$00
   sta $64b8,y
   iny
   cpy #$08
  bne -
  ;; The following is copied from $20534, patched to not sort
  ;; the swords or powerups (so it loads 2 instead of 0)
+ lda #$02
  sta $2e
  rts

.org $21500

;; MUST BE EXACTLY 4 BYTES
.org $20534
  nop
  jsr FillQuestItemsFromBuffer

;; NOTE: This is copied from preventSwordClobber, which is no longer
;; used on its own since we need to do slightly different initialization
;; to refill from the buffer.
;.org $20534
;  lda #$02
.org $205a7
  .byte $0c
.org $205a9
  .byte $04

`, 'rearrangeTriggers'));

export const requireHealedDolphinToRide = buildRomPatch(assemble(`
;; move portoa fisherman up 1 word, make him only
;; appear if both shell flute AND healed dolphin
;; NOTE: 8b is the traditional itemget and 25
;; is tied to the slot (healing dolphin)
;; We could delete the slot one, but it's actually
;; convenient to have both...
.org $1c6a8
  .byte $99,$87
.org $1c799
  .byte $d6,$00,$25,$80,$8b,$ff
;; daughter's dialog should trigger on both, too
.org $1d1c5
  .byte $80,$2a,$03,$cc,$ff
  .byte $20,$25,$01,$26,$00
  .byte $20,$8b,$01,$26,$00
  .byte $00,$21,$01,$25,$00
  .byte $a0,$00,$01,$24,$00
`, 'requireHealedDolphinToRide'));

// Skip the check that the player is stationary.  We could also adjust
// the speed by changing the mask at $3f02b from $3f to $1f to make it
// faster, or $7f to slow it down.  Possibly we could start it at $7f and
// lsr if stationary, so that MP recovers quickly when still, but at half
// speed when moving?  We might want to consider how this plays with
//refresh and psycho armor...
export const buffDeosPendant = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.org $3f026
  nop
  nop
`, 'buffDeosPendant'));

// Allow teleporting out of the tower.  Also, Draygon 2 must not appear after being defeated.
export const allowTeleportOutOfTower = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.bank $1c000 $8000:$4000

;; draygon 2 does not reappear after defeated
;; (points to moved memory location).
.org $1c857
  .byte $a6,$a2,$8d

.org $3db39
  .byte $00   ; don't jump away to prevent warp, just goto next line

`, 'allowTeleportOutOfTower'));

// Prevent Akahana from disappearing from waterfall cave after learning barrier,
// as well as other NPCs that migrate to Shyron but have missable items.
// Zebu will remain in his cave (to trigger windmill guard) and Asina in her
// room (for Recover).  For the queen's Flute of Lime, we avoid randomizing it
// and then have the Mesia recording give it instead.
// TODO - rethink Leaf a bit - windmill guard should maybe despawn, so the
// relevant slots to require are windmill guard and elder.
export const preventNpcDespawns = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.bank $1a000 $8000:$2000

.org $1a181 ;; npcdata a9 slot 0d second byte
  .byte $67 ;; move kelbesque 2 one tile left

.bank $1c000 $8000:$4000

;; akahana does not disappear from waterfall cave after barrier
.org $1c7e3
  .byte $00

;; stoned akahana does not disappear from waterfall cave after barrier
.org $1c7f0
  .byte $00

;; zebu does not disappear from his cave after barrier
.org $1c887
  .byte $00

;; asina does not disappear after defeating sabera
.org $1c8b9
  .byte $00

;; clark moves back to joel after giving item, not after calming sea
;; TODO - this is slightly awkward in that you can go up the stairs
;; and back down and he's disappeared.  An alternative would be to
;; put a trigger somewhere far away that checks 08d and sets some
;; other (fresh/unused) flag to key off of.  (disappearing would be
;; weird for clark, tho)
.org $1c842
  .byte $8d
.org $1c845
  .byte $8d

;; Prevent soft-lock when encountering sabera and mado from reverse
;; Double-returns if the boss's sprite is not in the top quarter of
;; the screen. This is unused space at the end of the triggers.
.org $1e3c0
CheckBelowBoss:
   lda $0380,x
    bmi ++
   ; skip the check for sabera 1 and mado 1
   lda $04a0,x
   and #$fe
   cmp #$e6  ; sabera and mado
   bne +
    lda #$dc
    cmp $04c0,x  ; first version has #$cf, second has #$dc
    bne ++
+  sec
   lda $d0
   sbc $d0,x
    bmi ++
   lda $b0
   sbc $b0,x
    bmi ++
   sbc #$40
++ rts
.org $1e3e5
.org $1e3f0

.org $1e48b  ; vampire pattern 0
  jsr CheckBelowBoss
.org $1e971  ; kelbesque pattern 0
  jsr CheckBelowBoss
.org $1ec8f  ; sabera pattern 0
  jsr CheckBelowBoss
.org $1ede8  ; mado pattern 0
  jsr CheckBelowBoss

;; TODO - despawning swan guards closes the door forever
;; instead, pick an unused flag, then set it as a prereq for
;; trigger_b3 (1e34c) and set it as result of dialog_2d @73 +0 (1cf87)
;;   => need 2 extra bytes to do this...
;;   ... or add a jump to DialogFollowupActionJump_08 () to
;;       set the flag manually if $6c==#$73

;; Also fix softlock issue with zebu in reverse fortress.
;; Remove the $c4,$29 spawn that locks the screen.
.bank $1a000 $a000:$2000
.org $1a1c0  ; npcdata_aa slot 0e
  .byte $ff  ; just delete the spawn entirely
.org $1a220  ; npcdata_ac slot 0f
  .byte $ff  ; same for tornel
.org $1a2e8  ; npcdata_b9 slot 0f
  .byte $ff  ; same for asina
;; NOTE - changing this for kensu seems broken and is unnecessary...
;; except that it seems to be broken.
;;.org $1a3ac  ; npcdata_ba slot 0e
;;  .byte $00,$00,$02,$80 ; more npcs follow so instead change to off-screen trigger

`, 'preventNpcDespawns'));

// Specifically require having calmed the sea to learn barrier
export const barrierRequiresCalmSea = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.bank $1c000 $8000:$4000

.org $1e202
  .byte $80,$8f  ; Condition: 283 calmed angy sea (also 283)
`, 'barrierRequiresCalmSea'));

// Prevent the teleport-to-shyron sequence upon getting thunder sword.
export const noTeleportOnThunderSword = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.org $3d565
  .word ($d78c)
`, 'noTeleportOnThunderSword'));

// This is the alternative to noTeleportOnThunderSword - if we teleport then
// we need a way back to leaf just in case!
export const asinaTeleportsToMezameShrine = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.bank $1c000 $8000:$2000

;; Add an extra dialog followup for asina to conditionally use to
;; warp back to leaf from shyron

.org $1d81b
  .byte $fa ; 03b -> action 1f
.org $1d820
  .byte $fa ; 03b -> action 1f
.org $1d82c
  .byte $fa ; default -> action 1f

.org $3d161
  .byte $45,$fe ; DialogFollowupActionJump 1f

.org $3fe45
  lda #$00
  sta $6c
  sta $6d
  lda #$01
  sta $41
  rts
.org $3fe50
.org $3fe78 ; end of unused space

`, 'asinaTeleportsToMezameShrine'));

export const saharaBunniesRequireTelepathy = buildRomPatch(assemble(`
.bank $1c000 $8000:$2000
.org $1d653 ; dialog 5a deo
  ;; replace akahana's dialog - would be nice to add an extra stanza instead,
  ;; but there's not immediately space - if we ever defrag then we should do it
  ;; or else remove all the changed forms (except maybe soldier)
  .byte $c2,$43   ; 243 NOT telepathy -> 1a:13
.org $1d671 ; dialog 59 generic sahara bunnies
  ;; replace stom - he can talk to bunnies just fine
  .byte $c2,$43   ; 243 NOT telepathy -> 1a:12

`, 'saharaBunniesRequireTelepathy'));


// Fix the shaking issues by tweaking the delay times in IRQ callbacks.
export const fixShaking = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank

.org $3f4eb
  ldx #$03
loop1:
  dex
  bpl loop1

.org $3f455
  ldx #$07
  nop
`, 'fixShaking'));


// Debug mode to display difficulty in status bar.
// NOTE: this needs to be patched AFTER difficultyScalingLib
export const displayDifficulty = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.bank $1e000 $a000:$2000

define ShouldRedisplayDifficulty $64a3

.org $1fd27
  lda #$0e                      ; refer to moved LV(menu) display

.bank $26000 $a000:$2000
.org $27aca
  ldx #$06                      ; also show diff

.bank $34000 $8000:$2000
.org $34ee9  ; NOTE - Difficulty goes here!
  .byte $a2,$64,$3c,$2b,$03,$00 ; display difficulty right of lvl
.org $34f19
  .byte $21,$04,$29,$29,$03,$00 ; copied from $34ee9

.bank $1c000 $8000:$2000
.org $1e106
  .byte $ea    ; change rts to nop

.org $3ffa9
DisplayNumber:

.org $3cb84
CheckForPlayerDeath:

.org $3cb65  ; inside GameModeJump_08_Normal
  jsr CheckToRedisplayDifficulty

.org $3ffe3 ; we have 23 bytes to spend here
CheckToRedisplayDifficulty:
  lda ShouldRedisplayDifficulty
  beq +
   lda #$00
   sta ShouldRedisplayDifficulty
   lda #$06
   jsr DisplayNumber
+ jmp CheckForPlayerDeath
.org $3fffa
`, 'displayDifficulty'));


// TODO - use a pure JS function for this
export const buffMedicalHerb3x = buildRomPatch(assemble(`
.bank $1c000 $8000:$4000
.org $1c4ea
  .byte $60
`, 'buffMedicalHerb3x'));

export const buffMedicalHerb2x = buildRomPatch(assemble(`
.bank $1c000 $8000:$4000
.org $1c4ea
  .byte $40
`, 'buffMedicalHerb2x'));

// TODO - buff medical herb - change $1c4ea from $20 to e.g. $60,
//   or else have it scale with difficulty?
//   - (diff + 1) << 4 ? 


export const removeWildWarp = buildRomPatch(assemble(`
;;; NOTE: this actually recovers 36 bytes of prime real estate PRG.
;;; Alternatively, restrict it to only go to leaf?
.bank $3c000 $c000:$4000
.org $3cbc7
  rts
`, 'removeWildWarp'));


export const nerfWildWarp = buildRomPatch(assemble(`
;;; Wild warp only goes to start.
.bank $3c000 $c000:$4000
.org $3cbec
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
`, 'nerfWildWarp'));


// Prevents swords and balls/bracelets from sorting, so that they don't clobber each other.
export const preventSwordClobber = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000
.bank $20000 $8000:$4000

.org $20534
  lda #$02
.org $205a7
  .byte $0c
.org $205a9
  .byte $04
`, 'preventSwordClobber'));

// Causes the first power-up to always give the ball, and the second to be the bracelet.
export const upgradeBallsToBracelets = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000
.bank $1c000 $8000:$2000

.org $1c2de
  lda $29
  bcc +
   inc $6430,x
   bne ItemGet_Bracelet
   lsr
   lda $29
   sbc #$00
   sta $23
+ sta $6430,x
  rts
.org $1c2f4
ItemGet_Bracelet:
`, 'upgradeBallsToBracelets'));

// TODO - expose via a hash fragment (pass into patch)
export const neverDie = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000

.org $3cb89
  lda $03c0
  sta $03c1
  nop
.org $3cbaf
  bne label
.org $3cbc0
label:
`, 'neverDie'));


export const fixVampire = buildRomPatch(assemble(`
;;; Fix the vampire to allow >60 HP
.bank $3c000 $c000:$4000
.bank $1e000 $a000:$2000
.org $1e576
  jsr ComputeVampireAnimationStart
  nop
.org $1ff97 ; This looks like it's just junk at the end, but we could
            ; probably go to $1ff47 if we don't care about developer mode
ComputeVampireAnimationStart:
   bcs +
   asl
   bcs +
   adc #$10
   bcc ++
+  lda #$ff
++ rts
`, 'fixVampire'));


export const itemLib = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank

.org $3c0f8
  jsr PostUpdateEquipment
  jmp RestoreBanksAndReturn

.org $3c446
PostUpdateEquipment:
  ;; Change 'lda' (ad) to 'jsr' (20) to enable these
  lda ApplySpeedBoots
  rts
ApplySpeedBoots:
  lda #$06   ; normal speed
  sta $0341  ; player speed
  lda $0716  ; equipped passive item
  cmp #$13   ; leather boots
  bne +
   inc $0341 ; speed up by 1
+ rts
.org $3c482  ; end of empty area

.org $3c008
UpdateEquipmentAndStatus:

.org $3d91f
  jsr PostInventoryMenu
.org $3d971
  jsr PostInventoryMenu

;;; Call 3f9ba instead of 3c008 after the inventory menu
.org $3f9ba
PostInventoryMenu:
  ;; Change 'lda' (ad) to 'jsr' (20) to enable these
  lda AutoEquipBracelets
  jmp UpdateEquipmentAndStatus
AutoEquipBracelets:
  lda $6428
  bpl +
   ;; deselect all
-  lda #$80
   sta $642b
   lda #00
   sta $0718
   sta $0719
   rts
+ tay
  cmp $6430,y ; check for crystalis
   bne -
  lda $643c,y ; which power-up do we have?
   bmi -
  ;; need to store $718 (0=nothing, 1..4=ball, 5..8=bracelet), $719 (0..2), $642b (0..3)
  lsr
  lda #$01
  bcs +
   lda #$02
+ sta $719
  and #$02
  asl
  sta $61
  tya
  sta $642b
  sec
  adc $61
  sta $0718
  rts

.org $3f9f8
FinishTriggerSquare:
  beq +
   lda #$08  ; game mode normal
   sta $41
+ jmp MainLoop_01_Game
  
.org $3fa10

.org $3fdf0

.org $3d354
WaitForDialogToBeDismissed:
.org $3d3ff
MainLoopItemGet:
.org $3e756
RestoreBanksAndReturn:


.org $3cab6
MainLoop_01_Game:

;; End of ActivateTriggerSquare restores game mode to normal,
;; but if sword of thunder comes from trigger square, this will
;; clobber the LOCATION_CHANGE mode.  Patch it to call out to
;; FinishTriggerSquare to check for mode 02 and if it is, don't
;; change it back.
.org $3d54b ; change this to call FinishTriggerSquare
  lda $41
  cmp #$01  ; game mode: location change
  jmp FinishTriggerSquare
.org $3d552

`, 'itemLib'));

// export const installInGameTimer = buildRomPatch(assemble(`
// .bank $3c000 $c000:$4000 ; fixed bank
// .org $3f9f8
// UpdateInGameTimer:

// .org $3f3b7
//   nop
//   jsr UpdateInGameTimer
// `, 'installInGameTimer'));

// TODO - not working yet
export const quickChangeItems = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank

;;.org $3fe75
;;  jmp

;; REPLACE ALL CALLS to ReadControllersWithDirections
;; to instead use ReadControllersAndUpdateStart

;;  - will thhis even work?

.org $3fe80
ReadControllersWithDirections:



.org $3cb62
  jsr ReadControllersAndUpdateStart
.org $3d8ea
  jsr ReadControllersAndUpdateStart

.org $3f9f8 ; whereever AutoEquipBracelet left off -- TODO - seat's taken
ReadControllersAndUpdateStart:
  lda $43    ; Pressed buttons last frame
  and #$30   ; Start and Select
  sta $61
  jsr ReadControllersWithDirections
  ;; Cahnge $4b to report start/select only on button-up, and
  ;; only if no quick select happened.  We store a mask #$30 in
  ;; $42 on button-down for start and select, and zero it out
  ;; on quick change, so that ANDing with it before setting
  ;; $4b is sufficient to meet the requirement.
  lda #$30
  bit $4b
  beq +
   sta $42
+ lda $43
  eor #$ff
  and $61
  and $42
  sta $61
  lda $4b
  and #$cf  ; ~$30
  ora $61
  sta $4b
  rts
`, 'quickChangeItems'));

export const leatherBootsForSpeed = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank

.org $3c446
  .byte $20

.bank $28000 $8000:$2000
.org $29105
  .byte "Speed Boots",$00
.org $2134a
  .byte "Speed Boots",$ff

`, 'leatherBootsForSpeed'));

export const autoEquipBracelet = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank
.org $3f9ba
  .byte $20
`, 'autoEquipBracelets'));


// NOTE: if we insert at $3c406 then we have $11 as scratch space, too!
// Extra code for difficulty scaling
export const scaleDifficultyLib = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000 ; fixed bank

define Difficulty $64a2
define PlayerLevel $421
define ObjectRecoil $340
define ObjectHP $3c0
define PlayerMaxHP $3c0
define ObjectAtk $3e0
define PlayerAtk $3e1
define ObjectDef $400
define ObjectActionScript $4a0
define ObjectGold $500
define ObjectElementalDefense $500
define ObjectExp $520

define SFX_MONSTER_HIT       $21
define SFX_ATTACK_IMMUNE     $3a

.org $34bde
CoinAmounts:
  .word 0,1,2,4,8,16,30,50,100,200,300,400,500,600,700,800

.bank $1c000 $8000:$4000 ; item use code

.org $3fe2e
SubtractEnemyHP:
  ;; NOTE: we could probably afford to move a few of these back if needed
  lda ObjectElementalDefense,y
  and #$0f
  cmp #$0f
  sec
   beq +   ; don't damage anything that's invincible.
  lda ObjectHP,y
  sbc $63
  sta ObjectHP,y
+ lda $61
  sbc #$00
  rts
.org $3fe45
; NOTE - this space used by TeleportToMezameShrine
.org $3fe78 ; end of unused space

;;.org $3c010
;;;; Adjusted inventory update - use level instead of sword
;;   ldy $0719  ; max charge level
;;   lda #$01
;;-   asl
;;    dey
;;   bpl -
;;   ldy $0716  ; equipped passive item
;;-   clc
;;    adc $0421  ; player level
;;    dey
;;    cpy #$0d   ; power ring - 1
;;   beq -
;;   sta $03e1  ; player attack
;;   lda $0421  ; player level
;;   cpy #$0f   ; iron necklace - 1
;;.org $3c02d   ; NOTE - MUST BE EXACT!!!!


.org $3c010
;; Adjusted inventory update - use level instead of sword
;; Also nerf power ring to only double the sword value, rather than the level.
   ldy $0719  ; max charge level
   lda #$01
-   asl
    dey
   bpl -
   ldy $0716  ; equipped passive item
   cpy #$0e   ; power ring
   bne +
    asl
+  clc
   adc $0421  ; player level
   sta $03e1  ; player attack
   lda $0421  ; player level
.org $3c02b   ; NOTE - MUST BE EXACT!!!!


.bank $34000 $8000:$4000 ; item use code


;; Adjusted stab damage for populating sword object ($02)
.org $35c5f
  lda #$02
  sta $03e2
  rts


;; ADJUSTED DAMAGE CALCULATIONS
;; $61 is extra HP bit(s)
;; $62 is DEF
;; $63 is damage
.org $350fa
    lda #$00
    sta $61
    sta $63 ; damage we're actually going to do
    ;; Check elemental immunity
    lda ObjectElementalDefense,y
    and ObjectElementalDefense,x
    and #$0f
    php
     lda ObjectDef,y
     lsr     ; Just pull one extra bit for HP, could do one more if needed
     rol $61
     sta $62 ; Store actual shifted DEF in $62
     lda PlayerAtk
     adc ObjectAtk,x
     sec
     sbc $62 ; A <- atk - def
     bcc +
    plp
    bne ++
     sta $63 ; will do damage
     pha ; to prevent pla from screwing up
+   pla  ; to compensate for skipping the plp above
++  stx $10
    sty $11
    lda $63
    bne ++
      sta ObjectActionScript,x
      lda ObjectActionScript,y
      bmi +
       jsr KnockbackObject
+     lda #SFX_ATTACK_IMMUNE
      inc $63
      bne +++
++   jsr KnockbackObject
     lda #SFX_MONSTER_HIT
+++ jsr StartAudioTrack
    jsr SubtractEnemyHP
     bcc KillObject
    lsr
    lda $62
    rol
    sta ObjectDef,y
    rts
;;; NOTE: must finish before 35152
.org $35152
KillObject:
.org $355c0
KnockbackObject:
.org $3c125
StartAudioTrack:


.bank $1a000 $a000:$2000 ; object data
.org $3c409
  jmp ComputeEnemyStats

.org $1bb00  ; This should leave some space after compression

DiffAtk:   ; PAtk*8
  .byte $28,$2C,$30,$33,$37,$3B,$3F,$42,$46,$4A,$4E,$51,$55,$59,$5D,$60
  .byte $64,$68,$6C,$6F,$73,$77,$7B,$7E,$82,$86,$8A,$8D,$91,$95,$99,$9C
  .byte $A0,$A4,$A8,$AB,$AF,$B3,$B7,$BA,$BE,$C2,$C6,$C9,$CD,$D1,$D5,$D8
DiffDef:   ; PDef * 4
  .byte $0C,$0F,$12,$15,$18,$1B,$1E,$21,$24,$27,$2A,$2D,$30,$33,$36,$39
  .byte $3C,$3F,$42,$45,$48,$4B,$4E,$51,$54,$57,$5A,$5D,$60,$63,$66,$69
  .byte $6C,$6F,$72,$75,$78,$7B,$7E,$81,$84,$87,$8A,$8D,$90,$93,$96,$99
DiffHP:    ; PHP (0..$26)
  .byte $30,$36,$3B,$41,$46,$4C,$51,$57,$5C,$62,$67,$6D,$72,$78,$7D,$83
  .byte $88,$8E,$93,$99,$9E,$A4,$A9,$AF,$B4,$BA,$BF,$C5,$CA,$D0,$D5,$DB
  .byte $E0,$E6,$EB,$F1,$F6,$FC,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
DiffExp:   ; ExpBase * 4, encoded in standard EXP encoding
  .byte $05,$06,$08,$0A,$0C,$0E,$12,$16,$1A,$20,$27,$30,$3A,$47,$56,$69
  .byte $88,$89,$8B,$8E,$91,$95,$99,$9F,$A6,$AE,$B8,$C4,$D2,$E4,$FA,$FF
  .byte $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF

;;; $12 and $13 are free RAM at this point

.org $1bbd0  ; Note: this follows immediately from the tables.
ComputeEnemyStats:
  lda ObjectRecoil,x
  bmi +
   jmp $3c2af ; exit point
+ and #$7f
  sta ObjectRecoil,x
  ldy Difficulty
RescaleDefAndHP:
   ;; HP = max(PAtk + SWRD - DEF, 1) * HITS - 1
   ;; DiffAtk = 8 * PAtk
   ;; DEF = (8 * PAtk) * SDEF / 64   (alt, SDEF = 8 * DEF / PAtk)
   lda ObjectHP,x
    beq RescaleAtk
   ;; Start by computing 8*DEF, but don't write it to DEF yet.
+  lda ObjectDef,x
   pha
    and #$0f
    sta $62 ; SDEF
   pla
   and #$f0
   lsr
   sta $12 ; 8*SWRD (Note: we could store this on the stack)
   lda DiffAtk,y
   sta $61 ; 8 * PAtk
   jsr Multiply16Bit  ; $61$62 <- 64*DEF
   ;; Multiply by 4 and read off the high byte.
   lda $62
   asl $61
   rol
   asl $61
   rol
   sta ObjectDef,x
   ;; Now compute 8*PAtk + 8*SWRD - 8*DEF
   asl
   bcs +
    asl
    bcs +
     asl
     bcc ++
+     lda #$ff        ; overflow, so just use $ff.
++ sta $61            ; $61 <- 8*DEF
   ;; Subtract from 8*PAtk.  This may go negative, in which case
   ;; we store the #$ff in $62.  We start with 1 and unconditionally
   ;; decrement at the end so that we can check its zeroness and sign
   ;; without destroying the accumulator.
   lda #$01
   sta $62
   lda DiffAtk,y
   sec
   sbc $61
   bcs +
    dec $62
   ;; Now add 8*SWRD, again carrying into $62.
+  clc
   adc $12
   bcc +
    inc $62
+  dec $62
   ;; Check for overflow - if $62 == 1 then set A <- $ff
   beq ++
    bpl +
     lda #$ff
     bmi ++
+   lda #$00
++ sta $61
   ;; Now check if A is zero, in which case we need to increment it.
   ora #$0
   bne +
    inc $61
   ;; Multiply by hits, then divide by 8
   ;; $1bc3c:
+  lda ObjectHP,x
   sta $62
   jsr Multiply16Bit
   ;; Subtract 1
   lda $61
   sec
   sbc #$01
   bcs +
    dec $62
   ;; Divide by 8
+  lsr $62
   ror
   lsr $62
   ror
   lsr $62
   ror                ; A is low byte of HP, $62 is high byte.
   ;; Check the high part of HP.  One bit will be rotated into the DEF byte.
   lsr $62
   ;; If there's anything left in $62 then we've overflowed.
   beq +
    lda #$ff
    sec
+  rol ObjectDef,x
   sta ObjectHP,x
RescaleAtk:   ; $1bc63
  ;; DiffDef = 4 * PDef
  ;; DiffHP = PHP
  ;; ATK = (4 * PDef + PHP * SAtk / 32) / 4
  lda ObjectAtk,x
   beq RescaleGold
  sta $61
  lda DiffHP,y
  sta $62
  jsr Multiply16Bit
  lda $61
  lsr $62
  ror
  lsr $62
  ror
  lsr $62
  ror
  lsr $62
  ror
  lsr $62
  ror
  clc
  adc DiffDef,y
  sta $61
  lda $62
  adc #$00
  lsr
  ror $61
  lsr
  lda $61
  ror
  sta ObjectAtk,x
RescaleGold:   ; $1bc98
  ;; GOLD = min(15, (8 * DGLD + 3 * DIFF) / 16)
  lda ObjectGold,x
  and #$f0
   beq RescaleExp
  lsr
  sta $61
  lda Difficulty
  asl
  adc Difficulty
  adc $61
  bcc +
   lda #$f0
+ and #$f0
  sta $61
  lda ObjectGold,x
  and #$0f
  ora $61
  sta ObjectGold,x
RescaleExp:   ; $1bcbd
  ;; EXP = min(2032, DiffExp * SEXP)
  ;; NOTE: SEXP is compressed for values > $7f.
  lda ObjectExp,x
   beq RescaleDone
  sta $61
  lda DiffExp,y
  php ; keep track of whether we were compressed or not.
   and #$7f
   sta $62
   jsr Multiply16Bit  
   lda $62
  plp
  bmi ++
    ;; No scaling previously.  $61$62 is 128*EXP.
    ;; If EXP >= 128 then 128*EXP >= #$4000
    cmp #$40
    bcc +
     ;; $62 >= #$40 - need scaling now.
     ;; EXP/16 = ($80*EXP)/$800
     lsr
     lsr
     lsr
     ora #$80
     bne +++ ; uncond
    ;; No rescaling needed, rotate left one.
+   asl $61
    rol
    ;; Now A is EXP, A<128 guaranteed.  Make sure it's not zero.
    bne +++
    lda #$01
    bne +++ ; uncond
   ;; Was previously scaled - just re-add and carry.
++ asl $61
   rol
   bcs +
    adc #$80
    bcc +++
+    lda #$ff
+++ sta ObjectExp,x
RescaleDone:
   jmp $3c2af

Multiply16Bit:
  ;; Multiplies inputs in $61 and $62, then shifts
  ;; right A times.
  ;; Result goes $61$62 (lo hi), preserves XY
  ;; Sets carry if result doesn't fit in 8 bits
  txa
  pha
  lda #$00
  ldx #$08
  clc
-  bcc +
    clc
    adc $62
+  ror
   ror $61
   dex
  bpl -
  sta $62
  cmp #$01 ; set carry if A != 0
  pla
  tax
  rts
.org $1bff0
`, 'scaleDifficultyLib'));

const nerfArmors = buildRomPatch(assemble(`
.bank $3c000 $c000:$4000
.bank $1a000 $a000:$2000
.org $1bb30
DiffDef:   ; PDef' * 4
  .byte $08,$0A,$0C,$0E,$10,$12,$14,$16,$18,$1A,$1C,$1E,$20,$22,$24,$26
  .byte $28,$2A,$2C,$2E,$30,$32,$34,$36,$38,$3A,$3C,$3E,$40,$42,$44,$46
  .byte $48,$4A,$4C,$4E,$50,$52,$54,$56,$58,$5A,$5C,$5E,$60,$62,$64,$66

.bank $34000 $8000:$2000
.org $34bc0
ArmorDefense:
  .byte $00,$01,$03,$05,$07,$09,$0c,$0a,$10
ShieldDefense:
  .byte $00,$01,$03,$04,$06,$09,$08,$0c,$10

;; Max out armor and shield def at 2*level
.org $3c02b
  sta $61
  asl $61
  ldy $0713
  lda ArmorDefense,y
  cmp $61
  bcc +
   lda $61
+ ldy $0716 ; equipped passive item
  cpy #$10  ; iron necklace
  bne +
   asl
+ clc
  adc $0421 ; armor defense
  sta $0401
.org $3c04a
  jsr PatchUpdateShieldDefense
  nop
  nop
.org $3c04f ; NOTE: must be exact!
  ; STA PLAYER_DEF

.org $3ff62
PatchUpdateShieldDefense:
  ldy $0714
  lda ShieldDefense,y
  cmp $61
  bcc +
   lda $61
+ ldy $0716 ; equipped passive item
  cpy #$14  ; shield ring
  bne +
   asl
+ clc
  adc $0421 ; shield defense
  sta $0400
  rts
.org $3ff80

;; We could try to be cleverer about not reloading the equipped item.
;; If we just ASL the whole defense then we can do them simultaneously,
;; and then go into power ring.

`, 'nerfArmors'));


const rescaleMonsters = (data, rom) => {

  // TODO - find anything sharing the same memory and update them as well
  for (const id of SCALED_MONSTERS.keys()) {
    for (const other in rom.objects) {
      if (SCALED_MONSTERS.has(other)) return;
      if (rom.objects[id].objectDataBase == rom.objects[other].objectDataBase) {
        SCALED_MONSTERS[other] = SCALED_MONSTERS[id];
      }
    }
  }

  for (const [id, {sdef, swrd, hits, satk, dgld, sexp}] of SCALED_MONSTERS) {
    // indicate that this object needs scaling
    const o = rom.objects[id].objectData;
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
  rom.objects[0x7d].objectData[0x10] |= 0x08;

  rom.writeObjectData();
};

const shuffleMonsters = (data, rom, random, log) => {
  // TODO: once we have location names, compile a spoiler of shuffled monsters
  const pool = new MonsterPool({});
  for (const loc of rom.locations) {
    if (loc) pool.populate(loc);
  }
  pool.shuffle(random);

  rom.writeNpcData();
};

const identifyKeyItemsForDifficultyBuffs = (rom) => {
  // Tag key items for difficulty buffs
  for (const get of rom.itemGets) {
    const item = ITEMS.get(get.item);
    if (!item || !item.key) continue;
    if (!get.table) throw new Error(`No table for ${item.name}`);
    if (get.table[get.table.length - 1] == 0xff) {
      get.table[get.table.length - 1] = 0xfe;
    } else {
      throw new Error(`Expected FF at end of ItemGet table: ${get.id.toString(16)}: ${Array.from(get.table).map(x => x.toString(16).padStart(2, 0)).join(' ')}`);
    }
    get.write(rom);
  }
  // console.log(report);
};


const SCALED_MONSTERS = new Map([
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
  [0x57, 'b', 'Vampire',                    3,  ,   13,  18,  ,    ,],
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
  [0xa5, 'b', 'Vampire 2',                  2,  ,   6,   27,  ,    ,],
  [0xb4, 'b', 'dyna pod',                   15, ,   255, 26,  ,    ,],
  [0xb8, 'p', 'dyna counter',               ,   ,   ,    26,  ,    ,],
  [0xb9, 'p', 'dyna laser',                 ,   ,   ,    26,  ,    ,],
  [0xba, 'p', 'dyna bubble',                ,   ,   ,    36,  ,    ,],
  [0xbc, 'm', 'vamp2 bat',                  ,   ,   ,    16,  ,    40],
  [0xbf, 'p', 'draygon2 fireball',          ,   ,   ,    26,  ,    ,],
  [0xc1, 'm', 'vamp1 bat',                  ,   ,   ,    16,  ,    40],
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
      [id, {id, type, name, sdef, swrd, hits, satk, dgld, sexp}]));

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


// A pool of monster spawns, built up from the locations in the rom.
// Passes through the locations twice, first to build and then to 
// reassign monsters.
class MonsterPool {
  constructor(report) {
    this.report = report;
    // available monsters
    this.monsters = [];
    // used monsters - as a backup if no available monsters fit
    this.used = [];
    // all locations
    this.locations = [];
  }

  // TODO - monsters w/ projectiles may have a specific bank they need to appear in,
  // since the projectile doesn't know where it came from...?
  //   - for now, just assume if it has a child then it must keep same pattern bank!

  populate(/** !Location */ location) {
    const {maxFlyers, nonFlyers = {}, skip, fixedSlots = {}, ...unexpected} =
          MONSTER_ADJUSTMENTS[location.id] || {};
    for (const u in unexpected) {
      throw new Error(
          `Unexpected property '${u}' in MONSTER_ADJUSTMENTS[${location.id}]`);
    }
    if (skip === true || !location.spritePatterns || !location.spritePalettes) return;
    const monsters = [];
    const slots = [];
    //const constraints = {};
    let treasureChest = false;
    let slot = 0x0c;
    for (const o of location.objects || []) {
      ++slot;
      if (o[2] & 7) continue;
      const id = o[3] + 0x50;
      if (id in UNTOUCHED_MONSTERS || !SCALED_MONSTERS.has(id) ||
          SCALED_MONSTERS.get(id).type != 'm') continue;
      const object = location.rom.objects[id];
      if (!object) continue;
      const patBank = o[2] & 0x80 ? 1 : 0;
      const pat = location.spritePatterns[patBank];
      const pal = object.palettes(true);
      const pal2 = pal.includes(2) ? location.spritePalettes[0] : null;
      const pal3 = pal.includes(3) ? location.spritePalettes[1] : null;
      monsters.push({id, pat, pal2, pal3, patBank});
(this.report[`start-${id.toString(16)}`] = this.report[`start-${id.toString(16)}`] || []).push('$' + location.id.toString(16));
      slots.push(slot);
    }
    if (!monsters.length) return;
    if (!skip) this.locations.push({location, slots});
    this.monsters.push(...monsters);
  }

  shuffle(random) {
this.report['pre-shuffle locations'] = this.locations.map(l=>l.location.id);
this.report['pre-shuffle monsters'] = this.monsters.map(m=>m.id);
    random.shuffle(this.locations);
    random.shuffle(this.monsters);
this.report['post-shuffle locations'] = this.locations.map(l=>l.location.id);
this.report['post-shuffle monsters'] = this.monsters.map(m=>m.id);
    while (this.locations.length) {
      const {location, slots} = this.locations.pop();
      let report = this.report['$' + location.id.toString(16).padStart(2, 0)] = [];
      const {maxFlyers, nonFlyers = {}, fixedSlots = {}} =
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
      for (const o of location.objects || []) {
        if ((o[2] & 7) == 2) treasureChest = true;
        if (o[2] & 7) continue;
        const id = o[3] + 0x50;
        if (id == 0x7e || id == 0x7f || id == 0x9f) {
          pat1 = 0x62;
        } else if (id == 0x8f) {
          pat0 = 0x61;
        }
      }
      // Cordel East and Kirisa Meadow have chests but don't need to actually draw them
      // (though we may need to make sure it doesn't end up with some nonsense tile that
      // ends up above the background).
      if (location.id == 0x15 || location.id == 0x47) treasureChest = false;

      report.push(`Initial pass: ${[treasureChest, pat0, pat1, pal2, pal3].join(', ')}`);

      const tryAddMonster = (m) => {
        const flyer = FLYERS.has(m.id);
        const moth = MOTHS_AND_BATS.has(m.id);
        if (flyer) {
          // TODO - add a small probability of adding it anyway, maybe
          // based on the map area?  25 seems a good threshold.
          if (!flyers) return false;
          --flyers;
        }
        if (pal2 != null && m.pal2 != null && pal2 != m.pal2 ||
            pal3 != null && m.pal3 != null && pal3 != m.pal3) {
          return false;
        }
        // whether we can put this one in pat0
        const pat0ok = !treasureChest || TREASURE_CHEST_BANKS.has(m.pat);
        let patSlot;
        if (location.rom.objects[m.id].child || RETAIN_SLOTS.has(m.id)) {
          // if there's a child, make sure to keep it in the same pattern slot
          patSlot = m.patSlot ? 0x80 : 0;
          const prev = patSlot ? pat1 : pat0;
          if (prev != null && prev != m.pat) return false;
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
          if (pat0 == null && pat0ok || pat0 == m.pat) {
            pat0 = m.pat;
            patSlot = 0;
report.push(`  Adding ${m.id.toString(16)}: pat0 <-  ${m.pat.toString(16)}`);
          } else if (pat1 == null || pat1 == m.pat) {
            pat1 = m.pat;
            patSlot = 0x80;
report.push(`  Adding ${m.id.toString(16)}: pat1 <-  ${m.pat.toString(16)}`);
          } else {              
            return false;
          }
        }
        if (m.pal2 != null) pal2 = m.pal2;
        if (m.pal3 != null) pal3 = m.pal3;
report.push(`    ${Object.keys(m).map(k=>`${k}: ${m[k]}`).join(', ')}`);
report.push(`    pal: ${(m.pal2||0).toString(16)} ${(m.pal3||0).toString(16)}`);

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
(this.report[`mon-${m.id.toString(16)}`] = this.report[`mon-${m.id.toString(16)}`] || []).push('$' + location.id.toString(16));
        const slot = slots[eligible];
        const objData = location.objects[slot - 0x0d];
        if (slot in nonFlyers) {
          objData[0] += nonFlyers[slot][0];
          objData[1] += nonFlyers[slot][1];
        }
        objData[2] = objData[2] & 0x7f | patSlot;
        objData[3] = m.id - 0x50;
report.push(`    slot ${slot.toString(16)}: objData=${objData}`);

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
          const objData = location.objects[slot - 0x0d];
          objData[0] = objData[1] = 0;
        }
      }
    }
  }
}

const FLYERS = new Set([0x59, 0x5c, 0x6e, 0x6f, 0x81, 0x8a, 0xa3, 0xc4]);
const MOTHS_AND_BATS = new Set([0x55, /* swamp plant */ 0x5d, 0x7c, 0xbc, 0xc1]);
const SWIMMERS = new Set([0x75, 0x76]);
const STATIONARY = new Set([0x77, 0x87]);  // kraken, sorceror

// constrains pat0 if map has a treasure chest on it
const TREASURE_CHEST_BANKS = new Set([
  0x5e, 0x5f, 0x60, 0x61, 0x64, 0x65, 0x66, 0x67,
  0x68, 0x69, 0x6a, 0x6c, 0x6d, 0x6e, 0x6f, 0x70,
  0x74, 0x75, 0x76, 0x77,
]);

const MONSTER_ADJUSTMENTS = {
  [0x03]: { // Valley of Wind
    maxFlyers: 2,
    fixedSlots: {
      pat1: 0x60, // required by windmill
    },
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
    //skip: 'add',
    maxFlyers: 2,
    fixedSlots: {
      pat1: 0x4f,
      pal3: 0x23,
    },
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
    maxFlyers: 1,
    fixedSlots: {
      pat1: 0x50,
      //pal2: 0x06, // might be fine to change tornel's color...
    },
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
    skip: true, // not sure how to randomize these well
    maxFlyers: 2,
    fixedSlots: {
      pat1: 0x52, // (as opposed to pat0)
      pal3: 0x08,
    },
  },
  [0x64]: { // Underground Channel
    skip: true,
    fixedSlots: {
      pat1: 0x52, // (as opposed to pat0)
      pal3: 0x08,
    },
  },
  [0x68]: { // Evil Spirit Island 1
    skip: true,
    fixedSlots: {
      pat1: 0x52, // (as opposed to pat0)
      pal3: 0x08,
    },
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

const ITEMS = new Map([
  // id  name                  key
  [0x00, 'Sword of Wind',      true],
  [0x01, 'Sword of Fire',      true],
  [0x02, 'Sword of Water',     true],
  [0x03, 'Sword of Thunder',   true],
  [0x04, 'Crystalis',          true],
  [0x05, 'Ball of Wind',       true],
  [0x06, 'Tornado Bracelet',   true],
  [0x07, 'Ball of Fire',       true],
  [0x08, 'Flame Bracelet',     true],
  [0x09, 'Ball of Water',      true],
  [0x0a, 'Blizzard Bracelet',  true],
  [0x0b, 'Ball of Thunder',    true],
  [0x0c, 'Storm Bracelet',     true],
  [0x0d, 'Carapace Shield',    ],
  [0x0e, 'Bronze Shield',      ],
  [0x0f, 'Platinum Shield',    ],
  [0x10, 'Mirrored Shield',    ],
  [0x11, 'Ceramic Shield',     ],
  [0x12, 'Sacred Shield',      ],
  [0x13, 'Battle Shield',      ],
  // id  name                  key
  [0x14, 'Psycho Shield',      true],
  [0x15, 'Tanned Hide',        ],
  [0x16, 'Leather Armor',      ],
  [0x17, 'Bronze Armor',       ],
  [0x18, 'Platinum Armor',     ],
  [0x19, 'Soldier Suit',       ],
  [0x1a, 'Ceramic Suit',       ],
  [0x1b, 'Battle Armor',       true],
  [0x1c, 'Psycho Armor',       true],
  [0x1d, 'Medical Herb',       ],
  [0x1e, 'Antidote',           ],
  [0x1f, 'Lysis Plant',        ],
  [0x20, 'Fruit of Lime',      ],
  [0x21, 'Fruit of Power',     ],
  [0x22, 'Magic Ring',         ],
  [0x23, 'Fruit of Repun',     ],
  [0x24, 'Warp Boots',         ],
  [0x25, 'Statue of Onyx',     true],
  [0x26, 'Opel Statue',        true],
  [0x27, 'Insect Flute',       true],
  // id  name                  key
  [0x28, 'Flute of Lime',      true],
  [0x29, 'Gas Mask',           true],
  [0x2a, 'Power Ring',         true],
  [0x2b, 'Warrior Ring',       true],
  [0x2c, 'Iron Necklace',      true],
  [0x2d, 'Deo\'s Pendant',     true],
  [0x2e, 'Rabbit Boots',       true],
  [0x2f, 'Leather Boots',      true],
  [0x30, 'Shield Ring',        true],
  [0x31, 'Alarm Flute',        ],
  [0x32, 'Windmill Key',       true],
  [0x33, 'Key to Prison',      true],
  [0x34, 'Key to Styx',        true],
  [0x35, 'Fog Lamp',           true],
  [0x36, 'Shell Flute',        true],
  [0x37, 'Eye Glasses',        true],
  [0x38, 'Broken Statue',      true],
  [0x39, 'Glowing Lamp',       true],
  [0x3a, 'Statue of Gold',     true],
  [0x3b, 'Love Pendant',       true],
  // id  name                  key
  [0x3c, 'Kirisa Plant',       true],
  [0x3d, 'Ivory Statue',       true],
  [0x3e, 'Bow of Moon',        true],
  [0x3f, 'Bow of Sun',         true],
  [0x40, 'Bow of Truth',       true],
  [0x41, 'Refresh',            true],
  [0x42, 'Paralysis',          true],
  [0x43, 'Telepathy',          true],
  [0x44, 'Teleport',           true],
  [0x45, 'Recover',            true],
  [0x46, 'Barrier',            true],
  [0x47, 'Change',             true],
  [0x48, 'Flight',             true],
].map(([id, name, key]) => [id, {id, name, key}]));


const RETAIN_SLOTS = new Set([0x50, 0x53]);

const UNTOUCHED_MONSTERS = { // not yet +0x50 in these keys
  [0x7e]: true, // vertical platform
  [0x7f]: true, // horizontal platform
  [0x83]: true, // glitch in $7c (hydra)
  [0x8d]: true, // glitch in location $ab (sabera 2)
  [0x8e]: true, // broken?, but sits on top of iron wall
  [0x8f]: true, // shooting statue
  [0x9f]: true, // vertical platform
  [0xa6]: true, // glitch in location $af (mado 2)
};
