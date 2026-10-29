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
    return "p" + Date.now().toString(36) + Maths.random().toString(36).slice(2, 6);
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
    return "turns" + info.turningAge;
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

    hint.textContent = 'Showing' + visible.length + ' of ' + state.people.length + (state.people.length === 1 ? 'person.' : 'people.');
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
        nameLine.appendChild(el('span', 'tag tag-todya', 'today'));
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