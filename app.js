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