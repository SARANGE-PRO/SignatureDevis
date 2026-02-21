/* ==========================================================================
   SARANGE — Admin : Extraction Devis PDF → Google Drive + Sheet + Mail
   Architecture v3 : Upload direct navigateur → Drive API, puis GAS pour Sheet + Email
   ========================================================================== */

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Client ID OAuth 2.0 Google Cloud (scope Drive).
 * À créer sur: console.cloud.google.com → APIs & Services → Credentials
 * Type: "OAuth 2.0 Client ID" → Application Web
 * Origines autorisées: http://127.0.0.1:8080 (dev) + https://ton-domaine.fr (prod)
 */
const GOOGLE_CLIENT_ID = '699593246334-05mr710cpof5efgbgra54mpoog2ghma7.apps.googleusercontent.com';

/**
 * ID du dossier Google Drive où uploader les devis.
 */
const DRIVE_FOLDER_ID = '1TslssfhTFaJ_I2-Hr2mqgtT8a7plnXZCt9_K00Zc8Nur6kjnEr8zJlC5nc8vSz-wZoBML0jb';

/**
 * URL du webhook Google Apps Script.
 * Ce endpoint reçoit {fileId, devis, client, email} puis:
 *   1) Ajoute la ligne au Sheet
 *   2) Envoie le mail de signature au client
 */
const ADMIN_API_URL = 'https://script.google.com/macros/s/AKfycbzTS1SgE9Lg3WlFHrC5q-jsfVUXMlk0fGStJQOw2yQGM1AIssJ8-hEtKls5cJTiEvxw/exec';

// ============================================================
// STATE
// ============================================================

let currentFile = null;
let googleAccessToken = null;

// ============================================================
// DOM REFERENCES
// ============================================================

let dom = {};

function cacheDom() {
    dom = {
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('file-input'),
        filePill: document.getElementById('file-pill'),
        fileName: document.getElementById('file-name'),
        removeFile: document.getElementById('remove-file'),
        loadingBar: document.getElementById('loading-bar'),
        resultsSection: document.getElementById('results-section'),
        fieldDevis: document.getElementById('field-devis'),
        fieldClient: document.getElementById('field-client'),
        fieldEmail: document.getElementById('field-email'),
        fieldTotal: document.getElementById('field-total'),
        fieldAddress: document.getElementById('field-address'),
        btnSend: document.getElementById('btn-send'),
        btnSendText: document.getElementById('btn-send-text'),
        btnSendSpinner: document.getElementById('btn-send-spinner'),
        btnReset: document.getElementById('btn-reset'),
        successBanner: document.getElementById('success-banner'),
        driveLinkResult: document.getElementById('drive-link-result'),
        errorBanner: document.getElementById('error-banner'),
        errorText: document.getElementById('error-text'),
        driveStatusText: document.getElementById('drive-status-text'),
        rawTextDebug: document.getElementById('raw-text-debug'),
        btnGoogleSignin: document.getElementById('btn-google-signin'),
        googleUserInfo: document.getElementById('google-user-info'),
    };
}

// ============================================================
// GOOGLE OAUTH — TOKEN FLOW (GIS popup)
// ============================================================

let tokenClient = null;

function initGoogleAuth() {
    // Attendre que le script GIS soit chargé
    if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(initGoogleAuth, 300);
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
            if (tokenResponse.error) {
                console.error('Erreur OAuth:', tokenResponse.error);
                showError('Connexion Google échouée : ' + tokenResponse.error);
                return;
            }
            googleAccessToken = tokenResponse.access_token;
            console.log('✅ Token Google obtenu, expire dans', tokenResponse.expires_in, 's');

            // Afficher info utilisateur
            fetchGoogleUserInfo();
        },
    });

    dom.btnGoogleSignin.addEventListener('click', () => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

async function fetchGoogleUserInfo() {
    try {
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + googleAccessToken }
        });
        const user = await resp.json();
        dom.btnGoogleSignin.classList.add('hidden');
        dom.googleUserInfo.textContent = '✅ ' + (user.name || user.email);
        dom.googleUserInfo.classList.remove('hidden');
        console.log('👤 Connecté en tant que:', user.name, user.email);
    } catch (e) {
        console.warn('Impossible de récupérer les infos utilisateur:', e);
    }
}

