DDR II PC - version 3
=====================

Plays the songs from your extracted Dance Dance Revolution II (USA) folder in your
web browser. It only reads the game folder; nothing in it is changed or copied.
No installs needed beyond Python (which you already have).

Start
  Double-click "Play DDR II PC.bat". A small window opens (keep it open while you play)
  and your browser opens the game. Press Enter or click to start.
  It looks for "Dance Dance Revolution II (USA) (En,Fr,Es)" in Downloads; if it can't
  find it, it asks you to pick the folder.

Keys (default)
  Arrow keys .......... P1 arrows (and menus)
  Numpad 4 2 8 6 ...... P2 arrows (Double uses P1 + P2)
  2 or Numpad Enter ... Player 2 joins (song select)
  Enter / Esc / Tab ... OK / Back / Options
  Laid out like DDR II's: a grid of option buttons (Arrows + Enter), each opening a page with a row
  per player (player 2's row appears in VERSUS) or a list of settings, then CONFIRM.
  Player options: SPEED, APPEARANCE, ROTATE (turn), ARROW (colors), FREEZE ARROW, JUMP (OFF = no
  jumps), CUT (ON = quarter-note steps only), GUIDELINE (measure lines), EVALUATION (show judgment
  and combo), MARVELOUS, N.G. COMBO (OFF like the real DDR II), GAME OVER (NORMAL / OFF).
  GAME PLAY: style, GAME LEVEL (MEDIUM is the game's own Dance Gauge; EASY/HARD/VERY HARD scale it -
  an approximation), announcer voice, song unlocks. GRAPHIC: song videos, video size, screen shape,
  full screen. DANCE: the dancer and your own dancer model. SOUND: menu sounds/music, audio timing
  offset (raise it if the arrows feel early). Plus Custom songs, Player data, Controls, Dance mats,
  Game folder.

Dance mat or gamepad
  Options > Controls... > pick an action > Enter > press the panel or button.
  Arrow keys, Enter and Esc always work in menus, so you can't lock yourself out.

Choosing a song (like the game)
  Enter on a song: songs with two versions open the SELECT SONG LENGTH pop-up (SHORT / FULL), then
  SELECT DIFFICULTY (Up/Down, Enter starts, Esc goes back a step). Before a BEGINNER song with freeze
  arrows, a short FREEZE ARROWS explanation shows once per player (Options > GAME PLAY > FREEZE GUIDE
  turns it off).

Song versions and CHALLENGE
  Songs that come in two versions have the game's SHORT / FULL tabs; press Space to switch.
  Songs with only one version don't show the tabs. CHALLENGE charts (the 5th row) are
  playable on the songs that have them, with the game's own levels and Groove Radar.

What it uses from the game
  Arrows, freeze arrows, step zone, the top panel with the LED life gauge, judgments,
  combo numbers, score numbers,
  READY / HERE WE GO / FULL COMBO / FINISH banners, song select and results art,
  menu sound effects and the announcer. Licensed songs play their music video behind
  the arrows; other songs use the game's blue gameplay backdrop (the real game also shows
  its 3D dancers there, which aren't in yet).

Options
  Style (Single/Double), Speed x0.25-x8, Appearance (Hidden/Sudden/Stealth),
  Turn (Mirror/Left/Right/Shuffle), Freeze arrows, Freeze N.G. breaks combo (OFF like the real
  DDR II, which keeps your combo through a freeze N.G.; ON like the arcade), Marvelous (ON/OFF), Arrow colors,
  Gauge (Normal/No fail), Song videos, Video size (Wii monitor beside the arrows, or full
  screen), Screen shape (16:9 or 4:3), Full screen, Announcer, Menu sounds, Menu music, Song unlocks,
  Audio offset (ms): if the arrows feel early, raise it; if late, lower it.

Players (user data)
  Like the game's user data, each player has their own name, DDR points, records and play
  options (speed, style, turn, colors...). Pick or create a player after the title screen;
  switch any time with Options > Change player. Tab on the player list deletes one.
  Controls, audio offset and screen settings are shared by everyone.

Two players (VERSUS)
  On song select press 2 (or P2 Start, Numpad Enter by default) and choose GUEST or one of the
  saved players. Each player gets their own lanes (1P left, 2P right), difficulty, life gauge,
  score and result. P1 picks difficulty with P1 Up/Down, P2 with P2 Up/Down; either side can
  change the song. P2 plays with their own saved speed and options (a guest uses P1's).
  The song keeps going until both players fail. Results use the game's VERSUS panel, and each
  saved player gets their own records and DDR points. Press 2 again to switch or remove player 2.
  For two dance mats, map P2 Left/Down/Up/Right and P2 Start to the second mat in Controls.

Double VERSUS (4 mats)
  Set Style to Double, then let player 2 join. Each player plays Double on their own two mats:
  player 1 = P1 (left mat) + P2 (right mat), player 2 = P3 (left mat) + P4 (right mat).
  Map each mat once in Options > Controls (P3/P4 have no keyboard keys by default).
  Before the first VERSUS game with mats (and whenever a mat is plugged in or out) the game asks
  each player to step on their mats in turn, so it always knows which mat is which, even if
  Windows numbers them differently next time. You can also run it from Options > Check dance mats.
  Esc skips it and keeps the mats as they are.

Custom songs (StepMania)
  Options > Custom songs... : make your own folders (like "Rock" or "Anime"), open one, then
  "+ IMPORT SONGS" to pick .sm / .ssc files (you can pick several), or "+ IMPORT A FOLDER OF SONGS"
  to bring in a whole pack. Each song's chart, music and pictures are copied into
  DDR II PC\Custom Songs\<folder>\, so your originals stay where they are. Tab removes a song
  (or a whole folder) from DDR II PC; your original files are not touched.
  On song select your folders sit next to RANDOM at the start of the list, each as its own
  tile. Press Enter on a folder to open it and Esc to go back to all songs. A search (S) or the
  favorites list (W) looks through every song, your folders included.
  Videos: a song's background video (from #BGCHANGES or #BACKGROUND, starting at the beat the
  song says) plays like the game's song videos (Options > Video size: Wii monitor or full screen).
  .mp4 / .webm / .m4v play as they are. Older .avi / .mpg / .wmv videos are turned into .mp4 when
  you import, if ffmpeg is installed (on PATH, or ffmpeg.exe in the DDR II PC folder); without
  ffmpeg those videos are skipped and the song plays over the normal backdrop.
  Charts: Beginner / Easy / Medium / Hard / Challenge (an Edit chart fills an empty CHALLENGE row),
  Single and Double, BPM changes and stops, holds (rolls play as holds). Mines, lifts and fakes
  are left out. Music can be .ogg, .mp3 or .wav. Records and DDR points work like the game's songs.
  You can also drop song folders straight into Custom Songs\<folder>\ yourself.

Replicant D-action
  The game's boss folder: Shiny World, Sakura Sunrise, Pierce The Sky, 888, DELTA MAX, New Decade,
  Anti-Matter, POSSESSION, London EVOLVED and Valkyrie dimension sit together at the end of the
  song list, in the game's order, with a darker red screen. Press R on song select to jump there
  and back. Getting AA or better on any chart of one of these songs earns its medal (10 in all);
  medals are kept in each player's data and shown on song select ("MEDAL GET!" on results).
  With Song unlocks ON, each song appears when your DDR points unlock it, like the game.

Dancer
  An original dancer (a white mannequin with a cyan visor) performs the game's own choreography
  for each song, from your disc's dance files, in time with the beat. The game picks a dance set
  for each song; the dancer plays its intro, its loop sections, then its ending.
  Options > Dancer turns it on or off.
  Options > Dancer model: press Enter to pick your own .glb or .gltf model (from Blender, VRoid
  Studio, Mixamo...). Any humanoid with a normal skeleton works: bones are matched by name
  (Mixamo "mixamorig:LeftArm", VRoid "J_Bip_L_UpperArm", "upperarm_l", or plain "LeftArm").
  Left/Right on that row switches between the built-in dancer and your model.

Records and DDR points
  Your best score, grade and full combo for each chart are saved in save.json and shown on
  song select. Every play earns DDR points from the game's own table (more for harder
  difficulties and better grades) plus the game's "Any song" challenge bonuses.
  Song unlocks are built in but OFF. Turn on "Song unlocks (DDR points)" in Options to use the
  game's own unlock schedule: Diamond Night at 15,000 points, Summer Fairytale at 60,000, and so
  on up to DanceDanceRevolution at 2,000,000 (from RemyWiki). Outfits and Mii parts on that list
  aren't in DDR II PC but still show as the next goal. Turning it off shows every song again.

