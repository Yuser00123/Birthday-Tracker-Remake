const {
    parseISODate,
    nextBirthdayInfo,
    weeksLived,
    countdownParts,
    formatDate,
    formatShortDate,
    humanDays,
    GRID_YEARS,
    WEEKS_PER_YEAR
} = BirthdayDates;

const { buildFactPrompt, askForFact } = BirthdayAI;

const STORAGE_KEY = 'birthday-os.people.v1';

function loadPeople() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter(function (person) {
            return person && typeof person.id === 'string' && typeof person.name === 'string';
        });
    } catch (error) {
        console.warn("Could not read saved birthdays:", error);
        return [];
    }
}

function savePeople(people) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
    } catch (error) {
        console.warn("Could not save birthdays:", error);
    }
}

function makeId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const state = {
    people: loadPeople(),
    editingId: null,
    nextUpId: null,
    selectedId: null,
    aiFactsUsed: [],
    factCache: {},
    countdownTimer: null
};

const AVATAR_COLORS = ["#7c5cff", "#2f9e8f", "#e0653f", "#c2557f", "#3f7fe0", "#a8762a", "#5d8a3a"];

const BUILT_IN_FACTS = [
    "September is the most common birth month in the world.",
    "About 1 in 365 people share your birthday.",
    "A 29 February birthday only comes around in leap years.",
    "The word birthday has been used in English since the 1300s.",
    "More babies are born on Tuesdays than on any other day of the week.",
    "The Happy Birthday song started out as a classroom song called Good Morning to All.",
    "In many countries people eat long noodles on their birthday for a long life.",
    "Twins can be born on different days, and occasionally in different years.",
    "Birthday cakes go back to ancient Greece, where round cakes were offered to the moon.",
    "Someone born on 29 February has about 18 real birthdays by their 72nd year.",
    "The oldest person ever recorded lived to 122, which is 122 birthdays.",
    "Your birthday puts you in one of about 19 million people born that same day.",
    "Denmark raises a flag outside the house to mark a birthday.",
    "The average person has around 80 birthdays in a lifetime.",
    "The idea of a birthday party only became common in the 1800s.",
    "Birthday candles were probably first used in Germany in the 1700s.",
    "In Vietnam many people celebrate their birthday on New Year's Day instead.",
    "Pisces and Aries swap over around 20 March every year.",
    "A golden birthday is when your age matches the day of the month you were born.",
    "You have been alive for more than a billion seconds by the time you turn 32."
];

