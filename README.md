# 🏋️ Habit Tracker

Tracker opakovaných návyků a cvičení, který běží na **Macu, Windows i Androidu**. Data umí ukládat do **souboru**, a od verze s účty i **na server – každý přihlášený uživatel má svá vlastní data**.

## Jak to spustit

```bash
npm install
npm run dev        # vývoj na http://localhost:5173 (bez serveru/účtů)
npm run serve      # build + server s účty → http://localhost:3000
```

## Jak to nainstalovat do telefonu / počítače

Nejjednodušší varianta je **PWA** (web appka, která se "nainstaluje"):

- **Android (Chrome):** otevři adresu aplikace → menu ⋮ → *Přidat na domovskou obrazovku / Nainstalovat aplikaci*. Běží poté na celou obrazovku jako aplikace, funguje i offline.
- **Mac (Chrome/Edge):** menu → *Přidat do Docku…*
- **Windows (Chrome/Edge):** menu → *Nainstalovat Habit Tracker…* — vytvoří se ikona v Startu.

## Přihlášení a účty (multi-user)

Aplikace má **účty** – každý uživatel se přihlásí jménem a heslem a má **vlastní data**:

- **„Vytvořit účet“** → zadáš jméno + heslo a hned jsi přihlášený.
- Příště stačí **„Přihlásit“** (prohlížeč si přihlášení pamatuje).
- Data každého uživatele žijí na serveru jako **jeden JSON soubor** (`data/<jméno>.json`).
- V hlavičce vidíš přihlášeného uživatele (👤 jméno), tlačítko **Odhlásit** a stav synchronizace: **● zelená** = uloženo na serveru, **⚠ červená** = server nedostupný (data zatím jen v zařízení, uloží se, jakmile to půjde).
- Založíš-li účet na zařízení, kde už data byla (z doby bez účtů), **stará data se do nového účtu automaticky přenesou**.
- ⚠️ **Bezpečnost je záměrně minimální** – hesla v plaintextu, žádné šifrování („kašli na ochranu, stačí JSON“). Vhodné pro rodinu a přátele, ne pro citlivé věci.

### 🛡️ Admin účet

Vestavěný účet **Admin / `Adam,,22`** (přihlašuje se stejně jako ostatní). Po přihlášení se místo cvičení zobrazí **Správa účtů** – seznam všech registrovaných uživatelů (počet cvičení, záznamů, poslední změna). U každého uživatele je tlačítko **👁 Zobrazit**, které otevře **read-only přehled, jak si kdo vede**: plnění aktuálního týdne, posledních 12 týdnů, denní aktivita posledních 14 dní a přehled jednotlivých cvičení za 30 dní. Data uživatelů se při prohlížení nikdy nemění. Dál je k dispozici **Smazat účet** i s jeho daty. Jméno „admin“ nelze zaregistrovat jako běžný účet.

## Jak to dát zadarmo na internet

Aplikace umí běžet dvojím způsobem:

- **Klasický mikro server** – `server.mjs` (Node, JSON soubory v `data/`). Hodí se pro lokální provoz, vlastní VM nebo Render.
- **Cloudflare Pages (doporučeno pro „0 Kč navždy“)** – stejné API běží jako serverless funkce v `functions/api/` a data se ukládají do trvalého **Workers KV**. Server nikdy nespí a data nemizí.

Lokálně se to spouští takhle:

```bash
npm run serve        # = npm run build && node server.mjs → http://localhost:3000
```

Vývoj s hot-reload a serverem zároveň: `npm run dev` (Vite na :5173) + `node server.mjs`, a v konzoli prohlížeče jednou nastav `localStorage.setItem('fit-tracker-api', 'http://localhost:3000')`.

### Možnosti hostingu

| Služba | Cena | JSON data přežijí? | Poznámka |
| --- | --- | --- | --- |
| **Cloudflare Pages + KV** | **0 Kč navždy** | ✅ ano | **Doporučeno.** Serverless funkce, data v trvalém Workers KV (free: 100k čtení / 1k zápisů denně, 1 GB), nikdy nespí, bez karty |
| **Render (Starter)** | ~7 $/měsíc | ✅ ano | Nejpohodlnější placená varianta: nespí, disk vydrží |
| **Render** (free) | 0 Kč | ⚠️ ne | Jen na vyzkoušení – usíná (~15 min) a JSON data se mažou |
| **Fly.io** | ❌ | – | Free tier pro nové účty zrušen (2024) |
| **Netlify / Vercel** | 0 Kč | – | Jen statické soubory – bez API by loginy nefungovaly |