Timing and scoring (read from the game's own code)
  Windows, in 1/150 s ticks (early / late):
    Marvelous -2/+2 (13 ms), Perfect -6/+7 (40/47 ms), Great -16/+15 (107/100 ms),
    Good -25/+30 (167/200 ms). Anything not hit by +200 ms is a BOO.
  Score: Marvelous/Perfect/Freeze OK = 2, Great = 1, else 0, out of 2 per step;
    max 1,000,000, rounded down to 10.
  Combo continues on Good or better.
  Life: starts half full; gains/losses depend on difficulty (Beginner/Basic +18/+13,
    Difficult +14/+9, Expert +11/+7, BOO -40), with the game's extra rules for
    misses in a row and a full gauge.
  Grade (AAA/AA/A/B/C/D, E if failed) uses the game's cut-offs for each difficulty.

Not done yet
  - Dancers and 3D stages, Workout and other modes.
  - Songs added with the Riivolution patch (like MAGIC PARADE) aren't included yet.

If something goes wrong, send log.txt from this folder (and a screenshot).


Setup (first start)
  When DDR II PC starts without a game or ffmpeg set, it opens SETUP:
  - Wii disc: pick your Dance Dance Revolution II (USA) disc image (.iso, .nkit.iso, .wbfs, .rvz).
    The disc is only read. If its files are already extracted next to it, those are used; otherwise
    they are copied out once into "Game Files" using DolphinTool.exe, which comes with Dolphin
    (it is found automatically in your Dolphin folder; press D to pick it yourself).
  - ffmpeg.exe: unzip the ffmpeg download and pick bin\ffmpeg.exe. It is used for custom songs'
    old-format videos. Press K to skip it.
  - or pick an already-extracted game folder instead of a disc.
  Options > GAME FOLDER opens SETUP again.

Deleting a custom folder
  Options > CUSTOM SONGS, open the folder, choose "- DELETE THIS FOLDER" (or press Tab on a folder
  in the folder list). Only DDR II PC's copy is deleted; your original song files stay.

Cabinet lights (Ultimarc PAC Drive)
  A panel's light is on while it's stepped on. Wiring: P1 Left, Down, Up, Right on outputs 1-4,
  P2 on 5-8, P3 on 9-12, P4 on 13-16.
  Needs PacDrive64.dll from Ultimarc's PacDrive SDK (http://www.ultimarc.com/PacDriveSDK.zip):
  put it next to DDR II PC, or pick it in Options > LIGHTS > PAC DRIVE DLL.
  Options > LIGHTS > LIGHT TEST lights outputs 1 to 16 in turn.
  To change which pin lights which arrow: Options > LIGHTS, go down to the arrow (P1 LEFT ... P4 RIGHT)
  and press Left/Right to pick its pin (1-16, 17-32 on a second board, or OFF). The chosen pin lights
  up while you pick it. RESET PINS puts them all back.

Style select
  After picking your player you choose SINGLE, DOUBLE, 2 PLAYERS (one mat each) or 2 PLAYERS DOUBLE
  (two mats each, four mats). For the 2-player styles you then pick who player 2 is. In the Double
  styles, songs without Double charts are hidden. Esc on song select goes back to style select.

DEMO player
  A player named DEMO plays every song by itself, each step dead on time and every freeze held.
  DEMO plays keep no records or points.

Hottest Party songs (second disc)
  If you also have Dance Dance Revolution Hottest Party (Wii, USA), its 50 songs show up as a
  HOTTEST PARTY tile next to RANDOM (Single only - Hottest Party has no Double charts).
  Add it in SETUP (Options > GAME FOLDER): pick the disc on the "Extra disc" row, or press H and
  pick a folder you already extracted. A folder named "...Hottest Party..." in Downloads or on the
  Desktop is found by itself. X takes the songs off the list again (nothing is deleted).
  Everything comes from your disc: step charts, music, previews and the song banners. Hand markers
  are left out, every arrow is a normal step. The levels shown are the game's own.
  The disc is only read. A disc image is copied out once into "Game Files (Hottest Party)".
  Inside the HOTTEST PARTY folder, song select uses Hottest Party's own moving background (the
  orange gridded sphere and circles), and every Hottest Party song plays on its 3D stage from the
  disc, with the stage's own animation and camera moves. Options > DANCE > HOTTEST PARTY STAGE:
  SONG'S OWN (default), RANDOM, or OFF.
  Hottest Party's own dancers dance on the stage, set up the way the game does it (read from its
  code): your character in front (Options > DANCE > HOTTEST PARTY DANCER) and four backup dancers -
  two of the game's four outfit pairs, picked at random each song. Each song's dance follows the
  game's own timeline (which move starts on which measure, the lead and the backups separately),
  filmed with the song's own camera.
  The stage: like Free Play on the Wii, a random one of the game's 41 dance stages, or pick one in
  Options > DANCE > HOTTEST PARTY STAGE (STAGE 1-41 in the game's own order, RANDOM, or OFF).

Pick your game
  With the Hottest Party disc added, after you pick your profile you choose the game:
  DANCE DANCE REVOLUTION II (its songs plus your custom songs) or HOTTEST PARTY (its songs).
  In Hottest Party the menus use its background and menu music, the song list has only its songs,
  Double is left out (it has no Double charts), and songs play on its stages with its dancers.
  Esc on the Style screen goes back to the game choice.
  Hottest Party's song select is laid out like the Wii's: the song on the left with its four
  difficulties and level bars, the songs as orange tabs on the right. Up/Down picks the music,
  Left/Right the difficulty, Enter starts. Its pictures (header, banner frame, difficulty bars,
  song name tabs, grades, arrows, scroll bar) are read from your Hottest Party disc as it plays.
  Hottest Party songs also play with its own gameplay screen, read from the disc: its arrows (coloured
  by timing), step zone, freeze arrows, MARVELOUS/PERFECT/... and combo, the gauge with PLAYER 1 and
  the STYLE badge at the top, and the score panel with the difficulty at the bottom left. READY,
  HERE WE GO!!, GO!!, CLEARED, FAILED and FINISHED are the game's too.
  The arrows' colours are the ones the game writes into their palette as it plays (taken from a
  Dolphin texture dump): they cycle through the colours once a measure and the white bar in the
  middle steps down through each beat.
  Backup dancers are set up the way the game does it (read from its memory in Dolphin): four of them
  from two outfit pairs, the two in front the opposite sex to your dancer (a woman gets the men in
  suits, a man gets the women), the other two further back.

