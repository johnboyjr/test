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
