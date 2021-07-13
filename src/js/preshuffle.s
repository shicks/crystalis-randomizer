;;; Various flag-based defines will be prepended to this file, indicated
;;; by a `_` prefix.

.segment "0e", "0f"

;;; Patch the end of ItemUse to check for a few more items.
.org $834d
  jmp PatchTradeInItem

;; TODO - extra item indirection preamble...
;; handle different checks

.org $8157
  .word (PowersOfTwo) ; no need for multiple copies

;;; Fix the overly-long loop to find broken statue
;; .org $1c585
;;   ldx #$08
;; - lda $6450,x
;;   cmp #$38    ; broken statue
;;   beq +
;;   dex
;;   bpl -
;;   jmp $84db
;;; Allow giving arbitrary items for broken statue trade-in
.org $8594
  lda #$ff
;  sta $6450,x
  ;rts
;;   ;; 9 free bytes, could be more if we remove the unused Flute of Lime checks
;; .assert * <= $1c59e

;.org $1c596
;  jsr $d22b ; grant item in register A
;  jsr FixStatue
 ; jmp FixStatue


;; Count uses of Flute of Lime and Alarm Flute - discard after two.
.segment "0e", "0f", "fe", "ff"
.reloc
PatchTradeInItem:
    cmp #$28  ; flute of lime
    beq @FluteOfLime
    cmp #$31  ; alarm flute
    bne @DoTradeIn
    lda #$40
    SKIP_TWO_BYTES ; skip the next instruction (safe b/c $80a9 is prg rom)
@FluteOfLime:
    lda #$80
    sta $61
    lda $648e ; check flag 076 (alarm flute) or 077 (flute of lime)
    and $61
    bne @DoTradeIn
    lda $648e
    ora $61
    sta $648e
    ;; Deselect current item
    lda #$00
    sta $0715
    lda #$80
    sta $642e
    rts
@DoTradeIn:
    jmp ItemUse_TradeIn

.segment "0f", "fe", "ff"


;; Prevent soft-lock when encountering sabera and mado from reverse
;; Returns N if player is not on same screen as boss and is at row 9,
;; which causes the caller to return.  We skip the vanilla "on-screen"
;; check in favor of our own version that is not skippable.
.reloc
CheckBelowBoss:
    ; skip the check for sabera 1 and mado 1
    lda $04a0,x
    and #$fe
    cmp #$e6  ; sabera and mado
    bne +
     lda #$dc
     cmp $04c0,x  ; first version has #$cf, second has #$dc
     bne +++
+   lda $d0
    cmp $d0,x
     bne ++
    lda $90
    cmp $90,x
     bne ++
    lda $b0
    and #$f0
    cmp #$90
     bne ++
    lda #$00
    rts
++  lda #$ff
+++ rts

.ifdef _NERF_MADO
;;; Mado's cannonball time is a function of his HP: framecount = HP + #$20.
;;; This causes problems when HP >= #$e0, since it overflows.  We can make
;;; sure he bounces for less time by dividing by two instead of clearing
;;; carry.  We also change the shift to #$18, making the range 24..152
;;; rather than 0..255.
.org $ae53
  lsr
  adc #$18
.endif

.org $a48b  ; vampire pattern 0
  jsr CheckBelowBoss
.org $a971  ; kelbesque pattern 0
  jsr CheckBelowBoss
.org $ac8f  ; sabera pattern 0
  jsr CheckBelowBoss
.org $ade8  ; mado pattern 0
  jsr CheckBelowBoss

;; If LookingAt is $1f and the item goes into the $20 row then we can't
;; just reject - instead, add the item to an overflow chest.
;; We use the bytes at 64b8..64bf to store the overflow.

;;; ITEM GET PATCHES
.segment "0e", "fe", "ff"

;; Treasure chest spawns don't need to be so complicated.
;; Instead, just use the new dedicated ItemGet flags 200..27f
.org $85c3
  ;; Read the flag 100|chest, where chest is in $23
  lda $23
  and #$07
  tay
  lda $c000,y ; powers of two
  pha
   lda $23
   lsr
   lsr
   lsr
   tay
  pla
  and SlotFlagsStart,y
  bne +
   inc $20
+ rts
FREE_UNTIL $85de  ; ~24 bytes


;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;; TODO - finish itemget patches
;;;  1. add a new table for indirection
;;;  2. new table can include mimic, so divert spawn
;;;  3. write both 1xx and 2yy flags.
;;;  4. store both ids until after item gotten
;;;     - may need to use something like 61fe ?
;;;  5. ???
;;; Also update the slots.
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;


;; Replace ItemGet with an extra indirection
.org $826f
  jsr PatchStartItemGet

.org $8285
  nop ; don't update $29, it was already written in PatchStartItemGet...
  nop

;; Patches to ItemGet to update the dedicated flag and
;; leave room for calling the difficulty methods
.org $8287
  jsr ItemGet_PickSlotAndAdd

.org $8297
  jmp ItemGetFollowup
FREE_UNTIL $829e  ; ~4 bytes

.org $829e
ItemGet_PickSlotAndAdd:  ; move this up a few bytes
  sty $62
.assert * = $82a0

.org $82a8
  jsr ItemGet_FindOpenSlotWithOverflow

.ifdef _PROGRESSIVE_BRACELET
;;; NOTE: this code replaces the WeaponBallOrBracelet_NotCrystalis branch
;;; of ItemGet, along with the Bracelet-only branch down to 1c308
.org $82de
   lda $29
   bcc +          ; just compared #$o4, swords are good to go
    inc $6430,x   ; try incrementing the power slot
    bne ++        ; if it was empty (ff) then now we're zero
    lsr           ; clear carry if $29 was even (a bracelet)
    lda $29
    sbc #$00      ; subtract one if carry clear, to make it a ball
    sta $23       ; store the *actual* item back in $23, which is used later
+  sta $6430,x    ; store the item in its spot
++ lda $6430,x    ; read the item back again (in case we jumped here)
   sta $07dc      ; store the actual item in the dialog spot to get right message
   rts ; jmp PostInventoryMenu (note: would be nice to get items right)
FREE_UNTIL $8308
.endif

;;; Exported by rom/slots.ts
.import CheckToItemGetMap

;;; NOTE: The start of this table is in the middle of some freed section
;;; [$9c82, $9daf); we only preserve the second half of the table, starting
;;; at $9daf (y=$49).
OriginalItemGetTable = $9d66

.reloc
PatchStartItemGet:
  lda $23
  sta $61fe
  tax
  lda CheckToItemGetMap,x
  tay
  cmp #$70
  bcc +
   ;; spawn mimic instead - need to back out of 3 layers of calls
   ;; TODO - keep track of which mimic so we can set the flag?
   pla
   pla
   pla
   pla
   pla
   pla
   jmp SpawnMimic
+ cmp #$49
  bcc +
   lda OriginalItemGetTable,y  ; NOTE: y>=$49, so this is really [$9daf...)
+ sta $29
  sta $07dc   ; TODO - can we ditch the table at 3d45c now?
  rts         ;      - what about other writes to 07dc?

;; TODO - why is this here?

.org $d3f6              ; Within game mode jump 07 (trigger / chest)
  ;; This is only a minor optimization to skip the 4 nops we add below
  bcc +
.org $d3fb              ; HandleTreasureChest
  ;; This normally checks for a mimic spawn, but we check that elsewhere
  ;; so just replace it with nops.
  nop ; just in case there's another entry into here
  nop
  nop
  nop
+:

;; Fix dialog to work with us... (patch in the middle here)
ShowTreasureChestMessage = $d41c
.org $d404
  ;lda $62 ; the actual item gained (or tried to gain)
  ;sta $07dc   ; note: already written in PatchStartItemGet
  lda $23
  bmi HandleTreasureChest_TooManyItems ; patched version of this message tells what was in chest
  bpl ShowTreasureChestMessage
  ;; skip these bytes
FREE_UNTIL $d41c