function $(id) {
    return document.getElementById(id);
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function monthName(date) {
    return date.toLocaleDateString(undefined, { month: 'long'});
}

function avatarColor(name) {
    let total = 0;
    for (let i = 0; i < name.length; i++) {
        total += name.charCodeAt(i);
    }
    return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function pad2(number) {
    return number < 10 ? "0" + number : String(number);
}

function ageLabel(info) {
    if (!info) return "";
    if (info.turningAge <= 0) return "";
    return "turns " + info.turningAge;
}

function sortedPeople() {
    const withInfo = [];

    state.people.forEach(function (person) {
        const info = nextBirthdayInfo(person.birthday);
        if (info) {
            withInfo.push({ person: person, info: info });
        }
    });

    withInfo.sort(function (a, b) {
        if (a.info.daysUntil !== b.info.daysUntil) {
            return a.info.daysUntil - b.info.daysUntil;
        }
        return a.person.name.localeCompare(b.person.name);
    });
    return withInfo;
}

function findPerson(id) {
    return state.people.find(function (person) {
        return person.id === id;
    });
}

function renderHero() {
    const hero = $("hero");
    const emptyState = $("empty-state");
    const sorted = sortedPeople();

    if (sorted.length === 0) {
        hero.hidden = true;
        emptyState.hidden = false;
        state.nextUpId = null;
        return;
    }

    const entry = sorted[0];
    state.nextUpId = entry.person.id;
    hero.hidden = false;
    emptyState.hidden = true;

    $("hero-name").textContent = entry.person.name;
    let dateLine = formatDate(entry.info.date);
    if (ageLabel(entry.info)) dateLine += " \u00b7 " + ageLabel(entry.info);
    if (entry.person.note) dateLine += " \u00b7 " + entry.person.note;
    $("hero-date").textContent = dateLine;

    updateCountdown();
}

function updateCountdown() {
    const person = findPerson(state.nextUpId);
    if (!person) return;

    const info = nextBirthdayInfo(person.birthday);
    if (!info) return;

    const note = $('hero-note');
    const countdown = $('countdown');

    if (info.isToday) {
        countdown.hidden = true;
        note.textContent = 'Today is the day. Happy Birthday, ' + person.name + '!';
        document.title = 'Happy birthday, ' + person.name + '!';
        return;
    }

    countdown.hidden = false;
    note.textContent = 'Their birthday is on ' + formatDate(info.date) + '.';

    const parts = countdownParts(info);
    if (!parts) return;

    $('cd-days').textContent = String(parts.days);
    $("cd-hours").textContent = pad2(parts.hours);
    $("cd-minutes").textContent = pad2(parts.minutes);
    $("cd-seconds").textContent = pad2(parts.seconds);

}

function startCountdownTimer() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(updateCountdown, 1000);
}

function renderList() {
    const list = $('people-list');
    const hint = $('list-hint');
    const searchText = $('search').value.trim().toLowerCase();
    const filter = $('filter').value;

    list.innerHTML = '';

    const sorted = sortedPeople();

    const visible= sorted.filter(function (entry) {
        const person = entry.person;
        if (searchText && person.name.toLowerCase().indexOf(searchText) === -1) {
            return false;
        }
        if (filter === 'week' && entry.info.daysUntil > 7) return false;
        if (filter === 'month') {
            const thisMonth = new Date().getMonth();
            if (entry.info.date.getMonth() !== thisMonth) return false;
        }
        return true;
    });

    if (state.people.length === 0) {
        hint.textContent = '';
        return;
    }

    if (visible.length === 0) {
        const row = el('li', 'list-empty', 'Nobody matches that search or filter.');
        list.appendChild(row);
        hint.textContent = '';
    }

    visible.forEach(function (entry) {
        list.appendChild(buildPersonRow(entry));
    });

    hint.textContent = 'Showing ' + visible.length + ' of ' + state.people.length + (state.people.length === 1 ? ' person.' : ' people.');
}

function buildPersonRow(entry) {
    const person = entry.person;
    const info = entry.info;

    const row = el('li', 'person');
    if (info.isToday) row.classList.add('is-today');

    const main = el('div', 'person-name');
    const avatar = el('span', 'avatar', person.name.trim().charAt(0).toUpperCase() || '?');
    avatar.style.backgroundColor = avatarColor(person.name);
    main.appendChild(avatar);

    const text = el('div', 'person-text');
    const nameLine = el('p', 'person-name', person.name);

    if (ageLabel(info)) {
        nameLine.appendChild(el('span', 'tag', ageLabel(info)));
    }
    if (info.isToday) {
        nameLine.appendChild(el('span', 'tag tag-today', 'today'));
    }
    text.appendChild(nameLine);

    const dateLine = el('p', 'person-date', formatShortDate(info.date) + ' \u00b7 ' + humanDays(info.daysUntil));

    if (person.note) {
        dateLine.textContent += " \u00b7 " + person.note;
    }
    text.appendChild(dateLine);
    main.appendChild(text);
    row.appendChild(main);

    const actions = el('div', 'person-actions');
    const showBtn = el('button', 'link-button', 'Show');
    showBtn.type = 'button';
    showBtn.dataset.action = 'show';
    showBtn.dataset.id = person.id;
    actions.appendChild(showBtn);

    const editBtn = el('button', 'link-button', 'Edit');
    editBtn.type = 'button';
    editBtn.dataset.action = 'edit';
    editBtn.dataset.id = person.id;
    actions.appendChild(editBtn);

    const deleteBtn = el('button', 'link-button danger', 'Delete');
    deleteBtn.type = 'button';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.id = person.id;
    actions.appendChild(deleteBtn);

    row.appendChild(actions);
    return row;
}

function renderLifeSelect() {
    const select = $('life-person');
    const sorted = sortedPeople();

    select.innerHTML = '';

    if (sorted.length === 0) {
        select.disabled = true;
        select.appendChild(el('option', '', 'Nobody added yet'));
        state.selectedId = null;
        return;
    }

    select.disabled = false;

    sorted.forEach(function (entry) {
        const option = el('option', '', entry.person.name);
        option.value = entry.person.id;
        select.appendChild(option);
    });

    const stillThere = sorted.some(function (entry) {
        return entry.person.id === state.selectedId;
    });
    if (!stillThere) state.selectedId = sorted[0].person.id;
    select.value = state.selectedId;
}

function renderLifeGrid() {
    const grid = $('life-grid');
    const summary = $('life-summary');

    grid.innerHTML = '';

    const person = findPerson($('life-person').value);
    if (!person) {
        summary.textContent = 'Add someone to see their grid.';
        return;
    }
    
    const born = parseISODate(person.birthday);
    if (!born) {
        summary.textContent = 'That birthday could not be read.';
        return;
    }

    const weeks = weeksLived(person.birthday);
    const totalWeeks = GRID_YEARS * WEEKS_PER_YEAR;
    const dayOfWeek = new Date(born.year, born.month - 1, born.day).toLocaleDateString(undefined, { weekday: 'long'});

    summary.textContent = person.name + ' has been alive for ' + weeks + ' weeks (' + (weeks * 7).toLocaleString() + ' days). Born on a ' + dayOfWeek + '.';

    const fragment = document.createDocumentFragment();

    for (let week = 0; week < totalWeeks; week++) {
        const square = document.createElement("span");
        square.className = week < weeks ? "week lived" : "week";

        if (week % WEEKS_PER_YEAR === 0) {
            square.classList.add("year-start");
            square.title = 'Age ' + (week / WEEKS_PER_YEAR);
        } else {
            square.title = 'Week ' + (week + 1);
        }

        fragment.appendChild(square);
    }
    grid.appendChild(fragment);
}

function renderAll() {
    renderHero();
    renderList();
    renderLifeSelect();
    renderLifeGrid();
    renderFactAbout();
    renderStorageHint();
}

function renderFactAbout() {
    const person = findPerson(state.selectedId);
    const about = $('fact-about');

    if (!person) {
        about.textContent = 'Add a birthday and this will tell you something about it.';
        return;
    }
    about.textContent = 'About ' + person.name + "'s birthday.";
}

function renderStorageHint() {
    const hint = $('storage-hint');
    const count = state.people.length;

    if (count === 0) {
        hint.textContent = 'Nothing saved yet. Everything you add stays in this browser only.';
        return;
    }
    hint.textContent = count + (count === 1 ? ' person is ' : ' people are') + " saved in this browser's localStorage. Clearing site data will delete them, so take a backup now and then.";

}

function commit() {
    savePeople(state.people);
    renderAll();
}

function showFormError(message) {
    $('form-error').textContent = message;
}

function clearForm() {
    $('name').value = '';
    $('birthday').value = '';
    $('note').value = '';
    showFormError('');
    state.editingId = null;
    $('form-title').textContent = 'Add someone';
    $('submit-btn').textContent = 'Add birthday';
    $('cancel-edit').hidden = true;
}

function handleSubmit(event) {
    event.preventDefault();
    showFormError('');

    const name = $('name').value.trim();
    const birthday = $('birthday').value;
    const note = $('note').value.trim();

    if (!name) {
        showFormError('Please write a name.');
        $('name').focus();
        return;
    }

    if (!birthday) {
        showFormError('Please pick your birthday.');
        $('birthday').focus();
        return;
    }

    if (!parseISODate(birthday)) {
        showFormError('That date does not look right. Try a year between 1900 and 2200.');
        return;
    }

    const alreadyThere = state.people.some(function (person) {
        return person.name.toLowerCase() === name.toLowerCase()  && person.birthday === birthday && person.id !== state.editingId;
    });

    if (alreadyThere) {
        showFormError('That birthday is already saved for ' + name + '.');
        return;
    }

    if (state.editingId) {
        const person = findPerson(state.editingId);
        if (person) {
            person.name = name;
            person.birthday = birthday;
            person.note = note;
        }
        state.selectedId = state.editingId;
    } else {
        const person = {
            id: makeId(),
            name: name,
            birthday: birthday,
            note: note,
            addedOn: new Date().toISOString()
        };
        state.people.push(person);
        state.selectedId = person.id;
    }

    const wasEditing = state.editingId !== null;
    const info = nextBirthdayInfo(birthday);

    clearForm();
    commit();

    if (info && info.isToday && !wasEditing) {
        launchConfetti();
    }
}

function startEditing(id) {
    const person = findPerson(id);
    if (!person) return;

    state.editingId = person.id;

    $('name').value = person.name;
    $('birthday').value = person.birthday;
    $('note').value = person.note || '';
    $('form-title').textContent = 'Editing ' + person.name;
    $('submit-btn').textContent = 'Save changes';
    $('cancel-edit').hidden = false;
    showFormError('');
    $('form-title').scrollIntoView( { behavior: 'smooth', block: 'center'});
    $('name').focus();
}

function deletePerson(id) {
    const person = findPerson(id);
    if (!person) return;

    const sure = confirm('Delete ' + person.name + "'s birthday? This cannot be undone.");
    if (!sure) return;

    state.people = state.people.filter(function (other) {
        return other.id !== id;
    });
    if (state.editingId === id) clearForm();
    if (state.selectedId === id) state.selectedId = null;

    commit();
}

function handleListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = button.dataset.id;

    if (button.dataset.action === 'delete') deletePerson(id);
    if (button.dataset.action === 'edit') startEditing(id);

    if (button.dataset.action === 'show') {
        state.selectedId = id;
        renderAll();
        $('life-person').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function showFactText(text, sourceLabel, note) {
    $('fact').textContent = text;

    const badge = $('fact-source');
    if (sourceLabel) {
        badge.textContent = sourceLabel;
        badge.hidden = false;
    } else {
        badge.hidden = true;
    }

    $('fact-note').textContent = note || '';

}

function pickBuiltInFact(avoid) {
    let fact = BUILT_IN_FACTS[Math.floor(Math.random() * BUILT_IN_FACTS.length)];
    let tries = 0;

    while (fact === avoid && tries < 10) {
        fact = BUILT_IN_FACTS[Math.floor(Math.random() * BUILT_IN_FACTS.length)];
        tries++;
    }
    return fact;
}

async function handleFactClick() {
    const person = findPerson(state.selectedId);
    const button = $('fact-btn');

    if (!person) {
        showFactText('Add a birthday first, then I can tell you something about it.', null, '');
        return;
    }

    const info = nextBirthdayInfo(person.birthday);
    if (!info) return;

    const cacheKey = person.id + '|' + info.date.toDateString();
    button.disabled = true;
    button.textContent = 'Thinking...';
    showFactText('Asking the AI for something about this date...', 'working', '');

    const prompt = buildFactPrompt(
        state.aiFactsUsed,
        monthName(info.date),
        info.bornOn.day,
        info.turningAge > 0 ? info.turningAge : 0
    );

    try {
        const fact = await askForFact(prompt);
        state.aiFactsUsed.unshift(fact);
        state.factCache[cacheKey] = fact;
        showFactText(fact, 'from the AI', '');
    } catch (error) {
        const cached = state.factCache[cacheKey];

        if (cached) {
            showFactText(cached, 'from the AI, earlier', 'The AI is busy right now (' + error.message + '), so here is the one it gave earlier.');
        } else {
            showFactText(pickBuiltInFact($('fact').textContent), 'built-in fact', 'The AI did not answer (' + error.message + '), so here is one from my own list.');
        }

        console.warn('AI fact failed:', error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Get another fact';
    }
}

function downloadFile(filename, text, type) {
    const blob = new Blob([text], { type: type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

function exportJson() {
    const data = {
        app: 'Birthday OS',
        version: 1,
        exportedOn: new Date().toISOString(),
        people: state.people
    };

    downloadFile('birthdays-backup.json', JSON.stringify(data, null, 2), 'application/json');
}

function importJson(file) {
    const reader = new FileReader();
    reader.onload = function () {
        try {
            const data = JSON.parse(String(reader.result));
            const incoming = Array.isArray(data) ? data : data.people;

            if (!Array.isArray(incoming)) {
                alert('That file does not look like a Birthday OS backup.');
                return;
            }
            let added = 0;
            incoming.forEach(function (raw) {
                if (!raw || typeof raw.name !== 'string' || !parseISODate(raw.birthday)) return;

                const duplicate = state.people.some(function (person) {
                    return person.name.toLowerCase() === raw.name.toLowerCase() && person.birthday === raw.birthday;
                });
                if (duplicate) return;

                state.people.push({
                    id: makeId(),
                    name: raw.name.slice(0, 40),
                    birthday: raw.birthday,
                    note: typeof raw.note === 'string' ? raw.note.slice(0, 60) : "",
                    addedOn: new Date().toISOString()
                });
                added++;
            });
            commit();
            alert(added === 0 ? 'Nothing new in that file.' : 'Added ' + added + (added === 1 ? ' birthday.' : ' birthdays.'));
        } catch (error) {
            alert('I could not read that file. ' + error.message);
        }
    };
    reader.readAsText(file);
}

function exportIcs() {
    if (state.people.length === 0) {
        alert('There is nothing to export yet.');
        return;
    }

    const now = new Date();
    const stamp = now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) + "T" + pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + 'Z';
    const lines = [
        'BEGIN:VCALANDAR',
        'VERSION:2.0',
        'PRODID:-//Birthday OS//EN',
        'CALSCALE:GREGORIAN'
    ];

    state.people.forEach(function (person) {
        const born = parseISODate(person.birthday);
        if (!born) return;

        lines.push('BEGIN:VEVENT');
        lines.push('UID:' + person.id + '@birthday-os');
        lines.push('DTSTAMP:' + stamp);
        lines.push('DTSTART;VALUE=DATE:' + born.year + pad2(born.month) + pad2(born.day));
        lines.push('RRULE:FREQ=YEARLY');
        lines.push('SUMMARY:' + person.name + "'s birthday");
        if (person.note) lines.push('DESCRIPTION:' + person.note);
        lines.push('END:VEVENT');
    });
    lines.push('END:VCALANDAR');
    downloadFile('birthdays.ics', lines.join('\r\n'), 'text/calendar');
}

const confettiCanvas = $('confetti');
const confettiCtx = confettiCanvas.getContext('2d');

const CONFETTI_COLORS = ['#e0653f', '#f0b429', '#2f9e8f', '#3f7fe0', '#c2557f'];
let confettiRunning = false;

function resizeConfettiCanvas() {
    const ratio = window.devicePixelRatio || 1;
    confettiCanvas.width = Math.floor(window.innerWidth * ratio);
    confettiCanvas.height = Math.floor(window.innerHeight * ratio);
    confettiCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function launchConfetti() {
    if (confettiRunning) return;

    confettiRunning = true;
    confettiCanvas.hidden = false;
    resizeConfettiCanvas();

    const pieces = [];
    const width = window.innerWidth;
    for (let i = 0; i < 120; i++) {
        pieces.push({
            x: Math.random() * width,
            y: -Math.random() * window.innerHeight,
            size: 4 + Math.random() * 6,
            speedY: 2 + Math.random() * 3,
            speedX: Math.random() * 1.6 - 0.8,
            rotation: Math.random() * 360,
            spin: Math.random() * 8 - 4,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
        });
    }

    const startedAt = Date.now();

    function frame() {
        confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        pieces.forEach(function (piece) {
            piece.y += piece.speedY;
            piece.x += piece.speedX;
            piece.rotation += piece.spin;

            if (piece.y > window.innerHeight + 20) {
                piece.y = -20;
                piece.x = Math.random() * window.innerWidth;
            }

            confettiCtx.save();
            confettiCtx.translate(piece.x, piece.y);
            confettiCtx.rotate((piece.rotation * Math.PI) / 180);
            confettiCtx.fillStyle = piece.color;
            confettiCtx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
            confettiCtx.restore();
        });

        if (Date.now() - startedAt > 4500) {
            confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            confettiCanvas.hidden = true;
            confettiRunning = false;
            return;
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function wireUpEvents() {
    $('person-form').addEventListener('submit', handleSubmit);
    $('cancel-edit').addEventListener('click', function () {
        clearForm();
    });

    $('people-list').addEventListener('click', handleListClick);
    $('search').addEventListener('input', renderList);
    $('filter').addEventListener('change', renderList);
    $('life-person').addEventListener('change', function () {
        state.selectedId = $('life-person').value;
        renderLifeGrid();
        renderFactAbout();
    });
    
    $('fact-btn').addEventListener('click', handleFactClick);

    $('export-json').addEventListener('click', exportJson);
    $('export-ics').addEventListener('click', exportIcs);

    $('import-btn').addEventListener('click', function () {
        $('import-file').click();
    });

    $('import-file').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) importJson(file);
        event.target.value = '';
    });

    $('hero-life-btn').addEventListener('click', function () {
        const person = findPerson(state.nextUpId);
        if (!person) return;
        state.selectedId = person.id;
        renderAll();
        $('life-person').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    window.addEventListener('resize', function () {
        if (!confettiCanvas.hidden) resizeConfettiCanvas();
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) updateCountdown();
    });
}

function start() {
    wireUpEvents();
    renderAll();
    startCountdownTimer();

    const anyoneToday = sortedPeople().some(function (entry) {
        return entry.info.isToday;
    });
    if (anyoneToday) launchConfetti();

    if (state.people.length === 0) {
        console.log('Birthday OS: no people saved yet. After you add one, look at', JSON.stringify(loadPeople(), null, 2));
    }
}

start();

