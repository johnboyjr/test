# DDR II (Wii) - what has been decoded

Reference for a future native rewrite. Every rule here was read from the game's own program
(`sys/main.dol`, US release) or its data files unless marked **(not decoded)** or **(estimate)**.
Addresses are main.dol virtual addresses. r2 = 0x802efb60, r13 = 0x802ee3a0.

## Basics

- Time unit: chart ticks of 1/150 s. Chart positions: 4096 per measure, 1024 per beat.
- Song database: 0x802A44A8, 412 bytes per slot, slots 1-200. Even slot = full song, odd = cut.
  - +4 flags (0x200000 random BPM dance, 0x40 own-video song, 0x30000 no-stage, 0x04000000 dummy)
  - +8 stage id (-1 = chosen at song select)
  - +30 u16 BPM
  - +116..+136 six gimmick-file ids (all -1 on the US disc: the GIMMICK folder is unused)
  - +204/+244/+284/+364 level bytes, indexed by difficulty index (0 BEGINNER, 1 BASIC, 2 DIFFICULT, 3 EXPERT)
- Chart file `ssq/ss4/MU_DDR_<slot>.ss4`, little-endian chunks: u32 size, u16 type, u16 p2, u32 n.
  - type 1 tempo: n positions then n tick times (p2 = ticks per second)
  - type 2 events: n positions then n 4-byte events (song start/end markers)
  - type 16 steps, p2 = (difficulty << 8) | style: n positions, n lane bytes, (aligned) n big-endian u32 flags
  - type 17: measure-start entries in 11 songs, value = 4-bit number (1-15, possibly a panel mask) + group
    0/2/3/4 **(meaning not decoded; also appears once in the Swing lesson, so maybe a timed event)**
  - **The game's chart parser (0x8002f408, tsSeqData.cpp) handles only chunk types 1 (tempo, 0x8002f7ec),
    2 (events, 0x8002f974), 3 / 9 / 16 (steps, 0x8002fd64 variants 0 / 1 / 2) and 10 (0x8002ff6c).
    No other code reads chunk types, so types 17 and 18 are never used by DDR II** (leftover tool data).
  - Step chunk key p2: high byte = difficulty; low byte = family (high nibble 1-4) and lane setup (low
    nibble 4 = four panels, 8 = double, 0xa = four panels + two hand lanes). Families 2-4 exist only on
    slots 39-60 (the hand-move songs): 0x24 / 0x34 four-lane, 0x2a / 0x3a hands, 0x4a punch / diagonal /
    board. The step parser (0x8002ec40) only copies steps and holds - it creates no gimmick notes.
  - The parser builds five internal lists (its overflow messages name them): foot steps, holds, steps,
    timings and indicators (likely the hand / gimmick markers). Note types 11, 13 and 16-21 are not set
    from constants anywhere in the reader; where they come from is still open.
  - type 18: seen only in slot 33 (a Tournament gimmick song): two positions, measures 26 and 34, values 0 -
    looked like a gimmick section, but the game never reads type 18
- GIMMICK: the GIMMICK option controls whether gimmicks show; the Tournament's gimmick request (songs
  31-33, value 4) shows them "regardless of Options settings" - that is player option bit 0x4, which also
  forces the note-chaining step 0x80037ae0 (so that step is part of the gimmick processing).
  Slots 31 and 32 have no type 17/18 data, so how their gimmicks are placed is still open.
- Chart difficulty codes: 4 BEGINNER, 1 BASIC, 2 DIFFICULT, 3 EXPERT, 6 CHALLENGE.
- Styles: 0x14 single, 0x18 double, 0x24/0x34 four lanes, 0x1a/0x2a/0x3a and 0x4a Hypermove (lanes 4, 5 = hands).

## Step flags (type 16 chunk, per note u32)

- 0x100 = freeze end.
- Hypermove (styles 0x1a/0x2a/0x3a): kind (top byte) 2 with value 1/3/5/7, kind 3 with value 1/2/7.
- Hypermove (style 0x4a): kinds 1, 5, 6, 7 with value 4 or 8 (and 0x6c in one note).
- Move codes, named from the 15 lesson charts (ssq/Lss4/LESSONnn.ss4) and the lesson text (text_eng entry 14).
  Flag = kind << 24 | value << 8; value = direction 0 up, 2 right, 4 down, 6 left (odd = diagonals),
  larger values encode two directions (0x64, 0x68, 0x6c):

  | kind | lesson | move |
  |---|---|---|
  | 8 / 9 | 1-6 (step lessons; 1 = only 2/6, 2 = only 0/4) | foot steps by direction (two sides) |
  | 2 | 7 | Thrust Arrows (arms thrust in a direction) |
  | 1 | 8 | Punch Markers (value 8 seen most) |
  | 4 | 9 | Swing Arrows (semicircle; 0x64 / 0x68 = start-end) |
  | 3 | 10 | hand markers (directions 1/3/5/7 and 0) |
  | 5 | 13 | Diagonal Arrows (A button right, B left; values 8, 0x6c) |
  | 6 / 7 | 14 | Balance Board bump / hop (values 2/4/6/8) |
  | 0x100 low bits | - | freeze end |

  Lesson 12 (MINIMIZER / NORMALIZER) is plain arrows with no flags or chunk 17, so those gimmicks
  are not in the chart flags. Lesson 9 has one chunk-17 entry (measure 28, 0x00d00100).
- Each built note points (+92) to extra data: +2 s16 block type, then 8 bytes per panel
  (+4 flags, +5 base sprite, +8 length). Sprite choice (0x80039508; head / body):
  16 normal arrow (base, or 8 when no length) / 8; 17 base+9 (flag 0x8), +18 (0x2), +27 (0x4);
  18 base+36 / base+9; 19 63 / base+54 (0x8) or +45; 21 64 (0x8) or 65.
  Block type 11 is not drawn here: it is the type the judge sends to the hand-move window (row 4).
  **(What 17-21 are on screen - freeze, shock, etc. - is not confirmed.)**
- Chain rule (0x80037ae0): notes flagged 0x30000 link to the next same-group note exactly one beat
  (1024) later on the same panels; skipped only in score mode 2 unless option bit 0x4 (= force gimmicks on).

## Play styles and inputs (style table 0x80270118, 324 bytes per style)

+120 lane used by hand notes (block types 11 and 13), +124 lane count, +132 lanes of 24 bytes
[lane, input bits, input bits 2, hand?, hand bits, ?]. Six styles:

| style | lanes | input bits per lane | meaning (read from the bits) |
|---|---|---|---|
| 0 | 4 | 1 2 4 8 | single |
| 1 | 8 | 1 2 4 8, 256 512 1024 2048 | double |
| 2 | 6 | 1 2 4 8, 16 32 | four panels + two extra inputs |
| 3 | 6 (4-5 used) | lanes 4/5: 0x10000 / 0x20000 (+0x80000 / 0x100000) | hands only |
| 4 | 6 | 1 2 4 8 + hands | Hypermove: feet + hands |
| 5 | 6 | all four panels on 0x40000 + hands | one shared panel input + hands |

