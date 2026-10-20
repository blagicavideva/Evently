/**
 * Prebere javno prikazane dogodke z evropskih spletnih strani Ticketmaster.
 * Ne uporablja API-ja. Zbere dogodke od dneva zagona do treh mesecev naprej.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('puppeteer');

const OUTPUT = path.resolve('data/dogodki_ticketmaster.json');
const MAX_PAGES_PER_CATEGORY = 100;
const MARKETS = [
  { code: 'at', name: 'Avstrija', host: 'www.ticketmaster.at', aliases: ['österreich', 'osterreich', 'austria', 'avstrija'] },
  { code: 'be', name: 'Belgija', host: 'www.ticketmaster.be', aliases: ['belgium', 'belgië', 'belgique', 'belgien', 'belgija'] },
  { code: 'cz', name: 'Češka', host: 'www.ticketmaster.cz', aliases: ['czech republic', 'czechia', 'česká republika', 'ceska republika', 'česko', 'cesko', 'czechy'] },
  { code: 'dk', name: 'Danska', host: 'www.ticketmaster.dk', aliases: ['denmark', 'danmark', 'dänemark', 'danska'] },
  { code: 'fi', name: 'Finska', host: 'www.ticketmaster.fi', aliases: ['finland', 'suomi', 'finska'] },
  { code: 'fr', name: 'Francija', host: 'www.ticketmaster.fr', aliases: ['france', 'frankreich', 'francija'] },
  { code: 'de', name: 'Nemčija', host: 'www.ticketmaster.de', aliases: ['germany', 'deutschland', 'nemčija', 'nemcija'] },
  { code: 'ie', name: 'Irska', host: 'www.ticketmaster.ie', aliases: ['ireland', 'éire', 'eire', 'irland', 'irska'] },
  { code: 'it', name: 'Italija', host: 'www.ticketmaster.it', aliases: ['italy', 'italia', 'italien', 'italija'] },
  { code: 'nl', name: 'Nizozemska', host: 'www.ticketmaster.nl', aliases: ['netherlands', 'nederland', 'holland', 'nizozemska'] },
  { code: 'no', name: 'Norveška', host: 'www.ticketmaster.no', aliases: ['norway', 'norge', 'norwegen', 'norsko', 'norveška', 'norveska'] },
  { code: 'pl', name: 'Poljska', host: 'www.ticketmaster.pl', aliases: ['poland', 'polska', 'polen', 'poljska'] },
  { code: 'es', name: 'Španija', host: 'www.ticketmaster.es', aliases: ['spain', 'españa', 'espana', 'spanien', 'španija', 'spanija'] },
  { code: 'se', name: 'Švedska', host: 'www.ticketmaster.se', aliases: ['sweden', 'sverige', 'schweden', 'švedska', 'svedska'] },
  { code: 'ch', name: 'Švica', host: 'www.ticketmaster.ch', aliases: ['switzerland', 'schweiz', 'suisse', 'svizzera', 'svizra', 'švica', 'svica'] },
  { code: 'uk', name: 'Združeno kraljestvo', host: 'www.ticketmaster.co.uk', aliases: ['united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland', 'uk', 'vereinigtes königreich'] },
];

function threeMonthsFrom(date) {
  const end = new Date(date);
  end.setMonth(end.getMonth() + 3);
  return end;
}

async function categoryUrls(page, market) {
  const home = `https://${market.host}/`;
  await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body', { timeout: 20000 });
  await page.waitForTimeout(1200);
  return page.evaluate(host => {
    const musicTerms = /music|musique|musik|muzyk|m[uú]sica|muziek|musikk|musiikk|concert|konzert|koncert|konser/i;
    const hostWithoutWww = host.replace(/^www\./i, '');
    const links = [...document.querySelectorAll('a[href]')]
      .map(a => ({ url: new URL(a.href, location.href), label: `${a.innerText || ''} ${a.getAttribute('aria-label') || ''}` }))
      .filter(({ url, label }) => url.hostname.replace(/^www\./i, '') === hostWithoutWww
        && /\/category\//i.test(url.pathname)
        && musicTerms.test(`${url.pathname} ${label}`))
      .map(({ url }) => `${url.origin}${url.pathname}`);
    return [...new Set(links)];
  }, market.host);
}

async function scrapeCategoryPage(page, url, market) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body', { timeout: 20000 });
  await page.waitForSelector('a[href*="/event/"]', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  return page.evaluate(({ allCountries, marketName }) => {
    const clean = value => (value || '').replace(/\s+/g, ' ').trim();
    const numericDatePattern = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/;
    const timePattern = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
    const monthNames = {
      januar: 1, january: 1, janvier: 1, gennaio: 1, enero: 1, januari: 1, stycznia: 1, ledna: 1, jan: 1, janv: 1,
      februar: 2, february: 2, février: 2, febbraio: 2, febrero: 2, februari: 2, lutego: 2, února: 2, unora: 2, feb: 2, févr: 2,
      märz: 3, marz: 3, march: 3, mars: 3, marzo: 3, maart: 3, marca: 3, března: 3, brezna: 3, mär: 3, mrz: 3, mar: 3,
      april: 4, avril: 4, aprile: 4, abril: 4, kwietnia: 4, dubna: 4, apr: 4, avr: 4,
      mai: 5, may: 5, maggio: 5, mayo: 5, mei: 5, maja: 5, května: 5, kvetna: 5,
      juni: 6, june: 6, juin: 6, giugno: 6, junio: 6, czerwiec: 6, června: 6, cervna: 6, jun: 6, jui: 6,
      juli: 7, july: 7, juillet: 7, luglio: 7, julio: 7, lipca: 7, července: 7, cervence: 7, jul: 7, juil: 7,
      august: 8, août: 8, agosto: 8, augustus: 8, sierpnia: 8, srpna: 8, aug: 8,
      september: 9, septembre: 9, settembre: 9, septiembre: 9, września: 9, wrzesnia: 9, září: 9, zari: 9, sep: 9, sept: 9,
      oktober: 10, october: 10, octobre: 10, ottobre: 10, octubre: 10, października: 10, pazdziernika: 10, října: 10, rijna: 10, okt: 10, oct: 10,
      november: 11, novembre: 11, noviembre: 11, listopada: 11, listopadu: 11, nov: 11,
      dezember: 12, december: 12, décembre: 12, dicembre: 12, diciembre: 12, grudnia: 12, prosince: 12, dez: 12, dec: 12,
    };
    const normalize = value => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\.$/, '');
    const cleanCity = value => {
      let result = clean(value).replace(/\s*(?:(?:at|um|alle|à|às|a las|uhr)\s*)?\d{1,2}:\d{2}\b.*$/i, '').trim();
      const weekday = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lunes|martes|miércoles|jueves|viernes|sábado|domingo|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|poniedziałek|wtorek|środa|czwartek|piątek|sobota|niedziela|pondělí|úterý|středa|čtvrtek|pátek|sobota|neděle)';
      if (new RegExp(`^${weekday}\\s+\\d{1,2}\\.?\\s+[\\p{L}.]+\\s+\\d{4}$`, 'iu').test(result)) return '';
      if (/^\d{1,2}\.?\s+[\p{L}.]+\s+\d{4}$/u.test(result)) return '';
      result = result
        .replace(/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/, '')
        .replace(/^\d{4}-\d{2}-\d{2}$/, '')
        .replace(/\s*\d{4}-\d{2}-\d{2}.*$/, '')
        .replace(/\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}.*$/, '')
        .replace(/\s+\d{1,2}\.?\s+[\p{L}.]+\s+\d{4}$/u, '')
        .replace(/[\s,–-]+$/, '')
        .trim();
      if (/^(?:\d{1,2}:\d{2})$/.test(result)) return '';
      return result;
    };
    const monthNumber = Object.fromEntries(Object.entries(monthNames).map(([name, number]) => [normalize(name), number]));
    const validIsoDate = (year, month, day) => {
      const value = new Date(year, month - 1, day);
      return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : null;
    };
    const findDate = text => {
      const numeric = text.match(numericDatePattern);
      if (numeric) {
        let first = Number(numeric[1]);
        let second = Number(numeric[2]);
        let year = Number(numeric[3]);
        if (year < 100) year += 2000;
        if (first <= 12 && second > 12) [first, second] = [second, first];
        return validIsoDate(year, second, first);
      }
      const longDate = text.match(/\b(\d{1,2})\.?\s+([\p{L}.]+)\s+(\d{4})\b/u)
        || text.match(/\b([\p{L}.]+)\s+(\d{1,2}),?\s+(\d{4})\b/u);
      if (!longDate) return null;
      const day = Number(longDate[1]?.match(/^\d/) ? longDate[1] : longDate[2]);
      const monthName = normalize(longDate[1]?.match(/^\d/) ? longDate[2] : longDate[1]);
      const year = Number(longDate[3]);
      return validIsoDate(year, monthNumber[monthName], day);
    };
    const eventAnchorMap = new Map();
    for (const anchor of document.querySelectorAll('a[href*="/event/"]')) {
      const key = new URL(anchor.href, location.href).pathname;
      const previous = eventAnchorMap.get(key);
      const text = clean(anchor.innerText);
      const score = text.length + (findDate(text) ? 1000 : 0) + (timePattern.test(text) ? 500 : 0);
      const previousText = clean(previous?.innerText);
      const previousScore = previousText.length + (findDate(previousText) ? 1000 : 0) + (timePattern.test(previousText) ? 500 : 0);
      if (!previous || score > previousScore) eventAnchorMap.set(key, anchor);
    }
    const eventAnchors = [...eventAnchorMap.values()];
    const records = [];
    let datesFound = 0;
    let timesFound = 0;
    let locationsFound = 0;

    for (const anchor of eventAnchors) {
      let card = anchor;
      for (let parent = anchor.parentElement, depth = 0; parent && depth < 16; parent = parent.parentElement, depth += 1) {
        const eventPaths = new Set([...parent.querySelectorAll('a[href*="/event/"]')]
          .map(link => new URL(link.href, location.href).pathname));
        const oneEvent = eventPaths.size === 1;
        const hasVenue = [...parent.querySelectorAll('a[href]')].some(link => /\/(venue|place)\//i.test(link.pathname) && clean(link.innerText));
        const hasArtist = [...parent.querySelectorAll('a[href]')].some(link => /\/(artist|performer)\//i.test(link.pathname) && clean(link.innerText));
        const text = clean(parent.innerText);
        if (oneEvent && text.length < 2200 && findDate(text) && timePattern.test(text)) {
          card = parent;
          if (hasVenue && hasArtist) break;
        }
      }

      const cardRawText = card.innerText || anchor.innerText;
      const cardText = clean(cardRawText);
      const timeElement = card.querySelector('time[datetime]');
      const dateTimeValue = timeElement?.getAttribute('datetime') || '';
      const date = findDate(cardText) || findDate(clean(anchor.innerText)) || dateTimeValue.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || null;
      const timeMatch = cardText.match(timePattern) || dateTimeValue.match(/T([01]?\d|2[0-3]):([0-5]\d)/);
      if (date) datesFound += 1;
      if (timeMatch) timesFound += 1;
      if (!date || !timeMatch) continue;
      const time = `${String(Number(timeMatch[1])).padStart(2, '0')}:${timeMatch[2]}`;
      const venueAnchor = [...card.querySelectorAll('a[href]')].find(link => /\/(venue|place)\//i.test(link.pathname) && clean(link.innerText));
      const venue = clean(venueAnchor?.innerText);
      const artistAnchor = [...card.querySelectorAll('a[href]')].find(link => /\/(artist|performer)\//i.test(link.pathname) && clean(link.innerText));

      let summary = clean(anchor.innerText)
        .replace(/^(kup bilety|kupite vstopnice|find tickets|find billetter|finn billetter|hitta biljetter|osta liput|koupit|koupit vstupenky|tickets kaufen|achetez vos billets|acquista biglietti|köp biljetter|kjøp billetter|tickets)\s*/i, '')
        .replace(/\d{1,2}[./]\d{1,2}[./]\d{2,4}\s*,?\s*\d{1,2}:\d{2}\s*$/, '').trim();
      if (venue && summary.toLocaleLowerCase().endsWith(venue.toLocaleLowerCase())) {
        summary = summary.slice(0, -venue.length).trim();
      }
      // Ticket buttons frequently concatenate the event title and location.
      // Remove any venue suffix from the card's accessible summary as well.
      const summaryLine = cardRawText.split(/\n/).map(clean).find(line => findDate(line) && timePattern.test(line)) || '';
      const accessible = summaryLine
        .replace(/^.*?(open additional information for|otwórz więcej informacji dla|otwórz dodatkowe informacje dotyczące|otevřít více informací pro|öffne zusätzliche informationen für|ouvrir les informations supplémentaires pour)\s*/i, '')
        .replace(/(?:\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}\.?\s+[\p{L}.]+\s+\d{4})\s*,?\s*\d{1,2}:\d{2}.*$/u, '').trim();
      if (!summary || summary === clean(anchor.innerText)
        || (summary.split(',').length < 2 && accessible.split(',').length > 1)) summary = accessible;
      if (venue && summary.toLocaleLowerCase().endsWith(venue.toLocaleLowerCase())) {
        summary = summary.slice(0, -venue.length).trim();
      }

      const pieces = summary.split(',').map(part => part.trim()).filter(Boolean);
      let city = null;
      if (pieces.length > 1) {
        const normalized = pieces.at(-1).toLocaleLowerCase();
        const locationCountry = allCountries.find(country => country.aliases.some(alias =>
          normalized === alias || normalized.endsWith(` ${alias}`) || normalized.endsWith(`, ${alias}`)));
        if (locationCountry) {
          if (locationCountry.name !== marketName) continue;
          city = pieces.at(-2);
        } else {
          city = pieces.at(-1);
        }
      }
      city = cleanCity(city || '');

      const performer = clean(artistAnchor?.innerText) || (pieces.length > 1 ? pieces.slice(0, -1).join(', ') : summary);
      if (performer && city) {
        locationsFound += 1;
        records.push({
          izvajalec: performer,
          mesto: city,
          prizorisce: venue || null,
          drzava: marketName,
          datum: date,
          zacetek: time,
        });
      }
    }

    const currentPage = Number(new URL(location.href).searchParams.get('page') || 1);
    const pageRange = document.body.innerText.match(/page\s+\d+\s+of\s+(\d+)/i);
    const maxPage = pageRange ? Number(pageRange[1]) : currentPage;
    const pageLinks = [...document.querySelectorAll('a[href*="page="]')].map(a => new URL(a.href, location.href))
      .filter(next => next.pathname === location.pathname && Number(next.searchParams.get('page')) > currentPage);
    const lastPage = Math.max(currentPage, ...pageLinks.map(next => Number(next.searchParams.get('page'))));
    const nextPageNumber = pageLinks.length
      ? Math.min(...pageLinks.map(next => Number(next.searchParams.get('page'))))
      : currentPage + 1;
    return {
      records,
      linksFound: eventAnchors.length,
      datesFound,
      timesFound,
      locationsFound,
      sample: records.length === 0 ? clean(eventAnchors[0]?.parentElement?.innerText || eventAnchors[0]?.innerText).slice(0, 350) : '',
      pageSignature: [...new Set(eventAnchors.map(a => new URL(a.href, location.href).pathname))].join('|'),
      nextPage: Math.max(lastPage, maxPage) > currentPage ? (() => {
          const next = new URL(location.href);
          next.searchParams.set('page', String(nextPageNumber));
          return next.href;
        })() : null,
    };
  }, { allCountries: MARKETS.map(({ name, aliases }) => ({ name, aliases })), marketName: market.name });
}

