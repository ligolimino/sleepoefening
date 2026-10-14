/* ================================================================
   Letterlab — sleepoefening

   Een woord met ontbrekende letters, of een zin met ontbrekende
   woorden. De cursist sleept een kaartje naar een vakje. In de buurt
   van een vakje klikt het kaartje vanzelf vast (magnetisch). Tik op
   een gevuld vakje om het kaartje weer weg te halen.

   De volledige oefening staat in de link, bijvoorbeeld:
   ?oef=ka[t]&keuzes=m,t,k
   Zie README.md voor alle mogelijkheden.
   ================================================================ */

(function () {
    "use strict";

    /* ------------------------------------------------------------
       Instellingen die je zelf kunt aanpassen
       ------------------------------------------------------------ */

    // Mappen in deze repository voor eigen bestanden.
    const IMAGE_FOLDER = "assets/afbeeldingen/";
    const INSTRUCTION_FOLDER = "assets/audio/instructies/";
    const EXERCISE_AUDIO_FOLDER = "assets/audio/oefeningen/";

    // Woordopnames van het klik-klakboekje. Omdat beide tools op
    // ligolimino.github.io staan, kan de sleepoefening ze gewoon
    // gebruiken zonder ze te kopiëren.
    const KLIKKLAK_WORD_AUDIO = "../klikklak/assets/audio/woorden/";

    // Losse klanken voor de luisterknop boven een vakje (optie klank=ja).
    // Eerst een eigen opname in deze repository, daarna de vaste klanken
    // van het klik-klakboekje.
    const SOUND_FOLDER = "assets/audio/klanken/";
    const KLIKKLAK_SOUNDS = "../klikklak/assets/audio/klanken/";

    // Bestandstypes die geprobeerd worden als je geen extensie typt.
    const IMAGE_EXTENSIONS = [".jpg", ".png", ".webp", ".jpeg"];
    const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav"];

    // Hoe ver (in pixels) naast een vakje een kaartje nog vastklikt.
    const MAGNET_EXTRA_PX = 34;

    // Vanaf hoeveel pixels beweging een aanraking slepen is (en geen tik).
    const DRAG_START_PX = 6;

    /* ------------------------------------------------------------
       Link lezen
       ------------------------------------------------------------ */

    const params = new URLSearchParams(window.location.search);
    const app = document.getElementById("app");

    function param(name) {
        return (params.get(name) || "").trim();
    }

    function isYes(value) {
        return ["ja", "j", "yes", "1", "true", "waar"].includes(
            value.toLowerCase(),
        );
    }

    const settings = {
        exercise: param("oef"),
        choices: param("keuzes"),
        shuffle: isYes(param("mix")),
        useUp: isYes(param("weg")),
        sound: isYes(param("klank")),
        // Na een juist antwoord een luisterknop voor het volledige woord.
        listenAfter: isYes(param("luister")),
        // Tijdens de oefening een afspeelknop voor het hele woord of de zin.
        wordDuring: isYes(param("woord")),
        // Zonder "weergave=volledig" alleen de onderkant, net als bij het
        // dictee en het klik-klakboekje.
        compact: param("weergave").toLowerCase() !== "volledig",
        instruction: param("instructie"),
        image: param("beeld"),
        audio: param("audio"),
    };

    /* ------------------------------------------------------------
       Oefening ontleden: alles tussen [ ] is een vakje
       ------------------------------------------------------------ */

    function parseExercise(text) {
        const parts = [];
        const pattern = /\[([^\]]*)\]/g;
        let last = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > last) {
                parts.push({ type: "text", value: text.slice(last, match.index) });
            }
            parts.push({ type: "gap", answer: match[1].trim() });
            last = pattern.lastIndex;
        }
        if (last < text.length) {
            parts.push({ type: "text", value: text.slice(last) });
        }
        return parts;
    }

    function splitList(value) {
        return value
            .split(/[,;|]/)
            .map((item) => item.trim())
            .filter((item) => item !== "");
    }

    function shuffleInPlace(list) {
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    // Maakt de lijst met kaartjes. De juiste antwoorden komen er altijd
    // in, ook als je ze vergat bij de keuzes te zetten.
    function buildChoices(answers) {
        const given = splitList(settings.choices);
        let choices;

        if (settings.useUp) {
            // Elk kaartje kan maar één keer gebruikt worden. Er moeten dus
            // minstens zoveel kaartjes zijn als het antwoord nodig heeft.
            choices = given.slice();
            const needed = {};
            answers.forEach((a) => {
                needed[a] = (needed[a] || 0) + 1;
            });
            Object.keys(needed).forEach((answer) => {
                const present = choices.filter((c) => c === answer).length;
                for (let i = present; i < needed[answer]; i += 1) {
                    choices.push(answer);
                }
            });
        } else {
            // Kaartjes blijven staan, dus elke keuze hoeft maar één keer.
            choices = [];
            given.concat(answers).forEach((item) => {
                if (!choices.includes(item)) {
                    choices.push(item);
                }
            });
        }

        if (settings.shuffle || given.length === 0) {
            shuffleInPlace(choices);
        }
        return choices;
    }

    /* ------------------------------------------------------------
       Kleine hulpfuncties voor de opbouw van de pagina
       ------------------------------------------------------------ */

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    /* ------------------------------------------------------------
       Kaartjes
       ------------------------------------------------------------ */

    // Meetinstrument voor de afmetingen van het lettertype Andika.
    const measureContext = document.createElement("canvas").getContext("2d");

    // Zet de tekst van een kaartje in een binnenste span. Die bepaalt de
    // ruimte boven en onder de letters.
    function fillTile(tile, text) {
        const inner = el("span", "tile-text", text);
        tile.replaceChildren(inner);
        return tile;
    }

    function icon(name, filled) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("class", filled ? "icon filled" : "icon");
        svg.setAttribute("aria-hidden", "true");
        const use = document.createElementNS(ns, "use");
        use.setAttribute("href", `#i-${name}`);
        svg.appendChild(use);
        return svg;
    }

    function setIcon(button, name, filled) {
        button.replaceChildren(icon(name, filled));
    }

    function encodePath(path) {
        return path
            .split("/")
            .map((segment) => encodeURIComponent(segment))
            .join("/");
    }

    // Zet een bestandsnaam of link uit Excel om naar een lijst met
    // adressen om na elkaar te proberen.
    function mediaCandidates(value, folder, extensions) {
        if (!value) {
            return [];
        }
        const isLink = /^(https?:)?\/\//i.test(value) || /^\.{0,2}\//.test(value);
        if (isLink) {
            return [value];
        }
        const hasExtension = /\.[a-z0-9]{2,4}$/i.test(value);
        if (hasExtension) {
            return [folder + encodePath(value)];
        }
        return extensions.map((ext) => folder + encodePath(value + ext));
    }

    /* ------------------------------------------------------------
       Geluid
       ------------------------------------------------------------ */

    const player = {
        audio: null,
        button: null,
        stop() {
            if (this.audio) {
                this.audio.pause();
                this.audio.currentTime = 0;
            }
            if (this.button) {
                const restIcon = this.button.dataset.icon || "play";
                this.button.classList.remove("is-playing");
                setIcon(this.button, restIcon, restIcon === "play");
                this.button.setAttribute(
                    "aria-label",
                    this.button.dataset.label || "Luister",
                );
            }
            this.audio = null;
            this.button = null;
        },
        toggle(button, source) {
            const wasThisOne = this.button === button;
            this.stop();
            if (wasThisOne || !source) {
                return;
            }
            const audio = new Audio(source);
            this.audio = audio;
            this.button = button;
            button.classList.add("is-playing");
            setIcon(button, "pause", false);
            button.setAttribute("aria-label", "Stop");
            audio.addEventListener("ended", () => {
                if (this.audio === audio) {
                    this.stop();
                }
            });
            audio.play().catch(() => {
                if (this.audio === audio) {
                    this.stop();
                }
            });
        },
    };

    // Zoekt het eerste adres dat echt een geluid is. Geeft null terug
    // als geen enkel bestand bestaat.
    function findAudio(candidates) {
        return new Promise((resolve) => {
            let index = 0;
            const tryNext = () => {
                if (index >= candidates.length) {
                    resolve(null);
                    return;
                }
                const source = candidates[index];
                index += 1;
                const probe = new Audio();
                probe.preload = "metadata";
                const done = (ok) => {
                    probe.removeAttribute("src");
                    if (ok) {
                        resolve(source);
                    } else {
                        tryNext();
                    }
                };
                probe.addEventListener("loadedmetadata", () => done(true), {
                    once: true,
                });
                probe.addEventListener("error", () => done(false), {
                    once: true,
                });
                probe.src = source;
            };
            tryNext();
        });
    }

    // Een afspeelknop die pas verschijnt als het bestand gevonden is.
    function audioButton(candidates, label) {
        const button = el("button", "play-btn is-hidden");
        button.type = "button";
        button.setAttribute("aria-label", label);
        setIcon(button, "play", true);
        let source = null;

        findAudio(candidates).then((found) => {
            source = found;
            if (found) {
                button.classList.remove("is-hidden");
            } else {
                const holder = button.parentElement;
                button.remove();
                // Een lege instructiebalk of lege rij verdwijnt mee.
                if (
                    holder &&
                    (holder.classList.contains("instruction-bar") ||
                        holder.classList.contains("word-audio")) &&
                    holder.children.length === 0
                ) {
                    holder.remove();
                }
                // Niet opnieuw schalen tijdens de verbetering: dan staan de
                // vakjes al op de breedte van het antwoord.
                if (!state.result) {
                    fit();
                }
            }
        });
        button.addEventListener("click", () => player.toggle(button, source));
        return button;
    }

    function wordAudioCandidates(fullText) {
        if (settings.audio.toLowerCase() === "geen") {
            return [];
        }
        if (settings.audio) {
            return mediaCandidates(
                settings.audio,
                EXERCISE_AUDIO_FOLDER,
                AUDIO_EXTENSIONS,
            );
        }
        // Geen audio opgegeven: bij één woord zoeken we zelf een opname,
        // eerst in deze repository en daarna bij het klik-klakboekje.
        const word = fullText.trim().toLowerCase();
        if (!word) {
            return [];
        }
        if (/\s/.test(word)) {
            // Een zin: zoek een opname met de zin zelf als naam, zonder
            // leestekens op het einde. Bv. "de koffie" vindt
            // "de koffie.mp3" of "de-koffie.mp3" in assets/audio/oefeningen/.
            const sentence = fullText.trim().replace(/[.?!,;:]+$/, "");
            const names = [
                sentence,
                sentence.toLowerCase(),
                sentence.toLowerCase().replace(/[^a-z0-9à-ÿ\s-]/g, "").replace(/\s+/g, "-"),
            ];
            return [...new Set(names)].map(
                (name) => EXERCISE_AUDIO_FOLDER + encodePath(name + ".mp3"),
            );
        }
        const file = encodeURIComponent(word) + ".mp3";
        const first = encodeURIComponent(word.charAt(0));
        return [
            EXERCISE_AUDIO_FOLDER + file,
            `${KLIKKLAK_WORD_AUDIO}${first}/${file}`,
            `${KLIKKLAK_WORD_AUDIO}nonsens/${file}`,
        ];
    }

    // Wat moet de luisterknop boven een vakje laten horen? Bij letters en
    // klankgroepen de klank (ij en ei delen één opname), bij een woord in
    // een zin de woordopname.
    function soundCandidates(answer) {
        const value = answer.trim().toLowerCase();
        const soundName = value === "ij" || value === "ei" ? "ij-ei" : value;
        const soundFile = encodeURIComponent(soundName) + ".mp3";
        const wordFile = encodeURIComponent(value) + ".mp3";
        const first = encodeURIComponent(value.charAt(0));
        return [
            SOUND_FOLDER + soundFile,
            KLIKKLAK_SOUNDS + soundFile,
            EXERCISE_AUDIO_FOLDER + wordFile,
            `${KLIKKLAK_WORD_AUDIO}${first}/${wordFile}`,
        ];
    }

    // Kleine luidsprekerknop boven een leeg vakje.
    function soundButton(answer) {
        const button = el("button", "sound-btn is-hidden");
        button.type = "button";
        button.dataset.icon = "speaker";
        button.dataset.label = "Luister naar de klank";
        button.setAttribute("aria-label", "Luister naar de klank");
        setIcon(button, "speaker", false);
        let source = null;
        findAudio(soundCandidates(answer)).then((found) => {
            source = found;
            if (found) {
                button.classList.remove("is-hidden");
            }
        });
        button.addEventListener("click", () => player.toggle(button, source));
        return button;
    }

    /* ------------------------------------------------------------
       Uitlegpagina als er geen (geldige) oefening in de link staat
       ------------------------------------------------------------ */

    function showHelp(warning) {
        document.title = "Letterlab — sleepoefening";
        const base = window.location.pathname;
        const examples = [
            ["Woord, volledige versie", "?oef=ka[t]&keuzes=m,t,k&weergave=volledig"],
            ["Woord, alleen de onderkant", "?oef=ka[t]&keuzes=m,t,k"],
            ["Twee vakjes", "?oef=[m]aa[n]&keuzes=m,n,k,p"],
            [
                "Zin met ontbrekend woord",
                "?oef=Ik%20[drink]%20koffie.&keuzes=eet,drink,slaap",
            ],
        ];

        const help = el("section", "help");
        help.innerHTML = `
            <h1>Letterlab — sleepoefening</h1>
            <p>Deze pagina verschijnt omdat de link nog geen oefening bevat.
            Maak links het eenvoudigst met het tabblad <b>Sleeplinken</b>
            in de Excel-lijst.</p>
            <table>
                <tr><th>In de link</th><th>Betekenis</th></tr>
                <tr><td><code>oef=</code></td><td>Woord of zin. Zet wat ontbreekt tussen
                    vierkante haken: <code>ka[t]</code>, <code>[sch]oen</code>,
                    <code>Ik [drink] koffie.</code></td></tr>
                <tr><td><code>keuzes=</code></td><td>Kaartjes, gescheiden door komma's.
                    De juiste antwoorden worden altijd toegevoegd.</td></tr>
                <tr><td><code>mix=ja</code></td><td>Kaartjes in willekeurige volgorde.</td></tr>
                <tr><td><code>woord=ja</code></td><td>Tijdens de oefening een afspeelknop onder het woord of de zin.</td></tr>
                <tr><td><code>luister=ja</code></td><td>Na een juist antwoord verschijnt een luisterknop voor het volledige woord.</td></tr>
                <tr><td><code>klank=ja</code></td><td>Boven elk vakje een luisterknop met de klank (of het woord) die erin moet.</td></tr>
                <tr><td><code>weg=ja</code></td><td>Een gebruikt kaartje verdwijnt uit het keuzevak.</td></tr>
                <tr><td><code>weergave=volledig</code></td><td>Volledige versie met instructie, afbeelding en audio. Zonder deze toevoeging: alleen de onderkant, voor Genially.</td></tr>
                <tr><td><code>instructie=</code></td><td>Instructie-audio uit <code>${INSTRUCTION_FOLDER}</code> of een volledige link.</td></tr>
                <tr><td><code>beeld=</code></td><td>Afbeelding uit <code>${IMAGE_FOLDER}</code> of een volledige link.</td></tr>
                <tr><td><code>audio=</code></td><td>Audio van het woord of de zin uit <code>${EXERCISE_AUDIO_FOLDER}</code>,
                    een volledige link, of <code>geen</code>. Leeg bij één woord: de woordopname van het
                    klik-klakboekje wordt gezocht.</td></tr>
            </table>
            <p><b>Voorbeelden</b></p>`;

        if (warning) {
            const box = el("p", "warning", warning);
            help.insertBefore(box, help.children[1]);
        }
        const list = el("ul");
        examples.forEach(([label, query]) => {
            const item = el("li");
            const link = el("a", "", label);
            link.href = base + query;
            item.appendChild(link);
            list.appendChild(item);
        });
        help.appendChild(list);
        app.replaceChildren(help);
        app.style.height = "auto";
        app.style.overflow = "visible";
    }

    /* ------------------------------------------------------------
       Oefening opbouwen
       ------------------------------------------------------------ */

    const parts = parseExercise(settings.exercise);
    const gapParts = parts.filter((p) => p.type === "gap");

    if (!settings.exercise) {
        showHelp("");
        return;
    }
    if (gapParts.length === 0 || gapParts.some((g) => g.answer === "")) {
        showHelp(
            "Deze oefening heeft geen (gevuld) vakje. Zet wat ontbreekt tussen vierkante haken, bijvoorbeeld ka[t].",
        );
        return;
    }

    const answers = gapParts.map((g) => g.answer);
    const choices = buildChoices(answers);
    const fullText = parts
        .map((p) => (p.type === "gap" ? p.answer : p.value))
        .join("");
    const isSentence = /\s/.test(fullText.trim());

    document.title = `Letterlab — ${fullText.replace(/\s+/g, " ").trim()}`;
    if (settings.compact) {
        document.documentElement.classList.add("compact");
        app.classList.add("compact");
    }
    app.classList.add(isSentence ? "sentence-mode" : "word-mode");

    // Per vakje: welk kaartje erin staat (tekst en plaats in het keuzevak).
    const state = {
        filled: answers.map(() => null),
        result: "",
    };

    const gapNodes = [];
    const tileNodes = [];
    let exerciseNode;
    let stageNode;
    let feedbackNode;
    let bankNode;
    let pictureNode = null;

    function buildExerciseRow() {
        const row = el("div", isSentence ? "exercise sentence" : "exercise");
        if (settings.sound) {
            row.classList.add("with-sound");
        }
        let chunk = el("span", "chunk");
        let gapIndex = 0;

        const closeChunk = () => {
            if (chunk.childNodes.length > 0) {
                row.appendChild(chunk);
            }
            chunk = el("span", "chunk");
        };

        parts.forEach((part) => {
            if (part.type === "gap") {
                const gap = el("span", "gap");
                gap.dataset.index = String(gapIndex);
                gap.setAttribute("role", "button");
                gap.setAttribute("aria-label", "Leeg vakje");
                gap.tabIndex = -1;
                gapNodes.push(gap);
                if (settings.sound) {
                    // Houder: de luisterknop zweeft boven het vakje, zodat
                    // de letters op één lijn blijven staan.
                    const holder = el("span", "gap-holder");
                    holder.appendChild(soundButton(part.answer));
                    holder.appendChild(gap);
                    chunk.appendChild(holder);
                } else {
                    chunk.appendChild(gap);
                }
                gapIndex += 1;
                return;
            }
            if (!isSentence) {
                chunk.appendChild(el("span", "text", part.value));
                return;
            }
            // In een zin wordt elke spatie een mogelijke regelovergang.
            part.value.split(/(\s+)/).forEach((piece) => {
                if (piece === "") {
                    return;
                }
                if (/^\s+$/.test(piece)) {
                    closeChunk();
                } else {
                    chunk.appendChild(el("span", "text", piece));
                }
            });
        });
        closeChunk();
        return row;
    }

    function buildBank() {
        const bank = el("div", "bank");
        bank.setAttribute("aria-label", "Keuzes");
        choices.forEach((choice, index) => {
            const tile = fillTile(el("button", "tile"), choice);
            tile.type = "button";
            tile.dataset.choice = String(index);
            tileNodes.push(tile);
            bank.appendChild(tile);
        });
        return bank;
    }

    function buildPicture() {
        const candidates = mediaCandidates(
            settings.image,
            IMAGE_FOLDER,
            IMAGE_EXTENSIONS,
        );
        if (candidates.length === 0) {
            return null;
        }
        const figure = el("figure", "picture");
        const img = el("img");
        img.alt = "";
        img.draggable = false;
        let index = 0;
        img.addEventListener("error", () => {
            index += 1;
            if (index < candidates.length) {
                img.src = candidates[index];
            } else {
                figure.remove();
                pictureNode = null;
                fit();
            }
        });
        img.addEventListener("load", () => fit());
        img.src = candidates[0];
        figure.appendChild(img);
        return figure;
    }

    function build() {
        const children = [];

        if (!settings.compact) {
            const instruction = mediaCandidates(
                settings.instruction,
                INSTRUCTION_FOLDER,
                AUDIO_EXTENSIONS,
            );
            if (instruction.length > 0) {
                const bar = el("div", "instruction-bar");
                bar.appendChild(audioButton(instruction, "Luister naar de opdracht"));
                children.push(bar);
            }
        }

        stageNode = el("section", "stage");
        if (!settings.compact) {
            pictureNode = buildPicture();
            if (pictureNode) {
                stageNode.appendChild(pictureNode);
            }
        }
        exerciseNode = buildExerciseRow();
        stageNode.appendChild(exerciseNode);

        // Onder de oefening staan op dezelfde plaats:
        // - tijdens de oefening: de luisterknop voor het hele woord of de
        //   zin, alleen met woord=ja (in beide weergaven);
        // - na het nakijken: het rijtje met vinkje of kruisje, eventueel de
        //   luisterknop (luister=ja) en de knop Opnieuw.
        const below = el("div", "below");
        if (settings.wordDuring) {
            const candidates = wordAudioCandidates(fullText);
            if (candidates.length > 0) {
                const wrap = el("div", "word-audio");
                wrap.appendChild(audioButton(candidates, "Luister naar het woord"));
                below.appendChild(wrap);
            }
        }

        feedbackNode = el("div", "feedback");
        below.appendChild(feedbackNode);
        stageNode.appendChild(below);
        children.push(stageNode);

        bankNode = buildBank();
        children.push(bankNode);

        app.replaceChildren(...children);
    }

    /* ------------------------------------------------------------
       Automatische maat: alles past op het scherm, zonder scrollen
       ------------------------------------------------------------ */

    // Op hoeveel regels staat de zin nu?
    // (Een woord met een vakje is hoger dan een gewoon woord. Daarom tellen
    // we een nieuwe regel pas als een woord volledig onder de vorige staat.)
    function exerciseLines() {
        let lines = 0;
        let lineBottom = -Infinity;
        exerciseNode.querySelectorAll(":scope > .chunk").forEach((chunk) => {
            const top = chunk.offsetTop;
            const bottom = top + chunk.offsetHeight;
            if (top >= lineBottom - 2) {
                lines += 1;
                lineBottom = bottom;
            } else {
                lineBottom = Math.max(lineBottom, bottom);
            }
        });
        return Math.max(1, lines);
    }

    // Een zin mag niet over meer regels gaan dan echt nodig is, alleen
    // om de letters groter te maken.
    let allowedLines = 1;

    function overflowing() {
        if (isSentence && exerciseLines() > allowedLines) {
            return true;
        }
        const rowTooWide = exerciseNode.scrollWidth > exerciseNode.clientWidth + 1;
        const bankTooWide = bankNode.scrollWidth > bankNode.clientWidth + 1;
        // Steekt iets boven of onder het middenvlak uit?
        const box = stageNode.getBoundingClientRect();
        const stageTooHigh =
            stageNode.scrollHeight > stageNode.clientHeight + 2 ||
            Array.from(stageNode.children).some((child) => {
                const r = child.getBoundingClientRect();
                return r.top < box.top - 2 || r.bottom > box.bottom + 2;
            });
        const appTooHigh = app.scrollHeight > app.clientHeight + 1;
        return rowTooWide || bankTooWide || stageTooHigh || appTooHigh;
    }

    // Hoe hoog wordt een kaartje, en waar staan de letters erin?
    // We meten in Andika hoe hoog de hoogste letter (b, d, h, k, l, t) en
    // hoe diep de diepste staart (g, j, p, q, y) komt. Het kaartje krijgt
    // boven en onder evenveel ruimte. Omdat alle kaartjes dezelfde
    // waarden krijgen, staan alle letters op één lijn, ook die in de
    // vakjes naast de gegeven letters.
    const TILE_MARGIN_EM = 0.13;

    function measureTiles() {
        const weight = isSentence ? 400 : 700;
        try {
            measureContext.font = `${weight} 100px Andika`;
            const box = measureContext.measureText("x");
            const ascent = box.fontBoundingBoxAscent / 100;
            const descent = box.fontBoundingBoxDescent / 100;
            const tallest =
                measureContext.measureText("bdfhklt").actualBoundingBoxAscent / 100;
            const deepest =
                measureContext.measureText("gjpqy").actualBoundingBoxDescent / 100;
            if (!ascent || !tallest) {
                return;
            }
            // Bij line-height 1 ligt de basislijn hier, gemeten vanaf de
            // bovenkant van de regel.
            const baseline = ascent - (ascent + descent - 1) / 2;
            const inkTop = baseline - tallest;
            const inkBottom = baseline + deepest;
            const top = TILE_MARGIN_EM - inkTop;
            const bottom = TILE_MARGIN_EM - (1 - inkBottom);
            app.style.setProperty("--tile-mt", `${top.toFixed(3)}em`);
            app.style.setProperty("--tile-mb", `${bottom.toFixed(3)}em`);
        } catch (error) {
            /* dan gelden de standaardwaarden uit styles.css */
        }
    }

    // Verdeelt de kaartjes gelijk over een aantal regels: 8 kaartjes over
    // 2 regels geeft 4 + 4, 7 kaartjes geeft 4 + 3.
    let bankRows = 0;

    function layoutBank(rows) {
        if (rows === bankRows) {
            return;
        }
        bankRows = rows;
        const total = tileNodes.length;
        const base = Math.floor(total / rows);
        const extra = total % rows;
        const rowNodes = [];
        let index = 0;
        for (let r = 0; r < rows; r += 1) {
            const row = el("div", "bank-row");
            const count = base + (r < extra ? 1 : 0);
            for (let i = 0; i < count; i += 1) {
                row.appendChild(tileNodes[index]);
                index += 1;
            }
            rowNodes.push(row);
        }
        bankNode.replaceChildren(...rowNodes);
    }

    // Maakt alles zo groot als het scherm (of het insluitvak in Genially)
    // toelaat. De kaartjes gaan pas over twee of drie regels als de
    // letters daardoor merkbaar groter kunnen worden.
    function fit() {
        if (!exerciseNode) {
            return;
        }
        const width = app.clientWidth || window.innerWidth;
        const height = app.clientHeight || window.innerHeight;

        // Op een breed, laag scherm staat de afbeelding naast de oefening.
        const wide = Boolean(pictureNode) && width > height * 1.25;
        app.classList.toggle("wide", wide);
        releaseGapWidths();

        const minFs = 14;
        const imageSizeSteps = (isWide) =>
            pictureNode && !isWide ? [36, 30, 24, 18, 12] : [0];
        const imageSizesFirst = () => imageSizeSteps(wide)[0];
        const maxFs = isSentence
            ? Math.min(96, height * 0.16)
            : Math.min(150, height * 0.3);

        const apply = (fs, imgH) => {
            app.style.setProperty("--fs", `${fs.toFixed(1)}px`);
            if (wide) {
                app.style.setProperty("--img-h", "1px");
                const room = stageNode.clientHeight - 24;
                app.style.setProperty("--img-h", `${Math.max(60, room)}px`);
            } else {
                app.style.setProperty("--img-h", `${imgH}svh`);
            }
            sizeGaps();
        };

        // Grootste lettergrootte die past, bij een vast aantal regels.
        const largest = (rows, imgH) => {
            layoutBank(rows);
            let low = minFs;
            let high = Math.max(minFs, maxFs);
            apply(high, imgH);
            if (!overflowing()) {
                return high;
            }
            for (let step = 0; step < 10; step += 1) {
                const middle = (low + high) / 2;
                apply(middle, imgH);
                if (overflowing()) {
                    high = middle;
                } else {
                    low = middle;
                }
            }
            return low;
        };

        // De afbeelding krimpt pas als de letters anders te klein worden.
        const imageSizes = imageSizeSteps(wide);

        // Beste verdeling voor een vast aantal regels van de zin.
        const bestLayout = () => {
            let found = null;
            for (const imgH of imageSizes) {
                const total = tileNodes.length;
                let rows = 1;
                let fs = largest(1, imgH);
                if (total >= 4) {
                    const two = largest(2, imgH);
                    if (two > fs * 1.2) {
                        rows = 2;
                        fs = two;
                    }
                }
                if (total >= 9 && rows === 2) {
                    const three = largest(3, imgH);
                    if (three > fs * 1.2) {
                        rows = 3;
                        fs = three;
                    }
                }
                found = { rows, fs, imgH };
                if (fs >= (isSentence ? 22 : 30)) {
                    break;
                }
            }
            return found;
        };

        let best;
        if (!isSentence) {
            best = bestLayout();
        } else {
            // Een zin gaat alleen over een extra regel als de letters
            // daardoor merkbaar groter worden, en er staan gemiddeld minstens
            // twee woorden op een regel (nooit één woord alleen).
            const words = exerciseNode.querySelectorAll(":scope > .chunk").length;
            const maxLines = Math.max(1, Math.floor(words / 2));
            allowedLines = 99;
            layoutBank(1);
            apply(minFs, imageSizes[0]);
            let lines = Math.min(exerciseLines(), maxLines);
            allowedLines = lines;
            best = { ...bestLayout(), lines };
            while (lines < maxLines) {
                allowedLines = lines + 1;
                const next = bestLayout();
                if (next.fs > best.fs * 1.25) {
                    lines += 1;
                    best = { ...next, lines };
                } else {
                    break;
                }
            }
            allowedLines = best.lines;
        }
        layoutBank(best.rows);
        apply(best.fs, best.imgH);

        // Na een juist antwoord blijven de vakjes zo breed als het antwoord,
        // ook als het scherm draait.
        if (state.result === "good") {
            fitGapsToAnswers();
        }
    }

    // Tijdens de oefening zijn alle vakjes even breed als het breedste
    // kaartje, zodat elk kaartje erin past en de breedte geen hint geeft.
    function sizeGaps() {
        app.style.removeProperty("--gap-w");
        let widest = 0;
        tileNodes.forEach((tile) => {
            widest = Math.max(widest, tile.offsetWidth);
        });
        if (widest > 0) {
            app.style.setProperty("--gap-w", `${widest}px`);
        }
    }

    /* ------------------------------------------------------------
       Vakjes vullen, leegmaken en controleren
       ------------------------------------------------------------ */

    function renderGap(index) {
        const gap = gapNodes[index];
        const content = state.filled[index];
        gap.replaceChildren();
        gap.classList.toggle("filled", Boolean(content));
        gap.classList.remove("good", "wrong");
        if (content) {
            gap.appendChild(fillTile(el("span", "tile"), content.text));
            gap.setAttribute("aria-label", `${content.text}, tik om weg te halen`);
            gap.tabIndex = 0;
        } else {
            // Onzichtbaar kaartje: zo is een leeg vakje even hoog als een
            // kaartje en staat het op dezelfde lijn als de letters.
            const spacer = fillTile(el("span", "tile spacer"), "x");
            spacer.setAttribute("aria-hidden", "true");
            gap.appendChild(spacer);
            gap.setAttribute("aria-label", "Leeg vakje");
            gap.tabIndex = -1;
        }
    }

    function updateBankUsage() {
        if (!settings.useUp) {
            return;
        }
        const used = new Set(
            state.filled.filter(Boolean).map((content) => content.choice),
        );
        tileNodes.forEach((tile, index) => {
            tile.classList.toggle("used", used.has(index));
            tile.disabled = used.has(index);
        });
    }

    function clearResult() {
        if (!state.result) {
            return;
        }
        state.result = "";
        app.classList.remove("done");
        app.classList.remove("has-result");
        player.stop();
        releaseGapWidths();
        feedbackNode.className = "feedback";
        feedbackNode.replaceChildren();
        gapNodes.forEach((gap) => gap.classList.remove("good", "wrong"));
    }

    function setGap(index, content) {
        clearResult();
        state.filled[index] = content;
        renderGap(index);
        updateBankUsage();
        if (state.filled.every(Boolean)) {
            window.setTimeout(check, 220);
        }
    }

    function check() {
        if (!state.filled.every(Boolean) || state.result) {
            return;
        }
        const correct = state.filled.map(
            (content, index) => content.text === answers[index],
        );
        const allGood = correct.every(Boolean);
        state.result = allGood ? "good" : "wrong";
        app.classList.add("has-result");
        player.stop();

        feedbackNode.replaceChildren();
        if (allGood) {
            gapNodes.forEach((gap) => gap.classList.add("good"));
            feedbackNode.className = "feedback good";
            feedbackNode.appendChild(icon("check"));
            if (settings.listenAfter) {
                const candidates = wordAudioCandidates(fullText);
                if (candidates.length > 0) {
                    const listen = audioButton(candidates, "Luister naar het woord");
                    listen.classList.add("small");
                    listen.dataset.icon = "speaker";
                    setIcon(listen, "speaker", false);
                    feedbackNode.appendChild(listen);
                }
            }
            feedbackNode.appendChild(retryButton("good"));
            app.classList.add("done");
            fitGapsToAnswers();
            // Alle kaartjes in het keuzevak verdwijnen: het antwoord staat
            // nu in de vakjes. De plaats blijft bewaard, zodat niets
            // verspringt.
            tileNodes.forEach((tile) => tile.classList.add("cleared"));
        } else {
            correct.forEach((ok, index) => {
                if (!ok) {
                    gapNodes[index].classList.add("wrong");
                }
            });
            feedbackNode.className = "feedback bad";
            feedbackNode.appendChild(icon("close"));
            feedbackNode.appendChild(retryButton("bad"));
        }

        // Genially of een andere omringende pagina kan dit opvangen.
        try {
            window.parent.postMessage(
                { bron: "letterlab-sleep", resultaat: state.result, oefening: fullText },
                "*",
            );
        } catch (error) {
            /* geen omringende pagina */
        }
    }

    // In de verbetering wordt elk vakje zo breed als het woord dat erin
    // staat. We meten het kaartje in het vakje zelf, zodat het altijd past.
    function fitGapsToAnswers() {
        gapNodes.forEach((gap) => {
            const from = gap.offsetWidth;
            gap.classList.add("fit");
            const to = gap.offsetWidth;
            gap.classList.remove("fit");
            gap.style.width = `${from}px`;
            // Even wachten zodat de browser het rustig laat krimpen.
            gap.getBoundingClientRect();
            gap.style.width = `${to}px`;
        });
    }

    function releaseGapWidths() {
        gapNodes.forEach((gap) => gap.style.removeProperty("width"));
    }

    // Knop om de oefening helemaal opnieuw te beginnen.
    function retryButton(kind) {
        const retry = el("button", `retry-btn ${kind}`);
        retry.type = "button";
        retry.setAttribute("aria-label", "Opnieuw");
        retry.appendChild(icon("retry"));
        retry.addEventListener("click", resetAll);
        return retry;
    }

    function resetAll() {
        tileNodes.forEach((tile) => tile.classList.remove("cleared"));
        clearResult();
        state.filled = state.filled.map(() => null);
        gapNodes.forEach((gap, index) => renderGap(index));
        updateBankUsage();
    }

    function firstEmptyGap() {
        return state.filled.findIndex((content) => !content);
    }

    /* ------------------------------------------------------------
       Slepen, magnetisch vastklikken en tikken
       ------------------------------------------------------------ */

    let drag = null;

    function centerOf(rect) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    // Zoekt het dichtstbijzijnde vakje binnen de magneetafstand.
    function nearestGap(point) {
        let best = -1;
        let bestDistance = Infinity;
        gapNodes.forEach((gap, index) => {
            const rect = gap.getBoundingClientRect();
            const c = centerOf(rect);
            const distance = Math.hypot(point.x - c.x, point.y - c.y);
            const reach = Math.max(rect.width, rect.height) * 0.9 + MAGNET_EXTRA_PX;
            if (distance <= reach && distance < bestDistance) {
                best = index;
                bestDistance = distance;
            }
        });
        return best;
    }

    function makeGhost(text, rect) {
        const ghost = fillTile(el("div", "tile ghost"), text);
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        // Zelfde lettergrootte als de kaartjes in het keuzevak.
        ghost.style.fontSize = getComputedStyle(tileNodes[0]).fontSize;
        ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
        app.appendChild(ghost);
        return ghost;
    }

    // Laat het zwevende kaartje vloeiend naar een plek glijden.
    function glide(ghost, rect, then) {
        let finished = false;
        const finish = () => {
            if (finished) {
                return;
            }
            finished = true;
            ghost.remove();
            then();
        };
        ghost.style.transition = "transform 0.17s ease-out, width 0.17s, height 0.17s";
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
        ghost.addEventListener("transitionend", finish, { once: true });
        window.setTimeout(finish, 260);
    }

    function highlight(index) {
        gapNodes.forEach((gap, i) => gap.classList.toggle("near", i === index));
    }

    function startDrag(event, source) {
        if (state.result === "good") {
            return;
        }
        const node = event.currentTarget;
        drag = {
            pointerId: event.pointerId,
            source,
            node,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
            ghost: null,
            offsetX: 0,
            offsetY: 0,
            text: source.text,
        };
        try {
            node.setPointerCapture(event.pointerId);
        } catch (error) {
            /* sommige browsers ondersteunen dit niet */
        }
    }

    function moveDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;

        if (!drag.moved) {
            if (Math.hypot(dx, dy) < DRAG_START_PX) {
                return;
            }
            drag.moved = true;
            player.stop();
            const rect = drag.node.getBoundingClientRect();
            drag.offsetX = drag.startX - rect.left;
            drag.offsetY = drag.startY - rect.top;
            drag.ghost = makeGhost(drag.text, rect);
            drag.ghost.style.transform += " scale(1.08)";
            drag.originRect = rect;

            if (drag.source.type === "gap") {
                // Een kaartje uit een vakje halen om het te verplaatsen.
                setGap(drag.source.index, null);
            } else if (settings.useUp) {
                drag.node.classList.add("used");
            }
        }

        const x = event.clientX - drag.offsetX;
        const y = event.clientY - drag.offsetY;
        drag.ghost.style.transform = `translate(${x}px, ${y}px) scale(1.08)`;
        const r = drag.ghost.getBoundingClientRect();
        highlight(nearestGap(centerOf(r)));
        event.preventDefault();
    }

    function endDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }
        const current = drag;
        drag = null;
        highlight(-1);

        if (!current.moved) {
            handleTap(current.source);
            return;
        }

        const target = nearestGap(centerOf(current.ghost.getBoundingClientRect()));
        const content = { text: current.text, choice: current.source.choice };

        if (target >= 0) {
            // Magnetisch: het kaartje glijdt netjes in het vakje.
            const gapRect = gapNodes[target].getBoundingClientRect();
            gapNodes[target].classList.add("target");
            glide(current.ghost, gapRect, () => {
                gapNodes[target].classList.remove("target");
                setGap(target, content);
            });
            return;
        }

        // Niet bij een vakje: terug naar het keuzevak.
        const back = tileNodes[current.source.choice].getBoundingClientRect();
        glide(current.ghost, back, () => updateBankUsage());
    }

    function cancelDrag() {
        if (!drag) {
            return;
        }
        if (drag.ghost) {
            drag.ghost.remove();
        }
        drag = null;
        highlight(-1);
        updateBankUsage();
    }

    function handleTap(source) {
        if (source.type === "gap") {
            // Nog eens tikken op een gevuld vakje haalt het kaartje weg.
            if (state.result !== "good") {
                setGap(source.index, null);
            }
            return;
        }
        // Tikken op een kaartje: het vliegt naar het eerste lege vakje.
        // Handig voor cursisten die moeilijk kunnen slepen.
        const target = firstEmptyGap();
        if (target < 0 || state.result === "good") {
            return;
        }
        const tile = tileNodes[source.choice];
        const ghost = makeGhost(source.text, tile.getBoundingClientRect());
        if (settings.useUp) {
            tile.classList.add("used");
        }
        gapNodes[target].classList.add("target");
        requestAnimationFrame(() =>
            glide(ghost, gapNodes[target].getBoundingClientRect(), () => {
                gapNodes[target].classList.remove("target");
                setGap(target, { text: source.text, choice: source.choice });
            }),
        );
    }

    function wireEvents() {
        tileNodes.forEach((tile, index) => {
            const source = () => ({ type: "bank", choice: index, text: choices[index] });
            tile.addEventListener("pointerdown", (event) => {
                if (event.button !== 0 || tile.disabled) {
                    return;
                }
                event.preventDefault();
                startDrag(event, source());
            });
            // Toetsenbord (Enter of spatie): zelfde als tikken.
            tile.addEventListener("click", (event) => {
                if (event.detail === 0) {
                    handleTap(source());
                }
            });
        });

        gapNodes.forEach((gap, index) => {
            gap.addEventListener("pointerdown", (event) => {
                const content = state.filled[index];
                if (!content || event.button !== 0) {
                    return;
                }
                event.preventDefault();
                startDrag(event, {
                    type: "gap",
                    index,
                    choice: content.choice,
                    text: content.text,
                });
            });
            gap.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (state.filled[index]) {
                        handleTap({ type: "gap", index });
                    }
                }
            });
        });

        document.addEventListener("pointermove", moveDrag, { passive: false });
        document.addEventListener("pointerup", endDrag);
        document.addEventListener("pointercancel", cancelDrag);
        window.addEventListener("blur", cancelDrag);

        let resizeTimer = 0;
        window.addEventListener("resize", () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(fit, 80);
        });
    }

    /* ------------------------------------------------------------
       Start
       ------------------------------------------------------------ */

    build();
    gapNodes.forEach((gap, index) => renderGap(index));
    wireEvents();
    measureTiles();
    fit();
    if (document.fonts && document.fonts.ready) {
        // Laad Andika uitdrukkelijk: pas dan kloppen de metingen voor het
        // centreren. (Zonder dit meet de browser soms een ander lettertype.)
        const loads = ["400 40px Andika", "700 40px Andika"].map((font) =>
            document.fonts.load(font, "abc").catch(() => null),
        );
        Promise.all(loads)
            .then(() => document.fonts.ready)
            .then(() => {
                measureTiles();
                fit();
            });
    }

    // Voor de tests: de toestand van buitenaf kunnen bekijken.
    window.__sleep = { state, answers, choices };
})();