- Hands: left 0x10000, right 0x20000, each with a second bit (0x80000 / 0x100000).
- Note block types 11 and 13 are hand notes (drawn / judged on the style's hand lane).
- Debug option "HAND" is ON / OFF (hand moves used or not).
- **Not decoded yet:** the motion reading that sets the hand bits, and what each chart move code means.

## Judging (normal arrows)

- Judge 0x8002d484, windows table 0x8026f638 (row 0 for mat steps). Early limits in ticks:
  Almost -25, Good -25, Great -16, Perfect -6, Marvelous -2 (see web/game.js for the full rows).
- Play-option bits 0x1/0x8 = auto play (the judge's automatic path; the demo uses 9).
- All window rows (0x8026f638, 40 bytes: early M.. then late, order Almost, Good, Great, Perfect, Marvelous):

  | row | early (Almost..Marvelous) | late (Almost..Marvelous) | used for |
  |---|---|---|---|
  | 0 | -25 -25 -16 -6 -2 | 30 30 15 7 2 | mat steps |
  | 1 | -3 -3 -3 -3 -3 | 22 22 22 9 3 | index 1/4 **(which setting: not traced)** |
  | 2 | -26 -26 -17 -7 -2 | 31 31 16 8 2 | index 2 |
  | 3 | -25 -25 -25 -6 -2 | 30 30 15 7 2 | index 3 |
  | 4 | -3 -3 -3 -3 -3 | 30 30 30 30 30 | **hand moves** (note flag 0x10, hand value 11) |

  Judge order (0x8002d528): Marvelous window first, then Perfect, Great, Good, Almost; outside all = BOO.
  Hand moves therefore score MARVELOUS anywhere from 3 ticks early to 30 ticks late, else BOO.
  Normal steps (note flag 0x2) take row index_table[player +108] (index table 0x8026f620 = 0 1 2 3 1 0);
  +104/+108 come from a 5-word record handed to the player setup (0x800339f4).
  **Open question:** the row index looks like selection field +20 (getter 0x80028048, setter 0x80028034),
  which song select sets to 1 by default and 4 for play types 2 and 9 - both map to row 1, not row 0.
  Row 0 matches standard DDR timing and is what the PC version uses; the 0x80041a9c -> 0x800339f4 copy
  chain (or the sign of 'early') may be misread. Check in Dolphin: player +108 during a normal song.

## Score (0x80037dd4)

Counters per judgment (BOO, ALMOST, GOOD, GREAT, PERFECT, MARVELOUS) and freezes (OK).
Mode from the player's option flags: 0x10000 -> mode 2, 0x40000 -> mode 1, else mode 0.

| mode | weights B/A/G/Gr/P/M | freeze OK | x | step denominator | after | scale |
|---|---|---|---|---|---|---|
| 0 normal | 0 0 0 1 2 2 | 2 | 100000 | 2 per step/freeze | minus GREATs + PERFECTs, not below 0 | x10 |
| 1 (game mode 8, demo) | 0 0 0 1 2 3 | 3 | 1000000 | 3 per step/freeze | nothing | x1 |
| 2 (dummy song only) | 0 0 0 1 2 2 | 2 | 100000 | 2 | minus GREATs | x10 |

Tables: weights 0x8026f718 (7 ints per mode), freeze 0x8026f770, multiplier 0x8026f700, scale 0x8026f70c.

## Grades, gauge, levels

- Dance level / grade 0x80037f4c, cut-offs per difficulty 0x8026f7d0.
- Life gauge 0x8003806c / 0x800381fc: starts 500, max 1000; deltas by difficulty 0x8026f8d0,
  BOO-streak loss multiplier 0x8026f8a0.
- GAME LEVEL table 0x8026f860 (8 rows of [gain, loss] multipliers, default index 3).
- Play points table 0x8027a4ac. Calories 0x80038d58.

## Modes and tables

- Game mode is the select record +196 / game +188. Mode 0 = Tournament (reads its table),
  mode 8 = demo play.
- Courses / workouts: 0x8027B688 (20 rows of 6 ints, slot = value + 1).
- Unlocks: 0x8027BF38 rows [points, type, id, a, b, c]; type 1 song, 2 outfit/character, 7 Mii.
- Tournament: 0x80279560 (32 requests), pools 0x80279420.
- Demo play: 0x8027b878, 16 entries of 6 bytes [type, dancers, song code, difficulty index, -];
  title waits 1200 frames (20 s, 0x800e1988) then plays the next entry. Song code 1000 = any song;
  a slot gets 0/2/4 added at random (0x8004be98). Type 6 = stage 18. Play flags 9 (auto), score mode 1,
  any button quits.

## Dancers, dances, stages

- Dancer choice 0x8004a728 (CSelect::setPlayerChr): 9 main dancers ids 200-208 (files CHR201-209).
  RANDOM picks an unlocked one not used by another player; outfit = rand % 2, but outfit 0 unless the
  second outfit is unlocked (unlock table type 2). Lists built by 0x8004b16c.
- Dance routine 0x80119844: flag 0x200000 -> random from the BPM pool (< 120, 120-140, > 140; tables at
  0x80290f88); else flag 0x40 -> HP2U_008; else fixed table 0x80291258 (key = slot + 1).
- Stage 0x8003d1f0: song DB +8 if not -1; -1 with flags 0x30000 = none; else the select screen's
  choice (0x8004c0f4): random among unlocked stages 10-29 not used recently. File = stage/STG(id+1).bin.
- Stage files are WII archives: [models, cameras, effects (TEB + TPL), STGnnn_Prm (ZAR tables)].
  The model archive's names are 64-byte slots: DRAW_ (stage), BG_ (background), COL_ (not drawn; it
  holds the spots EFF_aa_bb, LIGPOS_nn / LIGTAR_nn, OBJSET_<prop>_nn), OBJA_/OBJB_<x>_<prop>_<sfx>
  (props drawn at every OBJSET_<prop>_nn spot; pv screens come as _43 / _CE / _WI, one is used).
  Material colours are Maya placeholders (green / yellow / cyan); parts are coloured by vertex colour.
- Gameplay cameras: game/GAME_DEF_CAM.bin, 3 groups (86/48/22 moves), times in seconds; 0x8005c540
  (group, index): the group is the dance part being danced, the index one of that part's .cam moves.

### Dance cue sheets (dance/DANCE_<series>_<nnn>_<part><vv>_FRE.bin)
- WII container [ZAR table, position model, the part's camera moves (.cam, GAME_DEF_CAM format)].
- ZAR table (generic: B+16 schema, B+20 data; 0x8018d070): one row = 12-byte header (u32 count at +4)
  + count 52-byte events, merged over the song by 0x80119f0c (intro, loops, end), read by 0x8011ab4c
  (type accessors 0x802918b8):
  +0 f32 time (s at the dance tempo), +4 f32, +8 u32 position (4096 = one measure), +12 f32 tempo,
  +16/+20 type 0 motion clip, +24/+28 type 1 (second motion set), +32/+36 type 4 camera move (index
  in the part's .cam list, f32 how long to show it), +40 type 5, +41 type 6 light preset
  (0x80113098), +42 type 7 effect group (0x80112d9c), +43 types 2/3, +44 type 8 (on/off toggle),
  +45/+46 types 9/10 with +48 f32 (0x80113838). Header row has time -1. HP1C sheets use another layout.

### Stage effects
- Effect banks: 1 = game/GAME_STG_EFF.bin ddr3_stage.TEB (63 effects) + ge.tpl (47 textures);
  5 = the stage's own TEB + TPL. Effect manager scale 10.0 (0x80178278, +676).
- 260 effect slots at 0x802bd620 (16 bytes: name, effect, f32, 0; names filled in by 0x800f3210):
  slot -> spot EFF_<name> + effect in bank 1. Played by 0x80052e1c at the spot's matrix.
- Per stage table (0x8028d190 + 14304 + 24*(id-10) for 10-29, + 14112 + 24*id for 0-7; 200/201/19
  their own; 0x80115e10 / 0x801160a8 -> 0x801157cc): u32, u32 preset mask, f32, -> 8 effect groups
  (8 slots each, 0x104 ends, negative n = n + 260), -> 8 light presets of 148 bytes (only preset 0 is
  filled: [?, ambient, 1], power, ..., colour at +116), -> 2 floats (1.9, 21). Stages 20-29 have no
  effect groups. A cue's effect group plays every slot of the group.
- Stage's own effects: EFF_03_xx spots, effect per spot from STGnnn_Prm entry 1 (3-byte rows:
  effect, ?, ?); played over and over by 0x80052ffc (bank 5).
- Stage screens (Prm entry 0, read by 0x80055590; format strings at 0x802713ec +93/+115/+132..213/
  +240/+259): kind 0 stage/upt01, 1 bgv/<name>, 2 stage/<fvo|mvo|pop|upt>_<name>0<1-3> (by mode
  1 upt / 2 pop / 4 mvo / 5 fvo, random 1-3), 3 stage/<name> (single02, single05-07), 4 zz_pv/ddr<song>.
  Shown on every plain white "monitor*.tga" picture (stage or prop; not monitor_mask). Stages 12, 13,
  16, 17, 20, 23-26 (STG103/104/107/108) are a box of these screens around the dancer.
- ZMB texture table (header +0x18) in DDR II: u16 pictures, u16 names, u32 0, u32 offset of 32-byte
  names (HP2's form is a u32 count).
- Material byte 2 low values 1 / 3: drawn blended in model order without writing depth (floors and the
  glow strips lying flat on them); 0x81 additive glow, 0x83 cut-out.
- STG_SILHOUETTE01-03.tpl: 40-frame animated backdrops (bubbles, sparks, "DANCE"), loaded when the
  song's presentation record (+80 of the load request, +28 <= 2) asks for one **(which songs: not decoded)**.

### TEB particle format (teb.py)
- Header 'TEB\0', f32 version (0 old / 0.01 new), +0x10 effect table, +0x14 u16 count. Effect: u32
  node list, u8 node count. Node: u8 child, u8 brother, u8 type (0 transform / 1 particle part), u32 data.
- Key tracks: u32 count, u32 -> 20-byte {key count, keys, f32 t0, f32 t1, u8 smooth}; keys 32 bytes
  {t, x, y, z, quaternion}. A node emits only while one of its tracks runs (0x8017dc0c).
- Part header (52 new / 48 old): flags, offsets of emitter (0x1), acceleration (0x2), look (0x4),
  child link (0x8), light (0x10), rotation (0x20), scale (0x40), sphere, ring, [?], key tracks, u8
  shape (0 box 0x8017ac48, 1 sphere 0x8017ade0, 2 ring 0x8017b010). Flags 0x80 move with emitter,
  0x200 no depth test, 0x400 flip cells, 0x800 loop instead of dying.
- Emitter (52): life, ±, interval, box xyz, cone xyz, speed, ±, s16 max, s16 burst, u8 billboard.
- Look (48): flags (0x2 cells, 0x20 colour keys), colours, size0 xy, size1 xy, size curve, alpha curve,
  cells {u16 texW, u16 cellW, f32 time, u8 count}, u8 counts, u8 blend (2 = added), s16 texture,
  u8 colour count, random size % lo/hi. Curves are (t, v) pairs, linear (0x80180800).
- Particle step 0x8017b2bc: pos = start + dir*speed*age + accel*age^2/2, orbit, sprite spin; draw
  0x8017cb28 (blended parts first, then added ones; quads ±0.5).

## Menus (2D layouts and animations)

- The menu files (select/selTitle, selMusic, selResult, select_bin, select_cmn, 2Dcommon/comAF) are WII
  archives holding TPL textures and **CAE_WII** blocks: every menu piece's position and animation.
  Decoder: cae.py (served as /api/cae/<mus|res|ttl|sel|scm|af>). All 160 blocks / ~1,560 parts decode.
- Block: 'CAE_WII', u16 part count (+8), u32 part table offset (+12). Part (32 bytes): name[16],
  u16 sprite, u16 parent, u16 flags (0x100 = has parent), 3 x u16, u32 track-header offset.
  Track header (16 bytes): u16 kind (0x20 / 0x10), u16 sub, -, u16 fps (30), -, u16 count, u32 script.
- Script: (command, value) float pairs ending with command 0, played at 30 fps:
  8 X, 9 Y, 24 opacity 0-255, 21 wait N frames, 14/15 scale X/Y, 16 rotation;
  inferred: 22 looping wait, 13 uniform scale, 18 angle (degrees), 1/12 sprite cells, 6/7 pivot,
  31/32 drawn size; 4, 5, 17, 33-36 always 0 so far.
  Example: the song-select number badge slides in from X 608 to 408 over 10 frames (after a 3-frame
  wait) while fading 0 -> 255, and its second track slides it back out.
- The script player in main.dol is not found yet (it compares command numbers as floats).
- The in-song HUD uses the same format: game/GAME_CMN_US.bin has 15 CAE blocks - READY / GO,
  FULL COMBO (3 colour versions), FINISH, FAILED, combo break, combo / arrival counters, the song banner
  and credit, the MEASURE window, FIXED CAMERA, and the lane backboard with its lines and glow.

## Menu flow and screens (select/select_bin_us.bin)

- Flow (from a recording of the real game): TITLE -> SELECT MODE -> SELECT NUMBER OF PLAYERS -> SELECT RECORD
  DATA (per player) -> SELECT STYLE -> SELECT MUSIC (OPTIONS from there) -> song length -> difficulty.
- select_bin groups (WII archive, TPL pictures): 0 SELECT MODE (cards 1-4 /0/1/0/0, card shapes /0/1/0/1-4,
  card names /0/1/0/5, "SELECT MODE" /0/2/0/0, mode names /0/2/0/1, help lines /0/2/0/2, one dancer + white
  shape per mode /0/3-6/0/0-1); 1 SELECT NUMBER OF PLAYERS / STYLE (title /1/0/0/0, message window /1/0/0/1,
  cards /1/1/0/0: 1-4 players, SYNC. GUEST, NORMAL, FRIENDSHIP, SYNC, DOUBLE; highlight /1/1/0/1);
  2 dancer select; 3 SELECT STAGE (26 stage pictures + names); 4 backup dancers / Mii; 5 name / weight /
  password entry; 9 player data / diary (record window /9/4/0/2/0, GUEST /9/4/0/2/1); 10 options.
- Layouts (CAE, Wii 640 x 480): SELECT MODE cards at (324,103) (468,103) (394,254) (538,254), chosen card
  scale 1, others 0.7, the lower row mirrored below at alpha 64; the dancer at about (180,216); mode name
  (128,351) scale 0.75 x 0.675; help (331,378); "SELECT MODE" (216,405) with a mirror at (216,436).
  Record data: a 3 x 2 grid of record windows at (165|320|475, 135|266), scale 0.9. The message window is
  570 x 136 centred at (319,350).
- Mode help: "The main mode for music fitness." / "Exercise with DDR to burn calories!" / "Practice
  difficult songs." / "Learn the basics of DDR." Style help (text_eng): NORMAL "For 1 player. Normal
  gameplay.", DOUBLE "For 1 player only. This style is playable with 2 DDR Controllers.", and two group
  styles: highest judgment shared by all, or lowest accuracy (a MISS fails everyone) - assumed FRIENDSHIP
  and SYNC in that order **(check)**.
- OPTIONS: a 3 x 3 grid (INDIVIDUAL OPTIONS | ASSIST | SAVE / GAME PLAY | DANCE | CREDIT / GRAPHIC |
  USER SUPPORT | CONFIRM); INDIVIDUAL OPTIONS is its own grid (SPEED | SCROLL | EVALUATION / FREEZE ARROW |
  ARROW | GUIDELINE / ROTATE | JUMP | CUT / CONFIRM). DEFAULT asks "reset the individual options" inside it,
  "reset everything other than the individual options" outside. Pages list PLAYER 1-4, PARTY, CONFIRM.
- Option values (text_eng entry 1) and help (entry 8): EVALUATION NORMAL / COMBO / JUDGMENT ONLY / ALL =
  judgment and combo drawn over the arrows / combo under them / judgment under / both under (draw order:
  real-game shots on the default setting show the combo covering arrows that pass through it); ARROW VIVID (default) / NOTE / FLAT / RAINBOW; GUIDELINE
  DEFAULT (beginner only) / ALL / OFF; VOICE ALL / OFF / NO BOOING; GAME OVER NORMAL / END OF SONG;
  SAVE page: AUTO SAVE, SAVE; GRAPHIC page (seen): MARVELOUS, TIMING, COMBO PERFORMANCE, BUTTON WARNING.
- Full-combo tiers (the disc's FULL COMBO banners, result-screen pictures and crowns come in four
  colours): MARVELOUS = white-blue, PERFECT = gold, GREAT = green, GOOD = blue-purple. The combo count
  takes the colour of the tier you're on track for; once the combo has broken it's green (seen in the
  real game);
  the word "combo" starts 13.5% of the lanes' width left of their centre, the count ends 21% left of it,
  about 97 px (on 720) under the judgment.
- FRIENDSHIP / SYNC (implemented from the help text): every player dances the same chart; each step's
  judgments are pooled and everyone gets the best (FRIENDSHIP) or the worst (SYNC; a MISS or Almost fails
  the group). Freeze arrows' O.K. / N.G. stay each player's own **(check)**.
- SELECT STAGE (select_bin group 3): 26 stage pictures No.1-26 (some drawn twice), names in text_eng
  entry 2 (Street Show, The Vision, Silent Dome, Dance Truck, Purple Note, Success Colors, Sea Carnival,
  Underground, All Systems On, EVOLUTION, DDR Sports, DDR, Bridge, Psyche, Ascension, Reflexion, Premium,
  Voyeur, Wired, 2nd Home, Mid Hills, Liquid, Spaceborn, Echos, Cosmisphere, TERRA), filters RANDOM /
  No.01-No.10, No.26 / No.11-No.25 / No.01-No.10. Stage files: STG011-020 hold DDR II's stages 101-110
  (STG021-023 repeat 108-110, STG013/017/024 are tiny), STG028-030 hold 001-003, STG4xx are light-only
  stages with "bgv01" (a background video). Which picture is which file and when the screen is shown:
  **not found yet**.
- DDR SCHOOL: 15 lessons, ssq/Lss4/LESSON01-15.ss4 (main.dol 0x80118724 loads LESSON%02d when the song id
  is >= 200, numbered by the song's +96). 1-6 STEP LESSON, 7-11 CHOREOGRAPH, 12-15 Wii Balance Board.
  Step lessons are style 0x1a charts: lane 4 / 5 = the foot, the arrow in the flag's second byte (0 up,
  2 right, 4 down, 6 left), 0x100 = freeze end; 120 BPM from 0. **Music (decoded 2026-11-15):** the sound
  table (SNDTAB 0x8027A5B8, 20 bytes a song) has the lessons as songs 201-215, no voice track: step lessons
  1-6 all group 200 / music 577, CHOREOGRAPH 1-5 groups 201-205, balance board 206, 206, 206, 207. So a lesson
  plays slot 200 + n, not "Lesson by DJ" (slot 137) as assumed before. Teacher's words: text_eng entry 14, lines 1-6 step, 7-11
  choreograph, 14-17 balance board (12-13 MINIMIZER / DIAGONAL and 18 HAND MARKERS are unused leftovers).
  SELECT LESSON = select_bin group 11 (plates, six teacher poses, speech windows by kind, grades E-AAA,
  crowns, BEGIN LESSONS); layout: plate (338,98), grade (492.8,98), crown (464.5,91), teacher (190,312),
  window (399,248), arrows (278|559, 387), button (418,387). Seen in the real game (classic play): only the
  6 step lessons ("1/6" in the dark box at (545,98)), the window dark blue until the lesson is cleared,
  then light blue; the arrows wrap round. The US file's choreograph / balance board plates are in German
  (those lessons, the hand markers, CHOREOGRAPH / balance board pictures and the HIGH / LOW announcer are
  leftovers from the previous game: DDR II itself has no hand or balance board play).
- Start-up (real game, timed from a recording): wrist strap 1 (3 s), strap 2 (3.5 s) - logo/logo_ENG.tpl
  0-1; KONAMI (logo_ENG 2, 0.5 s fades); WARNING "Loading." in comAF /4/1/0/0 #1 over the darkened menu
  background while loading; NOTICE (selTitle group 1: NOTICE, the text, DOLBY, (C)); white flash; the
  opening movie movie/select/OP.thp (480 x 864, stored a quarter turn clockwise, 21 s, with sound); title
  (selTitle group 3-5: logo, emblem arrow, ripples, starfield, "Let's dance!" - "Point at the screen" with a
  Wii Remote). font/font_us.bin: a 16 x 13 grid of 20 x 24 letters, then 10 banners (WARNING!, SONG
  CLEARED!! ...). On a 16:9 screen the game draws its 640 x 480 menu layouts centred at 1.5x.
- ZMB faces (stages and dancers) are triangle strips, not fans (checked against the stored normals).
  Meshes with no skin weights (bracelets, wings) are in their node's space.
- Dance files are made for the dancers' own skeleton: each track's position is exactly the bone's rest
  offset, and its rotation is the bone's local rotation - so they drive the model directly (no
  retargeting). Where the game places the dancer on the stage (the hips' travel) isn't read yet.
- The staff credits are text_eng.bin entry 10 ("#cf" = a job title, "#cd" = a company heading).

## Player structure (song start reset, 0x8003552c)

- Life gauge 500 at +0x582C0 (-32064 from +0x60000); judgment counters (6) at -32036;
  freeze counters (3) at -31972; score at -32072; option flags at +40.

## Options screen (CselOptItem* classes; labels from text/text_eng.bin entry 1, help in entry 8)

The game's player options: SPEED (x0.5-x8.0), MUSIC SPEED, TURN (NORMAL / MIRROR / LEFT / RIGHT / SHUFFLE),
SCROLL (NORMAL / REVERSE), ARROW colours (VIVID / NOTE / FLAT / RAINBOW), FREEZE, JUMP, MARVELOUS, GIMMICK
(ALL / OFF / ...), PUNCH markers, CUT, GUIDE LINE, TIMING EVALUATION (colours early / late steps;
TYPE 1 / TYPE 2), TIMING A (GREAT / GOOD?), METRONOME, HAND CLAP, VOICE, COMBO PERFORMANCE
(NORMAL / COMBO / JUDGMENT ONLY), MOVIE (PICTURES / LAST APPEAL / ...), CAMERA WORK
(DEFAULT / FRONT ONLY / ALL CAMERAS), APPEAL, BACKGROUND DANCER, DANCER SET (NORMAL / Mii / RANDOM),
BELOW (DEFAULT / BELOW), GAME LEVEL, GAME OVER (NORMAL / END OF SONG), AUTO SAVE, DDR MAT, WORKOUT GOAL /
MENU, and the A/B button warning. Which label belongs to which option is inferred from order **(check)**.
- GAME LEVEL labels (easiest first): EASIEST, VERY EASY, EASY, MEDIUM, MEDIUM HARD, HARD, VERY HARD,
  HARDEST. The gauge rows run hardest..easiest, so the default row 3 (x1.0) reads MEDIUM HARD.
- Gimmick arrow names from the lesson text: MINIMIZER and NORMALIZER (and punch markers).
- Option button pictures (select file /10/8, big): ARROW, ASSIST, CONFIRM, CREDIT, CUT, EVALUATION,
  FREEZE ARROW, GAME PLAY, GRAPHIC, GUIDELINE, INDIVIDUAL OPTIONS, JUMP, ROTATE, SAVE, SCROLL, SPEED,
  USER SUPPORT, DANCE. Row pictures (/10/9, small): AUTO SAVE, COMBO PERFORMANCE, CONFIRM, CUT, FULL COMBO
  APPEAL, GAME LEVEL, GAME OVER, GOAL, HANDCLAP, JUMP, MARVELOUS, MENU, METRONOME, MOVIES, MUSIC SPEED,
  PARTY, PLAYER 1-4, SAVE, SONG, TIMING, TIMING EVALUATION, VOICE, COMBO ...
- Values and help (text_eng entries 1 / 8): GUIDELINE = BEGINNER only / all / off; VOICE = ALL / OFF /
  NO BOOING; GAME OVER = NORMAL / END OF SONG (play on with an empty gauge); SCROLL = NORMAL / REVERSE;
  ARROW = VIVID (default colour) / NOTE (by timing) / FLAT / RAINBOW (changes); TIMING EVALUATION colours
  the steps blue (early) / pink (late); CAMERA WORK = DEFAULT (by mode) / FRONT ONLY / ALL CAMERAS;
  APPEAL (FULL COMBO APPEAL) = NORMAL / LAST APPEAL; COMBO PERFORMANCE (lighting show at combo 50) ON/OFF;
  MOVIE = normal / PICTURES; BACKUP DANCER = NORMAL / Mii / RANDOM; judgment ABOVE / BELOW the arrows.
- The crowd (0x80026b10, state at +0x301068.., next-allowed position +0x30109c): READY -> SE_DDR_CHEER01
  (looped, RWAV loop point) for 6 s, then a 5 s fade; HERE WE GO -> fade, none for 7 measures. The gauge
  routine 0x800381fc flags each change: gauge > 700 or combo (+0x5833 4, i.e. -31948) > 12 = good, gauge <
  200 = bad. Good -> CHEER02 (looped, 6 s); bad -> CHEER03 (once); then 17 measures before the next. The
  enabling bits are player option bits 0x01000000 (cheers) / 0x02000000 (boos) - taken here as VOICE ALL /
  NO BOOING **(check)**. A cleared song ends with CHEER02. The HIGH / LOW / RANDOM / MULTI announcer lines
  (0x800d2114 and its siblings, a 9-digit-score screen) belong to the motion modes, not classic play: every
  so often, meter >= 165 -> HIGH or RANDOM (50/50), < 60 -> LOW HARD / LOW EASY, else RANDOM.
- In-game sounds 0x80026b10: HANDCLAP SE 629 on judged steps; METRONOME SE 630 on the first beat of a
  measure, 631 on the others; crowd cheers SE 623-625 by state; announcer 0x800d2114 (VO 747 HIGH,
  748/749 LOW HARD/EASY, 750 RANDOM, 782 MULTI) **(when each plays: not decoded)**.

## Save data (records)

- Save object at -29376(r13). Player profiles: profile n = save + n * 40560 + 4772 (0x8009b9e0).
- Per-song record: profile + 64 + song * 184, indexed [group 0-3][difficulty 0-4]:
  +0 u32 play count (sorting comparator 0x8006f518 adds full + cut versions);
  +4 u32 best score [4][5]; +84 u16 best max combo [4][5]; +124 u8 best clear level [4][5] (0 = none,
  higher = better; only written when the new value is non-zero); +144 s8 best grade [4][5]
  (-1 = never played, higher = better); +164 u8 "new record" marks [4][5].
- Writer 0x800e9374 (after a song): play count + 1 (capped); songs 92-97 count as one group (playing
  any of them adds 1 to all six). Then for the chart [group][difficulty] (only if group <= 3 and the new
  grade >= 0): each of grade / score / max combo / clear level is kept if the old value is higher,
  otherwise replaced. When the "show new" setting is on, +164 gets 0x8 (better grade), 0x1 (better
  score or combo) and 0x4 (better clear level); a bit is cleared when that value did not improve.
- Course records: profile + 0x10000 - 28672 + course * 184 (same 184-byte shape).
- ORDER EDIT (custom orders): save + 0x30000 - 29596 + set * 144 + order * 24: six song numbers per
  order (-1 = empty, 1002 = end), 2 sets x 6 orders (0x8009b9f8).
- Unlock bits: a bitset read by 0x8009bad8 / 0x8009bc1c (one bit per item id: word id>>5, bit id&31).

## Not decoded yet

- Opponent / battle score rule (HP2 and DDR II), chunk 17, silhouette backdrops, cue types 1/5/8-10,
  light preset switching (presets 1-7 are empty),
  Hypermove note kinds, menu and HUD animation data.

## Dance clips and cue sheets (checked against Unbelievable (Sparky remix) footage)
- Every MOT clip is one measure; its frame count is in the ZAB header +0x10 (144 in HP2U, 84-120 in
  HP3U/HP3J/HP4U/HP5U). dance.py rescales keys to 144 frames.
- The part's FRE cue sheet picks the clip: 'mot' = clip index starting at measure m, 'k1' = [clip,
  seconds it spans]. HP2U S sheets start at clip 1 (clip 0 unused); later dances repeat clips at
  quarter measures. Part length = last cue's measure + 1.
- HP4U_053-055 (Unbelievable etc.) are authored Z-up with the hips near the origin: the dancers fly
  lying flat through stage 200's tunnel (OBJA_Z_DRAW109 / hole01 in STG201). **How the game switches
  from the island (DRAW_STG201_01) to the tunnel and the glowing white dancer look: not decoded yet.**
- Dancers per song (Dolphin FileMon logs, 2026-11-14): a normal song loads only the player's dancer
  (CHRnnn00 + its outfit file) plus one stage/STG_SILHOUETTE0n.tpl (01/02/03 varies by song) - the
  animated silhouette backdrop - and two small stages (STG421 + STG406, or STG418 + STG405 on the boss
  stage) and STGChgWipe. The boss stage (200) loads three dancers: CHR207, CHR208, CHR209 (the player
  had picked CHR208), outfit files 01, plus accessory/AccRHand_HP4C_03.bin. **Whether the boss trio is
  fixed or built around the player's pick: one sample only.**
- Dancer list for the load (0x8003f8e0 adds up to 5 records of 56 bytes at +724 of the game object,
  count at +720; 0x80118e54 loads CHR%02d00 + CHR%02d%02d per record).
- Backup silhouettes (seen in Dolphin footage of Wings of an Angel): two copies of the player's own
  dancer either side, drawn with the STG_SILHOUETTE0n picture (01 blue bubbles, 02 orange sparks,
  03 pink "DANCE"; 40 frames of 256x128) instead of their textures. Which picture: the load request's
  +80 points at main.dol's stage record table 0x802b8eb0 (32 bytes each, record = stage id - 4); its
  +28 = 0-2 picks STG_SILHOUETTE01-03, anything else = no silhouettes (stages 20-29: none). Read from a
  Dolphin MEM1 dump (stage 13, record 9, +28 = 2, pink "DANCE") and matches all logged stages
  (16 -> 01, 11 -> 02, 14 -> 03). **Their exact spots and whether they lag the lead: not decoded.**
- Formations (dance FRE entry 1): <series>_s1_pos_NN.zmb nodes s1_pos_NN_01 (lead) .. _05 and s1_look_NN;
  HP2U keeps all 69 in one file, the later series one per file. The cue column k5 picks the formation
  (index in file order). The backups (silhouettes, boss dancers) stand at spots _02/_03 relative to the
  lead's _01; a missing spot hides that dancer. The cue sheet's getter table 0x802918b8 maps channels:
  0 mot, 1 k1 (second motion), 2/3 byte +43, 4 cam, 5 k5, 6 light, 7 fx, 8-10 bytes +44..+46.
- Video stages 27/28/29 (STG028 moon and snow, STG029 circuit world, STG030 water cave; the licensed and
  video songs' fixed stages): no dancer, a fixed head-on camera on the framed monitor OBJB_Z_pv03_WI
  (right of the arrows), playing the song's zz_pv video, else the stage movie (Dolphin footage).
  OBJB_Z_ models are drawn (they were wrongly skipped as "dancer boxes"; they are the pv monitors and
  the bubble / planet props).
- Random stage pool (decoded): 0x8004b16c lists every stage id 0-53 whose bit is set in the save's
  stage bits (save object +32, bit n = stage n; 0x8009bbcc tests, 0x8009ba94 sets); 0x8004c0f4 draws
  among those in 10-29 not used recently (song DB stage code -1 / 1000). A new save gets 0x3fc00 =
  stages 10-17 (0x8009ac64, 0x8009b59c), and the player's real save (Dolphin MEM1) still had exactly
  those. Stage codes 1001-1003 draw from ids 30-53 / ... / 0-7. Stage records: 32 bytes at
  0x802b8930 (ids 40-54), 0x802b8c30 (60-70), 0x802b8e70 (0-7), 0x802b8f70 (10-29), 0x802b9310 (200-205)
  (0x80027a74).
- Stage unlocks (searched): nothing in normal play unlocks a stage. The only stage-bit setter is reward
  type 3 in 0x8010d0d0, and the reward list it reads (+64) is merged by 0x8010bb64 from three builders
  only: the points table 0x8027bf38 (172 entries, types 1 song / 2 outfit / 7), 0x8010c448 (types 9/10,
  song-set tables 0x8027b688 / 0x8027b778) and 0x8010cbcc (types 11/12, 0x8027cf70). None makes a type-3
  entry; lists +68/+76/+88 are only ever cleared (0x8010b898 / 0x8010b978). So the random pool stays
  10-17 for good. The other stages are reached only by being pinned: song DB +8 stage code 27/28/29
  (video songs), 18 (slots 136-141, empty records on this disc) and 19 (slot 200, empty), demo type 6
  (stage 18), and Groove Circuit's own table 0x80279560 (4 areas x 8 events of 68 bytes, +8 = stage id
  40-69; read by 0x800de9d4). STG021-027 (ids 20-26) are copies of 17/18/19 and STG103-based screens
  that no table or code path names; they look unused.

## How the game draws a model (main.dol 0x8014fac8, the ZMB mesh renderer) 
GX functions identified: 0x801d7110 GXSetBlendMode, 0x801d7200 GXSetZMode, 0x801d6b70 GXSetAlphaCompare,
0x801d5120 GXSetChanCtrl, 0x801d5010 GXSetChanAmbColor, 0x801d4f30 GXSetChanMatColor, 0x801d6c40
GXSetTevOrder, 0x801d6700 GXSetTevOp, 0x801d67a0/67e0 GXSetTevColorIn/AlphaIn (a<<12 b<<8 c<<4 d),
0x801d6820/6880 GXSetTevColorOp/AlphaOp, 0x801d3000 GXSetTexCoordGen, 0x801d79d0 GXLoadTexMtx.
Material record (0x38 bytes): +0..3 material (diffuse) RGBA, +4..7 ambient RGBA, +16 lit flag,
+18 blend kind (low 7 bits), +19 special shader (1 / other -> 0x8015b2d8 / 0x8015abc8), +20 light
mask, +24 texture list, +31 texture-matrix (scrolling) flag, +44 second material (for the 2nd pass).
- Channel COLOR0A0 = vertex colour, unlit. If +16 (lit): channel COLOR1A1 = material colour
  (+0, times the object tint obj+60..63 / 255) x (ambient +4 + the stage lights in the mask).
- TEV: stage 0 = texture x COLOR0A0 (vertex colour) -> C0; lit: stage 1 = C0 - C0 x (1 - lighting)
  = texture x vertex colour x lighting. Unlit materials ignore the material colour entirely.

Decoded further (and checked against a MEM1 dump taken during play, Rena on stage 13):
- Record size: 0x50 in most stage ZMBs (0x38 in some); obj+184 holds it. Byte +16 = lit, +18 =
  blend kind | 0x80 flag, +19 = special shader, +31 = texture scroll. In every stage material that is
  lit, the ambient colour equals the material colour.
- The lit path is used only when the object's light mask obj+168 is non-zero (else +16 is ignored).
  0x80052bc8 sets obj+168 for every stage model in the groups of mask 123 (all but group 2); the
  group is the name prefix's index in the table at 0x802b9684: 0 DRAW_, 1 BG_, 2 COL_, 3 OBJA_N_,
  4 OBJA_Z_, 5 OBJB_N_, 6 OBJB_Z_. The value is light set kind 1's mask (0x80062cd0).
- Light set (148-byte lights x 8 at the stage controller's +88; GXLightObj at +0, +64 on, +68 world
  position, +80 direction, +92 colour, masks per kind at +1184): loaded each frame by 0x8006295c
  (GXInitLightColor/Pos/Dir, spot off, distance attenuation off = no fall-off).
  0x80114fa4 sets light 0 for kinds 0 and 1: a directional light (position 1e18 behind) shining from
  the camera's eye toward its target, colour = the controller's current colour state (+5160 + 1144 x
  state, bytes +20..22): white in states 0-2, 7f7f7f in 3-4; state 0 during play. Light 1 comes out
  zero-length and is never on. Light 7: grey, on for no kind. Dump: light 0 white, dir (0.70,-0.09,
  -0.71) = normalize(target - eye) of the camera at that moment; kind 0 and kind 1 masks = 1.
- So a lit stage part = texture x vertex colour x clamp(ambient + white x max(N.L, 0)) x material,
  per vertex; an unlit one = texture x vertex colour.
- Blend kind (0x80177184): 0 and 3 = blended by alpha (SRCALPHA, INVSRCALPHA); 1 = added (SRCALPHA,
  ONE) with no depth write; 2 = (ZERO, INVSRCALPHA). Kinds 1-3 alpha-test (alpha > 160, or > 0 when
  bit 0x80 is set) unless the material has a second layer; kind 0 does not test.
- Fog: 0x801438a4 would set white linear fog (10-1000), but only while the fog manager's +580 is 1;
  it is 0 during play, so there is no fog.
- Drawing order: each model draws its nodes and meshes in file order (0x8014ed4c), no sorting.
- Material tag (s16 at record +40, 0 = none), matched by 0x8015d920 (tag = id + 1):
  - 91-100: the stage movie screens. 0x8004d77c lists the textures of materials tagged 90+k+1 at
    obj+516; each frame 0x8004d91c puts the stage's movie player (0x80025368) in model+96[texture],
    which the renderer loads instead of the texture (0x8014fd94). This replaces the old "plain white
    texture = screen" guess. (101-110: model+92[texture] = another texture object; unused in DDR II.)
  - 11-90: light channel (tag - 11) // 10, slot (tag - 11) % 10 (obj+196 table). Only the boss
    stages (STG201-206) use them.
- Light channels: the controller's state (+5160, 8 channels x 120 bytes) holds per channel a current
  colour (+132), target (+136), fade floats and a 16-colour palette (+24). Cue column 6 picks a light
  preset (0x80113098): preset mask bit set -> the channel fades to the preset colour; clear -> it
  picks random palette colours (0x80131c0c). 0x80114fa4 then writes each channel's colour to the
  stage's channel table (0x80052cd4) and a grey level to the +192 colour of the groups in the table
  at 0x8027d160 (channel 0 -> DRAW, 1 -> OBJ groups, 2 -> BG). 0x8004d91c turns those into material
  colour overrides (runtime record +36 ambient, +40 material; read by the renderer when obj+44/48 set):
  material x (+188 x stage colour) and ambient x (+192 x stage colour); tagged materials get their
  channel's colours. In the dump every channel was c8b4ff (stage 13's preset colour) and +192 white.
  Not yet applied in the PC version (only the boss stages carry channel tags).
- Checked again 2026-11-15 (Wings snapshots, the light mask read from each model object, not the
  624-byte record): the lit path's mask (ZMB model +168) is 1 on the main stage file's DRAW model and 0
  on the extra stage files' models (STG406's DRAW). 0x80052bc8 is called only from 0x80114fa4, in
  variant 0, for the groups of the current variant, so the extra stage files (variants 1 / 2) are always
  drawn unlit (texture x vertex colour), even where their materials have +16 set. COL_ stays 0 (mask 123).
