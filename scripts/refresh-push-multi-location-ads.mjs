/**
 * Refresh the active PUSH multi-location ad set with four supplied poster assets.
 * Captions follow AIDOCAC: attention, interest, desire, offer, credential, action, close.
 *
 * Run: node scripts/refresh-push-multi-location-ads.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const GRAPH = 'https://graph.facebook.com/v23.0';
const ACCOUNT_ID = 'act_725484841474739';
const CAMPAIGN_ID = '120250214327890294';
const ADSET_ID = '120250214334810294';
const PAGE_ID = '102967319775538';
const LEAD_FORM_ID = '1515464823289816';

async function loadEnv() {
  for (const file of ['env.local', '.env.local']) {
    try {
      const contents = await fs.readFile(path.resolve(file), 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

await loadEnv();
const token = process.env.META_APP_TOKEN;
if (!token) throw new Error('META_APP_TOKEN is missing from env.local or .env.local.');

async function api(endpoint, method = 'GET', body) {
  const url = new URL(`${GRAPH}/${endpoint}`);
  const options = { method };
  if (method === 'GET') {
    url.searchParams.set('access_token', token);
  } else {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify({ ...body, access_token: token });
  }
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`${endpoint}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

async function uploadImage(file) {
  const blob = new Blob([await fs.readFile(file)], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('access_token', token);
  form.append('filename', blob, path.basename(file));
  const response = await fetch(`${GRAPH}/${ACCOUNT_ID}/adimages`, { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`upload ${path.basename(file)}: ${data.error?.message || JSON.stringify(data)}`);
  const image = Object.values(data.images || {})[0];
  if (!image?.hash) throw new Error(`upload ${path.basename(file)}: no image hash returned.`);
  return image.hash;
}

const base = '/Users/faeez/motionboards/FatHopes IMG/push-posters-real-jobdesc';
const assets = [
  {
    name: 'PUSH | Multi Location | Lori Jadi Ofis',
    file: path.join(base, 'file_1784624682348_d14865b6ed54.jpeg'),
    headline: 'Lori Jadi Ofis',
    message: `Ada lori dan nak bina laluan sendiri?\n\nProgram PUSH membuka peluang kutip minyak masak terpakai dari premis sekitar.\n\nGerak ikut jadual sendiri, dengan sokongan operasi FatHopes.\n\nKerja sebenar. Lori sebenar. Pasukan sebenar.\n\nIsi borang untuk dapatkan penerangan Program PUSH.\n\nUsahawan, bukan kerja bergaji tetap.`,
  },
  {
    name: 'PUSH | Multi Location | Kutip Untuk Diri',
    file: path.join(base, 'file_1784624701014_07bbadf425b0.jpeg'),
    headline: 'Bina Laluan Collection',
    message: `Minyak masak terpakai ada nilai bila dikutip dengan betul.\n\nProgram PUSH menghubungkan kutipan premis kepada operasi FatHopes.\n\nTrip dan laluan collection diakses melalui aplikasi, supaya perjalanan lebih teratur.\n\nDaftar minat untuk faham cara program ini berfungsi.\n\nOperasi pengumpulan sebenar, disokong pasukan FatHopes.\n\nIsi borang sekarang. Kami hubungi untuk penerangan.`,
  },
  {
    name: 'PUSH | Multi Location | Operasi Betul',
    file: path.join(base, 'file_1784624702626_ce6a958fbde7.jpeg'),
    headline: 'Program PUSH FatHopes',
    message: `Program pengumpulan yang ada operasi sebenar.\n\nMinyak masak terpakai daripada premis dikumpul untuk diberi nilai baharu.\n\nKutipan konsisten boleh membuka laluan collection sendiri.\n\nFatHopes sediakan ekosistem operasi untuk rakan pengumpul.\n\nLori, pasukan dan proses di belakang setiap kutipan.\n\nIsi borang untuk daftar minat hari ini.`,
  },
  {
    name: 'PUSH | Multi Location | Sisa Jadi Nilai',
    file: path.join(base, 'file_1784624873910_bfb7a8134548.jpeg'),
    headline: 'Tukar Sisa Jadi Nilai',
    message: `Sisa dapur bukan semestinya berakhir sebagai sisa.\n\nMinyak masak terpakai boleh dikumpul melalui Program PUSH.\n\nSetiap collection membina pengalaman dan peluang dalam laluan sendiri.\n\nPeluang untuk jadi rakan pengumpul FatHopes.\n\nProgram berasaskan operasi kitar semula sebenar.\n\nIsi borang sekarang untuk kami hubungi.`,
  },
];

// Preserve the eight existing operating areas; widen demographic relevance without broadening geography.
const targeting = {
  age_min: 21,
  age_max: 65,
  geo_locations: {
    location_types: ['home'],
    cities: [
      { key: '1569465', radius: 16, distance_unit: 'kilometer' }, // Kampong Salak Tinggi
      { key: '1573224', radius: 16, distance_unit: 'kilometer' }, // Kamunting
      { key: '1574423', radius: 16, distance_unit: 'kilometer' }, // Muar
      { key: '1576541', radius: 16, distance_unit: 'kilometer' }, // Segamat
      { key: '1576642', radius: 16, distance_unit: 'kilometer' }, // Sepang
      { key: '1577146', radius: 16, distance_unit: 'kilometer' }, // Taiping
      { key: '1577244', radius: 16, distance_unit: 'kilometer' }, // Tangkak
      { key: '1577728', radius: 16, distance_unit: 'kilometer' }, // Yong Peng
    ],
  },
  flexible_spec: [
    {
      interests: [
        { id: '363781183812266', name: 'GrabTaxi' },
        { id: '6003371567474', name: 'Entrepreneurship' },
        { id: '6003214937861', name: 'Self-employment' },
        { id: '6002884511422', name: 'Small business' },
      ],
    },
  ],
  targeting_automation: { advantage_audience: 0 },
};

const existing = await api(`${CAMPAIGN_ID}/ads?fields=id,name&limit=100`);
const existingByName = new Map((existing.data || []).map((ad) => [ad.name, ad.id]));
const created = [];

for (const asset of assets) {
  if (existingByName.has(asset.name)) {
    created.push({ name: asset.name, id: existingByName.get(asset.name), state: 'already exists' });
    continue;
  }
  const imageHash = await uploadImage(asset.file);
  const creative = await api(`${ACCOUNT_ID}/adcreatives`, 'POST', {
    name: asset.name,
    object_story_spec: {
      page_id: PAGE_ID,
      link_data: {
        link: 'http://fb.me/',
        message: asset.message,
        name: asset.headline,
        description: 'Isi borang untuk dapatkan penerangan Program PUSH.',
        image_hash: imageHash,
        call_to_action: {
          type: 'SEE_DETAILS',
          value: { lead_gen_form_id: LEAD_FORM_ID, link: 'http://fb.me/' },
        },
      },
    },
  });
  const ad = await api(`${ACCOUNT_ID}/ads`, 'POST', {
    name: asset.name,
    adset_id: ADSET_ID,
    creative: { creative_id: creative.id },
    status: 'PAUSED',
  });
  created.push({ name: asset.name, id: ad.id, state: 'created' });
}

await api(ADSET_ID, 'POST', { targeting });

for (const ad of created) {
  await api(ad.id, 'POST', { status: 'ACTIVE' });
}

const verification = await api(`${ADSET_ID}?fields=name,status,targeting`);
console.log(JSON.stringify({ created, adSet: { name: verification.name, status: verification.status, targeting: verification.targeting } }, null, 2));
