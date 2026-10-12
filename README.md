# Letterlab — sleepoefening

Een oefening waarin cursisten ontbrekende letters naar een woord slepen,
of ontbrekende woorden naar een zin. Een kaartje klikt vanzelf vast als het
in de buurt van een vakje wordt losgelaten. Tik op een gevuld vakje om het
kaartje weer weg te halen. Tikken op een kaartje zet het in het eerste lege
vakje. Dat is handig voor cursisten die moeilijk kunnen slepen.

Er zijn twee versies, met dezelfde link als basis. Dezelfde regel geldt voor
het dictee en het klik-klakboekje:

| Versie | Wat staat erop | Gebruik |
|---|---|---|
| Volledig (`weergave=volledig`) | instructie-audio, afbeelding, woord of zin, audio, kaartjes | zelfstandig gebruik |
| Onderkant (standaard) | alleen het woord of de zin en de kaartjes | in Genially, met afbeelding en audio in Genially zelf |

De onderkant heeft een doorzichtige achtergrond, zodat de achtergrond van je
Genially-dia zichtbaar blijft.

## Zelfstandig en onderhoudsvrij

- De tool bestaat alleen uit gewone bestanden (`index.html`, `styles.css`,
  `app.js`). Er is geen installatie, geen bouwstap en geen databank nodig.
- Het lettertype Andika staat in de repository zelf. Er wordt niets van
  andere websites geladen.
- De volledige oefening staat in de link. Een link uit Excel blijft dus
  werken zolang deze repository online staat.
- Wijzigen kan rechtstreeks op github.com: bestanden uploaden of slepen in
  de juiste map volstaat.

## Publiceren (eenmalig)

1. Maak op github.com, bij de account **ligolimino**, een nieuwe openbare
   repository met de naam `sleepoefening`.
2. Kies **uploading an existing file** en sleep de **inhoud** van deze map
   erin, dus niet de map zelf. Kies **Commit changes**.
3. Ga naar **Settings → Pages**. Kies bij *Branch* `main` en `/ (root)` en
   klik op **Save**.
4. Na een paar minuten werkt de tool op
   `https://ligolimino.github.io/sleepoefening/`.

Open je die link zonder iets erachter, dan zie je een uitlegpagina met
voorbeelden.

## Een oefening maken

Gebruik het tabblad **Sleeplinken** of **Sleepmaker** in de Excel-lijst. Die
maakt de links en de Genially-insluitcodes vanzelf.

Wat ontbreekt, zet je tussen vierkante haken:

| Je typt | De cursist ziet |
|---|---|
| `ka[t]` | ka + een vakje |
| `[m]aa[n]` | twee vakjes |
| `[sch]oen` | een vakje voor een klankgroep |
| `Ik [drink] koffie.` | een zin met één ontbrekend woord |

Alles met een spatie erin wordt als zin getoond. Lange zinnen lopen vanzelf
over meerdere regels. Een leesteken blijft bij het woord ervoor staan.

### Alle mogelijkheden in de link

| In de link | Betekenis |
|---|---|
| `oef=ka[t]` | De oefening (verplicht). |
| `keuzes=m,t,k` | De kaartjes, in deze volgorde. De juiste antwoorden worden altijd toegevoegd, ook als je ze vergeet. Leeg: alleen de juiste antwoorden, door elkaar. |
| `mix=ja` | De kaartjes staan in willekeurige volgorde, elke keer anders. |
| `luister=ja` | Na een juist antwoord verschijnt naast het vinkje een luisterknop voor het volledige woord. Bij één woord wordt de opname vanzelf gezocht (zie hieronder); bij een zin vul je **Audio woord/zin** in. Werkt in beide weergaven. |
| `klank=ja` | Boven elk vakje staat een kleine luisterknop met de klank die erin moet (bij een zin: het woord). Werkt in beide weergaven. |
| `weg=ja` | Een gebruikt kaartje verdwijnt uit het keuzevak. Zonder deze optie blijft het staan en kan het meerdere keren gebruikt worden (handig bij `[k]i[k]`). |
| `weergave=volledig` | De volledige versie. Zonder deze toevoeging krijg je alleen de onderkant, voor Genially. Instructie, afbeelding en audio worden dan genegeerd. |
| `instructie=sleep` | Instructie-audio uit `assets/audio/instructies/`. |
| `beeld=kat` | Afbeelding uit `assets/afbeeldingen/`. |
| `audio=kat` | Audio van het woord of de zin uit `assets/audio/oefeningen/`. |
| `audio=geen` | Geen afspeelknop bij het woord. |

## Afbeeldingen en audio

Zet je bestanden in deze mappen. Op github.com open je de map en kies je
**Add file → Upload files**.

| Map | Wat |
|---|---|
| `assets/afbeeldingen/` | afbeeldingen (`.jpg`, `.png` of `.webp`) |
| `assets/audio/instructies/` | instructie-audio (`.mp3`) |
| `assets/audio/oefeningen/` | audio van een woord of zin (`.mp3`) |
| `assets/audio/klanken/` | eigen klankopnames voor de luisterknop boven een vakje (`.mp3`), alleen nodig als je een andere opname wilt dan die van het klik-klakboekje |