- Light 0's colour is grey 255 x the stage's light preset +8: 1.0 on the song stages (10-17), the boss
  record and stage 19's; 0.4 on stages 201 / 203 (their record at 0x8028d190 + 14832, colour bebebe).
- Model +188 / +192 stayed ffffffff in every dump, and the channel greys of every preset (+44) are 1.0 for
  channels 0-2, so the group grey never darkens a stage part during play.
- DDR II PC: extra stage files are drawn unlit, light 0 uses the preset's brightness (ddr2fx light.G);
  tagged materials already took their channel's colours.
- Cue column 9/10 switch the stage variant (0x80113838 -> 0x8005386c), at most 3.
- Camera (0x8005b764): fov key = angle across a 640x480 frame; projection fovy = 2 atan(0.75 tan(fov/2)),
  aspect 640 x 1.3333 / 480 (wide), near 1, far 5000 (dump: fovy 64.37, near 1, far 5000).

## Boss stage (ids 200 / 204 / 205: STG201, STG205, STG206)
- Dancers: CHR208 leads (the first character file loaded for it in Dolphin's file log, before CHR207
  and CHR209; the player always dances as her), CHR207 and CHR209 behind, outfit 1 each (footage).
- Opening, before the song card and READY (Dolphin footage, 10 s): a wipe onto the island by day; the
  three on the grass at night with the portal (a purple lightning ball) opening above them; they leap
  and fly up; then READY in the neon tunnel.
  - Cameras: the stage file's second WII entry, STG201_CAM00_01..03.cam - 3 s, 4 s, 3 s (GAME_DEF_CAM's
    move format), played in turn.
  - Props: the OBJA_Z_ models - DRAW109 (the island with the record player; its 600-frame ZAB),
    BG109 (day sky, clouds), BG201 (night: stars, planets), hole01 (the tunnel mouth). The footage
    shows BG109 only in the first move and BG201 + the portal from the second on.
  - Motion: DANCE_HP4U_053_S01_MOT's third clip (600 frames = the 10 s; its hips walk forward from
    z -21.5 and rise to y 60), unused by the S01 cues; the three stand at S01's other formation
    (HP4U_s1_pos_24: lead (0, 0, 4), backups (-9, 0, -6) and (9, 0, -6)). The song itself uses pos_18.
  - The portal: the stage's own effect (STG201's Prm ZAR: effect 0 of bank 5 = the stage file's
    STG201_EFF section, 21 nodes, 4 s) at spot EFF_03_01 (0, 740, 2730), inside the tunnel mouth
    hole01 (meshes around y 550-700, z 2200-2560). The stage's own effects run all the time
    (0x80053124 restarts them), so from the opening's night camera it shows as the lightning ball
    above the dancers (about 15 degrees up, 2450 units away; the glow is 96-160 x 10 units).
    (stage/STG201_EFF.bin, a separate 3 s effect file loaded into loader slot 10 for stages with
    record flag 0x200 by 0x80118724, is never fetched by the loader accessor 0x80119300.)

