/** Lightweight i18n: Czech, English, German. Persisted in localStorage, applied on <html lang>. */

export type Lang = 'cs' | 'en' | 'de'

export const LANGS: Lang[] = ['cs', 'en', 'de']

export const LANG_LABELS: Record<Lang, string> = {
  cs: '🇨🇿 Česky',
  en: '🇬🇧 English',
  de: '🇩🇪 Deutsch',
}

interface LangData {
  msgs: Record<string, string>
  weekdaysFull: string[] // Monday=0 .. Sunday=6
  weekdaysShort: string[]
  months: string[] // January=0 .. December=11
  monthsShort: string[]
}

const DATA: Record<Lang, LangData> = {
  cs: {
    msgs: {
      // tabs / nav
      week: 'Týden', charts: 'Grafy', exercises: 'Cvičení', data: 'Data',
      prev: '‹ Předchozí', today: 'Dnes', next: 'Následující ›',
      weekDone: 'Tento týden: {done}/{total} splněno',
      missN: '{n} zmeškáno', upcomingN: '{n} před sebou',
      missingN: '{done}/{total} · chybí {n}', planN: 'plán: {n}',
      noWorkout: 'žádný trénink',
      colDay: 'Den', colPlan: 'Plán', colStatus: 'Stav',
      weekHint: 'Klikni na řádek pro zadání výsledků.',
      todayTag: 'dnes', pastTag: 'minulost',
      backToWeek: '← Zpět na týden',
      // day view
      done: 'Splněno', performanceColon: 'Výkon:',
      unmeasuredHint: 'Neměřený trénink – stačí odškrtnout.',
      notePlaceholder: 'Poznámka (nepovinné)',
      removeFromDay: 'Odebrat z tohoto dne',
      dayEmptyNotice: 'Na tento den není nic naplánováno. Níže můžeš přidat cvičení i ručně.',
      addOtherN: 'Přidat na tento den i jiné cvičení ({n})',
      add: '+ Přidat',
      // charts
      chartsDoneTitle: 'Splněné dny (%) – posledních 28 dní',
      volumeTitle: 'Objem za týden – posledních 12 týdnů',
      noMeasuredVolume: 'Žádná měřená cvičení – graf objemu se zobrazí, jakmile bude mít cvičení jednotku (např. km).',
      thisWeek: 'Tento týden',
      thisWeekEmpty: 'Tento týden není nic naplánováno.',
      historyTitle: 'Vývoj cvičení',
      historyNeedsMeasured: 'Pro graf vývoje potřebuješ měřené cvičení (s jednotkou).',
      donePct: 'Splněno %', goal: 'Cíl',
      performance: 'Výkon', missed: 'Zmeškáno', ahead: 'Před sebou',
      // exercises
      exercisesTitle: 'Cvičení a opakování',
      exercisesHint: 'Naplánuj opakované tréninky – objeví se v týdenní tabulce. Měřená cvičení mají jednotku (km, min, opakování…).',
      noExercises: 'Zatím žádná cvičení. Přidej první!',
      newExercise: '+ Nové cvičení', archiveTitle: 'Archiv',
      measuredUnit: ' · měřeno ({u})', onlyCheck: ' · jen odškrtnutí',
      edit: 'Upravit', restore: 'Obnovit', archive: 'Archivovat', delete: 'Smazat',
      confirmDelete: 'Smazat „{name}“ i všechny jeho záznamy?',
      everyWeekday: 'každé {wd}',
      everyWeekMulti: 'každý týden: {list}',
      everyNWeeksOff: 'každých {n} týdnů ({o}. týden): {list}',
      weekCycleLabel: 'Týden v cyklu',
      weekCycleHint: 'Když je N > 1, vyber, ve kterém týdnu cyklu se cvičí (např. pro N = 2: 1 = lichý týden, 2 = sudý).',
      weekShort: 'Týden',
      advLabel: 'Pokročilý rozvrh (vlastní časy podle dnů a týdnů)',
      advHint: 'Vyplň políčka v tabulce: řádek = den, sloupec = týden cyklu. Každý den tak může mít jiný čas a každý týden jiné dny/časy. Prázdné políčko = ten den se v daném týdnu netrénuje.',
      advWeekNow: 'Dnešní týden odpovídá sloupci {n}.',
      advSummary: 'Rozvrh (dny × týdny)',
      everyNDays: 'co {n} dní', everyDaily: 'denně',
      // modal
      exNamePlaceholder: 'např. Bicí předloktí',
      weeklyKind: 'Každý týden (dny v týdnu)', monthlyKind: 'Co N dní',
      weekdayLabel: 'Dny v týdnu', daysHint: 'Vyber jeden i více dní.', everyLabel: 'Opakovat každých N',
      everyWeeklyHint: '1 = každý týden, 2 = každý druhý týden…',
      everyMonthlyHint: '1 = denně, 2 = každý druhý den…',
      nameLabel: 'Název cvičení', colorLabel: 'Barva', customColor: 'Vlastní barva',
      kindLabel: 'Typ opakování', timeLabel: 'Čas',
      endTimeLabel: 'Konec (nepovinné)',
      endTimeHint: 'Bez konce se pro zobrazení na časové ose počítá s 1 minutou.',
      timelineTitle: 'Časová osa dne',
      timelineHint: 'Pořadí aktivit a mezery mezi nimi.',
      unitLabel: 'Jednotka (měřené cvičení)',
      unitHint: 'Nech prázdné pro neměřené cvičení – u něj jen odškrtneš splnění.',
      editExerciseTitle: 'Upravit cvičení', newExerciseTitle: 'Nové cvičení',
      cancel: 'Zrušit', save: 'Uložit',
      // data
      dataFileTitle: 'Datový soubor',
      autoSave: 'Data se průběžně ukládají v prohlížeči zařízení.',
      fsExtra: 'Na Macu/Windows navíc můžeš data navázat na soubor {file} na disku a ukládat na jeden klik.',
      syncNote: 'Mezi zařízeními (včetně Androidu) data přenášej exportem/importem JSON souboru.',
      selectedFile: 'Vybráno: {file}', noFile: 'Soubor není vybrán',
      openFile: 'Otevřít soubor…', saveToFile: 'Uložit do souboru',
      createDataFile: 'Vytvořit datový soubor…',
      exportImport: 'Export / Import',
      exportJson: '⬇ Exportovat JSON', importJson: '⬆ Importovat JSON',
      importReplaces: 'Import nahradí aktuální data obsahem souboru.',
      stats: 'Statistiky',
      statsLine: '{ex} cvičení · {done} splněných · celkem {all} záznamů',
      importOk: 'Import proběhl v pořádku.',
      errImport: 'Chyba při importu: ',
      errInvalidFile: 'Neplatný formát souboru (chybí exercises/logs).',
      // header / misc
      themeDark: 'Tmavý', themeLight: 'Světlý',
      themeTitle: 'Vzhled aplikace', langTitle: 'Jazyk',
      exerciseSingular: 'cvičení', entriesSingular: 'záznamů', donePlural: 'splněných',
      // chart folders + checkbox charts
      groupShow: 'Zobrazit:', allChip: 'Vše', newGroup: '+ Nová složka',
      manageGroups: '🗂 Složky',
      groupsTitle: 'Složky grafů',
      groupsHint: 'Složky sdružují vybraná cvičení – graf pak ukáže jen ta. Hodí se, když máš cvičení hodně a nechceš je všechny v jednom grafu.',
      emptyGroups: 'Zatím žádné složky. Vytvoř si první – třeba „Běh“ nebo „Posilovna“.',
      groupNameLabel: 'Název složky', groupNamePh: 'např. Karty',
      membersLabel: 'Cvičení ve složce',
      membersCount: '{n} cvičení',
      folderEmptyChart: 'Vybraná složka nemá žádná cvičení k zobrazení.',
      confirmDeleteGroup: 'Smazat složku „{name}“? Její cvičení zůstanou zachována.',
      newGroupTitle: 'Nová složka', editGroupTitle: 'Upravit složku',
      sessionsTitle: 'Splněné tréninky za týden – odškrtávací cvičení',
      optMeasured: 'Měřené', optCheck: 'Odškrtávací',
      histNoData: 'Zatím žádné naplánované termíny.',
      // login / accounts
      loginTitle: 'Přihlášení',
      loginSub: 'Přihlas se, nebo si vytvoř účet – každý uživatel má svá vlastní data.',
      username: 'Uživatelské jméno', password: 'Heslo',
      loginBtn: 'Přihlásit', registerBtn: 'Vytvořit účet',
      logout: 'Odhlásit', loggedInAs: 'Přihlášený uživatel',
      wrongCreds: 'Špatné uživatelské jméno nebo heslo.',
      userTaken: 'Toto uživatelské jméno už existuje – zkus se přihlásit.',
      invalidUser: 'Uživatelské jméno: jen písmena, číslice, tečka, pomlčka a podtržítko (2–30 znaků).',
      errFill: 'Vyplň uživatelské jméno i heslo.',
      errNetwork: 'Nepodařilo se spojit se serverem.',
      syncedOk: 'Data uložena na serveru',
      syncedOffline: 'Server nedostupný – data jen v tomto zařízení',
      loginHint: 'Bezpečnost je záměrně minimální – nepoužívej heslo, které používáš jinde.',
      // admin
      adminTitle: 'Správa účtů',
      adminHint: 'Všichni registrovaní uživatelé – každý má svůj JSON soubor. Účet můžeš smazat i s daty.',
      refresh: 'Obnovit',
      loading: 'Načítání…',
      deleteUser: 'Smazat účet',
      confirmDeleteUser: 'Opravdu smazat účet „{name}“? Všechna jeho data budou nenávratně smazána.',
      noUsers: 'Zatím nejsou registrovaní žádní uživatelé.',
      adminLoadError: 'Nepodařilo se načíst seznam účtů – je server dostupný?',
      userStats: '{ex} cvičení · {logs} záznamů',
      updatedCol: 'poslední změna:',
      viewUser: 'Zobrazit',
      backToAccounts: '← Zpět na správu účtů',
      userEmpty: 'Tento účet zatím nemá žádná data.',
      loadUserDataError: 'Nepodařilo se načíst data uživatele – je server dostupný?',
      weeksN: 'Posledních {n} týdnů',
      daysN: 'Posledních {n} dní',
      doneOf: '{done}/{total} splněno',
      totalVol: 'celkem {value} {unit}',
      activityTitle: 'Aktivita',
      noRecent: 'V posledních 30 dnech žádná aktivita.',
      adminReserved: 'Jméno „admin“ je vyhrazené – přihlas se správným heslem.',
    },
    weekdaysFull: ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'],
    weekdaysShort: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
    months: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'],
    monthsShort: ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'],
  },
  en: {
    msgs: {
      week: 'Week', charts: 'Charts', exercises: 'Exercises', data: 'Data',
      prev: '‹ Previous', today: 'Today', next: 'Next ›',
      weekDone: 'This week: {done}/{total} done',
      missN: '{n} missed', upcomingN: '{n} ahead',
      missingN: '{done}/{total} · {n} missing', planN: 'plan: {n}',
      noWorkout: 'no workout',
      colDay: 'Day', colPlan: 'Plan', colStatus: 'Status',
      weekHint: 'Click a row to log results.',
      todayTag: 'today', pastTag: 'past',
      backToWeek: '← Back to week',
      done: 'Done', performanceColon: 'Result:',
      unmeasuredHint: 'Unmeasured workout – just tick it off.',
      notePlaceholder: 'Note (optional)',
      removeFromDay: 'Remove from this day',
      dayEmptyNotice: 'Nothing is planned for this day. You can still add exercises manually below.',
      addOtherN: 'Add another exercise to this day ({n})',
      add: '+ Add',
      chartsDoneTitle: 'Days done (%) – last 28 days',
      volumeTitle: 'Weekly volume – last 12 weeks',
      noMeasuredVolume: 'No measured exercises – the volume chart appears once an exercise has a unit (e.g. km).',
      thisWeek: 'This week',
      thisWeekEmpty: 'Nothing is planned this week.',
      historyTitle: 'Exercise progress',
      historyNeedsMeasured: 'You need a measured exercise (with a unit) for the progress chart.',
      donePct: 'Done %', goal: 'Goal',
      performance: 'Performance', missed: 'Missed', ahead: 'Ahead',
      exercisesTitle: 'Exercises & schedules',
      exercisesHint: 'Schedule recurring workouts – they appear in the weekly table. Measured exercises have a unit (km, min, reps…).',
      noExercises: 'No exercises yet. Add the first one!',
      newExercise: '+ New exercise', archiveTitle: 'Archive',
      measuredUnit: ' · measured ({u})', onlyCheck: ' · checkbox only',
      edit: 'Edit', restore: 'Restore', archive: 'Archive', delete: 'Delete',
      confirmDelete: 'Delete “{name}” and all its entries?',
      everyWeekday: 'every {wd}',
      everyWeekMulti: 'every week: {list}',
      everyNWeeksOff: 'every {n} weeks (week {o}): {list}',
      weekCycleLabel: 'Week of the cycle',
      weekCycleHint: 'When N > 1, pick which week of the cycle the workout happens (e.g. for N = 2: 1 = odd week, 2 = even week).',
      weekShort: 'Week',
      advLabel: 'Advanced schedule (custom times per day and week)',
      advHint: 'Fill the cells: row = weekday, column = week of the cycle. Each day can have its own time, and each week its own days/times. An empty cell means no workout that day in that week.',
      advWeekNow: 'This week corresponds to column {n}.',
      advSummary: 'Schedule (days × weeks)',
      everyNDays: 'every {n} days', everyDaily: 'daily',
      exNamePlaceholder: 'e.g. Forearm curls',
      weeklyKind: 'Every week (weekdays)', monthlyKind: 'Every N days',
      weekdayLabel: 'Days of the week', daysHint: 'Pick one or more days.', everyLabel: 'Repeat every N',
      everyWeeklyHint: '1 = every week, 2 = every second week…',
      everyMonthlyHint: '1 = daily, 2 = every second day…',
      nameLabel: 'Exercise name', colorLabel: 'Color', customColor: 'Custom color',
      kindLabel: 'Repeat type', timeLabel: 'Time',
      endTimeLabel: 'End (optional)',
      endTimeHint: 'Without an end time, a 1-minute duration is assumed on the timeline.',
      timelineTitle: 'Day timeline',
      timelineHint: 'Activity order and the gaps between them.',
      unitLabel: 'Unit (measured exercise)',
      unitHint: 'Leave empty for unmeasured exercises – just tick them off.',
      editExerciseTitle: 'Edit exercise', newExerciseTitle: 'New exercise',
      cancel: 'Cancel', save: 'Save',
      dataFileTitle: 'Data file',
      autoSave: 'Data is saved continuously in the browser of this device.',
      fsExtra: 'On Mac/Windows you can additionally bind the data to a file {file} on disk and save with one click.',
      syncNote: 'Transfer data between devices (incl. Android) by exporting/importing a JSON file.',
      selectedFile: 'Selected: {file}', noFile: 'No file selected',
      openFile: 'Open file…', saveToFile: 'Save to file',
      createDataFile: 'Create data file…',
      exportImport: 'Export / Import',
      exportJson: '⬇ Export JSON', importJson: '⬆ Import JSON',
      importReplaces: 'Import replaces current data with the content of the file.',
      stats: 'Statistics',
      statsLine: '{ex} exercises · {done} done · {all} entries total',
      importOk: 'Import finished successfully.',
      errImport: 'Import error: ',
      errInvalidFile: 'Invalid file format (missing exercises/logs).',
      themeDark: 'Dark', themeLight: 'Light',
      themeTitle: 'Appearance', langTitle: 'Language',
      exerciseSingular: 'exercises', entriesSingular: 'entries', donePlural: 'done',
      // chart folders + checkbox charts
      groupShow: 'Show:', allChip: 'All', newGroup: '+ New folder',
      manageGroups: '🗂 Folders',
      groupsTitle: 'Chart folders',
      groupsHint: 'Folders collect selected exercises – a chart then shows only those. Handy when you have many exercises and don\'t want them all in one chart.',
      emptyGroups: 'No folders yet. Create your first one – e.g. “Running” or “Gym”.',
      groupNameLabel: 'Folder name', groupNamePh: 'e.g. Cardio',
      membersLabel: 'Exercises in the folder',
      membersCount: '{n} exercises',
      folderEmptyChart: 'The selected folder has no exercises to show.',
      confirmDeleteGroup: 'Delete folder “{name}”? Its exercises stay untouched.',
      newGroupTitle: 'New folder', editGroupTitle: 'Edit folder',
      sessionsTitle: 'Completed workouts per week – checkbox exercises',
      optMeasured: 'Measured', optCheck: 'Check-off',
      histNoData: 'No scheduled occurrences yet.',
      // login / accounts
      loginTitle: 'Sign in',
      loginSub: 'Sign in or create an account – every user has their own data.',
      username: 'Username', password: 'Password',
      loginBtn: 'Sign in', registerBtn: 'Create account',
      logout: 'Log out', loggedInAs: 'Signed-in user',
      wrongCreds: 'Wrong username or password.',
      userTaken: 'This username already exists – try signing in.',
      invalidUser: 'Username: letters, digits, dot, dash and underscore only (2–30 chars).',
      errFill: 'Enter both username and password.',
      errNetwork: 'Could not reach the server.',
      syncedOk: 'Data saved on server',
      syncedOffline: 'Server unreachable – data only on this device',
      loginHint: 'Security is intentionally minimal – don\u2019t reuse passwords you use elsewhere.',
      // admin
      adminTitle: 'Account management',
      adminHint: 'All registered users – each has their own JSON file. You can delete an account with all its data.',
      refresh: 'Refresh',
      loading: 'Loading…',
      deleteUser: 'Delete account',
      confirmDeleteUser: 'Really delete account “{name}”? All of its data will be permanently deleted.',
      noUsers: 'No registered users yet.',
      adminLoadError: 'Could not load the account list – is the server reachable?',
      userStats: '{ex} exercises · {logs} entries',
      updatedCol: 'last change:',
      viewUser: 'View',
      backToAccounts: '← Back to account management',
      userEmpty: 'This account has no data yet.',
      loadUserDataError: 'Could not load this user’s data – is the server reachable?',
      weeksN: 'Last {n} weeks',
      daysN: 'Last {n} days',
      doneOf: '{done}/{total} done',
      totalVol: 'total {value} {unit}',
      activityTitle: 'Activity',
      noRecent: 'No activity in the last 30 days.',
      adminReserved: 'The name “admin” is reserved – sign in with the correct password.',
    },
    weekdaysFull: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  de: {
    msgs: {
      week: 'Woche', charts: 'Diagramme', exercises: 'Übungen', data: 'Daten',
      prev: '‹ Vorige', today: 'Heute', next: 'Nächste ›',
      weekDone: 'Diese Woche: {done}/{total} geschafft',
      missN: '{n} verpasst', upcomingN: '{n} noch offen',
      missingN: '{done}/{total} · {n} fehlen', planN: 'Plan: {n}',
      noWorkout: 'kein Training',
      colDay: 'Tag', colPlan: 'Plan', colStatus: 'Status',
      weekHint: 'Klicke auf eine Zeile, um Ergebnisse einzutragen.',
      todayTag: 'heute', pastTag: 'vergangen',
      backToWeek: '← Zurück zur Woche',
      done: 'Erledigt', performanceColon: 'Leistung:',
      unmeasuredHint: 'Unmessbares Training – einfach abhaken.',
      notePlaceholder: 'Notiz (optional)',
      removeFromDay: 'Von diesem Tag entfernen',
      dayEmptyNotice: 'Für diesen Tag ist nichts geplant. Unten kannst du trotzdem Übungen hinzufügen.',
      addOtherN: 'Weitere Übung an diesem Tag hinzufügen ({n})',
      add: '+ Hinzufügen',
      chartsDoneTitle: 'Geschaffte Tage (%) – letzte 28 Tage',
      volumeTitle: 'Wochenumfang – letzte 12 Wochen',
      noMeasuredVolume: 'Keine messbaren Übungen – das Diagramm erscheint, sobald eine Übung eine Einheit hat (z. B. km).',
      thisWeek: 'Diese Woche',
      thisWeekEmpty: 'Für diese Woche ist nichts geplant.',
      historyTitle: 'Übungsverlauf',
      historyNeedsMeasured: 'Für das Verlaufsdiagramm brauchst du eine messbare Übung (mit Einheit).',
      donePct: 'Geschafft %', goal: 'Ziel',
      performance: 'Leistung', missed: 'Verpasst', ahead: 'Offen',
      exercisesTitle: 'Übungen & Pläne',
      exercisesHint: 'Plane wiederkehrende Workouts – sie erscheinen in der Wochentabelle. Messbare Übungen haben eine Einheit (km, min, Wiederholungen…).',
      noExercises: 'Noch keine Übungen. Füge die erste hinzu!',
      newExercise: '+ Neue Übung', archiveTitle: 'Archiv',
      measuredUnit: ' · messbar ({u})', onlyCheck: ' · nur abhaken',
      edit: 'Bearbeiten', restore: 'Wiederherstellen', archive: 'Archivieren', delete: 'Löschen',
      confirmDelete: '„{name}“ und alle Einträge löschen?',
      everyWeekday: 'jeden {wd}',
      everyWeekMulti: 'jede Woche: {list}',
      everyNWeeksOff: 'alle {n} Wochen ({o}. Woche): {list}',
      weekCycleLabel: 'Woche im Zyklus',
      weekCycleHint: 'Wenn N > 1, wähle, in welcher Woche des Zyklus trainiert wird (z. B. bei N = 2: 1 = ungerade Woche, 2 = gerade).',
      weekShort: 'Woche',
      advLabel: 'Erweiterter Zeitplan (eigene Zeiten pro Tag und Woche)',
      advHint: 'Fülle die Zellen aus: Zeile = Wochentag, Spalte = Woche des Zyklus. Jeder Tag kann eine eigene Zeit haben, jede Woche eigene Tage/Zeiten. Leere Zelle = an diesem Tag in dieser Woche kein Training.',
      advWeekNow: 'Diese Woche entspricht Spalte {n}.',
      advSummary: 'Zeitplan (Tage × Wochen)',
      everyNDays: 'alle {n} Tage', everyDaily: 'täglich',
      exNamePlaceholder: 'z. B. Bizeps-Curls',
      weeklyKind: 'Jede Woche (Wochentage)', monthlyKind: 'Alle N Tage',
      weekdayLabel: 'Wochentage', daysHint: 'Einen oder mehrere Tage wählen.', everyLabel: 'Wiederholen alle N',
      everyWeeklyHint: '1 = jede Woche, 2 = jede zweite Woche…',
      everyMonthlyHint: '1 = täglich, 2 = jeden zweiten Tag…',
      nameLabel: 'Name der Übung', colorLabel: 'Farbe', customColor: 'Eigene Farbe',
      kindLabel: 'Wiederholungstyp', timeLabel: 'Zeit',
      endTimeLabel: 'Ende (optional)',
      endTimeHint: 'Ohne Endzeit wird für die Zeitachse 1 Minute angenommen.',
      timelineTitle: 'Tagesverlauf',
      timelineHint: 'Reihenfolge der Aktivitäten und Lücken dazwischen.',
      unitLabel: 'Einheit (messbare Übung)',
      unitHint: 'Leer lassen für unmessbare Übungen – einfach abhaken.',
      editExerciseTitle: 'Übung bearbeiten', newExerciseTitle: 'Neue Übung',
      cancel: 'Abbrechen', save: 'Speichern',
      dataFileTitle: 'Datendatei',
      autoSave: 'Daten werden fortlaufend im Browser des Geräts gespeichert.',
      fsExtra: 'Auf Mac/Windows kannst du die Daten zusätzlich an eine Datei {file} auf der Festplatte binden und mit einem Klick speichern.',
      syncNote: 'Übertrage Daten zwischen Geräten (inkl. Android) per Export/Import einer JSON-Datei.',
      selectedFile: 'Ausgewählt: {file}', noFile: 'Keine Datei ausgewählt',
      openFile: 'Datei öffnen…', saveToFile: 'In Datei speichern',
      createDataFile: 'Datendatei erstellen…',
      exportImport: 'Export / Import',
      exportJson: '⬇ JSON exportieren', importJson: '⬆ JSON importieren',
      importReplaces: 'Der Import ersetzt die aktuellen Daten durch den Dateiinhalt.',
      stats: 'Statistiken',
      statsLine: '{ex} Übungen · {done} geschafft · insgesamt {all} Einträge',
      importOk: 'Import erfolgreich abgeschlossen.',
      errImport: 'Importfehler: ',
      errInvalidFile: 'Ungültiges Dateiformat (exercises/logs fehlen).',
      themeDark: 'Dunkel', themeLight: 'Hell',
      themeTitle: 'Darstellung', langTitle: 'Sprache',
      exerciseSingular: 'Übungen', entriesSingular: 'Einträge', donePlural: 'geschafft',
      // chart folders + checkbox charts
      groupShow: 'Zeigen:', allChip: 'Alle', newGroup: '+ Neuer Ordner',
      manageGroups: '🗂 Ordner',
      groupsTitle: 'Diagramm-Ordner',
      groupsHint: 'Ordner bündeln ausgewählte Übungen – ein Diagramm zeigt dann nur diese. Praktisch, wenn du viele Übungen hast und sie nicht alle in einem Diagramm sehen willst.',
      emptyGroups: 'Noch keine Ordner. Erstelle deinen ersten – z. B. „Laufen“ oder „Kraft“.',
      groupNameLabel: 'Ordnername', groupNamePh: 'z. B. Ausdauer',
      membersLabel: 'Übungen im Ordner',
      membersCount: '{n} Übungen',
      folderEmptyChart: 'Im ausgewählten Ordner gibt es keine Übungen anzuzeigen.',
      confirmDeleteGroup: 'Ordner „{name}“ löschen? Die Übungen bleiben erhalten.',
      newGroupTitle: 'Neuer Ordner', editGroupTitle: 'Ordner bearbeiten',
      sessionsTitle: 'Geschaffte Einheiten pro Woche – Abhak-Übungen',
      optMeasured: 'Messbar', optCheck: 'Abhaken',
      histNoData: 'Noch keine geplanten Termine.',
      // login / accounts
      loginTitle: 'Anmelden',
      loginSub: 'Anmelden oder Konto erstellen – jede Person hat ihre eigenen Daten.',
      username: 'Benutzername', password: 'Passwort',
      loginBtn: 'Anmelden', registerBtn: 'Konto erstellen',
      logout: 'Abmelden', loggedInAs: 'Angemeldeter Benutzer',
      wrongCreds: 'Falscher Benutzername oder falsches Passwort.',
      userTaken: 'Dieser Benutzername existiert bereits – versuche dich anzumelden.',
      invalidUser: 'Benutzername: nur Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich (2–30 Zeichen).',
      errFill: 'Benutzername und Passwort eingeben.',
      errNetwork: 'Server nicht erreichbar.',
      syncedOk: 'Daten auf dem Server gespeichert',
      syncedOffline: 'Server nicht erreichbar – Daten nur auf diesem Gerät',
      loginHint: 'Sicherheit ist bewusst minimal – verwende keine Passwörter, die du woanders nutzt.',
      // admin
      adminTitle: 'Kontoverwaltung',
      adminHint: 'Alle registrierten Benutzer – jede Person hat ihre eigene JSON-Datei. Du kannst ein Konto mit allen Daten löschen.',
      refresh: 'Aktualisieren',
      loading: 'Wird geladen…',
      deleteUser: 'Konto löschen',
      confirmDeleteUser: 'Konto „{name}“ wirklich löschen? Alle Daten werden dauerhaft gelöscht.',
      noUsers: 'Noch keine registrierten Benutzer.',
      adminLoadError: 'Die Kontoliste konnte nicht geladen werden – ist der Server erreichbar?',
      userStats: '{ex} Übungen · {logs} Einträge',
      updatedCol: 'letzte Änderung:',
      viewUser: 'Ansehen',
      backToAccounts: '← Zurück zur Kontoverwaltung',
      userEmpty: 'Dieses Konto hat noch keine Daten.',
      loadUserDataError: 'Die Daten des Benutzers konnten nicht geladen werden – ist der Server erreichbar?',
      weeksN: 'Letzte {n} Wochen',
      daysN: 'Letzte {n} Tage',
      doneOf: '{done}/{total} geschafft',
      totalVol: 'gesamt {value} {unit}',
      activityTitle: 'Aktivität',
      noRecent: 'Keine Aktivität in den letzten 30 Tagen.',
      adminReserved: 'Der Name „admin“ ist reserviert – melde dich mit dem richtigen Passwort an.',
    },
    weekdaysFull: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    weekdaysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    monthsShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  },
}

const KEY = 'fit-tracker-lang'

export function getLang(): Lang {
  const v = localStorage.getItem(KEY) as Lang | null
  return v && LANGS.includes(v) ? v : 'cs'
}

export function setLang(l: Lang): void {
  localStorage.setItem(KEY, l)
  document.documentElement.lang = l
}

/** Call once at startup so the persisted language is applied before first render. */
export function initLang(): void {
  setLang(getLang())
}

/** Translate `key` for the current language; `{x}` placeholders come from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = DATA[getLang()].msgs[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v))
    }
  }
  return s
}

/* Locale-aware name tables (current language at call time). */

export function weekdaysFull(): string[] {
  return DATA[getLang()].weekdaysFull
}

export function weekdaysShort(): string[] {
  return DATA[getLang()].weekdaysShort
}

export function months(): string[] {
  return DATA[getLang()].months
}

export function monthsShort(): string[] {
  return DATA[getLang()].monthsShort
}

/** "Monday", "Montag", ... for ISO weekday 1..7. */
export function weekdayName(isoWeekday: number): string {
  return weekdaysFull()[isoWeekday - 1] ?? ''
}

/** "Mo", "Mo", ... for ISO weekday 1..7. */
export function weekdayShortName(isoWeekday: number): string {
  return weekdaysShort()[isoWeekday - 1] ?? ''
}

/** "January", ... for month number 1..12. */
export function monthName(m1: number): string {
  return months()[m1 - 1] ?? ''
}

/** "Jan", ... for month number 1..12. */
export function monthShortName(m1: number): string {
  return monthsShort()[m1 - 1] ?? ''
}