### ✅ Doporučeno: Cloudflare Pages – 0 Kč navždy, data nikdy nezmizí

API je připravené jako **Cloudflare Pages Function** (`functions/api/[[path]].js`) a používá stejné chybové kódy jako `server.mjs`, takže aplikace se nemění. Postup:

1. Nahraj projekt na **GitHub** (viz nahoře).
2. Založ účet na **dash.cloudflare.com** (bez karty) → **Workers & Pages → Create → Pages → Connect to Git** → vyber repo → **Build command:** `npm run build`, **Build output:** `dist`. (Funkce v `functions/` se nasadí automaticky.)
3. Vytvoř KV úložiště: **Workers & Pages → KV → Create namespace**, jméno `HABITS`.
4. V projektu Pages → **Settings → Bindings → Add binding**: Variable name **`HABITS_KV`**, KV namespace **`HABITS`** → *Save* a pak v projektu zmáčkni **Deploy**, ať se binding projeví.
5. Aplikace běží na `https://<projekt>.pages.dev` – vyzkoušej přihlášení `Admin` / `Adam,,22`. Vlastní doménu přidáš v *Custom domains*.

Každý `git push` na GitHub automaticky nasadí novou verzi. Data jsou v KV (1 GB zdarma); volné limity (100k čtení / 1k zápisů denně) pro rodinu a přátele bohatě stačí.

> ℹ️ Workers KV je konzistentní „nakonec“ – čerstvě uložená data se v jiném regionu projeví během pár sekund. Pro tento účel to nevadí.

### Render (jen na zkoušku)

1. Nahraj projekt na **GitHub**.
2. Na **render.com** → *New → Web Service* → vyber repo.
3. Build command: `npm install && npm run build` · Start command: `node server.mjs`.
4. Hotovo – aplikace i účty běží na `https://tvuj-projekt.onrender.com`.

> ⚠️ Bezplatný tier Renderu po ~15 min usíná a **JSON soubory na disku se po restartu ztratí**. Pro trvalá data: Cloudflare výše, nebo placený **Render Starter** (~7 $/měsíc), který nespí a disk vydrží.

## Kde jsou data

- **Průběžně** se vše ukládá do zařízení (IndexedDB) — aplikace tedy funguje i offline.
- **Datový soubor:** na kartě *💾 Data* můžeš:
  - **Exportovat JSON** — stáhne `fit-tracker-data.json` (záloha, přenos na telefon apod.).
  - **Importovat JSON** — nahraje data ze souboru (na import se ptá, ať neztratíš práci).
  - Na Macu/Windows (Chrome/Edge) navíc **„Vytvořit datový soubor…“** — vybereš kde má soubor stát a pak tlačítko **„Uložit do souboru“** zapíše data tam na jeden klik. Po zavření prohlížeče je potřeba soubor znovu otevřít tlačítkem *Otevřít soubor…* (bezpečnostní omezení prohlížečů).

## Jak to používat

1. **🏋️ Cvičení** → **+ Nové cvičení**
   - název (např. *Bicíáky*)
   - **barva** – vyber z palety nebo vlastní (podle barvy je cvičení poznat v tabulce i grafech)
   - opakování:
     - *každý týden* → vyber **jeden i více dnů** v týdnu (např. Po + St + Pá) a zadej N v „Opakovat každých N“; když je **N > 1**, objeví se volba **„Týden v cyklu“** (čísla 1 až N) – pro N = 2 tedy **lichý / sudý týden**, pro vyšší N konkrétní týden cyklu. Výchozí je vždy aktuální týden, ať nové cvičení platí hned od dneška. (Pro N = 1 se volba nezobrazuje.)
     - *co N dní* → každých N dní od dnešního dne (např. „co 2 dny“, „co 3 dny“…)
   - **čas začátku** (např. 8:00) a **nepovinně čas konce** – bez konce se na časové ose počítá s 1 minutou, ať je aktivita vidět
   - **měřené** cvičení má jednotku (`km`, `min`, `opakování`…), **neměřené** nech jednotku prázdnou