### From the boss-stage memory dumps (opening and song)
- The boss stage controller (vtable 0x802beff0, a subclass) has +60 = 1. Its +64..72 is a travel
  offset added to the stage, the dancers, the camera and the lights (0x800439ac: 0x80052d18 stage
  root, dancer matrices, 0x80062d3c light centre); 0x80116a04 adds 3.0 to +72 each frame below 50000
  (opening dump: 714; song dump: -49685). Everything moves together, so only particles show it.
- Dancers stand at stage origin + formation spot: opening (pos_24) lead (0, 0, 4), backups (9, 0, -6),
  (-9, 0, -6); song (pos_18) lead (0, -15, 20), backups (-30, 15, -15), (30, 15, -15).
- The dance's camera moves (FRE entry 2, HP4U_DDR054_CAM1nn.cam: length field 150.3 s, keys a few s)
  are relative to the lead's spot: song dump eye = origin + (0, -15, 20) + key (x 68.94 exact, y 3.61
  = key 18.6 - 15). The opening's moves (STG201_CAM00) are relative to the stage origin.
- Field of view: the dump's projection fovy 51.08 = 2 atan(0.75 tan(65/2)) for the move's fov key 65.
- Stage materials: every stage model has its per-object colour records on (obj+48 = 1, records at
  obj+44, 220 bytes per material, +36 ambient, +40 material) and in all three dumps (stage 13; boss
  opening; boss song) they were white for the stage's own materials - so the file's material and
  ambient colours are not what is drawn; lit parts come out as texture x vertex colour. The boss
  tunnel mouth's channel-tagged materials held changing colours (d2ffe6, 8caadc ambient).

## Material animation, camera reference, silhouettes (decoded 2026-11-14)

Stage material record (0x50 bytes, DDR II):
- +20 texture count, +24 texture list (indices into the model's TPL).
- +31 non-zero = the material has a texture matrix (0x80157fe4 loads the obj+68 entry for it, GX texmtx 30).
- +32 / +36 f32 U / V scroll speed; +58 s16 key count, +60 keys of 16 bytes (f32 time in s, f32 u, f32 v,
  byte flags per component: 1 = step, else linear). 0x8015713c writes the matrix's translation:
  u = -(+32 x 60 x t) and v = +36 x 60 x t, or from the keys (u negated) wrapped at the last key time.
- +48 count / +52 list of u32 frame times: the texture flipbook. 0x801576fc runs the material's clock at
  60 a second (/ obj+412: 1.0, 1.2 at 50 Hz), wraps it at the last time, and shows the first texture
  whose time is past the clock (record +16 = index into the +24 list). The boss tunnel's squares cycle
  purple -> red -> yellow -> ... -> blue on a 600-frame loop, each ring starting at a different point;
  the portal (hole01) cycles 12 pictures every 2 frames.

Dance camera reference: the camera manager's object (Dolphin heap, 0x808a4760 in the dumps) holds at +104
the point the dance's camera moves are relative to, +116 the stage's travel offset, then the eye and
target in the world. Three boss-song dumps gave (0,-15,20), (-30,15,-15), (30,15,-15): the current
formation's s1_look_NN point (pos_18, pos_22 / pos_28, pos_23). Dancers stand at their s1_pos spots;
a formation without a spot leaves that dancer out.

Backup silhouettes (normal songs): the scene's object at +1036 gets texture slot 11
(STG_SILHOUETTE0n, 0x8003dbdc -> 0x800fb540). 0x8011412c (play start) starts its fade - 2.0 s
(0x800fb64c for silhouette types 0-2, 0x800fb608 otherwise; type 3 = none) - and 0x800fb6f8 runs it up
each frame; it stays on after that.

Boss opening clip: the S part's 600-frame clip, always the last in S01 (HP4U_053: 3rd, _054: 4th,
_055: 6th); all three are the same flight (stand, look up at the portal, fly up into the tunnel).
Stage ZAB rotation keys are quaternions taken the short way round between keys (the island's record
spins past 180 degrees between keys).

Skinned stage parts: a mesh's +0x28 word points at one (u32 count, u32 offset) pair per position; each
offset lists count 64-byte entries (32-byte node name, +56 u32 node index, +60 f32 weight). Positions are
in the file's world space. The boss tunnel (DRAW_STG201_01) is bound to Dummy01 / 02 / 03 (z -2500 / 0 /
+2500) and its ZAB swings the two ends up to 1000 sideways and 500 up over its 2000-frame loop, so the
tunnel bends away from the dancers; the portal's tube (hole01's grid02) is bound to Dummy_tube_back /
center / front under Dummy_scale (scale 0.3 -> 1) and stretches back to z -4500.

## Checked against a Dolphin camera trace (camtrace.py, London EVOLVED Ver.C, 2026-11-14)

- The camera manager's block at 0x808a4760 (the same address in every dump): +0x68 the camera's reference
  point (the formation's look), +0x74 the stage travel (+3 a frame: 0 upward through the boss opening, then
  about -50000 upward from the song's start), +0x80 eye, +0x8c target, all in the world.
- The dance controller (0x80c71020 in that run): +0x10 f32 the dance clock = chart time in seconds, +0x14 u32
  the chart position (4096 a measure) at that time. The boss opening's travel runs 10 s and the song phase
  (tunnel, dance, first camera move) starts at chart time 0; READY appears 0.3 s later (footage).
- A song's own dance (the fixed table) runs on seconds: each cue row's 't'. Its rows change tempo (London's
  L02: 190 / 95 / 47.5 BPM rows), so measures and seconds are mapped row by row; the parts follow S, L01, L02,
  L03, L01, ... and E.
- Hottest Party 4's camera moves are cut from one take that runs S, L01, L02, L03, E in order: a move plays
  at its part's place in the take (the earlier parts' lengths in seconds) + the cue row's 't' + the time
  since the cue (L02's first move at 11.36 s; E's at 105.35 s even when E came after 86 s).
- With these rules our camera follows the trace within a few units (the trace's own frame timing) through
  the opening and the song; the opening's three moves match to under one unit.
- Each cue sheet ends with a closing row (tempo 0): its time is the part's length in seconds. Every row's
  +4 f32 is its time in the dance's whole take (the camera moves' time base).
- The merged table (Dolphin heap, 0x808a4560 in the second trace): +16 one 8-byte entry per placed part
  (first row, last row, kind 0 S / 1-3 L / 4 E), +424 the parts' lengths (S, L01, L02, L03, E: 6.313,
  5.047, 83.373, 10.42, 28.413), +444 the number placed, +448 the song's length in whole seconds (114).
  0x80119f0c lays S and the loops end to end until one would pass (song length - E's length); that loop stops
  before its first row past that point and E starts there (London EVOLVED Ver.C: L02 cut after 66 rows,
  E at 85.89 s).
- Second trace of Ver.C (played to the end): our camera is within 0.9 units (median) of Dolphin's, 89% of
  samples within 3 units; the rest are the exact frames of cuts.
- Re-checked 2026-11-15 (both Ver.C traces, sampled every ~0.2 s): eye median 0.8, target median 0.5 units;
  93% / 95% within 3 units, and every remaining sample matches when shifted 0.10-0.15 s (the check's own
  sampling lag) - including the cuts and the two very fast moves (CAM113, CAM124 at ~100 units/s). The
  projection matches too: block +0xe0 = cot(fovy/2), +0xcc = that / (16/9); fovy = our 2 atan(0.75 tan(key/2))
  to within 1%. The opening's three moves match eye and target.
- Other camera-block words: +0x04 the current dance row's tempo (190.04 / 95 ...), +0x08 the chart's tempo
  at that time (169 / 170 / 340, changing at 12.7, 46.6, 57.9 s), +0x74 travel (z: 0 -> 1800 over the
  10 s opening, then -50000 at chart time 0, +3 a frame = 180 units/s for the rest of the song).

## Pool-song dances (decoded from main.dol, checked against Dolphin camtrace 20261114_230324)

- Songs with flag 0x200000 take a dance from the BPM pool (<120 / 120-140 / >140; 12 / 13 / 13 rows at 0x80290f88).
- 0x80119844 picks each of the five part slots on its own (0 S, 1-3 the three loop slots, 4 E): a fresh
  MT19937 (0x80128ce4 / 0x80128d38) seeded with base - slot (base + slot when base >= 0xffff0000), the row =
  rand % rows, then the file = the (rand % popcount + 1)-th set bit of that row's S (+8), L (+10) or E (+12) mask.
- base = rand() * rand() + 0x12345678 (C rand, 0x80131c0c), set as each song loads (0x8003d46c), so every
  play differs. The parts can come from different dances, and two loop slots can be the same file.
- Wings of an Angel (Dolphin): short - S HP3U_037_S01, L HP3U_045_L03 / HP3U_037_L02 / HP3U_037_L02,
  E HP3U_031_E01; full - S HP3U_002_S01, L HP3U_034_L04 / HP3U_045_L02 / HP3U_041_L02, E HP2U_036_E01.
  The merged table in memory (0x808b7cc0, 52-byte rows) matches those files row for row.
- Clock: chart seconds (controller +16 = chart time, +20 = chart position). Each part keeps its own file's
  tempo (170, 160 and 150 BPM parts in a 175 BPM song); parts are laid end to end by their closing-row
  lengths; the E rule (whole-second song length minus E's length, the loop playing then is cut before its
  first row past that point) gives exactly the 19 and 10 kept rows seen in memory.
- camtrace: 0x808a2558 points to the camera block and 0x808a258c to the dance controller in every dump.

## Normal-song camera, checked against camtrace (Wings of an Angel x3, 2026-11-15)

- Three plays, each with its own picks read from the merged table (play 1: HP3U_034_S01, HP3U_045_L01,
  HP3U_037_L02, HP3U_002_L02, HP3U_002_E01; play 2: HP3U_045_S01, HP3J_006_L01, HP2U_029_L03, HP3U_002_L03,
  HP3U_002_E01; play 3: HP3U_045_S01, HP3U_045_L04, HP2U_029_L04, HP2U_036_L04, HP2U_036_E01). The last
  loop is cut before E exactly by the E rule each time.
- A cue's move from a dance's own take (HP3U_DDRnnn_CAM10x) plays from the cue's place in the take (tt);
  its first frame is that place at once (HP3U_045's CAM102 at take 7.49 s holds still for 6 s).
- A move from the shared library (GAME_DEF_CAM: HP2U_DEF_CAM_.., HP3U_DEF_CAM_..) is spread over its cue's
  time: HP2U_DEF_CAM_02_14 (6 s) on an 11.64 s cue ran at 0.52 speed; HP2U_DEF_CAM_03_07 (9 s) on 8.73 s
  at full speed.
- After this, ours matched the real eye within 3 units on 66-87% of samples (median ~1 unit); the rest
  are at cuts, where the headless check samples about half a second late.
- Combo events (0x800fcdc8 -> 0x800fd1d0, per player): type 0 at combo 50, 1 at 100, 2 at 200 and every
  200 after, 3 and 4 still to be read (4 looks like the break); 0x80061c4c starts the dancer motion
  (dancer record +2044 base + type x 2, +1 for a variant). Not in DDR II PC yet.

## A song's stage variants (Dolphin memory, Wings of an Angel x3; video footage)

- Song record +16 points to a pair of stage ids (main.dol 0x802e7c48..); in memory record +12 = 2 when
  the pair is two ids, 0 when it starts with -1 (fixed-stage songs). 0x80118724 loads the song's stage into
  slot 0 and the pair into slots 1 and 2 (0x8011919c, stage/STG%03d.bin = id + 1). Wings of an Angel:
  420, 405 -> STG421 (no model: light spots + screen kind 1 = bgv/bgv16) and STG406 (BG_STG405, a room
  with two monitors, screens kind 2 = upt_quarter0n).
- They are not drawn with the stage: they are the stage's variants 1 and 2. Only one variant shows at a
  time (controller +5156; 4 = the full-combo appeal). Cue column 9 (FRE byte +45) switches:
  0x8011399c -> 0x80113838 -> 0x80129308 -> 0x8005386c (movie manager: current slot, fade = row +48,
  0.4 s; a kind-1 slot is drawn as a background video behind the dancers - footage: a full-screen
  sparkle / bubble video with the dancers in front for a few seconds, then back to the room).
  Value 0 = back to variant 0; non-zero = counter (controller +108) + 1 mod 3, 0 -> 1, so 1, 2, 1, 2.
  Only if the variant < the loaded count, its bit is set in +5148 (all set) and it differs from now.
  Footage and DDR II PC: variant 1 of Wings = bgv16 filling the screen behind the dancers.
- The gate: 0x80129308 lets a non-zero cue through only if table 0x80292080 [min(pass, 3)][kind] is set
  (or a force flag, only at play start). kind = the row's segment kind (0x8011af30: 0 S, 1-3 the loop
  slots, 4 E); pass = the segment's round (0x8011b030 returns schedule +288 [segment]: 1 the first time
  through the loops, 2 the second ..., 0 for S and E). Table rows: pass 0 [1,0,0,0,1], pass 1 [0,0,1,0,0],
  pass 2 [0,1,0,1,0], pass 3+ [0,0,1,0,0]. The cue runs only when the schedule reaches a new row
  (0x801142c4 compares the row time before and after advancing).
