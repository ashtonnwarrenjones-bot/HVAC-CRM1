/**
 * Microsoft Graph API helper for OneDrive / SharePoint file storage.
 * Requires env vars:
 *   AZURE_TENANT_ID      — Azure AD tenant ID
 *   AZURE_CLIENT_ID      — App registration client ID
 *   AZURE_CLIENT_SECRET  — App registration secret
 *   ONEDRIVE_DRIVE_ID    — Drive ID (OneDrive or SharePoint doc library)
 *
 * If any of these are missing the helpers return null and the caller
 * falls back to local disk storage.
 */

const axios = require('axios');

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  ONEDRIVE_DRIVE_ID,
} = process.env;

function isConfigured() {
  return !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET && ONEDRIVE_DRIVE_ID);
}

let _tokenCache = null;
let _tokenExpiry = 0;

async function getToken() {
  if (!isConfigured()) return null;
  if (_tokenCache && Date.now() < _tokenExpiry - 60_000) return _tokenCache;

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  });

  const r = await axios.post(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  _tokenCache = r.data.access_token;
  _tokenExpiry = Date.now() + r.data.expires_in * 1000;
  return _tokenCache;
}

/**
 * Sanitize a string for use as a folder/file name on OneDrive.
 * Strips characters that OneDrive disallows: " * : < > ? / \ |
 */
function safeName(str) {
  return (str || 'Unknown')
    .replace(/["*:<>?/\\|#%]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * Upload a file buffer to OneDrive / SharePoint.
 *
 * Folder path: /ServicePhotos/{companyName}/{YYYY-MM-DD}_{jobTitle}/
 *
 * Returns { itemId, webUrl, downloadUrl } or null on failure.
 */
async function uploadToSharePoint(buffer, mimeType, companyName, jobTitle, scheduledDate, originalName) {
  if (!isConfigured()) return null;

  const token = await getToken();
  const dateStr = scheduledDate
    ? new Date(scheduledDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const folder = `/ServicePhotos/${safeName(companyName)}/${dateStr}_${safeName(jobTitle)}`;
  const filename = `${Date.now()}_${safeName(originalName)}`;
  const uploadPath = encodeURIComponent(`${folder}/${filename}`).replace(/%2F/g, '/');

  const url = `https://graph.microsoft.com/v1.0/drives/${ONEDRIVE_DRIVE_ID}/root:/${uploadPath}:/content`;

  try {
    const r = await axios.put(url, buffer, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType || 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return {
      itemId: r.data.id,
      webUrl: r.data.webUrl,
      downloadUrl: r.data['@microsoft.graph.downloadUrl'] || null,
    };
  } catch (err) {
    console.error('SharePoint upload error:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Get a fresh (short-lived) direct download URL for an item.
 * The @microsoft.graph.downloadUrl stored at upload time expires after a few hours.
 */
async function getDownloadUrl(itemId) {
  if (!isConfigured() || !itemId) return null;
  const token = await getToken();
  try {
    const r = await axios.get(
      `https://graph.microsoft.com/v1.0/drives/${ONEDRIVE_DRIVE_ID}/items/${itemId}?select=id,webUrl,@microsoft.graph.downloadUrl`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return r.data['@microsoft.graph.downloadUrl'] || r.data.webUrl;
  } catch (err) {
    console.error('SharePoint getDownloadUrl error:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Delete an item from OneDrive / SharePoint by its item ID.
 */
async function deleteFromSharePoint(itemId) {
  if (!isConfigured() || !itemId) return;
  const token = await getToken();
  try {
    await axios.delete(
      `https://graph.microsoft.com/v1.0/drives/${ONEDRIVE_DRIVE_ID}/items/${itemId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error('SharePoint delete error:', err.response?.data || err.message);
  }
}

module.exports = { isConfigured, uploadToSharePoint, getDownloadUrl, deleteFromSharePoint };