HOTTEST PARTY 2
  Point the folder row in Setup at your extracted Hottest Party 2 folder (the one with DATA inside),
  or leave it in Downloads with "Hottest Party 2" in its name and it is found by itself. It shows up
  as a third game on the game choice screen with its 51 songs (the two lessons are left out): its
  charts, music, previews, BPMs, levels and song name tabs all come from the disc. For now it uses
  Hottest Party 1's menus and gameplay screen; its own stages, dancers and menus come next.

EVERY SONG IN EVERY GAME
  Each game's song list starts with its own songs; every other game's songs sit in folders next to
  RANDOM (DANCE DANCE REVOLUTION II, HOTTEST PARTY, HOTTEST PARTY 2), then your custom song folders
  (StepMania songs imported in Custom Songs). A song from another game plays with the look of the
  game you picked. With a Hottest Party stage, songs that aren't Hottest Party 1's borrow the dance
  routine of the Hottest Party song nearest to them in BPM.

DDR CUSTOM
  The fourth game on the game choice screen. You pick, part by part, which game it looks and plays
  like: song select, menus & music, arrows, play board, life bar & score, judgments & combo,
  READY / GO / CLEARED banners, background (DDR II's videos or a Hottest Party 3D stage), dancer
  (DDR II's, Hottest Party's, or none) and score display (7 or 9 digits). Your picks are saved.
  Every song from every game is in its list.

HOTTEST PARTY TIMING AND SCORING
  Read from Hottest Party's own code (found with your Dolphin memory dump) and checked against your
  recording. Hottest Party, Hottest Party 2, and DDR CUSTOM with TIMING & SCORING set to Hottest Party use:
  - Timing windows in 1/60 s frames: MARVELOUS -1..+1, PERFECT -2..+2, GREAT -5..+6, GOOD -14..+13,
    ALMOST -20..+19, BOO -23..+28; later than that is a miss.
  - Score: the chart is worth 1,000 x a value set by its difficulty and level (Expert level 10 =
    10,000,000). Each step or freeze is the k-th event and is worth k x (that total / (T(T+1)/2)),
    T = steps + freezes, times 10 for MARVELOUS, PERFECT, GREAT and freeze O.K., times 5 for GOOD,
    nothing for ALMOST, BOO, misses and N.G. A full MARVELOUS run scores 10 x the total
    (100,000,000 at most); the score is shown with 9 digits.

HOTTEST PARTY 2 STAGES
  Hottest Party 2 songs now play on Hottest Party 2's own 3D stages (files/stage/STGnnn.bin, one at
  random each song) with the stage's own camera moves, cutting every 3 seconds like the game.
  Its models (.zmb), textures (.tpl) and animations (.zab: parts of the stage that move, spin and
  pulse on a 15-second loop) are read from the disc; see-through parts and glowing light beams are
  drawn the way the game marks them.

