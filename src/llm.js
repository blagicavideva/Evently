const https = require('node:https');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const ALLOWED_TYPES = new Set(['Glasba', 'Festival', 'Gledališče', 'Šport', 'Drugo']);

const suggestionSchema = {
  type: 'object',
  properties: {
    lokacija: { type: 'string' },
    datum: { type: 'string' },
    vrstaDogodka: { type: 'string' },
    predlogi: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          naslov: { type: 'string' },
          opis: { type: 'string' },
          trajanje_min: { type: 'integer' },
          okolje: { type: 'string', enum: ['v zaprtih prostorih', 'na prostem', 'oboje'] },
        },
        required: ['naslov', 'opis', 'trajanje_min', 'okolje'],
        additionalProperties: false,
      },
    },
    opomba: { type: 'string' },
  },
  required: ['lokacija', 'datum', 'vrstaDogodka', 'predlogi', 'opomba'],
  additionalProperties: false,
};

class PredlogAktivnosti {
  constructor({ naslov, opis, trajanje_min, okolje }) {
    this.naslov = naslov;
    this.opis = opis;
    this.trajanje_min = trajanje_min;
    this.okolje = okolje;
  }

  static fromJSON(value) {
    if (!value || typeof value.naslov !== 'string' || typeof value.opis !== 'string'
      || !Number.isInteger(value.trajanje_min) || typeof value.okolje !== 'string') {
      throw new Error('LLM je vrnil predlog v nepričakovani obliki.');
    }
    return new PredlogAktivnosti(value);
  }
}

class OdgovorLLM {
  constructor({ lokacija, datum, vrstaDogodka, steviloPredlogov, predlogi, opomba }) {
    this.lokacija = lokacija;
    this.datum = datum;
    this.vrstaDogodka = vrstaDogodka;
    this.steviloPredlogov = steviloPredlogov;
    this.predlogi = predlogi;
    this.opomba = opomba;
  }

  static fromJSON(value, input) {
    if (!value || !Array.isArray(value.predlogi) || value.predlogi.length < input.steviloPredlogov) {
      throw new Error(`LLM ni vrnil vseh ${input.steviloPredlogov} zahtevanih predlogov v JSON obliki.`);
    }
    return new OdgovorLLM({
      lokacija: input.lokacija,
      datum: input.datum,
      vrstaDogodka: input.vrstaDogodka,
      steviloPredlogov: input.steviloPredlogov,
      predlogi: value.predlogi.slice(0, input.steviloPredlogov).map(PredlogAktivnosti.fromJSON),
      opomba: typeof value.opomba === 'string' ? value.opomba : 'Predlogi so ideje; pred obiskom preveri aktualne informacije.',
    });
  }
}

function validateInput(input) {
  const lokacija = String(input?.lokacija || '').trim();
  const datum = String(input?.datum || '').trim();
  const vrstaDogodka = String(input?.vrstaDogodka || '').trim();
  const preference = String(input?.zelje || '').trim().slice(0, 240);
  const steviloPredlogov = Number(input?.steviloPredlogov ?? 3);
  if (lokacija.length < 2 || lokacija.length > 100) {
    throw Object.assign(new Error('Vnesi kraj in državo (od 2 do 100 znakov).'), { statusCode: 400 });
  }
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(datum) ? new Date(`${datum}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== datum) {
    throw Object.assign(new Error('Izberi veljaven datum.'), { statusCode: 400 });
  }
  if (!ALLOWED_TYPES.has(vrstaDogodka)) {
    throw Object.assign(new Error('Izberi vrsto dogodka iz seznama.'), { statusCode: 400 });
  }
  if (!Number.isInteger(steviloPredlogov) || steviloPredlogov < 1 || steviloPredlogov > 5) {
    throw Object.assign(new Error('Število predlogov mora biti celo število med 1 in 5.'), { statusCode: 400 });
  }
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error('Manjka Groq API ključ. V CMD najprej nastavi GROQ_API_KEY in znova zaženi aplikacijo.'), { statusCode: 503 });
  }
  return { lokacija, datum, vrstaDogodka, preference, steviloPredlogov };
}

function apiRequest(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          reject(new Error('Groq API je vrnil neveljaven odgovor.'));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const details = result.error?.failed_generation
            ? ` Podrobnosti odgovora: ${String(result.error.failed_generation).slice(0, 500)}`
            : '';
          const error = new Error(`${result.error?.message || `Napaka Groq API-ja (HTTP ${response.statusCode}).`}${details}`);
          error.statusCode = response.statusCode;
          reject(error);
          return;
        }
        resolve(result);
      });
      response.on('error', reject);
    });
    request.setTimeout(45000, () => request.destroy(new Error('Odgovor LLM je trajal predolgo. Poskusi znova.')));
    request.on('error', reject);
    request.end(payload);
  });
}

async function generateActivitySuggestions(rawInput) {
  const input = validateInput(rawInput);
  const userPrompt = [
    `Kraj in država: ${input.lokacija}`,
    `Datum: ${input.datum}`,
    `Vrsta dogodka: ${input.vrstaDogodka}`,
    `Število predlogov: ${input.steviloPredlogov}`,
    `Posebne želje uporabnika: ${input.preference || 'niso navedene'}`,
    `Predlagaj natanko ${input.steviloPredlogov} aktivnosti za obiskovalca okoli izbranega dogodka. Upoštevaj izbrani kraj, datum in vrsto dogodka.`,
  ].join('\n');
  const request = {
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        content: 'Si pomočnik za načrtovanje obiska dogodkov v aplikaciji Evently. Predlagaj uporabne, raznolike ideje za aktivnosti pred ali po dogodku. Ne trdi, da so določeni dogodki, urniki ali vstopnice potrjeni. Odgovori v slovenščini. Vrni samo veljaven JSON objekt brez Markdown ograje s ključi lokacija, datum, vrstaDogodka, predlogi in opomba. Vsak element v predlogi naj vsebuje naslov (besedilo), opis (besedilo), trajanje_min (celo število) in okolje (v zaprtih prostorih, na prostem ali oboje). Število elementov v predlogi mora biti enako številu, ki ga navede uporabnik.',
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 1500,
  };

  try {
    return parseSuggestionResponse(await apiRequest(request), input);
  } catch (firstError) {
    request.messages[1].content += `\nPomembno: prejšnji odgovor ni imel vseh ${input.steviloPredlogov} predlogov. Vrni natanko ${input.steviloPredlogov} kratkih, popolnih predlogov. Vsak mora imeti naslov, opis, trajanje_min kot celo število in okolje. Vrni samo JSON.`;
    try {
      return parseSuggestionResponse(await apiRequest(request), input);
    } catch {
      throw new Error(firstError.message || 'Groq ni vrnil treh veljavnih predlogov. Poskusi znova.');
    }
  }
}

function parseSuggestionResponse(result, input) {
  const choice = result.choices?.[0];
  const message = choice?.message;
  if (!message || message.refusal) throw new Error(message?.refusal || 'LLM ni vrnil predlogov.');
  if (choice.finish_reason === 'length') throw new Error('Odgovor LLM je bil prekinjen.');
  if (!message.content) throw new Error('LLM je vrnil prazen odgovor.');
  let parsed;
  try {
    parsed = JSON.parse(message.content);
  } catch {
    throw new Error('LLM odgovor ni bil veljaven JSON.');
  }
  return OdgovorLLM.fromJSON(parsed, input);
}

module.exports = { generateActivitySuggestions, OdgovorLLM, PredlogAktivnosti };
