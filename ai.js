var BirthdayAI = (function () {
    'use strict';

    var ENDPOINT = 'https://text.pollination.ai/';
    var MODEL = 'openai';
    var TIMEOUT_MS = 15000;
    var MAX_OLD_FACTS = 8;

    function buildFactPrompt(oldFacts, monthName, day, turningAge) {
        var recent = oldFacts.slice(0, MAX_OLD_FACTS);
        var alreadySaid = recent.map(function (fact, index) {
            return index + 1 + '. ' + fact;
        }).join(' ');

        var when = turningAge ? 'born on ' + monthName + ' ' + day + ' and is turning ' + turningAge : 'born on ' + monthName + ' ' + day;

        var lines = [
            'Someone ' + when + '.', 'Write one interesting and short fact about that birthday.', 'One or two sentences and under 40 words and no emoji, no markdown, no greetings.'
        ];

        if (alreadySaid) {
            lines.push('Do not repeat these: ' + alreadySaid);
        }
        return lines.join(' ');
    }
    function cleanFact(text) {
        if (typeof text !== 'string') return '';

        var clean = text.trim();

        clean = clean.replace(/^["'\u201c\u201d]+/, "").replace(/["'\u201c\u201d]+$/, "");
        clean = clean.replace(/\*\*|__|`/g, "");
        clean = clean.trim();

        clean = clean.replace(/^(sure|certainly|okay|ok|of course|absolutely)[^.!?\n]{0,30}[.!:]\s+/i, "");
        clean = clean.replace(/^here(?:'s| is)[^.:\n]{0,40}:\s*/i, "");
        clean = clean.replace(/\s*(hope (?:that|this) helps|let me know[^.!?]*|feel free[^.!?]*|happy birthday[^.!?]*|enjoy)[.!?]?\s*$/i, "");
        clean = clean.trim();

        var sentences = clean.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length > 2) {
            clean = sentences.slice(0, 2).map(function (sentence) {
                return sentence.trim();
            }).join(' ');
        }
        if (clean.length > 280) {
            clean = clean.slice(0, 277).trim() + '...';
        }
        clean= clean.trim();

        if (clean.length < 15) return '';
        return clean;
    }

    function buildUrl(prompt) {
        var seed = Math.floor(Math.random() * 1000000);
        return ENDPOINT + encodeURIComponent(prompt) + '?model=' + MODEL + '&seed=' + seed;
    }

    async function askForFact(prompt) {
        var controller = new AbortController();
        var timer = setTimeout(function () {
            controller.abort();
        }, TIMEOUT_MS);

        try {
            var response = await fetch(buildUrl(prompt), { signal: controller.signal });
            var body = await response.text();

            if (/\bfree limit reached\b|\brate limit\b|turnstile token|payment required/i.test(body)) {
                throw new Error('it allows about only one reply per 30 seconds');
            }

            if (!response.ok) {
                throw new Error('HTTP error ' + response.status);
            }

            var fact = cleanFact(body);
            if (!fact) throw new Error('the reply came back early');
            return fact;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('it took too long to answer');
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }
    return {
        buildFactPrompt: buildFactPrompt,
        cleanFact: cleanFact,
        askForFact: askForFact
    };
})();