.org $d47c ; HandleTreasureChest_TooManyItems
HandleTreasureChest_TooManyItems:
  ;; Rather than using the global timer to determine whether
  ;; to show the "too many items" message, use the gamepad:
  ;; only show if pressing a direction ($49 != #$ff)
  lda $49
  bpl +
   rts
   nop
+:
.assert * = $d482


;;; Redisplay scaling level when it changes
.segment "0e", "0f", "fe", "ff"
.reloc
ItemGetRedisplayDifficulty:
.ifndef _DISPLAY_DIFFICULTY ; TODO - just remove the path?
  rts
.endif
  lda #$01
  sta ShouldRedisplayDifficulty
  rts

;;; Exported by rom/item.ts
.import KeyItemData
.reloc
ItemGetFollowup:
  ;; The vanilla code checks whether the last byte at ($24),y is negative
  ;; and if not, then it stores the positive value in $23 as some sort of
  ;; "chained" ItemGet and repeats the whole ItemGet routine from the
  ;; start.  But no items actually use this, so we don't bother copying
  ;; it here.  If we needed to, it's easy enough to `lda ($24),y;pha` and
  ;; then instead of a simple `rts` we `pla;bmi >rts;sta $23;jmp ItemGet`.

  ;; Check if this is a key item, and maybe increase difficulty.
  lda $29
  lsr
  lsr
  lsr
  tay
  lda $29
  and #$07
  tax
  lda KeyItemData,y
  and PowersOfTwo,x
  beq +
   inc Difficulty
   jsr ItemGetRedisplayDifficulty
   ;; Always set the dedicated 200+chest flag.
+:
  ;; lda #$42
  ;; sta $61
  ;; ;; $62 is already the item number, saved from earlier
  ;; lda #$61
  ;; sta $24
  ;; lda #$00
  ;; sta $25
  ;; tay
  ;; jmp SetOrClearFlagsFromBytePair_24y
  ldy #$02
  lda $62
  jsr SetFlagYA
  ldy #$01
  lda $61fe
  jmp SetFlagYA

.reloc
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


.segment "0f", "fe", "ff"  ;; NOTE: 0e is not valid below here.

.ifdef _FIX_VAMPIRE
;;; Fix vampire to allow >60 HP.  Normally at 61 HP there's an overflow
;;; and the teleport animation gets really fast until HP drops below 61.
.org $a576
  jsr ComputeVampireAnimationStart
  nop
.assert * = $a57a ; match up exactly to next instruction

.reloc
ComputeVampireAnimationStart:
   bcs +
   asl
   bcs +
   adc #$10
   bcc ++
+  lda #$ff
++ rts

.endif

;;; Ensure Draygon 2 spawns directly if bow of truth was used earlier.
.org $b1a1
  jsr SpawnDraygon

;;; Once we use the Bow of Truth, it's gone, so we need to make sure
;;; any future encounters with Draygon 2 automatically go to the
;;; final form.  Since triggers and itemuse actions share the same
;;; address space, we add a fake trigger $a0 that has the same reveal
;;; action as using the Bow of Truth.  But rather than placing it on
;;; the screen (and incurring lag by stepping on it) we instead
;;; simulate it during the "start fight" object action by setting
;;; 0623 and 057f as if we were standing in front of it.  To get this
;;; right we actually need to move the UsedBowOfTruth trigger to a
;;; fixed position (02f) that we can check easily.
.reloc
SpawnDraygon:
  inc $0600,x ; original action
  lda $06c3
  beq +       ; make sure we're looking at draygon 2, not 1
  lda $6485
  bpl +       ; check flag 02f
  lda #$1f
  sta $0623
  lda #$a0
  sta $057f
  lda #$07 ; trigger tile
  sta $41
+ rts

;;; Boss chest action jump has some special handling for bosskill 3 (rage)
;;; which is instead used for Kensu dropping a chest.  We'll rearrange the
;;; special case to consolidate.
;; .org $1f766
;;   lda #$8d
;;   sta $03a0,x
;;   lda #$aa
;;   sta $0300,x
;;   lda $0600,x
;;   asl
;;   asl
;;   ;clc
;;   adc $0600,x
;;   tay
;;   cpy #$0f
.org $b76b
  beq @HandleKensuChestInit
.org $b77b
  clc
  nop
@HandleKensuChestInit: ; if we jumped here then C is set
  jsr HandleKensuChest

.org $b7d0
  .byte $00  

;;; We moved the LV(menu) display from 06 to 0e so display that instead
.org $bd27
  lda #$0e

.pushseg "0f"    ; NOTE: 0e does not work here.
.reloc
HandleKensuChest:
  lda #$8d
  sta $03a0,x
  bcc +
   lda #$09
   sta $033e
+ rts
.popseg

.segment "10", "fe", "ff"  ; TODO - is 11 valid here, too?

;; Replace "drop item" code for key items to use an overflow buffer

.org $8372
  jsr CheckDroppable

.org $8434
  jsr MaybeDrop
  nop
  nop

InvItemData = $8ff0


;; MUST BE EXACTLY 4 BYTES
.org $8534
  nop
  jsr FillQuestItemsFromBuffer
.assert * = $8538

;; NOTE: This prevents swords and orbs from sorting to avoid out-of-order
;; swords from clobbering one another.  We swap the second and fourth
;; items from the table of row starts so that when we start at two instead
;; of zero, we end up skipping exactly the first and fourth rows.
;; We change the sort order more generally so that we can prevent sorting
;; the key item row as well if unidentified items is set.
.org $859e
  .byte $04,$04,$08,$08,$08,$08,$04,$04
  .byte $00,$0c,$20,$10,$18,$28,$04,$08


.reloc
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

.reloc
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

.reloc
FillQuestItemsFromBuffer:
  ;; First fill in any gaps in the quest item row
  ;; Note: we're very short space, but we need to increment x and y.
  ;; Start them at -9 (due to preincr) and -8 so that they end at zero.
  ldx #$f8
  ldy #$f7
-  iny
   beq +
   lda $6358,y ; NOTE: $6450..$6457
    bmi - ; nothing in y so loop
   sta $6358,x
   inx
   beq ++
  bne - ; uncond
+ lda #$ff
-  sta $6358,x
   inx
  bne -
  ;; Now check the overflow buffer...

  ;; If there's anything in the buffer and any space in the inventory,
  ;; fill them in.  Just take the most recently added ones, not worrying
  ;; about cycling the queue (that's only needed for dropping).
++:
  ldy #$08     ; predecrement, so start at $64c0 even tho last item at $64bf
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
+ lda #SORT_START_ROW
  sta $2e
  rts

;;; Support for fixing sword charge glitch
.reloc
ReloadInventoryAfterLoad:
  jsr PostInventoryMenu
  jmp AfterLoadGame



.ifdef _DISABLE_SHOP_GLITCH
;;; Disable the shop glitch by ensuring prices are updated immediately
;;; after moving the cursor, rather than a few frames later.
.org $9812
    jmp Shop_NothingPressed
.endif







.ifdef _DISABLE_SWORD_CHARGE_GLITCH
.org $9bce
  jmp ReloadInventoryAfterLoad
.org $9bde
  jmp ReloadInventoryAfterLoad
.endif


;;; Rewrite the page boundary to avoid code crossing it.
.segment "12"
.org $9fef
  ;; Need to fit this in 17 bytes
  sta $09     ; 85 09
  ldy #$03    ; a0 04
- sta $06f0,y ; 99 f0 06
  sta $0002,y ; 99 02 00
  dey         ; 88
  bpl -       ; 10 f7
  jmp $a005   ; 4c 05 a0
FREE_UNTIL $a000


.segment "13"
.org $a000
FREE_UNTIL $a005


.segment "13", "fe", "ff"   ; TODO - check 12

.ifdef _FIX_OPEL_STATUE
;; Search inventory for a statue
.reloc
CheckOpelStatue:
.ifndef _NEVER_DIE
  lda $6440,x
  cmp #$26
  beq +
   dex
   bpl CheckOpelStatue
    jmp PlayerDeath
+ stx SelectedConsumableIndex
  lda #$0a
  sta EquippedConsumableItem
  jmp ActivateOpelStatue
.else
  ;; Special code path for "never die" mode
  ;; (just automatically activate opels)
  jsr ActivateOpelStatue
  lda #$08
  sta $41
  rts
.endif

;;; Fix opel statue bug that undid change/dolphin rather than status
.org $b903
  and #$f0

.org $b912
  ldx #$07
  jmp CheckOpelStatue
FREE_UNTIL $b91c
.endif


.ifdef _DISPLAY_DIFFICULTY
;;; Start the loop at 6 instead of 5 to also show the difficulty
.org $baca
  ldx #$06
.endif


;;; Fix the graphics glitch from getting a sword while changed.
.org $bc04
  jsr MaybeRevertChangeOnSwordGet


.reloc
MaybeRevertChangeOnSwordGet:
  lda $0710
  and #$80
  beq +
   jsr $bb9d ; 27b9d MainGameModeJump_19_ChangeMagicRevertAnimation
+ jmp $c867  ; 3c867 ??


;.segment "14" ; TODO - do these _actually_ go together?
.segment "17", "fe", "ff"
;.bank $28000 $8000:$2000
;.bank $2e000 $a000:$2000

;;; Prevent softlock from saving or checkpointing with zero health or MP.
;;; This handles cases such as (1) swamp runs when the last HP was lost
;;; exactly upon entering Oak, (2) reverse goa runs where flight is needed
;;; to exit, but the last MP was used and no wise men are available to
;;; restore, (3) the first sword requires flying to Swan and then passing
;;; through the gate.  This patch guarantees starting with 5 HP and 1 MP,
;;; unless the player is swordless, in which case 20 MP are given (since
;;; it may be impossible to stay at an inn or buy magic-restoring items).
;;; This is entered by a patched call at $2fd82.
.ifdef _PITY_HP_AND_MP
.org $bd82 ; normally "sta $03c1"
  jsr CheckForLowHpMp

.reloc
CheckForLowHpMp:
    cmp #PITY_HP_AMOUNT
    bcs +
     lda #PITY_HP_AMOUNT
+   sta PlayerHP
    ;; Check if we've ever found any swords
    lda ItemFlagsStart
    and #$0f
    ;; If this is zero then we have no swords and should give 34 MP.
    ;; Note that we can ignore the swordless check via a flag.
    beq +
     lda #$01
    .byte $2c             ; skip next instruction
+    lda #PITY_MP_AMOUNT
    ;; Now compare with MP - if it's less, set the minimum.
    cmp PlayerMP
    bcc +
     sta PlayerMP
+   rts
.endif ; _PITY_HP_AND_MP

;;; This glitch works because the game sets three separate checkpoints
;;; when using warp boots: one from $3e538 (ExitTypeJump_2_Warp) after
;;; setting the location/exit but before setting coordinates, another
;;; from $3e503 (ExitTypeJump_0_Normal) after setting the coordinates
;;; but before consuming the item, and then the third time from $3d4ef
;;; (the warp boots follow-up of MainGameModeJump_06).  The third one
;;; is unique to Warp Boots (Teleport only does the first two), and is
;;; also the only one that does not run with GameMode == #$06.  The fix
;;; is simple: don't set the checkpoint in GameMode_06.

.org $bbd5
;;; Space freed from unused "revert change magic" routine.  We specify
;;; this directly so that we can use a branch to MaybeSetCheckpointActual
;;; and thus save 3 bytes.
FixWarpBootsReuseGlitch:
  lda $41  ; GameMode
  cmp #$06 ; item use
  bne MaybeSetCheckpointActual
  rts
FREE_UNTIL $bc00

.ifdef _DISABLE_WARP_BOOTS_REUSE
.org $bc00
MaybeSetCheckpoint:
  ;; Normally this just jumps to MaybeSetCheckpointActual, which is kind
  ;; of pointless, but it provides a convenient point of indirection for
  ;; us to use here.
  jmp FixWarpBootsReuseGlitch
.endif

.org $bc09
MaybeSetCheckpointActual:


.segment "12", "13", "fe", "ff"
;.bank $24000 $8000:$4000

;; Overwrite the StatusBarDataTable with the new UI tile layout
.org $badb
  .byte $80,$20,$20,$20 ; Lf _ _ _
.org $baee
  .byte $83,$00,$00,$20 ; Lv 0 0 _
  .byte $9c             ;  $

.org $bafb
  ;; on this row we shifted most everything left by three tiles
  ;; It should be possible to use .move to shift everything over,
  ;; but it didn't really work when tested
  .byte $81,$8f,$8f,$8f ; Pw > > >
  .byte $8f,$8f,$8f,$8f ;  > > > >
  .byte $93,$95,$94     ; (1) lit up
  .byte $90,$91,$92     ; (_) not lit up
  .byte $90,$91,$92     ; (_) not lit up
  .byte $20,$20         ;  _ _
  .byte $84,$20,$20,$20 ; Dl _ _ _
  .byte $86,$20,$20,$20 ; Ex _ _ _
  .byte $20,$20,$1f     ;  _ _ |

.org $bb1b
  .byte $20             ;  _
.org $bb1f ; clear out the experience count thats there initially
.repeat 16
  .byte $20 ;  _
.endrep
  .byte $85,$20,$20,$20 ; Mp _ _ _
  .byte $9d,$20,$20,$20 ;  / _ _ _



.segment "1a", "1b", "fe", "ff"
;.bank $34000 $8000:$4000


;; Move the position of the main UI number elements
.org $8ec7 ; Lv
  .byte $36,$2b
.org $8ecd ; Money
  .byte $3a,$2b
.org $8ed3 ; Experience
  .byte $5a,$2b

;;; Numeric displays
.org $8ed7  ; 03 - was Exp Left, now its Max MP
  .word (PlayerMaxMP)
  .byte $7b,$2b,$02,$00 ; copied from $34ee3
.org $8ee3  ; 05 - was Max MP, now its unused
.org $8ee9  ; 06 - was LV(menu) but now it's difficulty
  .word (Difficulty)
  .byte $56,$2b,$03,$00 ; display left of exp
.org $8f19  ; 0e - was unused, now it's LV(menu)
  .word (PlayerLevel)
  .byte $29,$29,$03,$00 ; copied from $34ee9

.pushseg "13", "fe", "ff"
;InitializeStatusBarNametable
.org $baca
  lda #%01011111 ; update all 5 status display (including difficulty)
  jsr UpdateStatusBarDisplays
  jmp $c676 ; WaitForNametableFlush
FREE_UNTIL $bad9
.popseg

.pushseg "1a", "fe", "ff"
;;; Calls DisplayNumberInternal for each of the bits in A as follows:
;; [in] A - bit mask for the different displays to update
;; [scratch] X - could push X if needed later
;; The following values are used in the randomizer for this
;; 0 - Level
;; 1 - Money
;; 2 - Exp
;; 3 - Max MP
;; 4 - MP
;; 5 - (currently unused)
;; 6 - Difficulty
.reloc
UpdateStatusBarDisplays:
  ldx #$07
-   rol
    bcc +
      pha
        txa
        jsr DisplayNumberInternal
      pla
+   dex
  bpl -
  rts
.popseg

;;; HP / Force bar display
;; Overwrites the tile position used by the nametable update buffer to move the tiles
.org $8d1f
  lda #$23 ; Subtracted 3 from the original value to move the player HP bar to the left
.org $8db2
  lda #$43 ; Subtracted 3 from the original to move the force bar to the left

;;; ----------------------------------------------------
;;; KillObject
;;; Recalculate PlayerEXP to count down from max instead of up


.org $9152
  ; Instead of calling AwardExperience immediately, just store the obj offset
  ; and push it onto the stack for use later. The code needs to check for an
  ; object replacement and we don't wanna clobber that
  jsr StoreObjectExp
.assert * <= $9155

.reloc
StoreObjectExp:
  lda ObjectExp,y
  sta $61
  rts

;; Update the level up check
.org $916a
  lda PlayerLevel
  and #$f0
  beq +
    jmp ExitWithoutDrawingEXP
+ jsr AwardExperiencePoints
  ; carry clear means we leveled up
  bcc LevelUp
  ; but it doesn't check if we were exactly at zero EXP so check for that now
  lda PlayerExp
  ora PlayerExp+1
  cmp #$00
  beq LevelUp
  jmp UpdateCurrentEXPAndExit
LevelUp:
  ; double check here that we aren't already max level
  inc PlayerLevel
  lda PlayerLevel
  asl  ; note: clears carry
  tay
  lda PlayerExp
  adc $8b9e,y      ; NextLevelExpByLevel
  sta PlayerExp
  lda PlayerExp+1
  adc $8b9f,y
  sta PlayerExp+1
  jsr UpdatePlayerMaxHPAndMPAfterLevelUp
  jsr UpdateDisplayAfterLevelUp
  jmp UpdateCurrentEXPAndExit
.assert * <= $91ef
FREE_UNTIL $91ef

.org $91ef
UpdateCurrentEXPAndExit:

.org $91f4
ExitWithoutDrawingEXP:

.org $8cc0
UpdateHPDisplayInternal:

.reloc
UpdatePlayerMaxHPAndMPAfterLevelUp:
  ldy PlayerLevel
  lda $8b7f,y
  sta PlayerMaxHP
  lda $8b8f,y
  sta PlayerMaxMP
  ;; Add the delta of the max HP/MP to the current
  sec
  lda $8b7f,y
  sbc $8b7e,y
  clc
  adc PlayerHP
  sta PlayerHP
  sec
  lda $8b8f,y
  sbc $8b8e,y
  clc
  adc PlayerMP
  sta PlayerMP
  rts

.reloc
UpdateDisplayAfterLevelUp:
  jsr UpdateHPDisplayInternal
  lda #%00011001 ; update displays 0, 3, 4
  jsr UpdateStatusBarDisplays
  lda #GAME_MODE_STATUS_MSG
  sta GameMode
  ; Update player metasprite information? This was copied from the
  ; actual game code
  lda #$0d
  sta $06c3
  lda #$20
  sta $06e3
  jmp UpdateEquipmentAndStatus


;;; ----------------------------------------------------
;;; AwardExperiencePoints
;; This is changed so that Player EXP counts down instead of up to max EXP
;; skip exp calculation if max level
.org $924b
AwardExperiencePoints:
  ;; instead of loading from ObjExp, we store the Exp value in $61
  lda $61
  nop

.org $9250
  ;; If the EXP < $80, then we set 0 for the monster exp lobyte
  ldy #$00
  sty $11      ; $11 is used to store the upper bits of monster exp temporarily
  jmp Do16BitSubtractionForEXP
.assert * <= $925d

.org $9261
  ;; instead of loading from ObjExp, we store the Exp value in $61
  lda $61
  nop

.org $926e
  ;; If the EXP >= $80, the code before this will load the hibyte into $11
  jmp Do16BitSubtractionForEXP


.reloc
Do16BitSubtractionForEXP:
  ; A = monsterEXPLo; y = scratch
  ldy PlayerExp
  sta PlayerExp
  tya
  ; A = playerExp; PlayerExp = monsterEXP
  sec
  sbc PlayerExp
  sta PlayerExp
  lda PlayerExp+1
  sbc $11
  sta PlayerExp+1
  rts


;;; ----------------------------------------------------
;; Inital EXP changes
;; Change the "initial" value loaded into the Continue save
;; file is you select continue from a cold boot. InitialPrg_6400
.pushseg "17", "fe", "ff"
.org $be82
  .byte $1e
.org $be84
  .byte $00
.popseg


;;; Crystalis should have all elements, rather than none
;;; Since we now invert the handling for enemy immunity,
;;; this aligns enemies and walls nicely, Crystalis will
;;; also be able to break all walls now, too (if we get
;;; it working outside the tower, that is).
.org $9c6b
  .byte $0f

;;; Invert how walls work: their elemental defense byte stores
;;; a single bit, and the sword must have that bit as well: this
;;; makes Crystalis able to break all walls.
.org $9097
  eor #$0f
  and ObjectElementalDefense,x
  .byte $f0  ; change 'bne' to 'beq'.

;;; ADJUSTED DAMAGE CALCULATIONS (in the middle of sword-enemy collision jump)
;;; This does several things: (1) tinks do 1 damage, (2) handles the extra HP
;;; bit that we store in the defense byte.
;;; $61 is extra HP bit(s)
;;; $62 is DEF
;;; $63 is damage
.org $90fa
    ;; Initialize
    lda #$00
    sta $61
    ;; Subtract enemy defense from player attack
    lda ObjectDef,y
    lsr     ; Just pull one extra bit for HP, could do one more if needed
    rol $61 ; Roll HP bit into $61, to be used later
    sta $62 ; Store actual shifted DEF in $62
    lda PlayerAtk
    adc ObjectAtk,x
    sbc $62 ; A <- atk - def - 1 (carry is always clear)
    bcs +
     lda #$00 ; If we overflowed, just set it to zero
+   sta $63 ; Damage we're actually going to do
    inc $63 ; Always add one since we added one to defense
    ;; Check elemental immunity
    lda ObjectElementalDefense,y
    eor #$ff ; invert monster defense so that 0=immune
    and ObjectElementalDefense,x
    and #$0f
    bne +
     sta $63
    ;; Check damage and subtract
+   stx $10
    sty $11
    lda $63
    bne ++
      sta ObjectActionScript,x
      lda ObjectActionScript,y
      bmi +
       jsr KnockbackObject
+     lda #SFX_ATTACK_IMMUNE
.ifdef _TINK_MODE
      inc $63
.endif
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
FREE_UNTIL $9152

;;; Change sacred shield to block curse instead of paralysis
.org $92ce
  cmp #$05 ; ceramic shield blocks paralysis

.org $934c
  jsr CheckSacredShieldForCurse

.reloc
CheckSacredShieldForCurse:
  lda $0714 ; equipped shield
  cmp #$06  ; sacred shield
  bne +
   pla
   pla
+ rts

;;; Allow other negative numbers to indicate projectile damage.
;;; Only $ff exactly will cause it to despawn.  This allows marking
;;; flails as $fe so that they still do projectile damage, but won't
;;; disappear.
.org $93df
  nop
  nop
  bpl $93e8


.ifdef _DISABLE_STATUE_GLITCH
.org $959a
  ;; Just always push down.
  lda #$04
.endif

.org $9b96 ; clear dolphin bit => also clear the flag
  jsr UpdatePlayerStatusAndDolphinFlag


.ifdef _EXTRA_EXTENDED_SCREENS
;;; Normally the check for tile effects just looks at the
;;; current map screen and clamps the page switch to the
;;; first 8 pages, but if we're reading screen data from
;;; extended locations, this won't work.  We need to patch
;;; the tile effects reader to read from extended pages
;;; when the extended flag is set ($62ff)

;;; NOTE: We could save some space by just calling directly
;;; into PatchPrepareScreenMapRead, but possibly the original
;;; code used the quick version for a reason?  It looks like
;;; it's not generally called more than a handful of times
;;; per frame (12-14, maybe a few more with a lot of objects)
;;; and it only saves 3 cycles each (the jsr and rts also
;;; o few instructions).
.if 1

.org $9a58
  jsr PatchPrepareScreenMapRead
  bne $9a73
FREE_UNTIL $9a73

.else ; false

.org $9a58
  pha
   sta $11
   lda $62ff
   asl $11
   rol
   asl $11
   rol
   asl $11
   rol
   sta $6f
   jsr QuickSwapPageA
  pla
  and #$1f
  ora #$a0
  sta $11
.assert * = $9a73

;;; This is a faster version of page swap ($a000) that destroys Y
;;; (Remove "1b" because it would change the page out from under itself).
.pushseg "1a", "fe", "ff"
.reloc
QuickSwapPageA:
  sta $6f
  ldy #$07
  sty $50
  sty $8000
  sta $8001
  rts
.popseg

.endif ; 1

.endif ; _EXTRA_EXTENDED_SCREENS


;; Adjusted stab damage for populating sword object ($02)
.org $9c5f
  lda #$02
.ifdef _NERF_FLIGHT
  jmp CheckSwordCollisionPlane
.else
  sta $03e2
.endif
  rts

.ifdef _RABBIT_BOOTS_CHARGE_WHILE_WALKING
.org $9e00
  jsr CheckRabbitBoots
.endif

.ifdef _DISABLE_TRIGGER_SKIP
.org $9d9a
  jsr FixTriggerSkip_CheckLatch
.endif

;.bank $36000 $a000:$2000
;
;.org $36086
;
;        ;; Free space at end of UseMagicJump
;        
;.assert * <= $36092 
;
;;;; Make gate opening independent of locations
;.org $37879
;  lda $23
;  and #$f8
;  cmp #$30
;  beq GateCheckPassed
;  lda $6c
;  cmp #$73
;  beq GateCheckPassed
;  bne GateCheckFailed
;.assert * <= $3788f
;.org $3788f
;GateCheckFailed:
;.org $37896
;GateCheckPassed:

;;; This is for fixing trigger glitch?
;;; @@@ TODO - this seems to have been orphaned somewhere?
;; .reloc
;; SetTriggerTileGameMode:
;;   sty $0623
;;   dec $41
;;   rts

;;; Free up some space in the magic table by consolidating the used magics.
.scope
  .org $a092
  ContinuousMagicTable_Orig:

  .org $a032 ; refer to moved table
    lda ContinuousMagicTable,y

  .org $a072
    .word (NoMagic)  ; UseMagicJump_00

  .reloc
  NoMagic:
    rts

  .reloc
  ContinuousMagicTable:
    .move 10, ContinuousMagicTable_Orig
    ;.byte $08,$00,$08,$08,$08,$08,$00,$08,$00,$08
.endscope


;;; This is a far entry in the jump table (????)
.org $a410
  .word (MaybeSpawnInsect)      ; ObjectActionJump_7e

.reloc
MaybeSpawnInsect:
  lda $038d
  bmi +
   bit $6488
   bvc +
    lda #$e2
    sta $04ad
+ rts


.ifdef _CUSTOM_SHOOTING_WALLS
;;; This is in object jump 07, replacing the hardcoded location check
.org $a864
  lda $06c0,x
  nop
  nop
  nop
  cmp #$ff
.endif


.ifdef _FIX_COIN_SPRITES
;;; Normally this code reads from a table to give the 16 different coin drop
;;; buckets a different metasprite.  Instead, we just change the CHR pages
;;; so that they're all compatible with $a9, which is loaded by LoadObject
;;; (after we updated the coin's object data to use a9 instead of a8).
;;; Now everything shows a single big coin.  This leads to slightly less
;;; variety, but less glitchy graphics.  Mimics should load $aa instead.
;;; We can tell because $300,x == $90.  This also frees up metasprite a8.
FREE "1a" [$8bfe, $8c0e) ; this table is no longer read, free up 16 bytes

.org $ba1c
  lda $0300,x
  cmp #$90
  bne +
   inc $0300,x
+ rts
FREE_UNTIL $ba2c
.endif
  

;;; Make white robots appear immediately outside tower.
.org $b5f3                 ; $375f3 is action script for waiting white robots
  jsr ReleaseWhiteRobots

.reloc
ReleaseWhiteRobots:
  lda $6c
  and #$f8
  cmp #$58
  bne +
   txa
   asl
   asl
   rts
+ pla
  pla
  jmp $b61b


;;; Beef up dyna

.ifdef _BUFF_DYNA

;;; This is near the beginning of object action 70:06 (dyna eye)
.org $bc9c
  ;; Don't check pod's status before shooting eye laser
  nop
  nop
;.org $37d37
;  ;; Don't shift the "bubble turns" by 2, so that one or the
;  ;; other is always shooting
;  nop
;  nop
;.org $37d3c
;  and #$01 ; each cannon shoots 1 in 2 rather than 1 in 8

;;; Middle of object action 70:08 (dyna pod)
.org $bd35
  txa
  asl ; clears carry
  adc $08
  and #$03
  beq +
   rts
+ lda $08
  and #$3c
  lsr
  lsr
  jmp $bd4c    ; 37d4c
.assert * <= $bd4c
;;; TODO - change ItemGet_Crystalis to remove magics!

.org $bd55
  ;; Change shots to start from a random location
  jmp DynaShoot

.org $bd86
  jmp DynaShoot2

.org $bd6c
  nop
  nop

.reloc
DynaShoot:
  sta $61        ; Store the spawn ID for later
  lda $70,x      ; Save pod's position on stack
  pha            ;
   tya           ; Store the shot's direction on stack
   pha           ;
    lda $70      ; Seed the random number by player's position
    adc $08      ; Also seed it with the global counter
    and #$3f     ; Don't overflow
    tay          ;
    lda $97e4,y  ; Read from Random number table
    asl          ; Multiply by 8: range is 0..$3f
    asl          ;
    asl          ;
    adc #$e0     ; Subtract $20
    adc $70,x    ; Add to pod's position
    sta $70,x    ; And store it back (temporarily)
   pla           ; Pull off the direction
   tay           ;   ...and save it back in Y
   lda $61       ; Pull off the spawn ID
   jsr $972d     ; AdHocSpawnObject
  pla            ; Pull off the pod's position
  sta $70,x      ;   ...and restore it
  rts

.reloc
DynaShoot2:
  pha
  lda $08
  asl
  bcc +
   iny
+ asl
  bcc +
   dey
+ pla
  jmp $972d     ; AdHocSpawnObject

.endif

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


.segment "fe", "ff"

.org $c010
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
   asl
   sta $62    ; $62 <- 2*player level
   asl
   sta $61    ; $61 <- 4*player level
   ldy $0713  ; equipped armor
   lda ArmorDefense,y
   ldy #$10   ; iron necklace
   jsr ComputeDefense
   sta $0401  ; armor defense
   ldy $0714  ; equipped shield
   lda ShieldDefense,y
   ldy #$14   ; shield ring
   jsr ComputeDefense
   sta $0400  ; shield defense
   nop
   nop
.assert * = $c04f ; NOTE: must be exact!


.org $c0f8
  jsr PostUpdateEquipment
  jmp RestoreBanksAndReturn


.reloc
PostUpdateEquipment:
  ;; Change 'lda' (ad) to 'jsr' (20) to enable these
.ifdef _LEATHER_BOOTS_GIVE_SPEED
  jsr ApplySpeedBoots
.endif
  rts

.reloc
ApplySpeedBoots:
  lda #$06   ; normal speed
  sta $0341  ; player speed
  lda $0716  ; equipped passive item
  cmp #$13   ; leather boots
  bne +
   inc $0341 ; speed up by 1
+ rts

;;; Remove the '10' bit if the player is flying ('20')
.reloc
CheckSwordCollisionPlane:
  sta $03e2 ; copied from $35c62
  lda $03a1
  and #$20
  ; lsr
  ; eor #$ff
  ; and $03a2
  ; sta $03a2
  ; rts
  beq +
   lda #$0c  ; zero out the collision plane entirely
   sta $03a2
+ rts


.ifdef _TWELVTH_WARP_POINT
;;; Remove 11 (5-byte) lines from the nametable write table
FREE "fe" [$c5b8, $c5ef)

.reloc
StageWarpMenuNametableWrite:
  ;; 20=a8, 21=DATA, 22=09, 23=00, 24=01
  sta $21
  lda #$a8
  sta $20
  lda #$09
  sta $22
  ldx #$00
  stx $23
  inx
  stx $24
  ;bne StageCustomNametableWrite ; uncond
StageCustomNametableWrite:  ; NOTE: was before the prev block
  jsr FlushNametableDataWrite
  txa
  pha
  jmp $c4b8  ; resume into the middle of StageNametableWrite

.reloc
WarpMenuNametableData:
  .byte $23,$2d,$36,$63,$6d,$76,$a3,$ad,$b6,$e3,$ed,$f6

.org $dc7b
  cmp #$0c  ; $0c is the first invalid slot (probably could just nop here)

.org $dd40
  lda #$0b  ; start drawing menu at $b

.org $dd4b
  ldx $11
  lda WarpMenuNametableData,x
  jsr StageWarpMenuNametableWrite
.assert * = $dd53

.org $dd59
  adc #$04  ; lower offset, start at 2f4 instead
.endif


.ifdef _DISABLE_SWORD_CHARGE_GLITCH
.org $c9fb
  jsr @ReloadInventoryAfterContinue

.reloc
@ReloadInventoryAfterContinue:
  sta $07e8
  jsr PostInventoryMenu
  rts
.endif


.ifdef _CHECK_FLAG0
;;; Note: this is a debugging aid added to determine if anything
;;; is accidentally setting flag 0.  It should not make a difference, 
.org $cb62 ; main game mode jump 08
    jsr CheckFlag0              ; was jsr ReadControllersWithDirections

.reloc
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
-     lda $6140,x
      eor #$ff
      sta $6140,x
      dex
     bpl -
     jsr LoadAndShowDialog

.ifdef _CTRL1_SHORTCUTS
+  jmp ReadControllersWithButtonUp
.else
+  jmp ReadControllersWithDirections
.endif
.endif ; _CHECK_FLAG0


.ifdef _DISPLAY_DIFFICULTY
.org $cb65  ; inside GameModeJump_08_Normal
  jsr CheckToRedisplayDifficulty ; was jsr CheckForPlayerDeath
.endif


.ifdef _CTRL1_SHORTCUTS
;;; These cases need to watch for button-up instead of button-down
.org $cb90 ; enter start menu
  lda $4a
.org $cbb4 ; enter select menu
  lda $4a

.ifndef _CHECK_FLAG0
.org $cb62 ; game mode 8
  jsr ReadControllersWithButtonUp
.endif
.endif ; _CTRL1_SHORTCUTS


.ifdef _DISABLE_WILD_WARP
.org $cbc7
  rts
.endif

;;; TODO - use this in several more places (i.e. dialog action jump 10 ??)
.reloc
WriteCoordsAndLoadOneObject:
  jsr $9897 ; WriteObjectCoordinatesFrom_34_37
  jmp $ff80 ; LoadOneObjectData

.org $d223 ; part of DialogFollowupActionJump_11 (give 2nd item)
  bpl GrantItemInRegisterA ; change from bne to handle sword of wind

.org $d22b
GrantItemInRegisterA:
  jsr PatchGrantItemInRegisterA

.reloc
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
  lda SlotFlagsStart,x
  and PowersOfTwo,y
  beq +
   pla
   pla
+ rts


;;; Fix bug in dialog action 9 where carrying from the low byte of money
;;; would just increment the low byte again instead of the high byte.
.org $d273
  inc $0703


.ifdef _ZEBU_STUDENT_GIVES_ITEM
;;; This is hairy - if there's money at the start then we really should just
;;; switch the action directly to 11 and free the entire thing, but that
;;; involves code outside here so we'll put it off.
.ifdef _MONEY_AT_START
;;; immediately jump straight to 11 at start of routine
.org $d263
  jmp DialogAction_11
FREE_UNTIL $d280
.else
;;; if we need to give both item and money then patch the followup.
.org $d27d
  jmp PatchZebuStudentFollowUp ; replace jmp DisplayNumberInternal

.pushseg "1a", "fe", "ff"
.reloc
PatchZebuStudentFollowUp:
;.bank $34000 $8000:$2000
  jsr DisplayNumberInternal
  jmp DialogAction_11
.popseg
.endif

.else  ; zebu student doesn't give an item
.ifdef _MONEY_AT_START
.org $d263
  rts
FREE_UNTIL $d280
.endif
.endif

.org $d29d ; Just set dolphin status bit => also set the flag
  jsr UpdatePlayerStatusAndDolphinFlag

;;; Dialog action $0a is kensu dropping a chest behind - update it to
;;; no longer hardcode an item but instead check persondata[0]
.org $d2f9
  ldx $0623
  lda $0680,x
  pha
  jsr $98a8 ; ReadObjectCoordinatesInto_34_37
  ldx #$1e  ; slot 1e
  stx $10
  lda #$0f  ; boss chest
  sta $11
  jsr WriteCoordsAndLoadOneObject
  pla
  sta $057e
  ldx #$02
  stx $055e
  inx
  stx $061e
  nop
.assert * = $d31c

;;; Convert a beq to a bcs for mimic spawns - any chest between $70 and $80
;;; will now spawn a mimic.
;;; .org $3d3fd
;;;   .byte $b0


;; End of ActivateTriggerSquare restores game mode to normal,
;; but if sword of thunder comes from trigger square, this will
;; clobber the LOCATION_CHANGE mode.  Patch it to call out to
;; FinishTriggerSquare to check for mode 02 and if it is, don't
;; change it back.
.org $d54b ; change this to call FinishTriggerSquare
  lda $41
  cmp #$01  ; game mode: location change
  jmp FinishTriggerSquare
.assert * = $d552

;; Change trigger action 4 to do any "start game" actions.
.org $d56b
  .word (InitialAction)

.org $d91f
  jsr PostInventoryMenu
.org $d971
  jsr PostInventoryMenu

.ifdef _FIX_OPEL_STATUE
;;; Prevent ever "equipping" opel statue
OpelStatueReturn = $db0d
.org $db0e
SetEquippedConsumableItem:
    ;; Figure out what's equipped
    ldy SelectedConsumableIndex
    bmi +
    lda InvConsumables,y
    cmp #ITEM_OPEL_STATUE
    bne ++
+   ldy SelectedQuestItemIndex
    bmi OpelStatueReturn
    lda InvQuest,y
++  sec
    jmp FinishEquippingConsumable
FREE_UNTIL $db28
.endif


.ifdef _ALLOW_TELEPORT_OUT_OF_BOSS
.org $db31
  .byte $00   ; don't jump
.endif

.ifdef _ALLOW_TELEPORT_OUT_OF_TOWER
.org $db39
  .byte $00   ; don't jump away to prevent warp, just goto next line

;; Make sure the down stair always spawns outside Mesia's room
.pushseg "1b", "fe", "ff"
.org $a48f
  lda $d0  ; player y hi
  ldy $b0  ; player y lo
  cpy #$20 ; set carry if below 2nd tile
  adc #0   ; add carry bit if needed
  tay      ; y is row to start clearing flags for
  ;; if we have crystalis then unlock from 0
  lda $6430
  cmp #4
  bne +
    ldy #0
  ;; set all the flags from y down to the bottom
+ lda #$ff
  bne +  ; (while ... do) instead of (do ... while)
-  sta $62f0,y
   iny
+  cpy #4
  bne -
  ;; if we're on the top screen (5c) then double-return
  lda $6c
  cmp #$5c
  bne +
   lda #0
   sta $04a0,x
   pla
   pla
   ;; TODO - do we still need to call SpawnTowerEscalator here?
+ rts
FREE_UNTIL $a4c6 ; currently saves ~12 bytes?
.popseg

.endif


;;; Allow putting oak child in pocket anywhere
.org $e7c3
-:
.org $e7cc
  bne -


.ifdef _SIMPLIFY_INVISIBLE_CHESTS
;;; We co-opt the unused npcdata[2]:20 bit to signify invisible chests
.org $e39f
  lda $2e
  and #$20
  beq $e3ad  ; normal chest
  bne $e3b0  ; invisible chest
  ;; 6 free bytes now
.endif

.org $e7b3 ; just cleared dolphin status => also clear the flag
  jsr UpdatePlayerStatusAndDolphinFlag

;;; Fix post-massacre Shyron sprites.  When we do sprite calculations,
;;; we don't really have any way to take into account the fact that
;;; post-massacre the game swaps $51 into pat1.  But pat0 is unused so
;;; if we make it $51 as well then we're good to go, even if we decide
;;; to flip the pattern slots.  Also, the changes to the color palettes
;;; are irrelevant, since it only changes pal3, which seems to be unused.
;;; So stop doing that so that peoples' colors don't change.
.org $e823
  lda $6c   ; check current location
  cmp #$8c  ; is it shyron?
  bne +     ; if not, then return
  lda $6484 ; check flag 027
  bpl +     ; if it's unset then return
  lda #$51
  sta $07f4
  sta $07f5
+ rts
  ;; and we save 14 bytes, to boot.
FREE_UNTIL $e845

.org $d458
    ;; Once we pick up a chest, reset the graphics?
    jmp ReloadLocationGraphicsAfterChest

.reloc
ReloadLocationGraphicsAfterChest:
    ;; After player picks up a chest, reload the location's graphics.
    ;; NOTE: we make an exception for Stom's house, since it needs to
    ;;       keep the modified pattern (4e instead of 4d)
    ;;       TODO - this is pretty crummy, consider finding a better solution
    lda $6c
    cmp #$1e
    beq +
     jsr $e148 ; reload just graphics, not objects
+   jmp $d552 ; ExecuteItemOrTriggerAction


;;; Allow any negative number to terminate an exit table.  Since X coordinates
;;; are constrained to 0..7f, this is safe, and it gives 7 extra bits for
;;; storing additional information that we can read when parsing the rom.
;;; For now, we will store %1p0eeeee where p is 1 if there is a pits table
;;; and eeeee is the number of entrances (0..1f).
.org $eb40
  bpl +
   rts
  nop
+:
.assert * = $eb44


;;; These are available because the "0a" screens are all for single-screen maps.
;;; We do use the 48 bytes at the end of the 142 screen for extra global data.
FREE "0a" [$80c0, $8100)
FREE "0a" [$81c0, $8200)

.ifdef _EXTRA_EXTENDED_SCREENS
.pushseg "0a", "fe", "ff"
;;; In this setup, we compress the map data by two bytes:
;;;  - The layout table (0) is now [music], [yx], [ext+anim],
;;;    where (x, y, anim, ext) have been compressed into only
;;;    two bytes, saving some room for other purposes.
;;;  - (yx) packs the height into the upper nibble and the
;;;    width into the lower nibble.
;;;  - (ext+anim) packs the ext number into the upper 6 bits
;;;    and the animation into the lower 2.  Thus, $28 would
;;;    indicate that screen 00 is at $14000, up through screen
;;;    $1f at $15f00.
.reloc
DecomposeScreenYX:
  lda ($10),y
  and #$0f
  sta $62fc
  lda ($10),y
  lsr
  lsr
  lsr
  lsr
  sta $13
  rts
.popseg

.org $e639
  ;; read the y=1 byte into both 62fc AND 62fd/13
  jsr DecomposeScreenYX ; $140f0
  sta $62fd
  iny
  lda ($10),y
  lsr
  lsr
  sta $62ff
  ;; read the y=2 byte into both 62ff AND 62fe
  lda ($10),y
  and #$03
  sta $62fe
  bpl $e652
FREE_UNTIL $e652

.org $ebe8
  ;; note: the AND should no longer be necessary since it's zero already
  and #$3f    ; note: we only need the 20 bit if we expand the rom
  beq $ebef
   jsr $c418  ; BankSwitch8k_8000
.assert * = $ebef

.org $ef36
  jsr PatchPrepareScreenMapRead
  bne $ef46  ; uncond
FREE_UNTIL $ef46

.pushseg "fe", "ff"
.reloc
PatchPrepareScreenMapRead:
    ;; First swap in the correct page into the $8000 bank.
    ;; Ultimately we want A = %00pp_paaa where ppp is $62ff (the low
    ;; 3 bits) and aaa is the upper 3 bits of the input ($11 for temp).
    pha
     sta $11
     lda $62ff
     asl $11
     rol
     asl $11
     rol
     asl $11
     rol
     jsr BankSwitch8k_a000
    pla
    and #$1f
    ora #$a0
    sta $11
    rts
    ; jmp $ef46  ; Pick up where we left off in the original code
.popseg
  

;;; TODO - PrepareMapScreenRead (ff:ef36) hardcodes assumptions about the
;;; segments - we probably need to patch into it to do something else.
;;; There's 4 calls to this.  Consider always loading out of the 8000
;;; bank rather than using both?  Will need to follow up on all 4 calls to
;;; see about swapping in the correct bank always?






.endif ; _EXTRA_EXTENDED_SCREENS


.ifdef _BUFF_DEOS_PENDANT
;;; Skip the check that the player is stationary.  We could also adjust
;;; the speed by changing the mask at $3f02b from $3f to $1f to make it
;;; faster, or $7f to slow it down.  Possibly we could start it at $7f and
;;; lsr if stationary, so that MP recovers quickly when still, but at half
;;; speed when moving?  We might want to consider how this plays with
;;; refresh and psycho armor...
.org $f026
  nop
  nop
.endif




.ifdef _FIX_SHAKING
; ;;; Fix the shaking issues by tweaking the delay times in IRQ callbacks.
; .org $f455
;   ldx #$07
;   nop
; .org $f4eb
;   ldx #$03
; - dex
;   bpl -
; .org $f359
;   lda #$20
; top text box - 1c
; status bar - 14
; vertical scroll - 09
; bottom of text - 0b

.reloc
;;;;;;;;;;;;;;;;;;;;;;;;
; Found on the NES Dev Wiki https://wiki.nesdev.com/w/index.php/Delay_code
; Delays A clocks + overhead
; Clobbers A. Preserves X,Y.
; Time: A+25 clocks (including JSR)
;;;;;;;;;;;;;;;;;;;;;;;;
                  ;       Cycles              Accumulator         Carry flag
                  ; 0  1  2  3  4  5  6          (hex)           0 1 2 3 4 5 6
                  ;
                  ; 6  6  6  6  6  6  6   00 01 02 03 04 05 06
-      sbc #7     ; carry set by CMP
DelayA25Clocks:
       cmp #7     ; 2  2  2  2  2  2  2   00 01 02 03 04 05 06   0 0 0 0 0 0 0
       bcs -      ; 2  2  2  2  2  2  2   00 01 02 03 04 05 06   0 0 0 0 0 0 0
       lsr        ; 2  2  2  2  2  2  2   00 00 01 01 02 02 03   0 1 0 1 0 1 0
       bcs *+2    ; 2  3  2  3  2  3  2   00 00 01 01 02 02 03   0 1 0 1 0 1 0
       beq +      ; 3  3  2  2  2  2  2   00 00 01 01 02 02 03   0 1 0 1 0 1 0
       lsr        ;       2  2  2  2  2         00 00 01 01 01       1 1 0 0 1
       beq @rts   ;       3  3  2  2  2         00 00 01 01 01       1 1 0 0 1
       bcc @rts   ;             3  3  2               01 01 01           0 0 1
+      bne @rts   ; 2  2              3   00 00             01   0 1         0
@rts:  rts        ; 6  6  6  6  6  6  6   00 00 00 00 01 01 01   0 1 1 1 0 0 1
; Total cycles:    25 26 27 28 29 30 31

.org $f424
SetIRQCallback:


;20 6F 7F 2F

.org $f455 ; VerticalScreenWrapHandler
  ;; go ahead and set the next IRQ callback before starting the delay
  lda #$bd
  sec
  sbc $57
  sta IRQLATCH
  sta IRQRELOAD
  lda #$01
  jsr SetIRQCallback

JustSetVerticalScreenScroll:
  ;; first write to PPUADDR can happen early before we need to wait
  lda PPUSTATUS ; reset address latch
  lda #$00
  sta PPUADDR

  ;; setup the next PPUADDR and PPUSCROLL value into x and y.
  lda $07d8
  tax
  lsr
  lsr
  lsr
  tay

  ;; this is extremely tight timing but we should be in hblank so we 
  ;; can quickly set the scroll now
  sty PPUADDR
  stx PPUSCROLL

  ;; We use method as a jump point in JustSetVerticalScreenScroll, which we
  ;; can detect with this jmp.
  lda $07fe
  beq +
  rts
+ 

  ;; all done with this IRQ, we've already setup the next callback as well before
  ;; we started the delay so we are ready to go.
  pla
  tay
  pla
  tax
  pla
  rti
.assert * <= $f488
FREE_UNTIL $f488

.reloc
HandleEarlyStatusBar:
  ;; The IRQ will be fired early when $07da == #$31 || $07da == #$32
  ;; $07da appears to be the viewport coords (excluding statusbar which starts at #$30)
  ;; if this is the case, then we do a custom handler that takes into account the extra
  ;; scanlines and sets the scroll for 1 or 2 scanlines before setting it back in time for
  ;; the status bar.
  ldy #$00
  ldx #$00
  lda $07da
  sec
  sbc #$33
  bpl @NotEarly
  adc #$02
  bpl @Early
  ;; We aren't early, so just delay a standard amount
@NotEarly:
  lda #$7c   ; $07f9
  jmp DelayA25Clocks ; Delay will return from this method

  ;; If the status bar IRQ is early, there will be 1 or 2 lines where we need to
  ;; set the scroll.
@Early:
  pha
    ;; A = 0 if we have one scanline to scroll. A = 1 if we have two.
    ;; if we have one scanline to scroll, then we need to delay for until the second hblank
    bne @TwoCycle
      lda #$5a
      jsr DelayA25Clocks
    ;; if we have two scanlines to scroll, then we need to set the scroll immediately
@TwoCycle:
    ;; delay an extra few cycles
    dex
    bmi @3
    bne @3
@3:
    inc $07fe
    jsr JustSetVerticalScreenScroll
    dec $07fe
  pla
  ;; if we are drawing two full scanlines, then we need to
  ;; delay some cycles before to skip the next scanline before returning
  beq @OneCycle
    lda #$9f
    jmp DelayA25Clocks
@OneCycle:
    lda #$2a
    jmp DelayA25Clocks

.org $f48e ; HandleStatusBarAndNextFrame

  ;; check to see if we are drawing the status bar early. Theres a window where IRQ handler #0
  ;; can't be used (because it would require back to back MMC3 scanline IRQs which is painful)
  ;; so we need to manually do the vertical scroll split here as well
  jsr HandleEarlyStatusBar
  
  ;; do everything we can before hblank to reduce the cycles needed to burn
  lda PPUSTATUS ; reset address latch
  ;; we need to write several zeroes, so just keep X as zero
  ldx #$00

  lda #$3b ; select nametable 2, tile 24, pixel 3
  sta PPUADDR

  ;; these two writes should land in hblank
  stx PPUADDR
  stx PPUSCROLL ; set fine x scroll
  
  ;; the top bar of the status bar comes from one bank, and the text from the other,
  ;; so we need to get the top bar switched ASAP, but we have extra time to switch the
  ;; text bank.
  stx BANKSELECT
  lda #$3c
  sta BANKDATA

  ;; now we have a little bit of time to switch banks for the rest of the drawing.
  ;; but first lets set the PPUMASK because thats more visible
  lda $01
  and #$0e
  ora #$08
  sta PPUMASK

  inx
  stx BANKSELECT
  lda #$38
  sta BANKDATA

  ;; this is some post cleanup operations
  lda $50
  sta BANKSELECT
  jmp $f4cb
.assert * <= $f4cb

.reloc
AdjustStatusBarPosition:
  ;; Updates A with the number of IRQ scanlines to delay for.
  ;; If we are on the seam (31, 32) then we need to go a scanline 
  ldy #$be
  lda $07da
  sec
  sbc #$33
  bpl @NotEarly
    adc #$02
    bmi @NotEarly
      dey
@NotEarly:
  tya
  ;; $57 appears to be the "current" scanline. This is tracked by
  ;; updating the value whenever an IRQ is triggered.
  ;; $57 counts up to #$bc in vanilla and #$bd in rando
  sec
  sbc $57
  rts

.org $f70a
  jsr AdjustStatusBarPosition
  nop
  nop

;;; update the scanline position for the status bar to run one scanline later for the
;;; scroll handler.
;; $f56d was rewritten entirely see MessageBoxBottomSetNextIRQ
; .org $f56d
;   cmp #$bd
.org $f6f1
  cmp #$bd

.reloc
MessageBoxTopSetNextIRQ:
  ldy #$48
  sty IRQLATCH
  sty IRQRELOAD
  dey
  dey
  ;; we have to take off one extra scanline from $57 because we are starting the
  ;; top message box one scanline sooner.
  dey
  tya
  clc
  adc $57
  sta $57
  lda #$03
  jmp SetIRQCallback

.org $f4e5 ; MessageBoxTopHandler
  jsr MessageBoxTopSetNextIRQ

  lda PPUSTATUS ; release the ~~kraken~~ addr latch
  ldx #$00 ; zero is used a lot in critically timed code, so just keep it handy
  ;; Preload the bank for the top of the message box
  ldy $58

  ;; Change the fine Y pixel offset by one pixel (#$28 -> #$38)
  ;; This slides the message box up one pixel, which gets rid of the extra border
  lda #$38 ; select nametable 2, tile 0, pixel 3
  sta PPUADDR

  ;; these two writes should land in hblank
  stx PPUADDR
  stx PPUSCROLL ; set fine x scroll
  
  ;; the top bar of the message box comes from one bank, and the text from the other,
  ;; so we need to get the top bar switched ASAP, but we have extra time to switch the
  ;; text bank.
  stx BANKSELECT
  sty BANKDATA
  
  ;; Critical timing code has ended, so now we can just take our time.
  jsr $f64f ; LoadCHRBanks
  jmp $f518
.assert * <= $f518
FREE_UNTIL $f518

; .org $f503
;   ldy #$48 ; ~~Fire the next IRQ one scanline sooner~~

.reloc
MessageBoxBottomSetNextIRQ:
  lda #$ef ; #$ef is the "bottom" of the screen
  ;; We finish this scanline earlier than vanilla, so decrement the current scanline by one
  dec $57
  sec
  sbc $07da
  cmp #$bd ; #$bd is the scanline for the statusbar
  bcs @NoScreenScroll
  cmp $57
  bcc @NoScreenScroll
  tay
  sbc $57
  sta IRQLATCH
  sta IRQRELOAD
  sty $57
  lda #$00
  jmp SetIRQCallback
@NoScreenScroll:
  jsr AdjustStatusBarPosition
  sta IRQLATCH
  sta IRQRELOAD
  sta $57
  lda #$01
  jmp SetIRQCallback

.org $f54b ; MessageBoxBottomHandler
  ;; In this handler, we have about 2 scanlines before we need to set the new scroll,
  ;; so get as much done to cut out unnecessary waiting time.

  ;; Custom SelectCHRRomBanks that doesn't set $07f0. We will set this as part of the
  ;; timed code
  ldx #$05
-  stx $8000
   lda $07f0,x
   sta $8001
   dex
   cpx #$01
  bpl -

  lda PPUSTATUS ; release the ppuaddr latch
  lda #$00      ; set the next bank latch
  sta BANKSELECT
  
  ;; Reload the previous scroll position
  lda $5e
  sta PPUADDR

  ;; Preload the coarse X and Y scroll value
  ldx $5f
  ;; Preload the bank that replaces the messsage box border
  ldy $07f0
  
  lda #$25
  jsr DelayA25Clocks

  ;; Critical timing code: this should happen right during the last fetch;
  sty BANKDATA
  ;; and these two writes should land in hblank
  stx PPUADDR
  lda $07d8
  sta PPUSCROLL ; set x scroll
  
  ;; Critical timing code is over, so now we can setup the bank select like SelectCHRRomBanks does
  lda $50
  sta BANKSELECT
  
  jsr MessageBoxBottomSetNextIRQ
  
  pla
  tay
  pla
  tax
  pla
  rti

.assert * <= $f5a1
FREE_UNTIL $f5a1

.org $f5a1 ; ScrollToPPUADDRLookupTable
;; By a terrible twist of fate, saving all those extra scanlines means that we
;; need to update this LUT to offset by an extra pixel. This sets the fine Y scroll
;; back one to allow us to display an extra pixel (which is normally covered by the
;; scroll jank).
  .byte $00,$10,$20,$10,$40,$10,$60,$10,$80,$10,$a0,$10,$c0,$10,$e0,$10
  .byte $00,$11,$20,$11,$40,$11,$60,$11,$80,$11,$a0,$11,$c0,$11,$e0,$11
  .byte $00,$12,$20,$12,$40,$12,$60,$12,$80,$12,$a0,$12,$c0,$12,$e0,$12
  .byte $00,$13,$20,$13,$40,$13,$60,$13,$80,$13,$a0,$13,$c0,$13,$e0,$13
.assert * = $f5e1

.org $f359
  lda #$00 ; Repurpose the old delay value as a flag for early return

.pushseg "17", "fe", "ff"
.org $bed2
  .byte $00 ; Overwrite continue save file delay value
.popseg

.endif


; possibly better to just have a bitset of modes that need to set the latch
; or patch the {lda 8; sta GameMode} that should be in every one?
.ifdef _DISABLE_TRIGGER_SKIP
.org $d497
  jsr FixTriggerSkip_LatchOnItemUse
.org $dd70
  jsr FixTriggerSkip_LatchOnMagicUse
.org $decb
  jsr FixTriggerSkip_LatchOnMagicUse
.endif

;;; Call this instead of 3c008 after the inventory menu
.reloc
PostInventoryMenu:
  ;; Change 'lda' (ad) to 'jsr' (20) to enable these
.ifdef _AUTO_EQUIP_BRACELET
  jsr AutoEquipBracelets
.else
  lda AutoEquipBracelets ; basically just a 3-byte no-op
.endif
  jmp UpdateEquipmentAndStatus

.reloc
AutoEquipBracelets:
  lda $6428
  bpl +
   ;; deselect all
-  lda #$80
   sta $642b
   lda #0
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

.reloc
FinishTriggerSquare:
  beq +
   lda #$08  ; game mode normal
   sta $41
+ jmp MainLoop_01_Game
  
.reloc
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
-   bcc +
     clc
     adc $62
+   ror
    ror $61
    dex
   bpl -
   sta $62
   cmp #$01 ; set carry if A != 0
  pla
  tax
  rts

;.export Multiply16Bit

;;; a <- 0, x <- 8
;;; ror a -> ror $61
;;; if the bit we just rotated off $61 is set then add $62
;;; carry goes into upper of A


.reloc
TrainerIncreaseScaling:
  ;; scaling level
  lda Difficulty
  clc
  adc #$02
  cmp #$2f
  bcc +
   lda #$2f
+ sta Difficulty
  lda #$01
  sta ShouldRedisplayDifficulty
  rts

.reloc
TrainerIncreaseLevel:
  ;; level up
  lda #$0f
  cmp $0421
  bcs +
   rts
+ inc $0421
  ldy $0421
  lda $6e
  pha
   lda #$1a
   jsr $c418
   lda $8b7f,y
   sta $03c0
   sta $03c1
   lda $8b8f,y
   sta $0708
   sta $0709
   jsr $8cc0
   lda #$00
   jsr $8e46
   lda #$02
   jsr $8e46
   lda #$03
   jsr $8e46
   lda #$04
   jsr $8e46
   lda #$05
   jsr $8e46
   jsr $c008
  pla
  jmp $c418


.org $e2ac ; normally loads object data for wall
  jsr SpawnWall  

.reloc
SpawnWall:
  ;; Spawns a breakable wall.  The $2e byte (3rd) determines
  ;; several changes if type:$20 bit is set:
  ;;   id:$30 determines the spawned object, id:$03 is element
  ;;   type:$10 determine if it shoots (stored in $6c0,x)
  ;; Works together with _CUSTOM_SHOOTING_WALLS
  lda $2e
  and #$20
  bne +
   jmp LoadOneObjectDataInternal
  ;; Do extra processing
+ lda $2f
  and #$30
  lsr
  lsr
  lsr
  lsr
  adc #$d0 ; carry clear
  sta $11
  jsr LoadOneObjectDataInternal
  lda $2e
  and #$10
  beq +
   lda #$ff
   sta $06c0,x
+ lda $2f
  and #$03
  tay
  lda WallElements,y
  sta $0500,x
+ rts

.reloc
WallElements:
  .byte $0e,$0d,$0b,$07

.reloc
GameModeJump_05_ItemTrigger:
  lda $0623
  pha
   lda $6c
   pha
    jsr $d497 ; 3d497 game mode 06 item use
   pla
   cmp $6c
   bne ++
  pla
  sta $0623
  lda $41
  cmp #$08
  bne +
   dec $41
   jmp $d3eb ; 3d3eb game mode 07 trigger
+ rts
++ pla
  rts

;;; Rather than reading ctrl2, we instead just read ctrl1 and
;;; then use $4a to store buttons released.
;;; $46 and $48 are buttons that have been pressed in button-up mode,
;;; but we remove bits from 48 to prevent button-up when a shortcut
;;; activates, but keep them in 46.
;;; $4c is the indicator that we're in button-up mode
.reloc
ReadControllersWithButtonUp:
  lda #$01
  jmp $fe82 ; ReadControllersWithDirections+2

.reloc
StartReadCtrl1:
  sta $4c
  ldx #$00
  jmp $ff17 ; ReadControllerX

.reloc
RegisterButtonRelease:
  ;; do nothing if not read with button up
  lda $4c
  bne +
   sta $46 ; also zero out pressed buttons
   sta $48
   rts
  ;; any newly-pressed buttons go in $48
+ lda $4b
  ora $48
  sta $48
  ora $46  ; NOTE: 46 should always be a superset of 48
  sta $46
  ;; any buttons in $48 not in $43 go in $4a
  lda $43
  eor #$ff
  and $48
  sta $4a
  ;; any unpressed buttons are removed from $48 and $46
  lda $43
  and $46
  sta $46
  and $48
  sta $48
-- rts
QuickChangeSword:
   lda $48
   and #$cf
   sta $48   ; zero out pressed buttons
   ldx $0711
   cpx #$05
   beq --     ; rts if crystalis
-   inx
    cpx #$05
    bne +
     ldx #$00
+   cpx $0711
     beq --   ; rts if no other sword found
    cpx #$00
     beq -
    lda $642f,x
     bmi -    ; don't own sword
    ;; Found a new sword - equip it
    sta $6428 ; currently equipped index
    stx $0711 ; equipped sword
    lda #$00
    sta $06c0 ; zero out the current charge
    lda #$4c  ; sfx: cursor select
    jsr $c125 ; StartAudioTrack
.ifndef _AUTO_EQUIP_BRACELET
    jsr $d9d8
    sty $0719
.endif
    jmp PostInventoryMenu
CheckSelectShortcuts:
  lda $4b
  cmp #$40   ; newly pressed B?
   beq QuickChangeSword  ; yes -> change sword

.ifdef _SOFT_RESET
  cmp #$10   ; newlt pressed start
   beq SoftReset
.endif

-:
.ifdef _TRAINER
  jmp CheckTrainerShortcuts
.endif

  rts
CheckStartShortcuts:
  lda $46
  cmp #$d0   ; A+B+start exactly?
  bne -      ; done -> rts
.ifndef _NO_BIDI_WILD_WARP ; save 12 bytes without this...?
   lda $4b
   and #$40  ; B newly pressed -> go backwards
   beq +
    dec $0780
    dec $0780
.endif
+  lda $48   ; activated, so zero out start/select from $48
   and #$cf
   sta $48
   jmp $cbd3 ; yes -> wild warp

.ifdef _SOFT_RESET
SoftReset:
  ldx #$ff
  txs
  jmp ($fffc)
.endif

;;; Defines code to run on game start
.reloc
InitialAction:
.ifdef _TRAINER
  jsr TrainerStart
.endif
  rts

;;; NOTE: this is 23 bytes.  If we do anything else with flags
;;; it would make sense to write a pair of functions SetFlag
;;; and ClearFlag that take an offset in Y and a bit in A (with
;;; appropriate CPL already applied for clear) - these are each
;;; 7 bytes to define and 7 bytes to call, so this ends up costing
;;; 34 bytes total, but only 20 on the margin.  It would take
;;; a number of calls to pay off.
.reloc
UpdatePlayerStatusAndDolphinFlag:
  ;; Args: A = new value for $0710, bit 40 will go into flag 0ee (649d:40)
  sta $0710
  and #$40
  beq +
   ora $648d ; flag 06e
   sta $648d
   rts
+ lda #$bf
  and $648d
  sta $648d
  rts

.reloc
SetFlagYA:
;;; 27 bytes - we can probably improve this?
  pha
   sty $24
   lsr $24
   ror
   lsr $24
   ror
   lsr
   sta $24
  pla
  and #$07
  tay
  lda PowersOfTwo,y
  ldy $24
  ora $6480,y
  sta $6480,y
  rts

.ifdef _TRAINER
;;; Trainer mode: provides a number of controller shortcuts
;;; to do a wide variety of things:
;;;   Start+B+Left -> all balls
;;;   Start+B+Right -> all bracelets
;;;   Start+B+Down -> some consumables
;;;   Start+Up -> gain a level
;;;   Start+Down -> increase scaling by 2
;;;   Start+Left -> better armors
;;;   Start+Right -> better shields
;;; TODO - move trainer to a different ROM page since it's so big.
.reloc
CheckTrainerShortcuts:
   lda $46    ; Currently pressed?
   and #$50   ; Start+B
   cmp #$50
   bne ++
    lda $4b   ; Newly pressed?
    cmp #$08  ; Up
    bne +
     ;; TODO - something here?
+   cmp #$04  ; Down
    bne +
     lda #$04
     jmp TrainerGetItems
+   cmp #$02  ; Left
    bne +
     lda #$05
     jmp TrainerGetItems
+   cmp #$01  ; Right
    beq +
-    rts
+   lda #$06
    jmp TrainerGetItems
    ;; ----
++ cmp #$10  ; Start only
   bne -
   lda $4b   ; Newly pressed?
   cmp #$08  ; Up
   bne +
    lda $48
    and #$ef
    sta $48
    jmp TrainerIncreaseLevel
+  cmp #$04  ; Down
   bne +
    lda $48
    and #$ef
    sta $48
    jmp TrainerIncreaseScaling
+  cmp #$02  ; Left
   bne +
    lda #$02
    jmp TrainerGetItems
+  cmp #$01
   bne -
   lda #$03
   jmp TrainerGetItems

TrainerStart:
  ;; Get all swords, armor, magic, bow of truth, max money
  lda #$ff  ; max gold
  sta $0702
  sta $0703
  lda $6484 ; shyron massacre
  eor #$80
  sta $6484
  lda #$ff  ; activate all warp points
  sta $64de
  sta $64df
  lda #$00
  jsr TrainerGetItems
  lda #$01
  jsr TrainerGetItems
  lda #$04
  jsr TrainerGetItems
  lda $6e ; NOTE: could just jmp $3d276 ?? but less hygeinic
  pha
   lda #$1a
   jsr $c418 ; bank switch 8k 8000
   lda #$01
   jsr $8e46 ; display number internal
  pla
  jmp $c418

.reloc
TrainerData:
  .word (TrainerData_Swords)      ; 0 swords, armors, shields
  .word (TrainerData_Magic)       ; 1 accessories, bow of truth, magic
  .word (TrainerData_Balls)       ; 2
  .word (TrainerData_Bracelets)   ; 3
  .word (TrainerData_Consumables) ; 4
  .word (TrainerData_Armors)      ; 5
  .word (TrainerData_Shields)     ; 6

.reloc
TrainerGetItems:
    ;; Input: A = index into TrainerData table
    asl
    tax
    lda TrainerData,x
    sta $10
    lda TrainerData+1,x
    sta $11
    ldy #$00
    lda ($10),y
    sta $12
    iny
    lda ($10),y
    tay
    iny
    iny
    clc
    adc $12
    tax
    dex
    dey
    ;; At this point, we move $6430,x <- ($10),y
    ;; and then decrease both until y=2
-    lda ($10),y
     bmi +
      sta $6430,x
+    dex
     dey
     cpy #$02
    bcs -
    lda $48
    and #$ef
    sta $48
    rts  

.reloc
TrainerData_Swords:
  .byte $00,$0c
  .byte $00,$01,$02,$03,$15,$16,$17,$18,$0d,$0e,$0f,$10

.reloc
TrainerData_Magic:
  .byte $18,$18
  .byte $29,$2a,$2b,$2c,$2d,$2e,$2f,$30
  .byte $ff,$ff,$ff,$ff,$ff,$ff,$ff,$40
  .byte $41,$42,$43,$44,$45,$46,$47,$48

.reloc
TrainerData_Balls:
  .byte $0c,$04
  .byte $05,$07,$09,$0b

.reloc
TrainerData_Bracelets:
  .byte $0c,$04
  .byte $06,$08,$0a,$0c

.reloc
TrainerData_Consumables:
  .byte $10,$08
  .byte $1d,$1d,$21,$21,$22,$22,$24,$26

.reloc
TrainerData_Armors:
  .byte $04,$04
  .byte $19,$1a,$1b,$1c

.reloc
TrainerData_Shields:
  .byte $08,$04
  .byte $11,$12,$13,$14

.endif  

.ifdef _DISABLE_TRIGGER_SKIP
.reloc
FixTriggerSkip_LatchOnItemUse:
  lda #$01
  sta $61fd
  rts

.reloc
FixTriggerSkip_LatchOnMagicUse:
  sta $07de
  lda #$01
  sta $61fd
  rts

;;; NOTE: We should move this to 34c0e after making _FIX_COIN_SPRITES
;;; mandatory.
.reloc
FixTriggerSkip_CheckLatch:
  lsr $61fd
  bcc +
  pla
  pla
+ lda $0710
  rts
.endif


.reloc
CheckRabbitBoots:
  lda EquippedPassiveItem
  cmp #ITEM_RABBIT_BOOTS ; require rabbit boots
  bne +
  lda $06c0
  cmp #$10 ; don't charge past level 2
  bcs +
  rts
  ;; return instead to after the charge is increased
+ pla
  pla
  jmp $9e39 ; 35e39


.reloc
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

;;; Note: This is moved from $3db22, where we ran out of space.
.reloc
FinishEquippingConsumable:
    sbc #$1c
    sta EquippedConsumableItem
    rts


.reloc
ComputeDefense:
  cpy $0716   ; equipped worn item
  php         ; remember whether it was equal or not
   clc
   adc $0421  ; add the level
   cmp $61    ; compare to 4*level
   bcc +      ; if less then skip
    lda $61   ; if greater then cap
+ plp         ; pull the Z flag
  bne +       ; if not wearing correct item then skip
   clc
   adc $62    ; add 2*level
+ rts


.reloc
CheckToRedisplayDifficulty:
  lda ShouldRedisplayDifficulty
  beq +
   lsr ShouldRedisplayDifficulty
   lda #$06
   jsr DisplayNumber
+ jmp CheckForPlayerDeath


;;; Repurpose $3e148 to skip loading NPCs and just reset pattern table.
;;; The only difference from $3e144 is that $18 gets set to 1 instead of 0,
;;; but this value is never read.  Start by changing all jumps to $3e148
;;; to instead jump to $3e144.  Then we grab some space and have a nonzero
;;; value in $18 return early.
.org $e6ff
  jmp $e144
.org $d21a
  jmp $e144
;;; For these, just eliminate the indirection: update the jump table directly.
.org $d56f
  .word ($e144)  ; ItemOrTriggerActionJumpTable[$06]
.org $d585
  .word ($e144)  ; ItemOrTriggerActionJumpTable[$11]


;;; ================================================================
;;; Consolidate some of the ItemOrTrigger -> itemget logic. (@@sog)
;;; A number of different message actions can be combined into a single
;;; one once we expose the active trigger ID at $23.

;;; TODO - change the actions on the messageids rather than repeat jumps
;;;   08,0d,0f -> 0b, 14 -> 13
;;;   ==> if we do this then we need to fix logic/world.ts
;;; We could free up 4 new actions (in addition to the 3 or so unused ones)
.org $d573                       ; ItemOrTriggerActionJumpTable + 2*$08
  .word (GrantItemFromTable)      ; 08 learn paralysis
.org $d579                       ; ItemOrTriggerActionJumpTable + 2*$0b
  .word (GrantItemFromTable)      ; 0b learn barrier
  .word (GrantItemThenDisappear)  ; 0c love pendant -> kensu change
  .word (GrantItemFromTable)      ; 0d kirisa plant -> bow of moon
  .word (UseIvoryStatue)          ; 0e
  .word (GrantItemFromTable)      ; 0f learn refresh
.org $d589                       ; ItemOrTriggerActionJumpTable + 2*$13
  .word (DestroyStatue)           ; 13 use bow of moon
  .word (DestroyStatue)           ; 14 use bow of sun


.import GrantItemTable
;;   .byte $25,$29  ; 25 statue of onyx use -> 29 gas mask
;;   .byte $39,$3a  ; 39 glowing lamp use -> 3a statue of gold
;;   .byte $3b,$47  ; 3b love pendant use -> 47 change
;;   .byte $3c,$3e  ; 3c kirisa plant use -> 3e bow of moon
;;   .byte $84,$46  ; 84 angry sea trigger -> 46 barrier
;;   .byte $b2,$42  ; b2 summit trigger -> 42 paralysis
;;   .byte $b4,$41  ; b4 windmill cave trigger -> 41 refresh
;;   .byte $ff      ; for bookkeeping purposes, not actually used

;; .assert * = $d6e4

.reloc
GrantItemFromTable:
  ldy #$00
  lda $34
-  iny
   iny
   ;; beq >rts    ; do we need a safety?
   cmp GrantItemTable-2,y
  bne -
+ lda GrantItemTable-1,y
  jmp GrantItemInRegisterA

.reloc
GrantItemThenDisappear:  ; Used by Kensu in granting change (action 0c)
  jsr GrantItemFromTable
  ldy #$0e
  jmp $d31f

.reloc
UseIvoryStatue:  ; Move bytes from $3d6ec
  jsr $e144 ; LoadNpcDataForCurrentLocation
  ldx #$0f
  lda #$1a
  jsr $c418 ; BankSwitch8k_8000
  jsr $98a8 ; ReadObjectCoordinatesInto_34_37
  ldx #$1e
  stx $10
  jsr $9897 ; WriteObjectCoordinatesFrom_34_37
  lda #$df
  sta $11
  jsr $c25d ; LoadOneObjectDataInternal
  lda #$a0
  sta $033e
- rts
DestroyStatue:
  ;; Modified version to use the ID of the used bow rather than have
  ;; a separate action for each bow.
  lda #$00
  ldy $34  ; $3e for moon -> 4ad, $3f for sun -> 4ae ==> add 46f
  sta $046f,y
  lda #$6b
  jsr $c125 ; StartAudioTrack
  jsr $d88b
  lda $04ad
  ora $04ae
  bne -  ; rts from previous
  lda #$7f
  sta $07d7
  lda $04cf
  sta $11
  lda #$0f
  sta $10
  jmp $c25d ; LoadOneObjectDataInternal

.org $d7fd ; itemuse action jump 1c - statue of onyx -> akahana
  jsr GrantItemFromTable
  nop
  nop

;;; In HandleItemOrTrigger, backup $23 in $10 rather than using it for the
;;; JMP opcode, and then call Jmp11 instead.
.org $d845
  lda $23
  sta $34

.org $d853
  jsr Jmp11

;;; ================================================================

;;; Vanilla moves the player down a tile when falling into pits.
;;; This is presumably to better line up the landing with the
;;; horizontal wide screens, which are offset a tile down from
;;; normal caves.  This leads to two problems: (1) when falling
;;; into a non-wide screen, the player lands _inside_ the wall;
;;; (2) the entrance and exit of Sabera's palace need to be
;;; shifted down a tile to compensate and prevent the player
;;; falling through the exit during the screen-shaking dead
;;; frames.  Instead, we offset up a tile, which in practice
;;; seems to be fine.
;; .org $e5a9
;;   beq $e5b2
;; FREE_UNTIL $e5b2

;;; NEW: offset up, and clamp x-tile to [4, b] so that vertical
;;; spikes are eligible targets for both horizontal and vertical
;;; platforms.
.org $e5ab
  sec
  sbc #$10
  nop
  jsr @ClampPitX

.reloc
@ClampPitX:
  sta $b0  ; copied from ff:e5ae
  sta $b1
  ;; original code
  lda $70
  cmp #$44
  bcs +
   lda #$44
+ cmp #$bb
  bcc +
   lda #$bb
+ sta $70
  sta $71
  rts

;;; ================================================================

;;; Now fix the LoadNpcDataForLocation code
.org $e19a  ; in the middle of CheckForNpcSpawn
  lda $18
  beq $e1ae ; <rts
  lda ($10),y
  dey
  asl
  bcs $e1af ; skip the rts
  jsr $e1b6 ; TryNpcSpawn
  inx
  jmp $e18f ; Check next NPC spawn.
FREE_UNTIL $e1ae

.reloc
Jmp11: ;;; More efficient version of `jsr $0010`, just `jsr Jmp11`
  jmp ($0011)


.ifdef _HAZMAT_SUIT
.org $ef66
  ;; Check for gas mask instead of leather boots for pain terrain
  cmp #$0d
.endif


.ifdef _CTRL1_SHORTCUTS
    ;; NOTE: we could save a bit of space by using relative jumps
    ;; and inserting the code around $3fe70
.org $fe80
  lda #$00
  jsr StartReadCtrl1
.org $fecc
  jmp RegisterButtonRelease

.org $fee0
  lda #$00
  jsr StartReadCtrl1
.org $ff13
  jmp RegisterButtonRelease

.org $cbc1
  lda $46
  and #$20   ; select pressed?
  beq +
   jsr CheckSelectShortcuts
+ lda $46
  and #$10   ; start pressed?
  beq $cbeb  ; no -> rts
   jmp CheckStartShortcuts
.assert * <= $cbd3
.endif

;;; TODO - quick select items
;; .org $3cb62
;;   jsr ReadControllersAndUpdateStart
;; .org $3d8ea
;;   jsr ReadControllersAndUpdateStart
;; 
;; .org $3fa10
;; ReadControllersAndUpdateStart:
;;   lda $43    ; Pressed buttons last frame
;;   and #$30   ; Start and Select
;;   sta $61
;;   jsr ReadControllersWithDirections
;;   ;; Change $4b to report start/select only on button-up, and
;;   ;; only if no quick select happened.  We store a mask #$30 in
;;   ;; $42 on button-down for start and select, and zero it out
;;   ;; on quick change, so that ANDing with it before setting
;;   ;; $4b is sufficient to meet the requirement.
;;   lda #$30
;;   bit $4b
;;   beq +
;;    sta $42
;; + lda $43
;;   eor #$ff
;;   and $61
;;   and $42
;;   sta $61
;;   lda $4b
;;   and #$cf  ; ~$30
;;   ora $61
;;   sta $4b
;;   rts



;;; TODO - set up an in-game timer?
;;; Also display completion percent on end screen?
;; .org $3f9f8
;; UpdateInGameTimer:
;; .org $3f3b7
;;   nop
;;   jsr UpdateInGameTimer


;;; The following patch fixes a crash where an IRQ right in the middle of
;;; loading NPCs can fail to correctly restore the bank select register
;;; $8000.  If the IRQ occurs exactly between selecting the bank and setting
;;; the value (i.e. at $3c430..$3c432) and executes both MaybeUpdateMusic
;;; (which page-swaps, rewriting $50 to $8000 afterwards, but not restoring
;;; $50) and SelectCHRRomBanks (which restores $8000 to the clobbered $50)
;;; then the bank swap will fail.  In the case of this crash, it then reads
;;; NpcData from the wrong page, reading a 7 into the NPC type and jumping
;;; off the end of the 5-element NpcDataJump table.  The fix is to make sure
;;; that MaybeUpdateMusic restores $50 as well as $8000, though this takes
;;; an extra two bytes that we need to recover from SelectCHRRomBanks (which
;;; immediately follows) by using smaller instructions.
;; This location is rewritten as part of the IRQ delay timing changes
; .org $f564
;   jsr SelectCHRRomBanks
.org $f6e2
  jsr SelectCHRRomBanks
.org $f734
  jsr SelectCHRRomBanks
.org $f779
  jsr SelectCHRRomBanks
.org $f785
  jsr SelectCHRRomBanks
.org $f7c8
  jsr SelectCHRRomBanks
.org $f882
  stx $50
  rts
FREE_UNTIL $f8cb

.reloc
SelectCHRRomBanks:
  ldx #$05
-  stx $8000
   lda $07f0,x
   sta $8001
   dex
  bpl -
  lda $50
  sta $8000
  rts

;;; ================================================================
;;; When initializing a new game, we need more space for custom
;;; values.  Instead of a bunch of sta $07xx to zero things out,
;;; use a table.

.org $c96d
  ldx #$00
-- lda PrepareGameInitialDataTable,x
    beq +
   sta $12
   inx
   lda PrepareGameInitialDataTable,x
   sta $10
   inx
   lda PrepareGameInitialDataTable,x
   sta $11
   inx
   ldy #$00
-   lda PrepareGameInitialDataTable,x
    sta ($10),y
    inx
    iny
    dec $12
   bne -
  beq --
+ jsr $c9ff ; PopulateInitialObjects
  jmp $c008
FREE_UNTIL $c9da

.reloc
PrepareGameInitialDataTable:
  ;; Initial location/entrance
  .byte 2
  .word ($006c)
  .byte $00,$01
  ;; Main loop mode and game mode
  .byte 2
  .word ($0040)
  .byte $01,$00
  ;; Various values in the 700 block
  .byte 8
  .word ($0702)
  .ifdef _MONEY_AT_START
    .byte 100
  .else
    .byte 0
  .endif
  .byte $00,$1e,$00,$00,$00,$22,$22
  ;; A few more values in 7xx
  .byte 11
  .word ($0710)
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  ;; Some other one-off values
  .byte 2
  .word ($0743)
  .byte $00,$00
  .byte 1
  .word ($07e8)
  .byte $00
  .byte 4
  .word ($0002)
  .byte $00,$00,$00,$00
  .byte 1
  .word ($0051)
  .byte $00
  .byte 0

.ifdef _MONEY_AT_START
.pushseg "17"
.org $be80
  .byte 100
.popseg
.endif

;;; NOTE: This is an alternative implementation of SelectCHRRomBanks
;;; that is 4 bytes shorter than the original, but way longer than
;;; the loop above.
  ;; ldx #$80
  ;; stx $53
  ;; ldx #$00
  ;; stx $52
  ;; txa
  ;; sta ($52,x)
  ;; tay
  ;; iny
  ;; lda $07f0
  ;; sta ($52),y
  ;; lda #$01
  ;; sta ($52,x)
  ;; lda $07f1
  ;; sta ($52),y
  ;; lda #$02
  ;; sta ($52,x)
  ;; lda $07f2
  ;; sta ($52),y
  ;; lda #$03
  ;; sta ($52,x)
  ;; lda $07f3
  ;; sta ($52),y
  ;; lda #$04
  ;; sta ($52,x)
  ;; lda $07f4
  ;; sta ($52),y
  ;; lda #$05
  ;; sta ($52,x)
  ;; lda $07f5
  ;; sta ($52),y
  ;; lda $50
  ;; sta ($52,x)
  ;; rts

;; ScalingLevels = SCALING_LEVELS
;; .export ScalingLevels
