// SharePoint integration — returns false/null when not configured
// Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET,
// SHAREPOINT_SITE_ID, and SHAREPOINT_DRIVE_ID in environment to enable.

function isConfigured() {
  return !!(
    process.env.SHAREPOINT_TENANT_ID &&
    process.env.SHAREPOINT_CLIENT_ID &&
    process.env.SHAREPOINT_CLIENT_SECRET &&
    process.env.SHAREPOINT_SITE_ID &&
    process.env.SHAREPOINT_DRIVE_ID
  );
}

async function getAccessToken() {
  const { default: fetch } = await import('node-fetch').catch(() => ({ default: global.fetch }));
  const url = `https://login.microsoftonline.com/${process.env.SHAREPOINT_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SHAREPOINT_CLIENT_ID,
    client_secret: process.env.SHAREPOINT_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  });
  const r = await fetch(url, { method: 'POST', body });
  const data = await r.json();
  return data.access_token;
}

async function uploadToSharePoint(buffer, mimetype, companyName, jobTitle, jobDate, originalName) {
  if (!isConfigured()) return null;
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: global.fetch }));
    const token = await getAccessToken();
    const safe = (s) => (s || 'Unknown').replace(/[^a-zA-Z0-9 _-]/g, '_');
    const folder = `${safe(companyName)}/${safe(jobTitle)}`;
    const filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const siteId = process.env.SHAREPOINT_SITE_ID;
    const driveId = process.env.SHAREPOINT_DRIVE_ID;

    // Create folder path
    const folderUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(folder)}:/children`;
    await fetch(folderUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: filename.split('/').pop(), folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
    });

    // Upload file
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}:/content`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimetype || 'application/octet-stream' },
      body: buffer,
    });
    const item = await uploadRes.json();
    return {
      itemId: item.id,
      webUrl: item.webUrl,
      downloadUrl: item['@microsoft.graph.downloadUrl'] || null,
    };
  } catch (err) {
    console.error('SharePoint upload error:', err.message);
    return null;
  }
}

async function getDownloadUrl(itemId) {
  if (!isConfigured() || !itemId) return null;
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: global.fetch }));
    const token = await getAccessToken();
    const siteId = process.env.SHAREPOINT_SITE_ID;
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json();
    return data['@microsoft.graph.downloadUrl'] || data.webUrl || null;
  } catch (err) {
    console.error('SharePoint getDownloadUrl error:', err.message);
    return null;
  }
}

async function deleteFromSharePoint(itemId) {
  if (!isConfigured() || !itemId) return;
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: global.fetch }));
    const token = await getAccessToken();
    const siteId = process.env.SHAREPOINT_SITE_ID;
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error('SharePoint delete error:', err.message);
  }
}

module.exports = { isConfigured, uploadToSharePoint, getDownloadUrl, deleteFromSharePoint };