/**
 * Demande un token si pas encore connecté.
 * Retourne une Promise qui se résout quand le token est disponible.
 */
function ensureToken() {
    return new Promise((resolve, reject) => {
        if (googleAccessToken) {
            resolve(googleAccessToken);
            return;
        }
        // Surcharger temporairement le callback
        const originalCallback = tokenClient.callback;
        tokenClient.callback = (tokenResponse) => {
            originalCallback(tokenResponse);
            if (tokenResponse.error) {
                reject(new Error(tokenResponse.error));
            } else {
                resolve(tokenResponse.access_token);
            }
            tokenClient.callback = originalCallback;
        };
        tokenClient.requestAccessToken({ prompt: '' });
    });
}

// ============================================================
// GOOGLE DRIVE — UPLOAD DIRECT depuis le navigateur
// ============================================================

/**
 * Upload un File vers Google Drive (multipart upload).
 * Retourne le fileId du fichier créé.
 */
async function uploadFileToDrive(file, token) {
    const metadata = {
        name: file.name,
        parents: [DRIVE_FOLDER_ID],
        mimeType: 'application/pdf',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
        {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
            body: form,
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error('Erreur upload Drive (' + response.status + ') : ' + err);
    }

    const data = await response.json();
    console.log('✅ PDF uploadé sur Drive :', data.id, data.webViewLink);

    // Rendre le fichier accessible en lecture aux personnes ayant le lien
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    return { fileId: data.id, webViewLink: data.webViewLink };
}

// ============================================================
// DRAG & DROP + FILE INPUT
// ============================================================

function initDropzone() {
    const dz = dom.dropzone;

    ['dragenter', 'dragover'].forEach(evt => {
        dz.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dz.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dz.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dz.classList.remove('dragover');
        });
    });

    dz.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });

    dom.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    dom.removeFile.addEventListener('click', resetAll);
}

// ============================================================
// FILE HANDLING + PARSING
// ============================================================

async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
        showError('Veuillez sélectionner un fichier PDF.');
        return;
    }

    currentFile = file;

    dom.fileName.textContent = file.name;
    dom.filePill.classList.add('visible');
    dom.loadingBar.classList.add('visible');
    dom.resultsSection.classList.remove('visible');
    dom.successBanner.classList.remove('visible');
    hideError();

    try {
        const parser = window.quoteParser;
        if (!parser) throw new Error('QuoteParserService non chargé.');

        await parser.init();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await parser.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();

            const items = content.items.map(item => ({
                str: item.str,
                x: item.transform[4],
                y: item.transform[5],
            }));

            items.sort((a, b) => {
                const dy = b.y - a.y;
                if (Math.abs(dy) > 5) return dy;
                return a.x - b.x;
            });

            let pageText = '';
            let lastY = items.length > 0 ? items[0].y : 0;

            for (const item of items) {
                if (Math.abs(item.y - lastY) > 5) pageText += '\n';
                pageText += item.str + ' ';
                lastY = item.y;
            }

            fullText += pageText + '\n';
        }

        const info = parser.extractClientInfo(fullText);

        dom.fieldDevis.value = info.number || '';
        dom.fieldClient.value = info.name || '';
        dom.fieldEmail.value = info.email || '';
        dom.fieldTotal.value = info.totalTTC ? info.totalTTC + ' €' : '';
        dom.fieldAddress.value = info.address || '';

        if (dom.rawTextDebug) {
            dom.rawTextDebug.textContent = fullText.substring(0, 2000);
        }

        console.log('📋 Données extraites :', info);

        dom.resultsSection.classList.add('visible');
        updateSendButton();

    } catch (err) {
        console.error('Erreur extraction PDF :', err);
        showError('Impossible de lire le PDF : ' + err.message);
    } finally {
        dom.loadingBar.classList.remove('visible');
    }
}

// ============================================================
// VALIDATION
// ============================================================

function updateSendButton() {
    const hasDevis = dom.fieldDevis.value.trim() !== '';
    const hasClient = dom.fieldClient.value.trim() !== '';
    const hasEmail = dom.fieldEmail.value.trim() !== '';
    dom.btnSend.disabled = !(hasDevis && hasClient && hasEmail);
}