- Checked against three plays (controller +108 counter / +5156 variant / +112 request at each 10 s
  snapshot): play 1 variant 1 at 48.6, 2 at 79-89, 1 at 130, 2 at 171-181 (its return cue cut by E);
  play 2: 1 at 49, 2 at 100-110, the full-combo appeal (4) at 151; play 3: 1 at 70, 2 at 101. Every cue
  let through or blocked matches the table. DDR II PC (stage.js pickVariant) reproduces plays 1-3.
- Song length for the E rule = song record +36 (schedule +448 in memory: Wings of an Angel 185,
  London EVOLVED 114); the chart's last tempo point (176.9 for Wings' full chart) is not it.
- 0x80055590 runs for slots 0-2: one movie per loaded stage file (memory 0x808b13e4: kinds 3 1 2,
  names single06 / bgv16 / quarter).

## Lights and effects from the dumps (2026-11-15)

- Light presets: per-stage table +16 -> 8 presets x 148 bytes, colour at +116 (boss 200: d2ffe6, 8caadc;
  stage 11: ffdcc8; 13 and 16: c8b4ff; presets 2-7 empty). The stage manager's channel table
  (+0x10000 - 20832, 16 bytes a channel: ?, ?, material, ambient) held channels 0-2 = white / preset 1's
  colour (preset 0's if preset 1 is empty) and 3-6 = white / black in every dump (London x3, Wings x3);
  the boss's fades in from d2ffe6 to 8caadc during the opening's first second (afd4e1 caught halfway).
  0x8004d91c gives materials tagged 11-90 their channel's colours (x the per-slot stage colour at
  manager +256 + 56 x slot, white in every dump). Only the boss portal (OBJA_Z_hole01, tags 13/16/17,
  channel 0, lit) has tags: its ambient is 8caadc, so its faces away from the light are light blue.
  Untagged materials keep their own colours (model +188/+192 white, overrides off) - the normal stages
  are not tinted, which matches the footage of stage 11.
- Light presets do not change during these songs (no cue column 6 rows in London EVOLVED Ver.C or the
  Wings parts that played); the controller's channel states stay put through every dump.
- The boss's rainbow streaks and sparkles come from character/CHR_EFF.bin (boss_ddr3.TEB, 27 effects +
  3.tpl, 17 textures: stars, rings, a rainbow gradient (texture 3), a white teardrop (2)), loaded with
  every character (0x80118e54 -> loader +200). Effect 24 is a single type-3 node (not a particle part:
  a ribbon / afterimage - flags 0, texture byte 2, colour ffffff5c -> ffffff00, 0.8, 0.1, 2.5 ...);
  the others are particle parts with the star textures. What plays them and at which bones is not read
  yet. Because the boss stage, dancers and camera travel +3 units a frame (+72 of the controller) and
  particles stay where they were emitted, anything these effects leave behind streams out behind the
  flying dancers - the trails in the footage.
- Character effects (bank 6 = CHR_EFF.bin, played by 0x8005fb04 via 0x8005f4c4 <- 0x80061f3c): per dancer,
  9 slots (dancer +44, 164-byte records) each naming a set in the table at 0x80271848 (40 bytes: set id,
  then three (code, effect, flag)): sets 0-2 codes 1000-1008, sets 1-4 codes 25/26 with effects 7-10,
  sets 5-6 code 2000 + 3000 with effects 3/4, sets 7-8 codes 2001-2006 with effects 3/4 (codes 2000-2006
  -> 0x8005fde8 with the 24-byte parameter rows at 0x80271cc0). An effect is placed at an attach point
  (0x8005eb84: table 0x80271798, 12 bytes [model part, flag, node], node index from the model's +2652)
  and follows that node's matrix (0x801791f0). Which sets the boss dancers run, and when: not read yet.
- PC version: particles not flagged 0x80 now stay behind while the boss stage travels (teb.js travelZ,
  180 units a second, -50000 at chart time 0) - the drift that turns these effects into trails.
- Boss dancers' effects, read from the effect manager (r13 - 29416 -> manager; +420 the instance list,
  312-byte instances: +112 the 3x4 world matrix, +300 bank, +304 effect): through the whole of London
  EVOLVED Ver.C the same nine bank-6 instances run - per dancer one at the hips and one at each hand
  (attach table 0x802717b8: 0 Hips, 1 LeftHand, 2 RightHand, 5 LeftFoot, 6 RightFoot; the odd ones sat
  level with the hips 2-5 units to each side): lead 8 + 9 / 9, spot 2 10 + 11 / 11, spot 3 12 + 13 / 13.
  The effects are ~2.2 s long; when one has run its length 0x8005fb04 stops it and starts it again.
  PC version: stage.js chrEffects plays them at the dancers' bones (dancer.js lastBones).
- TEB node type 3 = a tail (CzanEffTail, "CzanEffTailMng"): created by 0x8017e360 from the manager's
  +276 pool (0x801a1d48: 344-byte objects, constructor 0x801a0770, vtable 0x802c1940 -> 0x801a0808,
  0x801a0978 update (819 instructions), 0x801a1988, 0x801a1644 draw). It samples points every interval
  into a short history (+252, 8 bytes a slot, +316 the write index) and draws a ribbon through them -
  in the travelling boss stage the history stays behind, which makes the long rainbow streaks.
  CHR_EFF effect 24 is one: colour ffffff5c -> ffffff00, 0.8, 0.1, two keys at 2.5 (texture 2 or 3:
  the white teardrop / the rainbow). Not drawn by the PC version yet; it did not run in London
  EVOLVED Ver.C (it shows in Unbelievable (Sparky remix) footage).
- stage/StgChgWipe.bin: six screen transitions, each a WII pair [TPL, CAE_WII]: 0 circle01 (a white
  square with a round hole, scaled at the screen centre 320,240: CAE commands 14/15 scale X/Y, 22 wait;
  track kind 0x21 as well as 0x10/0x20), 1-2 line_mask, 3 box01, 4 (22 parts), 5 (14 parts). Loaded into
  loader +32 and handed to the stage manager (0x8003d740 -> 0x8004ebb8, object +0x10000 - 19520).
  0x8005386c plays one when a stage-variant switch has a non-zero cue column 10 (wipe = column 10,
  table 0x80271340 -> 0x8011e770); with column 10 = 0 (every Wings / London cue) there is no wipe.
- Footage (Unbelievable, boss): the song starts from the loading screen's speaker ring (the "DDR"
  picture) opening out round the island - a circle opening from the middle. That is the song-start
  transition, not StgChgWipe. The PC version's loading screen is still its own (jacket + title).

## Song-start ring (comAF /5/0)

- comAF_US.bin entry 5/0 holds the song-start "speaker ring": textures /5/0/0/0-5 (en_a01 DDR disc, en_b01 outer concrete ring with the blue rim, en_b02 gold ring, en_b03 inner metal ring, neji_a01 big screws, neji_a02 small screws) and the CAE block /5/0/1 (file offset 0x13aa40).
- A part's sprite number is its texture index in /5/0/0.
- The ring halves are top arches (880x400, pivot at bottom centre). Each has a child copy with negative scale for the bottom half.
- CAE command 1 is the draw depth: higher numbers are further back. The values are disc 2, outer ring 5/4, screws 7-18, gold ring 20/19 and inner ring 23/22. Checked against the closed-ring frame in ddr_small.mp4 at 34.3 s: the outer ring covers the gold ring's black corners, and the screws sit on the gold ring.
- Tracks:
  - 0: close-in, 16 frames.
  - 1: opening, 16 frames. The disc fades out over frames 3-6, the ring layers scale out from 1.35 to 2.3 and the screws spin away.
  - 2: long close-in, 61 frames. The disc appears at frame 52, then the ring shakes.
- Footage: the closed ring with the disc cuts straight from the explanation screen (the recording drops the close-in). It then opens over the stage in about 12 frames, with the step zone already drawn on top of it.
- Code: comAF entry 5 is loaded by 0x80104538 into a 132-byte object (comAF manager r13-29408, +52). +0 is /5/0 (the ring), +4 /5/1 (the wipe), +8 /5/2, +12 /5/3, +44 the /5/4 sounds. +128 is a track base (0, never changed); 0x80062d58 plays a track. The manager's wrappers:
  - 0x801004e0 -> 0x8010502c: track 0 (short close-in), sound 602.
  - 0x801004e8 -> 0x801050bc: track 2 (long close-in), sound 609.
  - 0x801004f8 -> 0x80105150: /5/1 track 0 (wipe), sound 628.
  - 0x80100510 -> 0x80105318: the opening, track 1, sound 601 (or /5/1 track 1 after a wipe).
- Which close-in:
  - The short one (track 0) is the one before a song. CSelect plays it when the song is decided (0x800457c8). CselDancerMovie also uses it (0x8010ad18).
  - The long one (track 2, with a 2000 ms wait) is only played by the game at a song's end (0x800421a0, called from the play update 0x800430cc).