DDR II'S OWN DANCERS
  DDR II's dancers are now read from your disc instead of the white stand-in. The game keeps them
  in an odd place, sound/stream/character/CHRnnn00.bin (nine dancers, 201-209) with outfits
  CHRnnn01/02.bin; they are the same kind of model as Hottest Party 2's. The app builds each one
  as a .glb model when a song starts (nothing is copied or saved) and it dances the song's own
  DDR II routine.
  Options > DANCE > DDR II DANCER: RANDOM (a different dancer and outfit each song), DANCER 1-9,
  or BUILT-IN (the white stand-in). Your own DANCER MODEL, if you turned it on, still comes first.
  The menu screens keep the stand-in.

GAME MODES (SELECT MODE)
  After picking a game there's now a SELECT MODE screen (every game has every mode, named the way
  that game names it; read from the games' own menus and text):
    DANCE MODE / FREE PLAY   normal play.
    RELAXED MODE             (DDR II, HP3) the Dance Gauge never runs out: you can't fail. Keeps no
                             song records.
    MAX COMBO CHALLENGE      (HP3; HP1 calls it MAX CONTINUOUS COMBO) one combo, song after song:
                             the combo carries over, and the run ends the moment it breaks (BOO,
                             ALMOST, a miss; an N.G. too if N.G. COMBO is on). Your best run for each
                             style is kept and shown on SELECT MODE.
    COURSE / DANCE ORDER     songs in a row on one Dance Gauge: the gauge carries over from song to
                             song and running out ends the course. Pick the difficulty for the whole
                             course with Left/Right (a song without that chart uses its nearest one).
                             Each game has ten courses made from its own songs, easy to hard (the
                             games' own course lists aren't read from the discs yet), plus
                             ORDER EDIT: make up to six of your own (2-6 songs; Enter adds, Esc
                             removes, Tab saves), kept in your player data. Your best total for each
                             course and difficulty is kept.
    WORKOUT MODE             the games' WORKOUT MENU: your WEIGHT (kept in your player data), a
                             TARGET (NO SETTING, PLAY TIME or CALORIES BURNED) and its amount, then
                             songs as usual with a calorie counter at the top of the screen and the
                             running total on the song select. Reaching the target, or Esc on the song
                             select, ends the workout: WORKOUT RESULTS, and it goes in your WORKOUT LOG.
                             Calories are an estimate from your weight, the time danced and the steps
                             you hit (the games don't say how they count theirs): a busy 2-minute song
                             at 60 kg is about 13 kcal.
    TRAINING MODE            (HP2, HP3, DDR II) pick a song, then its TRAINING settings: SPEED
                             (50-150%: the music and arrows together), FROM / TO MEASURE (just the part
                             you want), REPEAT (the part starts again by itself until you press Esc)
                             and ASSIST TICK (a click on every step). You can't fail, and it keeps no
                             song records.
    DDR SCHOOL / LESSON      (every game, needs the Hottest Party 3 disc) Hottest Party 3's 18 lessons:
                             STEP LESSON 1-6, GIMMICK LESSON 1-7, HAND LESSON 1-5. Pick one and the
                             teacher's words (read from the disc) come first; Enter starts it. You
                             play on BEGINNER and can't fail; a lesson you clear shows its grade in
                             the list. For now the gimmick and hand lessons play their arrows as
                             normal arrows (no gimmicks, no hand markers).
    GROOVE CIRCUIT           (Hottest Party) the story mode: nine venues, INCEPTION, GENESIS, TECTONIC,
                             HALLUMINATION, ERU, SYSTRONIX, STARGAZE, U-MATIC and EV. Each venue has the
                             crowd's requests and a VENUE MASTER battle. The requests' wording is read
                             from your disc, and the rules come from that wording: how many songs, the
                             difficulty, and the grade, combo, score or 'Boo' limit. Venues open like the
                             game: INCEPTION first, then four, then three more after four venues, then EV.
                             Clearing EV starts round 2 with the harder requests.
                             "Clear N songs" requests: pick the songs yourself (only Hottest Party songs
                             count; Esc gives up). "Designated" requests and Venue Masters play their own
                             songs: pick the difficulty with Left/Right first. The Venue Master's score
                             climbs through the song in the top corner, and you have to finish above it.
                             (A share of the chart's top score that rises venue by venue: the real
                             master's rule isn't known.) Round 1's songs and unlocks are the real game's;
                             round 2's designated songs aren't in the disc's text, so they're picked from
                             the songs the real round 2 uses. Every song and stage is already open here,
                             so "Unlocks" just says what the real game would unlock.
    GROOVE ARENA             (Hottest Party 2) the story mode, read from the game itself: the request
                             table in sys/main.dol (2 rounds x 11 arenas x 3 requests) gives each
                             arena's requests, their type, difficulty and limit (gauge, GREAT/PERFECT,
                             grade, score, combo, Boo), the designated songs, and each opponent dancer's
                             character and COM level; the requests' wording comes from text_eng.bin.
                             Arenas open in the game's order: FIRST ARENA; GET-A-GO-GO, ARENA SHIFT and
                             FUNKTION JUNCTION; GROOVE BY GROOVE, WONDERLAND and DANCETERIA; PINNACLE
                             (three battles); EXPOSURE (the dance group); then two hidden venues. That
                             opens ROUND 2 (Left/Right on the arena list).
                             Still estimated: the songs inside the designated courses (the game names
                             them by number; their lists aren't decoded yet), and how the COM dancers
                             score (their level is the game's; the score they reach is an estimate
                             that rises with it). The first arena and the hidden venues aren't named in
                             the text.
  Still to come, in this order: DDR II and Hottest Party 3's Tournament, gimmick arrows and hand markers.

HOTTEST PARTY 3
  Hottest Party 3 is the fourth game (SELECT GAME), with its 59 songs (the three lessons left out).
  The app looks for a "Hottest Party 3" folder in Downloads, or add it in Setup (the folder row
  works for it). Every other game gets a HOTTEST PARTY 3 folder, and its songs are in DDR CUSTOM.
  Read from your disc, nothing typed in:
    sys/main.dol                     the song table (140-byte records: BPM, the four levels)
    files/ssq/ss9/MU_DDR_nnn.ss9     the step charts (same format as Hottest Party 2's)
    files/sound/DDRHP3_SOUND.brsar   the music (group k = song k), MU_SAM_nnn the previews
    files/text/text_eng.bin          titles and artists (from the credits and the unlock messages)
  MUSIC VIDEOS: like the real game, its licensed songs play their music video behind the arrows,
  full screen and in time with the song (files/movie/pv/ddrNNN.thp = song NNN-1, also the two
  HOTTEST PARTY medleys); the other songs play one of its background loops (files/movie/stage).
  (Options > VIDEO off turns them off.)
  SONG SELECT: its own, built from the pictures on your disc and lined up with a recording of the
  real game: the orange panel with the row of song pictures (files/2Dcommon/comAF_US.bin: picture k
  = song k, and its name bars), title and artist above, BPM and STAGE under it, the SORT bar, the
  radar and the four difficulty bars with the coloured feet (files/select/selMusic_us.bin).
  DDR CUSTOM's SONG SELECT option has HOTTEST PARTY 3 too.
  DANCERS: songs without a music video get Hottest Party 3's own dancers, read from your disc
  (files/sound/stream/character/CHRxy0.bin + outfit CHRxyN.bin, the same formats as HP2's): a lead
  picked from its characters (CHR01x-CHR15x) and one backup dancer (CHR21x-CHR32x) in two different
  outfits, dancing the song's own routine (files/motion/MOT010_SSQnnn.bin).
  STAGES: they dance on one of Hottest Party 3's own stages (files/stage/STGnnn.bin, the same
  format as HP2's: models, textures, animations, camera moves), picked at random from the 04x, 05x
  and 1xx stages. HP3 mixes two sizes of material record (0x38 and 0x50 bytes) and keeps colours as
  RGBA bytes; both are handled. Some surfaces still show plain white or grey (HP3's extra texture
  layers and lighting aren't drawn yet), and the 2xx stages are left out for now (the camera ends
  up inside their sky dome).
  Not yet its own: the gameplay screen (it uses Hottest Party 2's gold one if that disc is here),
  and the game's rule for which dancers and stage appear (picked at random for now).

HOTTEST PARTY 2 SONG SELECT
  Picking HOTTEST PARTY 2 now gives its own song select, built from the pictures on your disc
  (files/select/selMusic.bin): the SELECT MUSIC header, the gold side panel, the song tabs (red; the
  cursor's turns yellow in the green frame), the gold picture frame with the song in it, and the four
  difficulty bars with their feet lit up to the song's level. DDR CUSTOM's SONG SELECT option has
  HOTTEST PARTY 2 as well. The layout was lined up with a recording of the real game in Dolphin
  (the Wii draws its 4:3 pictures stretched to widescreen, so they're drawn a third wider here).
  Each Hottest Party 2 song now shows its own picture, read from your disc (files/select/
  select_cmn.bin holds them, 226x110 each, picture k = song k) in the song box and on the tiles
  everywhere else; the name tabs stay on the list.
  Not yet: HP2's own purple background, the song's category icon, the green scroll arrows.

HOTTEST PARTY 2 DANCERS
  Hottest Party 2 songs now have Hottest Party 2's own dancers, read from your disc: the lead in the
  middle (files/character/CHR010 with outfit 1 or 2) and two backup dancers either side (CHR090,
  two different outfits of the four), as the game does (read from its memory in Dolphin). Each
  dancer is a skinned model (a 44-joint skeleton, body and head with eyes and mouth) and they dance
  the song's own routine (files/motion/MOT010_SSQnnn.bin), clip after clip from the start of the
  song, kept on the beat. If a dancer can't be read, Hottest Party 1's dancers stand in.
  DDR CUSTOM's DANCER option now has HOTTEST PARTY 2 as well: pick it (with BACKGROUND set to
  HOTTEST PARTY) and any song, DDR II's included, gets Hottest Party 2's dancers, dancing the HP2
  routine closest in BPM, timed to that song's measures.
  Not yet: blinking and mouth changes (they keep eyes open / mouth 1), and the game's own
  formation changes during a song (the three stay in one line).

HOTTEST PARTY 2 GAMEPLAY SCREEN
  Playing Hottest Party 2 now uses its own gold screen, read from files/game/gui.tpl: the gauge with
  the player's ball, the STYLE badge at the top, the score panel with the difficulty tab, its
  MARVELOUS!! / PERFECT!! ... judgments, combo digits, O.K. / N.G., and its READY, HERE WE GO!!,
  FINISHED and FAILED banners. Its arrows look the same as Hottest Party 1's and use those.
