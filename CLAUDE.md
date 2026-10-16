# Carcassonne Mini

Un joc Carcassonne 2D, simplu, care rulează direct în browser. Publicat pe GitHub Pages.

- Repo: https://github.com/edybtt/carcassonne-mini
- Site: https://edybtt.github.io/carcassonne-mini/

## Structură

Site static, fără build. Dependențe externe: fontul Cinzel (Google Fonts) și PeerJS 1.5.4 (jsDelivr) pentru modul online.

- `index.html` – structura paginii (tabla + panoul lateral + modal).
- `style.css` – aspectul; sub 760px panoul trece jos (telefon).
- `game.js` – tot jocul, într-un singur IIFE, pe secțiuni:
  - **Constante / `TILE_DEFS`** – cele 72 de piese din setul de bază (A–X). `e` = margini N,E,S,V (`C` oraș, `R` drum, `F` câmp), `f` = elemente (`city` / `road` / `monastery`) cu laturile atinse și `p` pentru scut.
  - **Reguli** – `fits`, `computeCandidates`, `structureOf` (BFS pe drum/oraș, sau vecinii mănăstirii), `findCompletions`, `pointsFor`, `winnersOf`.
  - **Desfășurarea jocului** – `newGame` → `startTurn` → click pe loc (`doPlace`, faza `meeple`: piesa se poate roti / muta) → meeple (`doMeeple`, faza `end` cât aterizează) sau „Fără meeple” → `finishTurn` → … → `endGame`.
  - **Setări de joc** – `{deck, meeples, time}`: pachet `DECK_SIZES` (Small 43 / Normal 72 / Large 115 piese, prin `tileCount`), meeple `MEEPLE_COUNTS` (Few 5 / Normal 7 / Many 10), timp `TURN_TIMES`. `DEFAULT_SETTINGS` = setările clasice; `cleanSettings` validează tot ce vine din localStorage sau de la gazdă. UI comun: `settingsHTML` + `bindSettings` (joc local și lobby).
  - **Timp pe tură** – `turnTime` (secunde, 0 = fără limită, implicit 30); `startTurnTimer` / `onTimeout` (piesa se pune automat, fără meeple). Gazda trimite clienților timpul rămas în `snapshot()`.
  - **Animația meeple** – `putMeeple` (sau un meeple nou văzut în `applyState`) pornește `startMeepleAnim`; `drawFlyingMeeple` îl aduce în arc din dreapta tablei, cu turtire și praf la aterizare. Punctarea se face după `MEEPLE_ANIM_MS`. Când un meeple e punctat, `applyScore` (sau un meeple dispărut în `applyState`) pornește `startLeaveAnim`: `drawLeavingMeeple` îl ghemuiește, apoi îl trimite în arc înapoi spre dreapta (mai mulți pleacă în cascadă; ecranul final așteaptă `finalDelay()`).
  - **Undo** – în faza `meeple`, „↶ Anulează” / Esc (`undoAction` → `doUndo`) ia piesa înapoi în mână; online, acțiunea `undo`.
  - **Calculatorul** – `aiChooseMove` încearcă toate pozițiile/rotațiile/opțiunile de meeple și alege cu `evaluate` (scor + valoare estimată a structurilor ocupate + meeple rămași, față de cel mai bun adversar).
  - **Desen** – totul pe `<canvas>`, coordonate de piesă între -0.5 și 0.5; orașele sunt desenate într-o orientare canonică și rotite.
  - **Interfață** – panou, jurnal, meniu principal, joc local, reguli, ecran final.
  - **Online** – lobby-uri prin PeerJS (WebRTC, fără server propriu).

## Modul online

GitHub Pages nu are backend, așa că browserele se conectează direct (WebRTC). Serverul public PeerJS (`0.peerjs.com`) e folosit doar ca să se găsească după cod.

- Gazda creează peer-ul `carcmini-<COD>` (cod de 5 caractere); ceilalți intră cu codul sau cu linkul `?lobby=COD`.
- Nu există listă publică de lobby-uri – pentru asta ar trebui un backend (ex. Firebase).
- **Gazda e autoritară**: ține pachetul, aplică regulile, rulează calculatoarele și trimite după fiecare `updateUI()` starea completă (`snapshot()`) plus evenimentele (`emit` → jurnal, „+N”, sclipiri, mesaje).
- Clienții reconstruiesc starea în `applyState()` și trimit doar intenții: `place` (pune sau mută piesa) / `rotate` / `undo` / `meeple` / `skip`; gazda le validează în `onRemoteAction()`.
- Setările (pachet, meeple, timp) le alege gazda în lobby (`net.settings`); clienții le văd în lobby și în jurnal.
- `players[i].owner` spune cine controlează jucătorul (`'local'`, `'host'` sau id-ul peer al clientului); `isMine(i)` compară cu `net.myId`.
- Dacă un client iese în timpul jocului, calculatorul îi preia locul. Dacă gazda iese, clienții primesc un mesaj și revin la meniu.
- Datele venite de la celălalt capăt sunt tratate ca nesigure: textele trec prin `esc`, culorile prin `safeColor`.

## Convenții

- Laturile sunt indexate 0 = N, 1 = E, 2 = S, 3 = V; rotația `rot` e în pași de 90° în sensul acelor de ceasornic. Latura originală `o` ajunge la `(o + rot) % 4`.
- Textele din joc sunt în română, cu diacritice.
- Reguli simplificate: fără fermieri (câmpurile nu se punctează). Orașele terminate dau 2 puncte/piesă indiferent de mărime.

## Rulare locală

Deschide `index.html` direct în browser sau servește folderul cu orice server static. Pentru a testa online pe un singur calculator, deschide două taburi: unul creează lobby-ul, celălalt intră cu codul.

În consolă, `window.__carcassonne` expune starea (`board`, `players`, `phase`, `net`, `candidates`, `spots`) și `clickWorld(x, y)` pentru teste.

## Publicare

Orice push pe `main` actualizează site-ul (GitHub Pages servește rădăcina ramurii `main`).
