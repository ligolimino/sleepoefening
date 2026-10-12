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
       Letters precies in het midden van een kaartje
       ------------------------------------------------------------ */

    // Andika heeft boven de letters veel meer ruimte dan eronder. Daardoor
    // staan letters zonder stok (m, a, oe) optisch te laag in een kaartje.
    // We meten waar de inkt van een tekst echt staat en schuiven hem zo
    // dat hij precies in het midden komt. De uitkomst is in em, zodat ze
    // klopt bij elke lettergrootte.
    const measureContext = document.createElement("canvas").getContext("2d");

    // Afstand (in em) tussen het midden van de inkt en het midden van de
    // regel, bij line-height 1. Positief = de inkt staat te laag.
    function inkOffset(text, weight) {
        const size = 100;
        try {
            measureContext.font = `${weight} ${size}px Andika`;
            const m = measureContext.measureText(text);
            if (!m.fontBoundingBoxAscent || !m.actualBoundingBoxAscent) {
                return 0;
            }
            const baseline = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
            const inkMiddle =
                baseline -
                (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
            return inkMiddle / size;
        } catch (error) {
            return 0;
        }
    }

    // Zet de tekst van een kaartje in een binnenste span die verschoven
    // kan worden, zonder dat het kader meeschuift.
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
                button.remove();
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
        if (!word || /\s/.test(word)) {
            return [];
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

        if (!settings.compact) {
            const candidates = wordAudioCandidates(fullText);
            if (candidates.length > 0) {
                const wrap = el("div", "word-audio");
                wrap.appendChild(audioButton(candidates, "Luister naar het woord"));
                stageNode.appendChild(wrap);
            }
        }

        feedbackNode = el("div", "feedback");
        stageNode.appendChild(feedbackNode);
        children.push(stageNode);

        bankNode = buildBank();
        children.push(bankNode);

        app.replaceChildren(...children);
    }

    /* ------------------------------------------------------------
       Automatische maat: alles past op het scherm, zonder scrollen
       ------------------------------------------------------------ */

    // Staan de kaartjes over meer dan één regel verspreid?
    function bankWraps() {
        const first = tileNodes[0];
        const last = tileNodes[tileNodes.length - 1];
        return last.offsetTop > first.offsetTop + first.offsetHeight / 2;
    }

    function overflowing(fs) {
        const rowTooWide = exerciseNode.scrollWidth > exerciseNode.clientWidth + 1;
        // Steekt iets boven of onder het middenvlak uit?
        const box = stageNode.getBoundingClientRect();
        const stageTooHigh =
            stageNode.scrollHeight > stageNode.clientHeight + 4 ||
            Array.from(stageNode.children).some((child) => {
                const r = child.getBoundingClientRect();
                return r.top < box.top - 4 || r.bottom > box.bottom + 4;
            });
        const appTooHigh = app.scrollHeight > app.clientHeight + 1;
        // Tot zes kaartjes passen bij voorkeur op één regel, zolang de
        // letters daarvoor niet te klein moeten worden.
        const keepOneRow = tileNodes.length <= 6 && fs > (isSentence ? 27 : 30);
        return rowTooWide || stageTooHigh || appTooHigh || (keepOneRow && bankWraps());
    }

    // Kaartjes in het keuzevak: elk kaartje wordt apart gecentreerd.
    // In het woord of de zin: alle letters staan op één basislijn, en het
    // geheel staat in het midden van de regel. Zo oogt "kat" niet scheef
    // als de t in een vakje staat.
    function centerTexts() {
        const weight = isSentence ? 400 : 700;
        tileNodes.forEach((tile) => {
            const offset = inkOffset(tile.textContent, weight);
            tile.firstChild.style.setProperty("--dy", `${(-offset).toFixed(3)}em`);
        });

        const rowOffset = inkOffset(fullText.replace(/\s+/g, " "), weight);
        exerciseNode.style.setProperty("--row-dy", `${(-rowOffset).toFixed(3)}em`);

        // Een kaartje in een vakje heeft een kleinere letter dan de rest
        // van het woord. Reken de verschuiving om zodat de basislijn toch
        // gelijk ligt met de gegeven letters.
        const sample = tileNodes[0];
        const bankSize = parseFloat(getComputedStyle(bankNode).fontSize) || 1;
        const tileSize = parseFloat(getComputedStyle(sample).fontSize) || bankSize;
        const ratio = tileSize / bankSize;
        const baselineFromMiddle = baselineOffset(weight);
        const inGap = (baselineFromMiddle * (1 - ratio) - rowOffset) / ratio;
        exerciseNode.style.setProperty("--gap-dy", `${inGap.toFixed(3)}em`);
    }

    // Afstand (in em) van de basislijn tot het midden van de regel.
    function baselineOffset(weight) {
        try {
            measureContext.font = `${weight} 100px Andika`;
            const m = measureContext.measureText("x");
            return (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 / 100 || 0;
        } catch (error) {
            return 0;
        }
    }

    function fit() {
        if (!exerciseNode) {
            return;
        }
        const width = app.clientWidth || window.innerWidth;
        const height = app.clientHeight || window.innerHeight;
        const longest = Math.max(...choices.map((c) => c.length), 1);

        // Startgrootte: groot voor letters, kleiner voor zinnen.
        let fs = isSentence
            ? Math.min(width * 0.08, height * 0.2, 46)
            : Math.min(width * 0.16, height * 0.24, 84);
        if (longest > 3 && !isSentence) {
            fs = Math.min(fs, (width * 0.5) / longest);
        }
        // Op een breed, laag scherm staat de afbeelding naast de oefening.
        const wide = Boolean(pictureNode) && width > height * 1.25;
        app.classList.toggle("wide", wide);
        let imgH = settings.compact ? 0 : wide ? 62 : 36;
        const minFs = 16;

        for (let step = 0; step < 40; step += 1) {
            app.style.setProperty("--fs", `${fs.toFixed(1)}px`);
            if (wide) {
                // Naast de oefening mag de afbeelding de volle hoogte nemen.
                app.style.setProperty("--img-h", "1px");
                const room = stageNode.clientHeight - 24;
                app.style.setProperty("--img-h", `${Math.max(60, room)}px`);
            } else {
                app.style.setProperty("--img-h", `${imgH.toFixed(1)}svh`);
            }
            sizeGaps();
            if (!overflowing(fs)) {
                break;
            }
            // Eerst de afbeelding wat kleiner, daarna de letters.
            if (pictureNode && !wide && imgH > 20) {
                imgH *= 0.9;
            } else if (fs > minFs) {
                fs = Math.max(minFs, fs * 0.93);
                if (pictureNode && !wide && imgH > 12) {
                    imgH *= 0.95;
                }
            } else {
                break;
            }
        }
        // Na een juist antwoord blijven de vakjes zo breed als het antwoord,
        // ook als het scherm draait.
        if (state.result === "good") {
            fitGapsToAnswers();
        }
    }

    // Alle vakjes en kaartjes krijgen dezelfde hoogte. De vakjes zijn zo
    // breed als het breedste kaartje, zodat elk kaartje erin past.
    function sizeGaps() {
        const height = "1.32em";
        app.style.setProperty("--gap-h", height);
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
            // De kaartjes die niet in het antwoord horen, verdwijnen.
            tileNodes.forEach((tile, index) => {
                if (!answers.includes(choices[index])) {
                    tile.classList.add("cleared");
                }
            });
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

    // In de verbetering wordt elk vakje zo breed als het juiste antwoord.
    // Tijdens de oefening zijn alle vakjes even breed, zodat de breedte
    // geen hint geeft over welk kaartje erin hoort.
    function tileWidthFor(text) {
        const tile = tileNodes.find((node) => node.textContent === text);
        return tile ? tile.offsetWidth : 0;
    }

    function fitGapsToAnswers() {
        gapNodes.forEach((gap, index) => {
            const width = tileWidthFor(answers[index]);
            if (width > 0) {
                gap.style.width = `${width}px`;
            }
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
        const source = tileNodes.find((node) => node.textContent === text);
        if (source) {
            ghost.firstChild.style.setProperty(
                "--dy",
                source.firstChild.style.getPropertyValue("--dy"),
            );
        }
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
    wireEvents();
    centerTexts();
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
                centerTexts();
                fit();
            });
    }

    // Voor de tests: de toestand van buitenaf kunnen bekijken.
    window.__sleep = { state, answers, choices };
})();