async function main() {
  const start = new Date();
  const end = threeMonthsFrom(start);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const browser = await puppeteer.launch({ headless: true });
  const collected = new Map();
  let scannedMarkets = 0;
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    for (const market of MARKETS) {
      let categories;
      try {
        categories = await categoryUrls(page, market);
      } catch (error) {
        console.log(`${market.name}: strani ni bilo mogoče odpreti (${error.message}).`);
        continue;
      }
      console.log(`\n=== ${market.name} (${market.host}) — ${categories.length} kategorij ===`);
      if (!categories.length) {
        console.log('  Kategorij ni bilo mogoče najti; trg preskočim.');
        continue;
      }
      scannedMarkets += 1;

      const marketSeen = new Set();
      for (const category of categories) {
        const firstPage = new URL(category);
        firstPage.searchParams.set('datestart', start.toISOString().slice(0, 10));
        firstPage.searchParams.set('page', '1');
        let nextUrl = firstPage.href;
        let pageNumber = 0;
        let pagesPastEnd = 0;
        let previousPageSignature = null;
        while (nextUrl && pageNumber < MAX_PAGES_PER_CATEGORY) {
          pageNumber += 1;
          let result;
          try {
            result = await scrapeCategoryPage(page, nextUrl, market);
          } catch (error) {
            console.log(`  Napaka na ${nextUrl}: ${error.message}`);
            break;
          }
          const validDates = result.records.map(record => new Date(`${record.datum}T00:00:00`)).filter(date => !Number.isNaN(date.valueOf()));
          let count = 0;
          for (const record of result.records) {
            const date = new Date(`${record.datum}T00:00:00`);
            if (Number.isNaN(date.valueOf())) continue;
            if (date < startDay || date > end) continue;
            const key = [record.izvajalec, record.mesto, record.datum, record.zacetek].join('|').toLocaleLowerCase();
            if (marketSeen.has(key)) continue;
            marketSeen.add(key);
            collected.set(`${market.code}|${key}`, record);
            count += 1;
          }
          const allAfterEnd = validDates.length > 0 && validDates.every(date => date > end);
          pagesPastEnd = allAfterEnd ? pagesPastEnd + 1 : 0;
          console.log(`  ${category} — stran ${pageNumber}: ${result.linksFound} povezav; datum ${result.datesFound}, ura ${result.timesFound}, lokacija ${result.locationsFound}; ${count} v obdobju; trg skupaj ${marketSeen.size}.`);
          if (result.linksFound > 0 && result.records.length === 0 && result.sample) {
            console.log(`  Primer vsebine kartice: ${result.sample}`);
          }
          if (result.pageSignature && result.pageSignature === previousPageSignature) break;
          previousPageSignature = result.pageSignature;
          if (pagesPastEnd >= 2 || !result.nextPage) break;
          nextUrl = result.nextPage;
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (!scannedMarkets) {
    throw new Error('Na nobenem Ticketmasterjevem trgu nisem našel kategorij; izhodne datoteke nisem posodobil.');
  }

  const events = [...collected.values()].sort((a, b) => `${a.datum} ${a.zacetek}`.localeCompare(`${b.datum} ${b.zacetek}`));
  const output = {
    vir: 'Ticketmaster (javno prikazane strani evropskih trgov)',
    obdobje: { od: start.toISOString().slice(0, 10), do: end.toISOString().slice(0, 10) },
    stevilo: events.length,
    dogodki: events,
  };
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`\nKončano: ${events.length} dogodkov od ${output.obdobje.od} do ${output.obdobje.do}.`);
  console.log(`JSON shranjen v: ${OUTPUT}`);
}

main().catch(error => {
  console.error(`Napaka scraperja: ${error.message}`);
  process.exitCode = 1;
});