- Song-end close (0x800421a0), decoded further:
  - Scenes (scene manager 0x80021048 / 0x80021140: +0 requested, +4 current, init(scene id) through vtable +12): 0 and 1 small boot scenes, 2 CSelect, 3 / 5 / 6 CGame (1072 bytes, vptr at +4).
  - CGame's init (0x8003c210) sets +184 = 0 for scene 5, 1 for scene 6 (also +252 = 10 and +264 = 0x80027a74(10)), and −1 for scene 3. With +184 = −1 there is no ring at the song's end at all, and the song goes straight on. Every Dolphin dump so far (London, Wings, the boss song) had +184 = −1, +148 = 0, +188 = 1.
  - In scenes 5 / 6 CGame also asks the ring to open at the song's start (0x80100540 sets ring +36, and the ring's update 0x8010476c then plays the opening) and waits for it (0x80100518).
  - +148 = the song's outcome, written by the play update: 0 cleared, 1 failed (gauge or the session's fail flags), 2 (an end flag, bit 28 of the r13-29412 object's +0x30107c).
  - +188 = the session object's +0 (r13-29392, 0x80027ffc): 1 in every dump.
  - The session's +276 / +272 = the song list's length and the current index (16-byte entries from +280; 0x8002822c sets the length, 0x800282d4 steps on).
  - The rule (scenes 5 / 6 only):
    - Cleared (+148 = 0) with +188 ≠ 8: the short close.
    - Otherwise, when more than one song is left (+276 − +272 > 1): the wipe (/5/1) if +188 = 8 or the song was cleared; the long close-in with its 2-second wait if the song was failed.
    - On the last song: the short close.
  - Scenes 5 and 6 are never entered. The manager's next scene is whatever the current scene's update (vtable +16) returns (0x800210ec: mgr+0 = update(mgr+0)). The only other write is the start-up request (0x80021030, once, from 0x80020b68). The updates return:
    - scene 0 (CcmnLoad, 0x8002210c): 1;
    - scene 1 (logos, 0x800214fc): 2;
    - CSelect (0x800457c8): 3 when its screen +56 = 29 (play), 4 when it is 30, otherwise 2;
    - CGame (0x8003c8a0): its own id, or in its state 5 its +0, which the manager set to the scene it came from (0x800212ac), i.e. CSelect.
  - Nothing returns 5 or 6, so in the released game the song-end ring (and with it the long close-in, track 2) never plays: they are leftovers. Normal play (scene 3) has no song-end ring, and DDR II PC already matches that (the song fades out into the results).
- DDR II PC uses track 0 while loading and track 1 over the first 16 frames of play, drawn after the stage and the dancers but under the HUD. It has no song-end close, which is right: only the unreachable scenes 5 / 6 have one.

## Character select (CselChara) - notes, not built yet

- Graphics are in select_bin_us.bin, group /2 (DDR II dancers) and /4 (Mii player windows and bodies).
  - /2/0: title "MY DANCERS" (text varies by language).
  - /2/1: dancer windows "DANCER 1-3" and the name plates (/2/1/0/3 holds 28 names).
  - /2/2: the SELECT CHARACTER screen. Name window at (160,392), title at (320,35), page arrows at x 254 / 575, y 240.
  - /2/3: 101 icons (faces 0-15, RANDOM / ALEATORIO, Mii bodies, numbered shirts / trousers / shoes).
  - /2/4: the character board, 282x360 with a 3x4 grid of slots 85 apart.
  - /2/5: 13 anchor points.
  - /2/6: OUTFIT 1-4 / Wii / GUEST / CONFIRM buttons.
  - /2/10-12: the Mii character select.
- Code: class CselChara, vtable 0x802b9a20. Methods: 0x800657ec dtor, 0x80065920, 0x80066918, 0x80066bbc, 0x8006bd58. The code covers about 0x80065000-0x8006e000.
- Tables at 0x802721d0-0x80272320 look like board slot to character maps (0x15 = empty).
- CSelect::setPlayerChr is at 0x8004a728.
- Still to do: decode the state machine and board order, then check against a recording.

## Boss opening script (decoded 2026-11-15)

- Code: main.dol 0x801163ac sets it up and 0x80116478 runs it every frame. c is the frame count since the opening began (controller +11252, 60 a second). 0x80053d2c(mgr, i) gives stage object i: 624 bytes each, +596 visible, +0 the model.
- Stage object order: 0 STG201_01, 1 STG201, 2 STG201, 3 BG109, 4 BG201, 5 DRAW109, 6 hole01.
- At the start: 0 and 1 off; 3, 4 and 5 on; 6 off. Light preset 0 is set at once (0x80113098). Each dancer gets character-effect set 1 (0x80062058).
- c 60-210: DRAW109's and BG109's model colour (model +112, 0x8015c440) goes from 1 to 0.15, i.e. 0.85 × (210−c)/150 + 0.15. This is the dusk.
- c 180: the stage's own effects start (0x80052ffc: the portal), plus sound 633 / 634.
- c 300: hole01 is switched on and its animation restarts (0x8015625c). Its alpha goes from 0 at c 300 to 1 at c 360. The tube (Dummy_scale 0.3 → 1 over animation frames 0-150) therefore grows over c 300-450.
- c 390: BG109's alpha goes from 1 at c 390 to 0 at c 420, then it is switched off. Controller +276 = 0.5, and light preset 1 is started as a fade (0x80113098(ctl, 1, 0)).
- c 544: each dancer gets character-effect set 2 (0x80062014).
- Checked against Dolphin dumps:
  - At 3.83 s and 3.97 s: BG109 and DRAW109 colour 0.15, hole01 off. The hole01 animation clock (node record: clock, length 33.33 s) equals the time since the start, because it has not restarted yet.
  - At 8.77 s: BG109 alpha 1/30 and off, hole01 on, clock 3.767 (it restarted at 5.0 s).
  - In the song: hole01 off; STG201_01 and STG201 on.
- Footage (ddr_small.mp4, the opening starts at about 34.0 s): night from 3.3 s; the portal grows; flash at 6.3 s; the tube shows from 6.8 s; dark grass with BG201's stars at 7.5-8 s; the tube's blue beams at 8.5 s.
- Light preset fade (0x80113098): a preset record in the controller sits at +148 × preset (+128 fade time, +132 the file record's +4, ..., +244 colour). With instant = 0, the old and new values are blended in a straight line over the +128 time. The script writes 0.5 there for preset 1 (+276), so the portal's light-channel ambient goes from d2ffe6 to 8caadc over c 390-420. Dumps: d2ffe6 at c 230 / 238, 8caadc at c 526 and in the song. (This replaces the earlier note that it faded "within the first second".) The opening's clock stops at c 604.
- DDR II PC (stage.js bossProp) does all of the above.

## Ring and boss-opening sounds

- 0x8002425c(r13-29436, n, ...) plays sound n. n is the sound's index in DDRHP5_SOUND.brsar (sfx.py names).
- Ring sounds:
  - 601 SE_SYS_SHUTOPEN: the opening (track 1);
  - 602 SE_SYS_SHUTCLOSE: the short close-in (track 0);
  - 609 SE_SYS_QUALSHUTCLOSE: the long close-in (track 2, unused);
  - 628 SE_DDR_WIPE: the wipe (/5/1).
- Neighbouring sounds: 605 / 606 SE_SYS_TOURSHUTOPEN / CLOSE (/5/3), 607 / 608 SE_SYS_INTRUOPEN / INTRUCLOSE (/5/2).
- Boss opening at c 180: 633 SE_DDR_BOSS when the players count (0x8011aadc summed) is 1, otherwise 634 SE_DDR_BOSSMULTI.
- DDR II PC plays SHUTCLOSE when the loading ring starts, SHUTOPEN with the opening, and the boss sound at 3 s into the opening.

## Tails (CzanEffTail): how the rainbow trail is built and drawn (decoded 2026-11-15)

- **Setup (0x801a08f8).** The node's record is +220 (the TEB type-3 node data):
  - +4: texture index in the effect bank;
  - +8: start colour (rgba);
  - +12: end colour;
  - +16: fade time in seconds;
  - +20: width (the half-width is 10 × this);
  - +24: keys.
  - CHR_EFF effect 24 is texture 2/3, ffffff5c → ffffff00, fade 0.8 s, width 0.1 (half-width 1.0).
  - +224 / +228 / +232 are rgb multipliers (1.0 at the start).
- **The path is precomputed (CzanEffMng::init_model_motion, 0x80178844).**
  - When a dance is set up, 0x8005dd8c runs it for every clip and for each of the 12 attach points (table 0x802717b8: Hips, LeftHand, RightHand, model parts 3/4, LeftFoot, RightFoot, part 7 slots 0-3, Hips).
  - For each, it steps the model's animation through the clip at 128 evenly spaced times (clip length / 127 apart) and stores the node's world position plus that time: 16 bytes a point, up to 256 paths at mgr +692, 24 bytes each.
  - The path index for a clip and attach point lives at dancer +2036 + clip × 64 + 16.
- **Which path is used (0x8005fb04).** A character effect whose record has bit 2 set looks up the current clip's path (dancer +2060 clip, +2064 slot) and plays through 0x8017912c with that path index (mgr +288). When the clip changes, the old one stops and a new one starts on the new clip's path.
- **Update (0x801a0978).**
  - As the effect's clock passes each point's time, the point is revealed. Up to 8 runs of points (+252 / +256 start / end, +316 the current run) exist, and a new run starts when the effect restarts.
  - Every revealed point has a life (+244, 8 bytes a point) that starts at the fade time and counts down by dt.
  - Its colour is lerp(start, end, 1 − life / fade) × the rgb multipliers. At life 0 it is finished.
  - Each point becomes two vertices (48 bytes, at +240): p ± side, with side = normalize(cross(normalize(eye − p_next), normalize(p_next − p))) × half-width. Eye = effect manager +664 (0x80179114).
  - Texture coordinates: u = 0 / 1 across the strip; v = 1 at the run's first point, falling by 1 / (n − 1) per point to 0 at the newest.
- **Draw (0x801a1644).** The instance's 3x4 matrix (+108) is the model matrix. The texture is the bank texture at record +4. Each run is drawn as one GX_TRIANGLESTRIP (position, colour, uv), blended and without depth writes.
- **Effect sets (0x80271848, 40 bytes: set id, then (code, attach, flag) × 3):**
  - set 0: codes 1000 / 1001 / 1002 at Hips / LeftHand / RightHand;
  - set 1: codes 1003-1005, the same three attach points;
  - set 2: 1006 at attach 11 (Hips) with flag 1, 1007 at LeftFoot, 1008 at RightFoot;
  - sets 3-10: codes 25/26 at attach 7-10;
  - set 11: 2000 / 3000 at attach 4.
  - The boss opening switches every dancer to set 2 at c 544 (9.07 s), the moment they fly up. In the footage that is when the rainbow streaks start.
- **Codes to effects (decoded 2026-11-15):** 0x8005f168 looks codes 1000-1008 up in 0x80271c30 (16 bytes a
  code, one word per dancer slot 0-3): 1000 0/2/4/6, 1001-1002 1/3/5/7, 1003 8/10/12/14, 1004-1005
  9/11/13/15, 1006 16/18/20/22, 1007-1008 17/19/21/23. So set 1 = effects 8 + 2k (hips) and 9 + 2k (hands)
  - the London EVOLVED song dumps' 8/9/9, 10/11/11, 12/13/13 were set 1 - and set 2 = 16 + 2k (hips, attach
  flag 1) and 17 + 2k (feet). Codes 0-26 are effects as they are; 2000-2006 / 3000 go to 0x8005fde8.
- **DDR II PC:** the boss opening runs set 1 until c 544 and set 2 from then (bones from the opening's
  dancers, relative to the stage), the song set 1. Checked in a test play: effects 16-21 start at 9.5 s,
  8-13 again in the song. The old set's effects are left to finish (not checked against the game); what
  attach flag 1 does is not read.
- **Still unknown:**
  - the exact GX blend mode.
- DDR II PC does not draw tails yet.

## Variant 4 = the combo performance (decoded 2026-11-15; replaces "full-combo appeal" above)

- Controller variant 4 is not a full-combo extra. The stage controller's vtable +68 (0x80115b80) sets it and +72 (0x80115ce8) ends it. They are called only from the combo-event code: 0x800fd1d0 starts it, 0x800fd344 / 0x800fcc70 end it.
- So it is the COMBO PERFORMANCE option (the light show at combo 50, 100, 200 and on). Wings play 2's "4 at 151 s" was one.
- A combo event of type t (0 / 1 / 2 at combo 50 / 100 / 200+, from 0x800fcdc8) starts these at once:
  - Dancer: 0x80061c4c plays the dancer's combo motion: record +2044 + t × 2, +1 for the alternative. The alternative is chosen by a per-song bit list (0x8002754c index, tables 0x8026e898 / 0x802b8824).
  - Stage effect: 0x800535f0 plays a bank-3 effect from table 0x80271200 [effect set × 40 + slot × 4], else from 0x802712a0 [set × 20 + t × 4].
  - Camera: 0x8005c408 starts the camera manager's appeal move (+508, 0x8005a9c4) if t ≥ its threshold +332.
  - Lights: the controller (0x80115b80(ctl, t, style, alt)) takes a light script from 0x802bee60 [alt × 80 + style × 20 + t × 4] (+10900) and parameters from 0x802bea80 [style × 60 + t × 12] (two floats and a colour, +10848 / +10864 / +9868). It sets variant 4, keeping the previous one at +112 to restore when the performance ends.
  - Its length (0x800fae4c): 120 for style 0, 100 for style 2, 72 (102 with alt) for styles 1 / 3, with 30.
- When it ends (0x800fd344, or 0x800fcc70 on a combo break / reset): the stage effect and the dancer motion stop, the camera returns, and the controller restores the variant and lights.
- Not built in DDR II PC yet. Each part still needs reading:
  - the light-script format;
  - the camera appeal move;
  - the bank-3 effect tables;
  - what "style" (combo object +4) is.

### Combo performance: when it fires (decoded 2026-11-15)

- **Setup.** The combo object (CGame +1040, 88 bytes) is set up by 0x800fcb90(obj, style, off):
  - off = the top bit of CGame +212 (1 = COMBO PERFORMANCE OFF);
  - style = song record +24 (0x802A44A8 + 412 × slot + 24): 0-3, or −1 = the song has no performance. Boss Unbelievable = −1. Of slots 1-200: 119 × −1, 12 × 0, 54 × 1, 13 × 2, 2 × 3.
  - Dumps: style 0 (slot 82), 1 (slot 75), −1 (slot 94, boss), with off = 0.
- **Per-player counters (player block, G = *(r13−29412) + 0x91610 + p × 0x5852c** - 0x800fcdc8: addis 9, +5648; corrected 2026-11-15, the 2-player trace found it there):
  - +0x5832c: the opening run, which counts good steps only until the first break, then stops for the rest of the song;
  - +0x58334: the current combo;
  - +0x58338: the max combo;
  - +0x58254: the target used in modes 2 / 4;
  - +52: **the chart's difficulty** (0 BEGINNER, 1 BASIC, 2 DIFFICULT, 3 EXPERT, 4 CHALLENGE; 0x800339f4 writes it with the chart's level at +48). Corrected 2026-11-15 (it was read as a "depth"): dumps BEGINNER level 2 -> 0, BASIC level 4 -> 1, DIFFICULT level 5 -> 2. So BEGINNER never gets a combo performance, the 100 one needs DIFFICULT or harder and the 200+ ones EXPERT or harder.
- **Each frame (0x800fcdc8), normal play (mode G+0x301078 = −1):**
  - Nothing happens unless off = 0 and the song position is at most 85% of its measures (+0x301094 against +0x301090).
  - If opening run > current combo (the opening run was broken) and a level had been reached: type 4, the "break" performance. The player is then done for the song (level 1000).
  - Level 0, depth ≥ 1, run ≥ 50: type 0. Level 1, depth ≥ 2, run ≥ 100: type 1. Level 2, depth ≥ 3, run ≥ 200: type 2. Then type 2 again at 400, 600, ... (level − 1) × 200.
  - Modes 2 / 4: type 3 when the run reaches the +0x58254 target.
  - Only one performance runs at a time (+68 = −1). The player whose event is newest goes first.
- **Its end (0x801142c4 -> 0x800fd3c8 / 0x800fd344):** when the dancer's combo motion has finished (dancer +148 = 2).
  - The motion is the dancer model's clip +2044 + type × 2 (+1 when the song's bit says to use the alternative; 0x80061c4c, played through model vtable +36). It applies only when model +2040 ≤ 0.
  - Where those clips live (which motion file) is not found yet.
- So the break animation the user saw is type 4: it plays when you break the opening run after reaching 50.

### Combo performance: files and checks (2026-11-15)

- **Files.**
  - game/GAME_APL_MOT01.bin: 10 ZAB clips, index type × 2 + alt. Frame counts 60, 60, 120, 120, 180, 180, 180, 180, 100, 100. The break clips (type 4) move only 21 of the 37 bones.
  - game/GAME_APL_CAM01-04.bin: 10 moves each, in the GAME_DEF_CAM format, lengths 1, 1, 2, 2, 3, 3, 3, 3, 1.67, 1.67 s. The file is CAM(style + 1).
  - game/GAME_APL_EFF.bin: a TEB plus its textures, the effect bank used by the stage-effect tables.
  - main.dol also names GAME_APL_STG01-04 and MOT02-04; those files are not on the disc.
- **Alt.** The performing dancer's flag bit 0 (0x8002754c groups the character ids; 0x8026e9b0 holds ids 200-208: 1,0,1,1,0,1,0,1,0).
- **Checked against the Wings of an Angel camtrace (20261115_053506, three plays, memory snapshots every 10 s).**
  - Each play reached level 1 when the run passed 50: snapshots at run 48 → 52/53. Depth stayed 1, so there was no level 2 at runs of 100, 150 and 208 (play 3 reached 208 with level still 1).
  - Play 1 broke at run 103 and play 2 at run 180: level 1000, last type (+72) 4. Play 2's snapshot at 406.90 caught it running: +68 = 4, controller variant 4.
  - The camera trace shows the type-0 moves at chart time 52.1 s in each play (play 1 move 1, plays 2 and 3 move 0, matching the alt of the dancers used) and play 2's break move (eye (0, 13.4, 23), target (1.4, 8.9, 0) from the reference point) for 1.5-1.7 s. All are relative to the camera's reference point (the formation's look), exactly as CAM01 has them.
- **DDR II PC** (game.js appealStep, dancer.js, stage.js appealCam; option COMBO PERFORMANCE 50 / OFF): plays the motion on the lead and the camera move. Still missing: the light script (controller +10900) and the stage effects (GAME_APL_EFF through tables 0x80271200 / 0x802712a0). One player only.

### Combo performance: stage effects and lights (2026-11-15)

- **Stage effects (0x800535f0).** Bank 3 = GAME_APL_EFF.bin (20 effects, 30 textures). The game plays effect A[set][clip] (table 0x80271200, 10 a row) and then B[set][type] (0x802712a0, 5 a row, −1 = none), with layer byte +0x10000 − 30203 and no spot (at the origin). The set is movie manager +0x10000 − 20440, which equals the song's style (dumps: 0 for style-0 Wings, 1 for a style-1 song).
  - A rows: 0 [3,3,0,0,1,1,2,2,5,5]; 1 [14,14,11,11,12,12,13,19,5,5]; 2 [10,10,6,6,7,7,8,8,5,5]; 3 [17,17,18,18,15,15,16,16,5,5].
  - B: set 0 type 3 → 4, set 2 type 3 → 9, otherwise none (rows 4-7 are [0,2,4,6,8|9], used by other sets).
  - DDR II PC plays them.
- **Light show, part decoded.**
  - The controller's update (0x80114d18) runs only in variant 4. It steps a script from 0x802bee60 [alt × 80 + style × 20 + type × 4]: 8-byte entries (value 0-9, start frame), ended by an entry with frame 0. Each value goes to dancer-manager +116 / +128 (flags +124 / +136). 0x8006238c hands it to each dancer's +16 block, and 0x800563ac turns it into a pair (a 0-2, b 0-6) through a jump table (value 2 → (0, 1)). The Wings snapshot during the break performance showed manager +116 = 2 and dancer 0's block = 2 / 0 / 1.
  - The performance also fades light state 4 (controller +5160 + 4 × 1144) to colour C over F1 / F2 seconds. C, F1 and F2 come from table 0x802bea80 [style × 60 + type × 12] (3.0 / 1.0, e.g. 46283c; 2.0 / 1.0 and 283741 for the break).
  - 0x80114fa4 feeds the current variant's state to the scene light manager (0x80062a58: GX lights placed from the stage's LIGPOS / LIGTAR spots). In the snapshot the stage's light channels kept their normal colour, so the dim colour goes to these lights, which light the dancers.
  - Still to read: what the (a, b) pair selects, and how those lights are drawn on the dancers. Not in DDR II PC yet.

