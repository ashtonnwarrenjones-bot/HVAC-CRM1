/**
 * Microsoft Graph API helper for OneDrive / SharePoint file storage.
 * Uses Node's built-in https — no external dependencies.
 *
 * Required env vars:
 *   AZURE_TENANT_ID      — Azure AD tenant ID
 *   AZURE_CLIENT_ID      — App registration client ID
 *   AZURE_CLIENT_SECRET  — App registration client secret
 *   ONEDRIVE_DRIVE_ID    — Drive ID (OneDrive or SharePoint doc library)
 *
 * When any var is missing, isConfigured() returns false and callers
 * fall back to local disk storage automatically.
 */

const https = require('https');

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  ONEDRIVE_DRIVE_ID,
} = process.env;

function isConfigured() {
  return !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET && ONEDRIVE_DRIVE_ID);
}

// ── Tiny https helpers ────────────────────────────────────────────────────────

function httpsRequest(options, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode}`);
          err.response = { status: res.statusCode, data };
          return reject(err);
        }
        resolve(data);
      });
    });
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

// ── Token cache ───────────────────────────────────────────────────────────────

let _tokenCache = null;
let _tokenExpiry = 0;

async function getToken() {
  if (!isConfigured()) return null;
  if (_tokenCache && Date.now() < _tokenExpiry - 60_000) return _tokenCache;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  }).toString();

  const data = await httpsRequest({
    hostname: 'login.microsoftonline.com',
    path: `/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  _tokenCache = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _tokenCache;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeName(str) {
  return (str || 'Unknown')
    .replace(/["*:<>?/\\|#%]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload a Buffer to OneDrive / SharePoint.
 * Folder: /ServicePhotos/{companyName}/{YYYY-MM-DD}_{jobTitle}/
 * Returns { itemId, webUrl, downloadUrl } or null on failure.
 */
async function uploadToSharePoint(buffer, mimeType, companyName, jobTitle, scheduledDate, originalName) {
  if (!isConfigured()) return null;
  const token = await getToken();

  const dateStr = scheduledDate
    ? new Date(scheduledDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const folder = `ServicePhotos/${safeName(companyName)}/${dateStr}_${safeName(jobTitle)}`;
  const filename = `${Date.now()}_${safeName(originalName)}`;
  // Graph path: /drives/{id}/root:/{folder}/{file}:/content
  const graphPath = `/v1.0/drives/${ONEDRIVE_DRIVE_ID}/root:/${folder}/${filename}:/content`;

  try {
    const data = await httpsRequest({
      hostname: 'graph.microsoft.com',
      path: graphPath,
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType || 'application/octet-stream',
        'Content-Length': buffer.length,
      },
    }, buffer);

    return {
      itemId: data.id,
      webUrl: data.webUrl,
      downloadUrl: data['@microsoft.graph.downloadUrl'] || null,
    };
  } catch (err) {
    console.error('SharePoint upload error:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Get a fresh direct-download URL for a stored item.
 */
async function getDownloadUrl(itemId) {
  if (!isConfigured() || !itemId) return null;
  const token = await getToken();
  try {
    const data = await httpsRequest({
      hostname: 'graph.microsoft.com',
      path: `/v1.0/drives/${ONEDRIVE_DRIVE_ID}/items/${itemId}?select=id,webUrl,@microsoft.graph.downloadUrl`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return data['@microsoft.graph.downloadUrl'] || data.webUrl;
  } catch (err) {
    console.error('SharePoint getDownloadUrl error:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Delete an item from OneDrive / SharePoint by item ID.
 */
async function deleteFromSharePoint(itemId) {
  if (!isConfigured() || !itemId) return;
  const token = await getToken();
  try {
    await httpsRequest({
      hostname: 'graph.microsoft.com',
      path: `/v1.0/drives/${ONEDRIVE_DRIVE_ID}/items/${itemId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('SharePoint delete error:', err.response?.data || err.message);
  }
}

module.exports = { isConfigured, uploadToSharePoint, getDownloadUrl, deleteFromSharePoint };