// ============================================================
// SEND : Upload Drive → GAS (Sheet + Email)
// ============================================================

async function handleSend() {
    if (dom.btnSend.disabled) return;

    setLoading(true);
    hideError();

    try {
        // 1) S'assurer qu'on a un token Google
        dom.driveStatusText.textContent = '🔐 Connexion Google en cours…';
        const token = await ensureToken();

        // 2) Uploader le PDF directement sur Google Drive
        dom.driveStatusText.textContent = '📤 Upload du PDF sur Google Drive…';
        const { fileId, webViewLink } = await uploadFileToDrive(currentFile, token);
        dom.driveStatusText.textContent = '✅ PDF uploadé sur Drive !';

        // 3) Envoyer les données au GAS (Sheet + Email)
        dom.driveStatusText.textContent = '📊 Enregistrement dans le Sheet + envoi du mail…';

        const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

        // Extraire le montant TTC comme nombre (ex: "35 207,10 €" → 35207.10)
        const totalTTCRaw = dom.fieldTotal.value.replace(/[^0-9,]/g, '').replace(',', '.');
        const totalTTC = parseFloat(totalTTCRaw) || 0;

        const payload = {
            action: 'admin_devis',
            horodateur: new Date().toLocaleString('fr-FR'),
            devis: dom.fieldDevis.value.trim(),
            client: dom.fieldClient.value.trim(),
            email: dom.fieldEmail.value.trim(),
            fileId: fileId,
            driveUrl: driveUrl,
            totalTTC: totalTTC,
        };

        console.log('📤 Envoi vers GAS :', payload);

        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        console.log('📥 Réponse GAS :', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            throw new Error('Réponse non-JSON du GAS (redéployer?). Réponse: ' + responseText.substring(0, 150));
        }

        if (result.status === 'success') {
            dom.resultsSection.classList.remove('visible');
            dom.successBanner.classList.add('visible');

            // Afficher le lien Drive dans le banner de succès
            if (webViewLink || driveUrl) {
                dom.driveLinkResult.href = webViewLink || driveUrl;
                dom.driveLinkResult.classList.remove('hidden');
            }

            console.log('✅ Tout est OK :', result.message);
        } else {
            throw new Error(result.message || 'Erreur GAS inconnue.');
        }

    } catch (err) {
        console.error('❌ Erreur :', err);
        showError('Erreur : ' + err.message);
        dom.driveStatusText.textContent = 'Le PDF sera uploadé automatiquement sur Google Drive';
    } finally {
        setLoading(false);
    }
}

// ============================================================
// UI HELPERS
// ============================================================

function setLoading(isLoading) {
    if (isLoading) {
        dom.btnSend.disabled = true;
        dom.btnSendText.textContent = 'Envoi en cours…';
        dom.btnSendSpinner.classList.remove('hidden');
    } else {
        dom.btnSendText.textContent = 'Envoyer vers Sheet + Mail';
        dom.btnSendSpinner.classList.add('hidden');
        updateSendButton();
    }
}

function showError(msg) {
    dom.errorText.textContent = msg;
    dom.errorBanner.classList.add('visible');
}

function hideError() {
    dom.errorBanner.classList.remove('visible');
}

function resetAll() {
    currentFile = null;
    dom.filePill.classList.remove('visible');
    dom.resultsSection.classList.remove('visible');
    dom.successBanner.classList.remove('visible');
    dom.loadingBar.classList.remove('visible');
    dom.driveLinkResult.classList.add('hidden');
    dom.driveStatusText.textContent = 'Le PDF sera uploadé automatiquement sur Google Drive';
    hideError();
    dom.fileInput.value = '';
    dom.fieldDevis.value = '';
    dom.fieldClient.value = '';
    dom.fieldEmail.value = '';
    dom.fieldTotal.value = '';
    dom.fieldAddress.value = '';
    if (dom.rawTextDebug) dom.rawTextDebug.textContent = '';
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    initDropzone();
    initGoogleAuth();

    ['field-devis', 'field-client', 'field-email'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateSendButton);
    });

    dom.btnSend.addEventListener('click', handleSend);
    dom.btnReset.addEventListener('click', resetAll);
});