### Combo performance: the light show decoded (2026-11-15)

- **What it changes: the dancers' ambient colour, nothing on the stage.**
  - The controller keeps five light states (+5160 + 1144 x n), one per variant (0-2 = the song's stage and
    its two extra stage files, 3 = a fixed grey state, 4 = the performance). 0x80114d18 steps all five
    each frame (0x801114ac) and hands the current variant's state to 0x80114fa4.
  - 0x801114ac builds each state's three colours: +12..14 = clamp(sum over the 8 channels of channel
    colour (+132) x weight (+984 + 16k)) x F (F = +1128 faded to +1132 by +1136); +16..19 = ffffffff;
    +20..22 = grey 255 x G (G = +1112 faded to +1116 by +1120).
  - 0x80111cbc / 0x80114fa4: +12..14 x the controller brightness (+10896, 1.0) goes to the dancer manager
    (+144, 0x80062328), which writes it as the ambient of every dancer material (runtime material records,
    material ffffffff). +20..22 is GX light 0 (the directional light from the camera, masks for kinds 0
    and 1). Light 1 gets +16..19 but has a zero-length direction (table 0x8027d138), so it does nothing.
  - The stage's channel colours and group greys (0x80052cd4 / 0x80052c34) are only written in variant 0,
    so the stage itself keeps its look during the performance (Wings snapshots: stage tables unchanged).
- **Start (0x80115b80).** Channel 0 of state 4 gets the table colour C (0x802bea80 [style x 60 + type x 12]
  +8) as current and target, channels 1-7 black; F = +0 and G = +4 of that entry, with no fade (timers 0).
  So the dancers' ambient jumps to clamp(C x F) at once. Wings (stage preset 0: c8b4ff x 0.65 = 8274a5
  during play): type 0 = 46283c x 3.0 = d278b4 (a warm pink); the break = 283741 x 2.0 = 506e82 (dark
  blue). Both read back from the snapshots (dancer manager +144 and every dancer material).
  G = 1.0, so light 0 stays white. The end (0x80115ce8) restores the previous variant (at least 3 kept
  from +112), and the ambient snaps back to the stage's colour.
- **Normal play.** The ambient comes from the stage's light preset 0. Light records: 24 bytes at
  0x80290970 + 24 x (stage - 10) for stages 10-29, 0x802908b0 + 24 x stage for 0-7 (0x801160a8; boss and
  others from 0x8028d190 + 14784 / 14808 / 14832), extra stages 400-439 from 0x802bef50 [id - 400]. Record
  +4 = channel mask, +8 = brightness, +12 = 16-colour palette, +16 = 8 presets x 148 bytes. Preset: +0
  fade time, +4 F, +8 G, +12 eight channel weights, +44 eight channel greys, +76 flag, +80 channel mask,
  +116 colour. Checked: state 0 = c8b4ff x 0.65, state 1 (STG421) = e6e6be x 0.6 = 8a8a72, state 2
  (STG406) = c8ffdc x 0.7 = 8cb29a, all as in memory.
- **The script (0x802bee60 [alt x 80 + style x 20 + type x 4]).** Entries (value, until-frame), 60 frames a
  second; an entry holds until its frame, frame 0 = to the end (0x80114d18: advance while frame != 0 and
  t >= frame / 60). The value goes to the dancer manager (+116 / +128 per dancer group) and from there to
  every dancer's block (+16 in the 380-byte dancer record). 0x800563ac maps it to a pair (a, b):
  0 (0, 0)*, 1 (0, 5)*, 2 (0, 1), 3 (0, 3)*, 4 (0, 4)*, 5 (0, 2), 6 (1, 0)*, 7 (1, 6), 8 (2, 0)*, 9 (2, 6);
  * = b is then replaced by a randomly stepped counter (+12, 0-10) through table 0x802715b0 (a blink-like
  sequence). The pair is read by the dancer model (vtable +52); what it switches on the model is the open
  part. Break performance: value 2 (0, 1) for its whole length (snapshot: block 2 / 0 / 1).
- **What the script drives: the dancers' faces (decoded 2026-11-15).** The head model's materials carry a
  slot number (material +21: 1 = eyes, 7 textures; 2 = mouth, 3 textures; checked in CHR20100's head).
  0x80057d14 (each frame) reads the dancer's (a, b) and, through the table at 0x80271508, picks the
  texture each slot shows (0x8015d864 sets runtime material +16 for every material of that slot):
  - mouth (slot 2) = row a's texture: a 0 / 1 / 2 -> mouth 0 / 1 / 2 (rows +12: [-1, 0, -1], [-1, 1, 1],
    [-1, 2, 1]; the third column is for Mii heads, 0x80188a04);
  - eyes (slot 1) = table +48 [b]: b 0..6 -> eye texture 0, 2, 5, 3, 4, 1, 6.
  - The starred values blink: b follows a counter that steps at random (0x80131c0c) through
    0x802715b0 = [-1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1] (-1 = keep b), i.e. eyes 0 -> 2 -> 5 -> 2 -> 0.
  So the "timer" is a face script: e.g. style 0 type 1 = value 0 (mouth 0, blinking) until frame 12,
  7 (mouth 1, eyes 6) until frame 76, then 9 (mouth 2, eyes 6) to the end; the break = value 2 (mouth 0,
  eyes 2) throughout. Outside a performance the manager value is the normal one (+116 = -1 -> +124).
  DDR II PC's own dancer has a visor and no face, so there is nothing for it to drive there.
- **Why DDR II PC can't show it yet.** DDR II's dancers are drawn with their own shader, which uses
  character/CHR_SHADER.bin (two textures; named next to game/shadowmask.tpl at 0x80290cd7, loaded near
  0x80182830). DDR II PC draws its dancers with stand-in lighting, so there is no real ambient term to
  change. The game's own dancers are left as they are.
- **DDR II PC (2026-11-15).** The server works out each stage's dancer ambient (/api/ddr2stage dancerAmb,
  one per variant: stage 16 = 8274a5, 12 = 998a66, extras 420 = 8a8a72, 405 = 8cb29a, all equal to
  memory; single-precision products truncated) and the table's performance colours (/api/appeal
  lights: style 0 type 0 = d278b4, break = 506e82). While a performance runs, DDR II PC's own dancer
  (the graphite one) multiplies its ambient term by performance colour / the current variant's colour,
  switching at once at the start and back at the end. Checked in a test play (slot 76, stage 15,
  variant 1: 847299 -> 96b4d2, tint 1.14 / 1.58 / 1.37, gone when the performance ended).
- **DANCER LIGHTING option (2026-11-15).** DDR II PC (the default) keeps the stand-in lighting. GAME STYLE
  lights DDR II PC's own dancer only, with the decoded rules: texture x material x the dancers' ambient
  colour (the stage's preset colour for the current variant, swapped for the performance colour during
  a combo performance) + the CHR_SHADER ramp (/api/ddr2shader, the 256 x 256 texture; the 64 x 64 one is
  plain white) looked up at (N.L, N.L) with L = the light from the camera (eye - target). Per pixel here,
  per vertex in GX. Dancers loaded from a file are not affected.

### Combo performance: the motion checked in the Wings snapshots (2026-11-15)

- The lead was dancer id 206 (CHR207; flag bit 0 = 0, so alt 0). Model 0x809e6ba0 has +2040 = 10 (the ten appeal clips loaded) and +2044 = 152 (where they start in its motion list).
  - Correction: 0x80061c4c uses clip +2044 + idx when +2040 > 0, not ≤ 0.
- Snapshot 406.90 (break performance running): model +3796 = 160 = 152 + 8, i.e. clip 8, the break, alt 0. +3792 = 0.017 s into it, +3808 = 1.667 s long (100 frames), +3824 speed 1.0. The dance clip before it ran at 1.009 (tempo-scaled); the performance clip runs in plain seconds.
- Dancer-manager +148 = 1 (playing), +152 = 0 (player), +156 = 4 (type).
- DDR II PC matches all of this: clip type × 2 + alt from the dancer's flag, its length at 60 frames a second, and the lead only.

## Challenge task (decoded 2026-11-15, checked against two Dolphin MEM1 dumps and three result screens)

- **State:** game data (r13 - 29392) + 12060, 36 bytes (0x8011f920 / 0x8011f9c4 set it up): +0 started,
  +20 lock (1 = never steps), bytes +24..+29 = indexes (task, song, difficulty, gauge, combo, rank),
  +32 = the DDR points at the last step. A new save gets song index = rand % 255, the rest 0.
- **Tables (base 0x80291bc8).** +0: 20 words, 1 = ANY SONG, 0 = a specified song
  ([1,1,0,1,1,0,1,1,0,1,1,0,0,1,0,1,1,1,1,0]). Song ids (slot = id + 1) for the three DDR-point ranges
  (<= 899,999 / <= 1,679,999 / more): +80 (27), +188 (19), +264 (19). Difficulty level +340 / +400 / +460
  (15 each, 0 BEGINNER .. 4 Challenge), gauge bytes 0x802e9600 + 8 x range (7: 60 / 75 / 90 / 100),
  MAX COMBO halfwords +520 / +544 / +568 (12; -1 = FULL COMBO), rank +592 / +628 / +664 (9: 2 C .. 5 AA).
  The range comes from the points stored at +32.
- **Points (0x80120334 / 0x801203f4 / 0x80120508 / 0x801205ac):** difficulty 500 / 750 / 1000 / 1500 /
  2000; gauge 60 250, 75 500, 90 750, 100 1000; combo 50 500, 100 750, 200 1000, FULL COMBO 1500; rank
  C 250, B 500, A 750, AA 1000. Each pays when the play's value is at least the task's.