## Jazyky

Vpravo nahoře se přepíná jazyk aplikace: **🇨🇿 Česky · 🇬🇧 English · 🇩🇪 Deutsch** (uloží se a pamatuje). Překládá se celé UI, názvy dnů/měsíců i grafy.

## Vzhled (témata)

Vedle jazyka se přepíná vzhled aplikace (uloží se a pamatuje):

- **🌙 Tmavý** (default) · **☀️ Světlý**
- **👑 SIr Jonathan** – zlatá, černá, zelená (Loki)
- **🍇 Dionysus** – vínová + zelená
- **🐍 Lord Garmadon** – fialovo-černá s tmavě šedou (Serpentine z Ninjaga)

Grafy se přebarvují podle zvoleného tématu.
2. **📅 Týden** – tabulka na každý den; klikni na den po tréninku:
   - neměřené → jen **odškrtni** ✅
   - měřené → **zadej hodnotu** (např. uběhlých `12` km) – zaškrne se to samo
   - do každého záznamu jde napsat **poznámku**
   - v detailu dne je nahoře **🕐 Časová osa dne** – „rámeček“, kde je vidět, jak jdou aktivity za sebou a jaké jsou mezi nimi mezery (podle začátku/konce; mezery se popíší, např. „10 h 15 min“)
   - v detailu dne lze přidat i cvičení, které není v plánu (např. náhradní trénink) – uloží se k tomu dni, v týdenní tabulce je označené **＋** a počítá se do splnění dne i statistik (odebrat jde ikonou 🗑 v detailu dne)
3. **📈 Grafy** – splněnost za 28 dní, objem za 12 týdnů (stacked podle cvičení), koláč aktuálního týdne a vývoj jednotlivých cvičení.
4. **🗂 Složky grafů** – máš-li hodně cvičení, vytvoř si složky (např. „Běh“, „Posilovna“) a vyber si jednu nahoře v grafu – všechny grafy pak ukazují jen její cvičení. Spravují se tlačítky „🗂 Složky“ / „+ Nová složka“: jméno, barva a zaškrtnutí členů. Graf *Vývoj cvičení* měří i **odškrtávací aktivity** – každý naplánovaný termín jako zelený (splněno) či červený (zmeškáno) sloupec; navíc se pro ně zobrazí graf *Splněné tréninky za týden*.

## Buildy

```bash
npm run build            # klasický build do dist/ (hosting, PWA service worker)
npm run build:single     # vše v JEDNOM html souboru → dist-single/index.html (bez serveru/účtů)
npm run start            # spustí server server.mjs (po hotovém buildu)
npm run serve            # build + server → http://localhost:3000
```

`soupis technologií: TypeScript + Vite + Chart.js + idb-keyval (IndexedDB) + File System Access API + vlastní mikro server (node:http, bez závislostí)`

## Struktura

```
server.mjs     – mikro server: účty + jeden JSON soubor na uživatele (data/), obsluha dist/
functions/api/[[path]].js – stejné API jako server.mjs, ale jako Cloudflare Pages Function (data ve Workers KV – pro hosting 0 Kč navždy)
src/
  types.ts       – typy (Exercise, LogEntry, ExerciseGroup, AppData)
  dates.ts       – práce s daty (ISO týdny, plánování výskytů)
  storage.ts     – IndexedDB (offline cache) + JSON import/export + File System Access API
  api.ts         – klient pro server (registrace, přihlášení, synchronizace dat)
  aggregate.ts   – výpočty pro tabulku i grafy (plán dne, týdenní součty, historie)
  store.ts       – stav aplikace, mutace a synchronizace se serverem
  views.ts       – obrazovky (přihlášení, týden, den, grafy, cvičení, data) + modaly
  charts.ts      – Chart.js grafy
  ui.ts          – helper na tvorbu DOM
  main.ts        – start aplikace
scripts/gen-icon.mjs – generátor ikon PWA
scripts/smoke-cf.mjs – lokální smoke test Cloudflare API (spustíš: npm test)
data/            – (vzniká za běhu u server.mjs) JSON soubory uživatelů, není v gitu; u Cloudflare místo toho slouží Workers KV
```
