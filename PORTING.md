# Přenos změn do LOKÁLNÍ verze Habit Trackeru (BEZ serveru)

> Cíl: uprav lokální kopii aplikace (single-user, offline, bez loginů a bez serveru)
> tak, aby obsahovala stejné funkce a opravy jako webová verze. **Serverovou část
> (účty, přihlašování, displayName, API, KV) nedělej** — to v lokální verzi není.

Výsledek, kterého má lokální AI dosáhnout:
1. **Pokročilý rozvrh cvičení** — uživatel může u „každý týden" cvičení zaškrtnout
   pokročilý režim a vyplnit **mřížku dnů × týdnů cyklu** s vlastními časy
   (např. 1. týden pondělí 08:00, 2. týden úterý 07:00; prázdná buňka = volno).
   **Každá buňka má začátek i konec** (např. pondělí 08:00–09:30, úterý
   08:00–10:15); konec je nepovinný a liší se den ode dne i týden od týdne.
2. **Přehledné UX** pokročilého režimu (schování starých ovladačů, tlačítka
   vyplnit/vyprázdnit, ukotvení „1. týden = týden vzniku cvičení").
3. **Oprava**: tlačítko „+ Nové cvičení" otevírá editor (nesmí házet chybu).
4. **Přejmenování motivu**: styl „SIr Jonathan" → „Sir Jonathan" (pokud ve tvé
   verzi existuje motiv s tímto jménem).

---

## 1) Datový model (`src/types.ts`)

Rozšíř `Exercise` o tři **nepovinná** pole (stará data fungují dál — pole tam nemají):

```ts
/** Pokročilý rozvrh: den (0=Po..6=Ne) → týden cyklu (1..every) → čas "HH:MM".
 *  Přítomnost = absolutní výběr: políčko s časem znamená trénink, chybějící = volno.
 *  Nepřítomno = klasický rozvrh (weekdays + time). */
weekTimes?: Record<string, Record<string, string | null>>
/** Pokročilý rozvrh – konec na buňku: stejná struktura jako weekTimes
 *  (den → týden → "HH:MM"). Buňka bez vlastního konce použije globální `endTime`;
 *  chybí-li i ten, trénink konce nemá. Nepřítomno = žádné per-buňkové konce. */
weekEndTimes?: Record<string, Record<string, string | null>>
/** Ukotvení sloupce „1. týden“ na týden obsahující toto datum
 *  (obvykle týden vytvoření cvičení). Chybí → epochová fáze cyklu. */
weekAnchor?: string | null
```

**Klíčová sémantika:** `every` = počet týdnů cyklu (N). Cvičení má buď klasický
rozvrh (`weekdays[]` + `time` + `weekOffset`), nebo pokročilý (`weekTimes`):
- sloupec `c` (1..N) se vztahuje k týdnu: `(weekIndexOf(datum) − weekIndexOf(ukotvení)) mod N + 1`,
- buňka s časem = ten den v tom týdnu se trénuje, chybějící buňka = volno,
- ukotvení = `weekAnchor` (datum); při vytvoření se nastaví na dnešní den,
  takže „1. týden" je pro uživatele ten aktuální.

## 2) Datové pomocníky (`src/dates.ts`)

Pokud neexistuje, doplň `weekIndexOf(date)` (index týdne od epochy, pondělí = začátek
týdne — viz komentář v originále) a `weekOffsetFor`. Přidej:

```ts
/** Číslo sloupce (1..n) pokročilého rozvrhu pro dané datum.
 *  S ukotvením je 1. týden = týden ukotvení; bez něj epochová fáze (zpětná kompatibilita). */
export function weekColumn(date: string, n: number, anchor?: string | null): number {
  if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    const diff = weekIndexOf(date) - weekIndexOf(anchor)
    return ((diff % n) + n) % n + 1
  }
  return weekOffsetFor(date, n)
}
```

Rozšiř logiku „kdy se cvičí" — v originále `occursOn(ex, date)` (weekly větev):

```ts
// weekly:
const weekdays = ex.weekdays?.length ? ex.weekdays : []
const w = isoWeekday(date) - 1            // 0 = pondělí
const wt = ex.weekTimes
if (wt && Object.keys(wt).length) {
  const cell = wt[String(w)]?.[String(weekColumn(date, ex.every, ex.weekAnchor))]
  return cell !== undefined && cell !== null   // vyplněná buňka = trénink
}
// jinak původní logika: weekdays.includes(w) && weekOffsetFor(date, every) === weekOffset
```

Přidej novou funkci „efektivní čas pro daný den" (používá ji UI):

```ts
export function timeOn(ex: Exercise, date: string): string | null {
  if (ex.kind !== 'weekly') return ex.time
  const wt = ex.weekTimes
  if (wt && Object.keys(wt).length) {
    const w = isoWeekday(date) - 1
    const cell = wt[String(w)]?.[String(weekColumn(date, ex.every, ex.weekAnchor))]
    if (cell !== undefined) return cell     // null = tento den v tomto týdnu volno
  }
  return ex.time
}
```

Přidej i **efektivní konec pro daný den** (per-buňkový konec má přednost,
jinak globální `endTime`):

```ts
export function endOn(ex: Exercise, date: string): string | null {
  if (ex.kind === 'weekly') {
    const wt = ex.weekTimes
    if (wt && Object.keys(wt).length) {
      const w = isoWeekday(date) - 1
      const wet = ex.weekEndTimes
      if (wet && Object.keys(wet).length) {
        const cell = wet[String(w)]?.[String(weekColumn(date, ex.every, ex.weekAnchor))]
        if (cell !== undefined) return cell // explicitní konec (nebo null) pro tento den/týden
      }
    }
  }
  return ex.endTime ?? null
}
```

(V originále je `endOn` typováno přes sdílený interface `ScheduleLike`; `Exercise`
je s ním kompatibilní.)

## 3) Statistiky (`src/aggregate.ts`)

**Nemění se.** Všechny progresy/statistiky už staví na `occursOn`, takže nový rozvrh
respektují automaticky.

## 4) UI (`src/views.ts`)

### a) Zobrazování času podle dne (týdenní i denní pohled)

Přidej pomocníky a všude, kde se plán zobrazuje (řádek týdne, karta dne, časová osa),
používej místo `ex.time` čas pro konkrétní datum:

```ts
function exTimeOn(ex: Exercise, date: string): string { return timeOn(ex, date) ?? ex.time }
function timeRangeOn(ex: Exercise, date: string): string {
  const t = exTimeOn(ex, date)
  const e = endOn(ex, date)
  return e ? `${t}–${e}` : t
}
function exEndMin(ex: Exercise, date: string): number {
  const start = timeToMin(exTimeOn(ex, date))
  const e = endOn(ex, date)
  return e ? Math.max(timeToMin(e), start + 1) : start + 1 // bez konce = 1 min
}
```

- Týdenní tabulka: řadit položky dne podle `exTimeOn(ex, date)` a zobrazovat
  `timeRangeOn(ex, date)` (konec už bere v úvahu `weekEndTimes`).
- Den: karta cvičení i časová osa (timeline) dostanou `date` a používají
  `timeRangeOn` / `exTimeOn` / `exEndMin`; délka bloku `end = start + 1 min`,
  když není konec (per-buňkový ani globální).

### b) Editor cvičení (`openExerciseModal`)

Formulář už má: název, barvu, typ opakování (`weekly` | `interval`), `every` (N),
pro weekly výběr dní (`weekdayField`), pro N ≥ 2 výběr týdne v cyklu
(`weekCycleField`), `time`, `endTime`, `unit`. Přidej k tomu:

1. **Wrapper pole času** (kvůli schovávání):
   `timeField` = „Čas" + `time` input; `endField` = „Konec" + `endTime` input.

2. **Sekce „Pokročilý rozvrh"** (zobrazovat jen pro `kind === 'weekly'`):
   - checkbox `advToggle` (zaškrtnutý, když `ex.weekTimes` existuje),
   - nápověda (text viz i18n níže),
   - tlačítka `Vyplnit vše časem` (všechny buňky dostanou první vyplněný čas,
     jinak základní `time`/`08:00`) a `Vyprázdnit vše` (maže začátky **i** konce),
   - řádek „Dnešní týden odpovídá sloupci {n}.",
   - mřížka `schedGrid` (HTML grid): záhlaví prázdné + sloupce „Týden 1..N",
     pak 7 řádků (Po..Ne). **Každá buňka = div se DVĚMA časovými inputy pod
     sebou**: horní `.sched-s` = začátek, dolní `.sched-e` (zvýrazněný okraj)
     = konec (nepovinný).** Prázdný začátek = volno. Aktuální sloupec
     (`weekColumn(dnešní datum, N, ex?.weekAnchor ?? dnešní datum)`) zvýrazni.
   - pod mřížkou legenda (klíč `advCellHint`, viz i18n) vysvětlující horní/dolní
     pole a že prázdný konec použije globální „Konec" pod mřížkou.

3. **Stav buňky:** dvě paralelní pole `cols[d][c]` (začátky) a `ends[d][c]`
   (konce, `''` = žádný). Při otevření editoru naplň obojí z `ex.weekTimes` /
   `ex.weekEndTimes`. Při zapnutí pokročilého režimu poprvé předvyplň začátky
   základním časem (konce nech prázdné); skryj `weekdayField`, `weekCycleField`
   i `timeField` (mřížka je jediný zdroj, globální `endField` zůstává vidět jako
   výchozí konec). Při vypnutí se staré ovladače vrátí. Při změně `every` (N)
   mřížku přegeneruj (zachovej vyplněné buňky, sloupce nad N zahod).

4. **Uložení** (`payload`): když je pokročilý režim zapnutý a aspoň jedna buňka
   vyplněná → `weekTimes = { den: { sloupec: čas } }`,
   `weekAnchor = ex?.weekAnchor ?? dnešní datum` a `weekEndTimes` = stejná
   struktura, ale jen z buněk, které mají **začátek i konec** (konec u prázdného
   začátku se ignoruje; prázdné konce se neukládají — platí pak globální
   `endTime`). Jinak pole vynech (klasický režim).

5. **⚠️ POŘADÍ DEKLARACÍ (kritické — už jednou způsobilo rozbité tlačítko):**
   všechny proměnné, které používají `renderGrid()`, `updateKind()` a
   `updateWeekCycle()` (zejména `timeField`, `endField`, prvky mřížky, `cols`),
   musí být deklarované **PŘED** prvním voláním těchto funkcí
   (`updateKind(); updateWeekCycle(); renderGrid();` na konci builderu).
   Jinak nastane `ReferenceError: Cannot access 'timeField' before initialization`
   a modál se vůbec neotevře — přesně tahle chyba se v projektu stala
   (typecheck ji nechytí, je to runtime chyba).

### c) Souhrn cvičení v seznamu

`scheduleText(ex)`: když má `ex.weekTimes` → zobraz „Rozvrh (dny × týdny)"
(klíč `advSummary`); jinak původní text. U pokročilého cvičení **neukazuj**
globální časový rozsah (časy jsou per-den) — v originále to řeší pomocník
`exerciseMeta(ex)`: `scheduleText` + případně `' · ' + timeRange(ex)` jen pro
klasický režim + text jednotky (`t('measuredUnit'/{u})` nebo `t('onlyCheck')`,
které už samy začínají oddělovačem `' · '`).

## 5) Persistence (`src/storage.ts`, funkce `normalize`)

Při načítání/importu **předávej** nová pole dál (jinak by se smazala):
- `weekTimes` i `weekEndTimes`: jen očištěná verze — den celé číslo 0–6,
  sloupec celé číslo 1..365, hodnota `"HH:MM"` nebo `null`; neprázdné dny
  zachovej, prázdné vynech (obě pole čistí stejná funkce).
- `weekAnchor`: jen `YYYY-MM-DD` (jinak `null`).

## 6) Překlady (`src/i18n.ts`) — přidej do všech tří jazyků

| klíč | česky | anglicky | německy |
| --- | --- | --- | --- |
| `weekShort` | Týden | Week | Woche |
| `advLabel` | Pokročilý rozvrh (vlastní časy podle dnů a týdnů) | Advanced schedule (custom times per day and week) | Erweiterter Zeitplan (eigene Zeiten pro Tag und Woche) |
| `advHint` | Vyplň políčka: řádek = den, sloupec = týden cyklu (1. týden = týden, kdy cvičení vzniklo). Každá buňka = jeden trénink se začátkem a koncem; každý den může mít jiný čas a každý týden jiné dny. Prázdný začátek = ten den se v daném týdnu netrénuje. | Fill the cells: row = weekday, column = week of the cycle (week 1 = the week the exercise was created). Each cell is one workout with a start and an end; each day can have its own time and each week its own days. An empty start means no workout that day in that week. | Fülle die Zellen aus: Zeile = Wochentag, Spalte = Woche des Zyklus (Woche 1 = die Woche, in der die Übung erstellt wurde). Jede Zelle ist ein Training mit Beginn und Ende; jeder Tag kann eine eigene Zeit haben, jede Woche eigene Tage. Leerer Beginn = an diesem Tag in dieser Woche kein Training. |
| `advFillAll` | Vyplnit vše časem | Fill all with time | Alle mit Zeit füllen |
| `advClearAll` | Vyprázdnit vše | Clear all | Alles leeren |
| `advWeekNow` | Dnešní týden odpovídá sloupci {n}. | This week corresponds to column {n}. | Diese Woche entspricht Spalte {n}. |
| `advSummary` | Rozvrh (dny × týdny) | Schedule (days × weeks) | Zeitplan (Tage × Wochen) |
| `advCellHint` | V každé buňce: horní pole = začátek, dolní (se zvýrazněným okrajem) = konec. Prázdný konec použije konec z pole „Konec“ pod mřížkou, jinak trénink konce nemá. | In each cell: top field = start, bottom one (highlighted edge) = end. An empty end uses the “End” field below the grid; otherwise the workout has no end. | In jeder Zelle: oberes Feld = Beginn, unteres (mit hervorgehobenem Rand) = Ende. Leeres Ende verwendet das Feld „Ende“ unter dem Raster, sonst hat das Training kein Ende. |

(`t(key, { n })` interpoluje `{n}` — ověř, že to tvůj `t()` umí.)

## 7) Styly (`src/style.css`)

```css
.adv-wrap { margin-top: 6px; }
.adv-label { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
.sched-grid { display: grid; gap: 4px; align-items: center; margin-top: 10px; overflow-x: auto; padding-bottom: 4px; }
.sched-head { font-size: 0.75rem; opacity: 0.6; text-align: center; white-space: nowrap; }
.sched-day { font-size: 0.85rem; white-space: nowrap; }
/* buňka = začátek + konec (dva časové vstupy pod sebou) */
.sched-cell { min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 3px; border-radius: 8px; }
.sched-cell input[type='time'] { width: 100%; min-width: 0; padding: 4px 5px; }
.sched-cell .sched-e { border-left: 3px solid var(--accent); }
.sched-now { outline: 1px solid var(--accent); }
.adv-tools { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
```
Počet sloupců mřížky nastav inline stylem
`gridTemplateColumns: auto repeat(N, minmax(96px, 1fr))`.

## 8) Přejmenování motivu (`src/theme.ts`)

Motiv `{ id: 'loki', icon: '👑', name: 'SIr Jonathan' }` → `name: 'Sir Jonathan'`.
(Mění se jen zobrazovaný název; id `loki` zůstává, uložená volba vzhledu se neztratí.)
Když ve tvé verzi motiv chybí, přeskoč.

## 9) Ověření (stejný výsledek jako web)

1. `typecheck` + build projdou.
2. Otevři editor: **„+ Nové cvičení" otevře modál bez chyby v konzoli.**
3. Zaškrtni pokročilý rozvrh → zobrazí se mřížka, nápis „Dnešní týden odpovídá
   sloupci 1.", staré ovladače (dny/týden/čas) zmizí.
4. N = 2: vyplň `pondělí/1. týden = 08:00` (konec 09:30) a `úterý/2. týden =
   07:00`, zbytek prázdný → ulož. V týdenním plánu: tento týden pondělí
   08:00–09:30, příští týden úterý 07:00 (bez konce), ostatní dny nic.
5. Editace stejného cvičení → mřížka se otevře se stejnými hodnotami (začátky
   i konce včetně vyplněných buněk).
6. Export → import JSON → `weekTimes`, `weekEndTimes` i `weekAnchor` zůstanou
   (soubor je má).
7. V seznamu cvičení je souhrn „Rozvrh (dny × týdny)" (bez zavádějícího
   globálního času) a motiv v nabídce vzhledu se jmenuje „Sir Jonathan".
8. Do buňky konce zadej čas → v týdenním i denním pohledu se zobrazí rozsah
   (např. `08:00–09:30`); jiné dny bez konce ukazují jen `08:00`.

## Co naopak NEdělat (serverová část — v lokální verzi bez serveru není)

Účty/přihlašování, `displayName`, session, `api.ts`, synchronizace na server,
KV namespace, soubory `server.mjs` a `functions/`. Bez serveru nemá smysl —
data se ukládají offline (IndexedDB / JSON soubor) jako dosud.
