var BirthdayDates = (function () {
    'use strict';

    var WEEKS_PER_YEAR = 52;
    var GRID_YEARS = 90;

    function daysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function parseISODate(text) {
        if (typeof text !== 'string') return null;

        var parts = text.split('-');
        if (parts.length !== 3) return null;

        var year = Number(parts[0]);
        var month = Number(parts[1]);
        var day = Number(parts[2]);

        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
        if (year < 1900 || year > 2200) return null;
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > daysInMonth(year, month)) return null;

        return { year: year, month: month, day: day};
    }

    function atNoon(year, month, day) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    function todayAtNoon(now) {
        var d = now || new Date();
        return atNoon(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }

    function daysBetween(from, to) {
        var oneDay = 1000 * 60 * 60 * 24;
        return Math.round((to.getTime() - from.getTime()) / oneDay);
    }

    function birthdayInYear(month, day, year){
        if (month === 2 && day === 29 && !isLeapYear(year)) {
            return atNoon(year, 2, 28);
        }
        return atNoon(year, month, day);
    }

    function nextBirthday(month, day, from) {
        var today = from || todayAtNoon();
        var year = today.getFullYear();
        var when = birthdayInYear(month, day, year);
        if (when.getTime() < today.getTime()) {
            when = birthdayInYear(month, day, year + 1);
        }
        return when;
    }

    function nextBirthdayInfo(birthday, from) {
        var parsed = parseISODate(birthday);
        if (parsed === null) return null;

        var today = from || todayAtNoon();
        var date = nextBirthday(parsed.month, parsed.day, today);
        var daysUntil = daysBetween(today, date);
        
        return {
            date: date,
            daysUntil: daysUntil,
            isToday: daysUntil === 0,
            turningAge: date.getFullYear() - parsed.year,
            bornOn: parsed
        };
    }

    function weeksLived(birthday, from) {
        var parsed = parseISODate(birthday);
        if (parsed === null) return 0;
        var born = atNoon(parsed.year, parsed.month, parsed.day);
        var today = from || todayAtNoon();
        var weeks = Math.floor(daysBetween(born, today) / 7);
        return weeks < 0 ? 0 : weeks;
    }

    function formatDate(date) {
        return date.toLocaleDateString(undefined, {
            weeday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function formatShortDate(date) {
        return date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short'
        });
    }

    function humanDays(daysUntil) {
        if (daysUntil === 0) return 'today!';
        if (daysUntil === 1) return 'tomorrow';
        return 'in ' + daysUntil + ' days';
    }

    function countdownParts(info, now) {
        if (info === null || info.isToday) return null;
        
        var today = now || new Date();
        var start = new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate(), 0, 0, 0, 0);
        var left = start.getTime() - today.getTime();
        if (left < 0) left = 0;

        return {
            days: Math.floor(left / (1000 * 60 * 60 * 24)),
            hours: Math.floor((left % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((left % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((left % (1000 * 60)) / 1000)
        };
    }

    return {
        WEEKS_PER_YEAR: WEEKS_PER_YEAR,
        GRID_YEARS: GRID_YEARS,
        daysInMonth: daysInMonth,
        isLeapYear: isLeapYear,
        parseISODate: parseISODate,
        atNoon: atNoon,
        daysBetween: daysBetween,
        nextBirthday: nextBirthday,
        nextBirthdayInfo: nextBirthdayInfo,
        weeksLived: weeksLived,
        formatDate: formatDate,
        formatShortDate: formatShortDate,
        humanDays: humanDays,
        countdownParts: countdownParts
    };
})();