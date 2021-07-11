.segment "0d", "fe", "ff" ; object data

.org $c409
  jmp ComputeEnemyStats

.import DiffAtk, DiffDef, DiffHP, DiffExp

;; ;;; TODO - use a label: .org EndOfCompressedMonsterData
;; .org $bd00  ; This should leave some space after compression
;; DiffAtk:   ; PAtk*8
;; .org * + SCALING_LEVELS
;; DiffDef:   ; PDef * 4
;; .org * + SCALING_LEVELS
;; DiffHP:    ; PHP (0..$26)
;; .org * + SCALING_LEVELS
;; DiffExp:   ; ExpBase * 4, encoded in standard EXP encoding
;; .org * + SCALING_LEVELS

;;; $12 and $13 are free RAM at this point

;.org $1bdd0  ; Note: this follows immediately from the tables.
.reloc
ComputeEnemyStats:
  lda ObjectRecoil,x
  bmi +
   jmp $c2af ; exit point
+ and #$7f
  sta ObjectRecoil,x
  ;; We're gonna do the rescaling - figure out the actual difficulty
.ifdef _MAX_SCALING_IN_TOWER
  lda $6c
  and #$f8
  cmp #$58
  bne +
-  lda #(SCALING_LEVELS-1)
   bne ++
+   lda Difficulty
    cmp #(SCALING_LEVELS-1)
    bcs -
.else
   lda Difficulty
   cmp #(SCALING_LEVELS-1)
   bcc ++
    lda #(SCALING_LEVELS-1)
.endif
++ tay
   sta $63
RescaleDefAndHP:
   ;; HP = max(PAtk + SWRD - DEF, 1) * HITS - 1
   ;; DiffAtk = 8 * PAtk
   ;; DEF = (8 * PAtk) * SDEF / 64   (alt, SDEF = 8 * DEF / PAtk)
   lda ObjectHP,x
   bne +
    jmp RescaleAtk
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
   lda $6c
   and #$f8
   cmp #$58
   bne +
    asl $62
    bcc +
     lda #$ff
     sta $62
+  jsr Multiply16Bit
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
   ;; Store the calculated Max HP into a different RAM location
   ;; for the enemy HP bar calculations
   sta ObjectMaxHPLo,x
   lda ObjectDef,x
   and #$01
   sta ObjectMaxHPHi,x
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
  lda $6c
  and #$f8
  cmp #$58
  bne +
   ;; Zero out exp and gold
   lda ObjectGold,x
   and #$0f
   sta ObjectGold,x
   lda #$00
   sta ObjectExp,x
   beq RescaleDone ; unconditional
   ;; ------------
+ lda ObjectGold,x
  and #$f0
   beq RescaleExp
  lsr
  sta $61
  lda $63 ; difficulty
  asl
  adc $63 ; difficulty
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
   jmp $c2af

; .assert * <= $c000
;.assert < $1bff0