- In Excel typ je alleen de bestandsnaam. De extensie mag je weglaten:
  `kat` vindt `kat.jpg`, `kat.png` of `kat.webp`.
- Submappen mogen: `thema1/kat` vindt `assets/afbeeldingen/thema1/kat.jpg`.
- Een volledige link (`https://...`) werkt ook, bijvoorbeeld naar een
  afbeelding die al elders online staat.
- Gebruik bij voorkeur kleine letters en geen spaties in bestandsnamen.
- Bestandsnamen zijn hoofdlettergevoelig: `Kat.jpg` is niet `kat.jpg`.

### Audio van het klik-klakboekje

Laat je **audio** leeg bij een oefening met één woord, dan zoekt de tool zelf
een opname, in deze volgorde:

1. `assets/audio/oefeningen/woord.mp3` in deze repository;
2. de woordopname van het klik-klakboekje
   (`klikklak/assets/audio/woorden/eerste-letter/woord.mp3`);
3. de nonsenswoordopname van het klik-klakboekje
   (`klikklak/assets/audio/woorden/nonsens/woord.mp3`).

Zo hoef je opnames die al bij het klik-klakboekje staan niet te kopiëren.
Dat werkt omdat beide tools op `ligolimino.github.io` staan. Wordt geen
opname gevonden, dan verschijnt er gewoon geen afspeelknop.

Wil je deze tool ooit volledig los van het klik-klakboekje gebruiken? Zet de
opnames dan in `assets/audio/oefeningen/`. Die map wordt altijd eerst
geprobeerd.

## Wat de cursist ziet

- Kaartje in de buurt van een vakje loslaten: het klikt vast. Het vakje
  kleurt roze zolang het kaartje dichtbij genoeg is.
- Ergens anders loslaten: het kaartje glijdt terug.
- Zijn alle vakjes gevuld, dan volgt meteen de controle:
  - juist: groene vakjes en een vinkje;
  - fout: de foute vakjes worden rood en schudden, en er verschijnen een
    kruisje en een knop **Opnieuw**. De cursist kan ook op een rood vakje
    tikken en een ander kaartje kiezen.

De letters en kaartjes worden automatisch zo groot mogelijk gemaakt, zonder
dat er gescrold moet worden. Dat werkt op gsm (staand en liggend), tablet en
computer. Op een breed scherm staat de afbeelding naast de oefening.

## Iets aanpassen

| Wat | Waar |
|---|---|
| Kleuren | bovenaan in `styles.css`, bij `:root` |
| Hoe ver een kaartje nog vastklikt | `MAGNET_EXTRA_PX` bovenaan in `app.js` |
| Mappen voor afbeeldingen en audio | bovenaan in `app.js` |

Verhoog na een wijziging in `styles.css` of `app.js` het versienummer in
`index.html`, bijvoorbeeld van `styles.css?v=1` naar `styles.css?v=2`. Anders
tonen telefoons nog een tijd de oude versie.

## Controle vóór gebruik

- Open de link uit Excel eerst zelf.
- Sleep één fout en één juist kaartje.
- Test de Genially-insluiting op Android en iPhone, staand en liggend.

## Licentie lettertype

Andika valt onder de SIL Open Font License, zie
`assets/fonts/OFL-LICENSE.txt`.

## Luisterknop boven een vakje

Met **Klank boven vakje? = Ja** in Excel (in de link: `klank=ja`) staat boven
elk vakje een luisterknop. De tool zoekt de opname in deze volgorde:

1. `assets/audio/klanken/klank.mp3` in deze repository;
2. de vaste klanken van het klik-klakboekje (`klikklak/assets/audio/klanken/`),
   met `ij-ei.mp3` voor zowel `ij` als `ei`;
3. bij een woord: `assets/audio/oefeningen/woord.mp3` en daarna de
   woordopname van het klik-klakboekje.

Wordt niets gevonden, dan blijft de knop boven dat vakje weg.

## Wat er gebeurt na een juist antwoord

- Alle kaartjes in het keuzevak verdwijnen (de plaats blijft bewaard).
- De vakjes worden groen en krimpen tot de breedte van het juiste
  antwoord. Tijdens de oefening zijn alle vakjes even breed, zodat de
  breedte geen hint geeft.
- Met **Woord beluisteren na juist antwoord? = Ja** (`luister=ja`) staat er
  naast het vinkje een luisterknop voor het volledige woord.
- De knop **Opnieuw** zet alles terug.

## Letters in het midden

De tool meet bij het laden waar de letters staan en zet ze zo goed mogelijk
in het midden van de kaartjes. Alle kaartjes delen één basislijn, zodat de
letters onderling op één lijn blijven. In het woord of de zin staan alle
letters op één lijn, ook die in de vakjes. Daar hoef je niets voor te doen.

## Audio bij een zin

Laat je **Audio woord/zin** leeg bij een zin, dan zoekt de tool in
`assets/audio/oefeningen/` naar een opname met de zin als naam, zonder
leesteken op het einde. Voor "Ik [drink] koffie." werkt bijvoorbeeld
`Ik drink koffie.mp3`, `ik drink koffie.mp3` of `ik-drink-koffie.mp3`.