- **Which song counts (0x80120774):** ANY SONG, or the task's song id or its pair (even id + 1 / odd id - 1).
- **Stepping (0x8011fa98, from the results 0x800e7814):** after a rewarded play, while something is
  still left to unlock (reward list +148), unless the lock is set and outside modes 3 / 6. The first
  call only marks it started; later calls add 1 to every index (mod 20 / 15 / 7 / 12 / 9). A
  specified-song task then steps the song index (mod the range's list) to the next unlocked song
  (0x8009bad8); if none is, it walks the first range's list.
- **+12 / +16 = the play setup's mode and style** (select record +0 / +4, copied by 0x8006eac8 with
  setters 0x8011feac / 0x8011feb4 when the mode is picked: the mode menu's table 0x80272358, 16 bytes an
  item [?, mode, style, ?] = [2,1,1] [2,2,7] [27,3,5] [21,6,0] [12,1,0]; the style screen 0x80097414
  rewrites +4 with 5 / 6 / 7 / 8 by the number of players). Every dump: 1 / 1 (normal play). When
  style = 4, or mode = 2 with style = 8, a required BEGINNER becomes BASIC and EXPERT becomes DIFFICULT
  (0x8011ff88), i.e. the task's difficulty is held to BASIC..DIFFICULT. The copy is made at SELECT MODE
  (the table's columns), so the style screen's choice does not reach +16 - except in 0x80097414's cursor-1
  path, which sets select +4 = 8 (+8 = 2) when +312 = 0 and calls the +16 setter (7 otherwise). Doubles
  dump (main mode, DOUBLE): +12 / +16 = 1 / 1 and +4 = 6 (the style screen's +16 value), so DOUBLE does not
  trigger it. Mode 2 is the second SELECT MODE card (its table row [2, 2, 7]); mode 2 + style 8 is that
  card with the cursor-1 choice. Style 4 comes from no path found. DDR II PC awards tasks only in its
  normal play, where the rule never applies.
- **Checked:** dump 1 = indexes 0 / 85 / 0 / 0 / 0 / 0 (ANY SONG: BEGINNER 500, 60% 250, 50 500, C 250 -
  the result screens' 1,500 bonus); dump 2 = 2 / 5 / 2 / 2 / 2 / 2: song id 10 (Spice up your life),
  BASIC 750, 75% 500, MAX COMBO 100 750, RANK B 500 - exactly the NEXT CHALLENGE TASK screen.
- **DDR II PC:** /api/ddr2tasks serves the tables; each profile keeps its own task position; the result
  card shows ANY SONG or the song, and after it the NEXT CHALLENGE TASK card (pink, STILL NEEDED).
- **New profile, checked (fourth dump + two screens):** after the first play (BEGINNER cleared, 500 bonus,
  2,000 points in all) the task was started = 1, indexes 0 / 85 / 0 / 0 / 0 / 0, stored points 0 - the
  same song index 85 as the other profile (the same random draw at start-up), and the NEXT CHALLENGE TASK
  card showed the same ANY SONG set (the first step only starts it). The stored points are the profile's
  points field (+5284 +1256, 0x800f3b68) when the step runs: 0 there, i.e. before that play's points.
- **Song select:** the task's song (and its pair) shows the "Specified Song" sticker over its jacket
  (selMusic_us.bin /0/3/0/4, 128 x 64; placed from the Wii's song select). A third dump (song select,
  Spice up your life highlighted) had the same task state: 2 / 5 / 2 / 2 / 2 / 2, points 7500.

## MY CHARACTER (song select tile; Wii footage 2026-11-15)

- Song select's first tiles: COURSE MUSIC, MY CHARACTER, FAVORITE MUSIC, RANDOM; while one is on, BPM and
  length are blank and every level is 0. MY CHARACTER opens a 3 x 3 page grid with pink page arrows,
  the highlighted dancer's name in a box at the bottom left and its 3D model above it. Page 1: RANDOM ALL,
  RANDOM (girls), RANDOM (boys), Mii, EMI, DISCO, YUNI, RAGE, RUBY; page 2: Rena, NAOKI, jun, U1, then
  five empty slots. Locked dancers show ??? (name plate "???").
- Names: select_bin_us.bin /2/2/0/0 (English name plates: DISCO, EMI, RUBY, RAGE, YUNI, Rena, U1, jun,
  NAOKI, Root, Harmony, Mii, Bossa, Nova, Hip, Hop, RANDOM ALL, RANDOM girl / boy, ???); /2/1/0/3 the
  French set. Portraits: /2/3/0/0 icons 0-15 (80 x 80).
- Ids (file CHR = game id + 1): 200 EMI, 201 DISCO, 202 RUBY, 203 YUNI, 204 RAGE (their outfits in the unlock
  table), 205 Rena, 206 NAOKI, 207 jun, 208 U1. Sex = character flags 0x8026e9b0 [id - 200] & 3: 1 girl
  (EMI, RUBY, YUNI, Rena, jun), 2 boy (DISCO, RAGE, NAOKI, U1).
- DDR II PC: the MY CHARACTER tile (before RANDOM) opens the same grid with each dancer's name in a black
  box (no portraits, no 3D model), Mii shown but not selectable; the pick (or RANDOM ALL / girls / boys)
  is the DDR II DANCER setting.

## 3 and 4 players (DDR II PC, 2026-11-15)

- SELECT NUMBER OF PLAYERS 3 / 4 are open for the modes that take two players (free play, RELAXED,
  MAX COMBO). Each player picks record data in turn (a record can't be used twice), then SELECT STYLE
  offers NORMAL (VERSUS), FRIENDSHIP and SYNC (no doubles with 3 / 4). Players 3 / 4 use mats P3 / P4,
  change their own difficulty on song select (or share player 1's in FRIENDSHIP / SYNC), play their own
  chart with their own options, and get their own results, DDR points and challenge task.
- **4-player play screen (matched to a Wii screenshot, NORMAL):** fields centred at 14.4 / 38.1 / 62.0 /
  85.6% of the width, each 16.6% wide, arrows at 31% of the height, each field a full-height see-through
  column in the player's colour (1 blue, 2 red, 3 green, 4 yellow); meter panels at 61% size, centred at
  19.5% of the height, with the file's per-player badges (METER_FM_US.bin /0/10 #0-3) and gauge frames
  (/0/5 #0-3). Panels: blue / red from /0/4 #0 / #1; for 3 / 4 the file's green / yellow (#2 / #3) are a
  pill shape unlike the screenshot, so the grey panel (#5) is tinted (approximation). Not yet: the
  STYLE NORMAL plate at the top, the 3-player layout (spread the same way, provisional).
- **PROVISIONAL (not from the game):** the results put two cards each side of the jacket with each player's counts under
  their card; song select lists players 3 / 4 and their difficulties under the panel. The Wii's own
  3 / 4 player screens are still to be checked against footage.

## 3 / 4 player meters, DDR POINTS plate, difficulty markers (decoded from the disc, 2026-11-15)
- **game/METER_MULTI_US.bin** holds the multi-player meters: three WII sets, each [TPL x 14, CAE_WII]:
  /0 (block 0x72240) 2-player demo layout, /1 (0xc9760) **3 players**, /2 (0x11e100) **4 players**. Per set:
  /0/0 mode words (NORMAL, SYNC, FRIENDSHIP), /0/1 STYLE plate (230 x 36), /0/4 panels (3P 208 x 76, 4P 158 x 76:
  blue, red, green, yellow), /0/5 gauge frames, /0/6 difficulty words (BEGINNER..CHALLENGE), /0/7 gauge pill,
  /0/9 DANGER!!, /0/10 badges 1-4.
- CAE parts (first frame): 1p_bar0n panels at y 97 (3P x 311 / 521 / 730, 4P 293 / 444 / 596 / 747, pivot 79,38
  for 4P); 1p_gauge01 (3P sx 0.75, 4P 0.55); diff words; Num_00 score (its x = the middle of the last digit);
  gauge01 one part per pill; 1p_box01 badges rotated -8; style_wind02 STYLE plate (520, 40) pivot (115, 18) and
  font_single01 word (558, 41). Field places (dummy01, a 0-640 strip): 3P 110 / 320 / 530 (scale 0.9), 4P 93 / 244
  / 397 / 547 (0.75).
- **Screen mapping, checked against the Wii 3- and 4-player screenshots:** each panel's x lands at
  640 + (x - 520) x 2 on a 1280-wide screen; the player's other parts keep their distance from the panel at 1.5x,
  y is 1.5x, pictures 1.5x. (Measured field widths: 4P 16.6% of the screen, 3P 20.6%; arrows at y 224 / 232.)
- **DDR POINTS plate** (song select, bottom left; also on 3/4-player results): 2Dcommon/comAF_US.bin CAE 0x2e2840
  (its tracks are 16-byte headers: 0, fps 30, count, offset; three tracks a part: in, hold, out). End of the in
  track, on the 854 x 480 widescreen layout (1.5x straight across): plate /7/0/2 at (74.45, 432.85) pivot (52, 12)
  rot -3; COMPLETE!! /7/0/1 at (100.38, 449.52) pivot (70, 15) rot -3.25 (shown once no unlock is left); the points
  Num_00 at (125.45, 445.95) 0.7x rot -3 (digit alignment not decoded: centred there).
- **SELECT DIFFICULTY player markers:** selMusic_us.bin /0/10 = [TPL x 8, CAE 0x178ae0]. sel_1p-4p (TPLs
  /0/10/0/4-7, 120 x 42 each, 4 pictures): each picture is player n's badge n-1 slots (25 units) out with its
  coloured line back to the button, at its own height, so players on the same button line up 1 2 3 4 with
  stacked lines. Placed at (133, -1) from the button's middle, pivot (60, 21). Every picked button gets the
  orange frame. 1p-4p_box01 (badges at -26 / -3.7 / 18.7 / 41, y 10.5, rot -10, 0.55x, hidden at first) are
  the confirmed-player badges on the button; where the game puts them on screen is not matched yet.
- **FRIENDSHIP / SYNC with 3 / 4 players** (Wii screenshot, 3P FRIENDSHIP): game/METER_FS2_US.bin [TPL x 17, CAE
  0x4e220]. One shared field in the middle (field mark at 320, full size); the pink group panel 0p_bar01 (520, 60)
  pivot (123, 38) with its gauge (539, 65), difficulty (525, 34.5), score Num (619.5, 72) 0.8x, DANGER (566, 54.5),
  badge (419.5, 54) rot -8 and the PARTY sticker (418, 53); the STYLE plate style_wind01 (322, 46.5) with the word
  (322, 38.5) 0.9x (/0/0: 3 SYNC, 4 FRIENDSHIP); a tag per player: 1p_bar03 at 0.85 x 0.45 with PLAYER n on it at
  (319, 120) P1, (730, 120) P2, (319, 297) P3, (729, 297) P4. Same mapping as the meters. DDR II PC draws player 1's
  field (the group's judgments are shared); the other players' own steps are not shown on it.
- **3 / 4 player RESULTS** (Wii 4-player screenshot): selResult_us.bin /0/1 (CAE 0xedf20, the screen) and /0/2
  (CAE 0x12b580, one card), laid out at 1.5x around 520 (not the meters' 2x spread). RESULTS tab (520, 11 / 29),
  jacket frame (520, 139), jacket (520, 128) 0.5x, style words /0/1/0/4 (520, 205: NORMAL, BATTLE, MULTI, SYNC,
  FRIENDSHIP, FAMILY, DOUBLE), the multi judgment list /0/1/0/1 #2 (520, 327); cards /0/2/0/4 (blue, red, green,
  yellow, grey, pink) at (326, 122) (714, 122) (326, 327) (714, 327) for players 1-4, pivot (72, 99); PLAYER n
  (0, -81); difficulty (0, -55); the grade layouts hang off dummy01 (0, 29): letter (0, -8), NEW RECORD (-5, -12).
  CHANGE INFO turns the cards to the count window /0/2/0/2 (0, 8) pivot (58, 77): MARVELOUS .. MAX COMBO at x 16.5,
  y -60 .. 45 (15 apart, lined up with the middle list), the score at (32, 61). 3 players use the first three
  places (not seen). DDR POINTS plate bottom left as on the song select.
- **Lesson music** (see DDR SCHOOL): slot 200 + lesson number, from the sound table.

### Combo performance with 2 players (Dolphin camtrace 20261115_172342, 2026-11-15)

- 2-player play, player 1 reached a run of 54 then missed. Combo object (CGame +1040, at 0x808b42c0 in this
  run): +0 = 0 (performances on), +4 = 1 (song style 1), five 12-byte entries from +8 (level, +4 0, +8 -1;
  the setup clears the +4 words to 0, every entry +8 = -1 so all use player block 0), +64 / +68 / +72 = -1.
- Player 1's block: run 5 -> 54, combo 54 -> 0, target 104; **+52 (depth) = 0** in every snapshot. So the
  type-0 check (depth >= 1, run >= 50) never passed, and at the miss the level went 0 -> 1000 with no break
  performance (+72 stayed -1). The camera shows no performance move either.
- Solved: +52 is the chart's difficulty, and this play was on BEGINNER (+48 level 2), where the game gives no
  performance (the user confirmed it was a one-player play).

### Dancer facing on DDR II stages (2026-11-15, user's boss-flight videos)
- The game turns no dancer: the formation spots (s1_pos / s1_look) have identity rotations, and the dance
  file's own orientation is drawn as is. Forward kinematics of the files: a standing dance (HP2U_008 S) has
  its toes along +z; the boss flight (HP4U_053 L02) has its head along +z (Hips -> Head (0, 1.4, 3.8)) and
  its toes along -z - head-first towards the camera, which sits on the +z side (camtrace eye relative z > 0).
- DDR II PC had turned every stage dancer 180 degrees ("to face the camera", from the first frame's hips),
  which made the boss dancers fly feet-first ("backwards" next to the real game). Fixed: on a DDR II stage
  the dance keeps the file's facing.
- **Double** on the song select: only the versions (short / full) with Double charts count - a song whose
  current version has none shows the other one, and the SHORT / FULL choice only appears when both have them.

### Lessons (2026-11-15, user's footage)
- The lesson dancer is always DISCO (file CHR202), the teacher - DDR II PC forces him for step lessons.
- Step-lesson arrows are coloured by foot: lane 4 = left foot (lesson 1's left arrows) blue, lane 5 = right
  foot red (the game's explanation text: "Left foot arrows are in blue, right foot arrows are in red").
  The server keeps the foot in the converted chart's flag top bits (1 left, 2 right).
- The dancer-panel turn was dropped too: the dance files face +z, the panel camera sits on +z.
- **Stage and dance (Dolphin camtrace of Step Lesson 1, 2026-11-15):** memory held the STG110 models (stage
  19 = STG020.bin; STG023.bin is the same file) and the cue-sheet cameras HP4U_DDR001L_CAM101-107 plus
  HP4U_DEF_CAM_05_40 / 78 / 81 - the cameras of dance HP4U_001L (S01, L01-L03, E01; formation s1_pos_07).
  The camera stays on the +z side (eye (0, 13, 36) -> (0, 9, 0), then (22.3, 13.3, 22.3) ...). DDR II PC
  now gives step lessons that stage and dance. (HP4U_006L carries DDR006L cameras: the choreograph lessons'
  dance, presumably - not seen.)

### Explanation screens (comAF_US.bin /5/4, 2026-11-15)
- One TPL of whole pages: 0 / 1 side panels (107 x 480), 2 / 3 854 x 24 strips, 4 Explanation of Arrow,
  5-10 Explanation of STEP LESSON 1-6, 11 Explanation of Freeze Arrow (640 x 480 each). Drawn as the 854 x 480
  screen at 1.5x: left panel, page, right panel; the "(A) Let's dance!" button is comAF hint 34.
- A step lesson starts with its page (user's footage). The freeze-arrow guide now uses page 11 too.
- SSQ_CMN.bin also holds the lesson arrows: sheet 11 red, sheet 12 blue (heads and freeze bodies) - not used
  yet (DDR II PC tints its notes blue / red instead).

### Battle opponent (COM) — decoded 2026-11-15

- **Generator (DDR II 0x80034cc8, the same code in Hottest Party 2):** runs for a player whose block +0x58254 (the count of judgeable arrow notes, +36 bit 0x4000; 0x80034a80) is above 0, with an 18-byte profile copied to block +0x5829c.
  - Bytes 0-5 are weights for BOO, ALMOST, GOOD, GREAT, PERFECT, MARVELOUS. Unless all six are 0 or 255, each non-zero weight w becomes w + j − trunc(j/4) with j = trunc(2 × (rand % total) / 100).
  - Count for each judgment = trunc(N × w' / Σw'); the rest goes to the first non-zero weight. The list is filled in judgment order, then shuffled with 10N swaps (index k % N with rand % N).
  - Each note gets its judgment (0x8002dac8 stores it in note +27) and a simulated press inside that judgment's window, early or late at random (0x8002d668), so a jump is decided by whichever press is later.
  - Byte 6 is a percentage: per measure (up to 400) a bit says whether off-beat second panels of jumps are played; on-beat ones roll rand % 100 < byte 6. A freeze is held (note +16 |= 4) only when its press is played and judged GREAT or better.
  - Byte 17 = 95-99 (100 in the default) and bytes 7-15 are not read by this routine.
- **Default profile 0x8026F0E0** [0,0,0,0,0,255,100,…]: every step MARVELOUS (demo play). The demo/attract setups (0x80049a88, 0x8004af04) use 0x8026F4EC[level] with the song record's +408 level (9 for 197 songs).
- **HP2 GROOVE ARENA (0x8001c7a4(arena, row, group)):** arenas 0-9 / 20-29 use 0x801d80f0 + idx × 288 + group × 72 + row × 18; arenas 40-42 use 0x801d8c30; group −1 = the default. Every arena's 4 × 4 block holds the same numbers.
  - Battle setup 0x80034860: group = (arena state == 3, i.e. every request tier done) + 2 × (save byte 1 == 1, round 2). Row = the setup word +200 (the chart's difficulty, the same word DDR II's 0x8002874c keeps at +3316).
  - Rows: g0 [4,5,5,40,26,20 | 30], g1 [3,3,4,40,30,20 | 40/30/25/25], g2 [2,2,2,40,40,20 | 65/60/55/55], g3 [0,0,2,34,48,25 | 85/75/70/70].
- **DDR II** keeps the same table at 0x8026F0F4 (groups 0-3, rows 0-4, groups 4-7 empty) behind 0x80027b64, but only ever asks it for the default. The PC TOURNAMENT uses HP2's rule with one round (group 1 once the stage is cleared).
- **Hottest Party 1** has a different system: 6-byte rows summing to 100 at 0x801f36b8 (72-byte blocks, read by 0x80154290 with a setting byte at 0x8020e870+29). It is not decoded, so GROOVE CIRCUIT's venue masters keep the estimate.
- **PC (web/game.js comRival):** the opponent's judgments are drawn as above and scored by the player's own rules (DDR II or HP), giving its score at every step (the battle bar) and its final score (the BEAT THE DANCER check). Simplified: a jump takes one of its panels' judgments at random (the later press), and a freeze in a jump is held by byte 6's chance.

## Character picker and lighting update

MY CHARACTER reads its portraits and RANDOM/lock/empty icons from the configured
extracted disc at select/select_bin_us.bin, WII path 2/3/0/0, through
/api/ddr2charicon/<index>. No menu archive or extracted portrait is bundled.
Missing icons fall back to names. Character preview uses the existing disc-model
converter and dance loader, with an independent renderer so browsing does not
change the selected gameplay dancer. Locked characters have no model preview.
The GAME STYLE lighting approximation now also covers loaded dancers, backups,
reflections and the boss opening. It is not a verified reconstruction of GX.
