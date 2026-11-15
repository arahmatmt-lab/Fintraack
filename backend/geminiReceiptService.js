/**
 * FINTRACK — AI Receipt Scanner Service (Bagian 6 Dokumen Rancangan)
 * Mengekstrak informasi terstruktur dari foto struk belanja melalui Gemini API
 * dan memvalidasi konsistensi perhitungan sebelum ditampilkan pada formulir konfirmasi pengguna.
 */

const DEMO_RECEIPTS = {
  minimarket: {
    merchant_name: 'Minimarket ABC',
    receipt_date: '2026-11-14',
    items: [
      { item_name: 'Air Mineral 600ml', quantity: 2, unit_price: 4500, total_price: 9000 },
      { item_name: 'Roti Tawar Gandum', quantity: 1, unit_price: 16500, total_price: 16500 },
      { item_name: 'Sabun Mandi Cair', quantity: 1, unit_price: 12500, total_price: 12500 }
    ],
    subtotal: 38000,
    tax: 0,
    discount: 2000,
    total_amount: 36000,
    suggested_category: 'Belanja Kebutuhan'
  },
  coffee: {
    merchant_name: 'Kopi Nusantara Roastery',
    receipt_date: '2026-11-14',
    items: [
      { item_name: 'Es Kopi Susu Gula Aren', quantity: 2, unit_price: 24000, total_price: 48000 },
      { item_name: 'Croissant Butter', quantity: 1, unit_price: 27000, total_price: 27000 }
    ],
    subtotal: 75000,
    tax: 7500,
    discount: 0,
    total_amount: 82500,
    suggested_category: 'Makan & Minum'
  },
  pharmacy: {
    merchant_name: 'Apotek Sehat Sentosa',
    receipt_date: '2026-11-13',
    items: [
      { item_name: 'Vitamin C 500mg', quantity: 1, unit_price: 45000, total_price: 45000 },
      { item_name: 'Plester Luka Box', quantity: 2, unit_price: 12000, total_price: 24000 }
    ],
    subtotal: 69000,
    tax: 0,
    discount: 4000,
    total_amount: 65000,
    suggested_category: 'Kesehatan'
  }
};

function validateCalculation(extracted) {
  const items = Array.isArray(extracted.items) ? extracted.items : [];
  const itemsSum = items.reduce((acc, it) => acc + Number(it.total_price || (it.quantity * it.unit_price) || 0), 0);
  const subtotal = Number(extracted.subtotal || itemsSum);
  const tax = Number(extracted.tax || 0);
  const discount = Number(extracted.discount || 0);
  const total = Number(extracted.total_amount || 0);
  const computedTotal = Math.max(0, subtotal + tax - discount);
  const diff = Math.abs(computedTotal - total);

  return {
    items_sum: itemsSum,
    computed_total: computedTotal,
    reported_total: total,
    is_consistent: diff <= 500,
    discrepancy: diff,
    note: diff <= 500
      ? 'Perhitungan item, pajak, diskon, dan total konsisten.'
      : `Terdapat selisih Rp${diff.toLocaleString('id-ID')} antara rincian dan total. Harap periksa ulang sebelum menyimpan.`
  };
}

function buildCandidateTargets(apiKey) {
  const targets = ['gemini-3.5-flash', 'gemini-flash-latest'].map((model) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    headers: { 'Content-Type': 'application/json' }
  }));
  if (apiKey.startsWith('AQ.')) {
    targets.push({
      url: 'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      }
    });
  }
  return targets;
}

function parseGeminiJson(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

async function callGeminiTarget(target, requestBody) {
  const response = await fetch(target.url, {
    method: 'POST',
    headers: target.headers,
    body: requestBody
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.error?.message) detail = `${detail}: ${errBody.error.message}`;
    } catch (_) {}
    throw new Error(`Gemini API ${detail}`);
  }
  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini API mengembalikan respons kosong.');
  return parseGeminiJson(text);
}

async function extractWithGemini(base64DataUrl, mimeType = 'image/jpeg') {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }

  const base64Clean = String(base64DataUrl || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64Clean) return null;

  const prompt = [
    'Ekstrak informasi dari foto struk belanja ini ke dalam JSON valid tanpa markdown.',
    'Prioritaskan akurasi total_amount (TOTAL / GRAND TOTAL / TOTAL BAYAR / TOTAL PENGELUARAN).',
    'Format JSON wajib:',
    '{',
    '  "merchant_name": string,',
    '  "receipt_date": "YYYY-MM-DD",',
    '  "items": [{"item_name": string, "quantity": number, "unit_price": number, "total_price": number}],',
    '  "subtotal": number,',
    '  "tax": number,',
    '  "discount": number,',
    '  "total_amount": number,',
    '  "suggested_category": string',
    '}',
    'Gunakan angka numerik murni tanpa simbol mata uang untuk nominal.'
  ].join('\n');

  const requestBody = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Clean } }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  let lastError = null;
  for (const target of buildCandidateTargets(apiKey)) {
    try {
      return await callGeminiTarget(target, requestBody);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Gemini API gagal memproses struk.');
}

function buildEmptyReceiptDraft() {
  return {
    merchant_name: '',
    receipt_date: new Date().toISOString().slice(0, 10),
    items: [],
    subtotal: 0,
    tax: 0,
    discount: 0,
    total_amount: 0,
    suggested_category: 'Belanja Kebutuhan'
  };
}

async function analyzeReceipt({ imageDataUrl, mimeType, demoPreset }) {
  if (demoPreset && DEMO_RECEIPTS[demoPreset]) {
    const preset = JSON.parse(JSON.stringify(DEMO_RECEIPTS[demoPreset]));
    return {
      source: 'demo_preset',
      ai_status: 'draft_for_confirmation',
      data: preset,
      validation: validateCalculation(preset)
    };
  }

  if (process.env.GEMINI_API_KEY && imageDataUrl) {
    try {
      const geminiData = await extractWithGemini(imageDataUrl, mimeType);
      if (geminiData) {
        return {
          source: 'gemini_api',
          ai_status: 'draft_for_confirmation',
          data: geminiData,
          validation: validateCalculation(geminiData)
        };
      }
    } catch (err) {
      const blankDraft = buildEmptyReceiptDraft();
      return {
        source: 'fallback_preview',
        ai_status: 'needs_manual_review',
        warning: `Pembacaan AI gagal (${err.message}). Silakan isi Total Pengeluaran secara manual.`,
        data: blankDraft,
        validation: validateCalculation(blankDraft)
      };
    }
  }

  const blankDraft = buildEmptyReceiptDraft();
  return {
    source: 'local_preview',
    ai_status: 'needs_manual_review',
    warning: 'GEMINI_API_KEY belum aktif di server. Foto struk siap — masukkan Total Pengeluaran secara manual atau aktifkan GEMINI_API_KEY untuk ekstraksi otomatis.',
    data: blankDraft,
    validation: validateCalculation(blankDraft)
  };
}

module.exports = {
  analyzeReceipt,
  validateCalculation,
  DEMO_RECEIPTS
};
