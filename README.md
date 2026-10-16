# 🏰 Carcassonne Mini

Un joc Carcassonne 2D, simplu, care rulează direct în browser — pe calculator sau pe telefon.

**▶ Joacă aici: https://edybtt.github.io/carcassonne-mini/**

## Ce poți face

- 2–4 jucători, fiecare fie om (pe același dispozitiv), fie calculator.
- **Lobby online:** creezi un lobby, trimiți codul sau linkul prietenilor, ei intră de pe telefonul/calculatorul lor și jucați împreună (poți adăuga și calculatoare).
- Toate cele 72 de piese din setul de bază: drumuri, orașe (cu scuturi) și mănăstiri.
- Meeple pe drumuri, orașe și mănăstiri, cu punctare automată.
- Tabla se mută prin tragere și se mărește cu rotița sau prin ciupire.

## Reguli pe scurt

1. Tragi o piesă și o așezi lângă cele existente; marginile trebuie să se potrivească.
2. Poți pune un meeple pe piesa abia pusă, dacă structura nu e deja ocupată.
3. Drum terminat: 1 punct/piesă. Oraș terminat: 2 puncte/piesă + 2/scut. Mănăstire înconjurată: 9 puncte.
4. La final, structurile neterminate valorează 1 punct/piesă (+1/scut); mănăstirea 1 + vecinii.

Versiune simplificată: fără fermieri.

## Cum funcționează online

Site-ul e static (GitHub Pages), așa că browserele jucătorilor se conectează direct între ele prin WebRTC, cu ajutorul [PeerJS](https://peerjs.com/). Cel care creează lobby-ul e gazda: jocul rulează la el, iar ceilalți îi trimit doar mutările. Dacă gazda închide pagina, jocul se termină.

## Taste

`R` rotește · `Enter` plasează · `Space` fără meeple · `Esc` înapoi · `C` centrează

## Rulare locală

Deschide `index.html` în browser. Nu are nevoie de instalare sau server.
