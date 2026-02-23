/* ==========================================================================
   SARANGE — Signature Électronique de Devis
   Logique applicative : URL Parsing, Signature Pad, Connexion API
   ========================================================================== */

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * URL du webhook Google Apps Script.
 * IMPORTANT : Remplacez cette valeur par votre URL de déploiement GAS.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbzTS1SgE9Lg3WlFHrC5q-jsfVUXMlk0fGStJQOw2yQGM1AIssJ8-hEtKls5cJTiEvxw/exec';

// ============================================================
// VARIABLES GLOBALES
// ============================================================

/** Instance de SignaturePad */
let signaturePad = null;

/** Flag indiquant la présence d'un cachet d'entreprise */
let hasStamp = false;

/** Références aux éléments du DOM (initialisées dans initPage) */
let elements = {};

// ============================================================
// 1. URL PARSING — Lecture des paramètres de l'URL
// ============================================================

/**
 * Extrait les paramètres de l'URL courante.
 * @returns {Object|null} Objet { devis, client, email, pdf } ou null si paramètres obligatoires manquants.
 */
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const devis = params.get('devis');
    const client = params.get('client');
    const email = params.get('email');
    const pdf = params.get('pdf'); // Optionnel — ID Google Drive du PDF
    const tva = params.get('tva'); // Optionnel — 1 si TVA réduite

    // Vérifie que les trois paramètres obligatoires sont présents
    if (!devis || !client || !email) {
        return null;
    }

    return { devis, client, email, pdf, tva };
}

// ============================================================
// 2. VÉRIFICATION ANTI-DOUBLE SIGNATURE
// ============================================================

/**
 * Vérifie auprès de l'API si le devis a déjà été signé.
 * @param {string} devisNumber - Numéro du devis à vérifier.
 * @returns {Promise<boolean>} true si déjà signé, false sinon.
 */
async function checkAlreadySigned(devisNumber) {
    try {
        const response = await fetch(API_URL + '?check=' + encodeURIComponent(devisNumber), {
            method: 'GET',
            redirect: 'follow',
        });
        const result = await response.json();
        return result.signed === true;
    } catch (error) {
        console.warn('Impossible de vérifier le statut du devis :', error);
        // En cas d'erreur réseau, on laisse le formulaire accessible
        return false;
    }
}

/**
 * Affiche le bloc "déjà signé" et masque le formulaire.
 * @param {string} devisNumber - Numéro du devis.
 */
function showAlreadySigned(devisNumber) {
    elements.formSection.classList.add('hidden');
    elements.alreadySignedZone.style.display = 'block';
    elements.alreadySignedDevisId.textContent = devisNumber;
}

// ============================================================
// 3. INITIALISATION DE LA PAGE
// ============================================================

/**
 * Point d'entrée principal. Initialise la page en fonction
 * de la présence ou non des paramètres URL.
 */
async function initPage() {
    // Récupération des références DOM
    elements = {
        formSection: document.getElementById('form-section'),
        errorZone: document.getElementById('error-zone'),
        successZone: document.getElementById('success-zone'),
        alreadySignedZone: document.getElementById('already-signed-zone'),
        alreadySignedDevisId: document.getElementById('already-signed-devis-id'),
        clientName: document.getElementById('client-name'),
        clientEmail: document.getElementById('client-email'),
        devisNumber: document.getElementById('devis-number'),
        signatureCanvas: document.getElementById('signature-canvas'),
        canvasPlaceholder: document.getElementById('canvas-placeholder'),
        acceptCheckbox: document.getElementById('accept-checkbox'),
        tvaSection: document.getElementById('tva-section'),
        tvaCheckbox: document.getElementById('tva-checkbox'),
        submitBtn: document.getElementById('submit-btn'),
        submitBtnText: document.getElementById('submit-btn-text'),
        submitBtnSpinner: document.getElementById('submit-btn-spinner'),
        clearBtn: document.getElementById('clear-btn'),
        successDevisId: document.getElementById('success-devis-id'),
        pdfViewerSection: document.getElementById('pdf-viewer-section'),
        pdfIframe: document.getElementById('pdf-iframe'),
        downloadPdfBtn: document.getElementById('download-pdf-btn'),
        stampBtn: document.getElementById('stamp-btn'),
        stampUpload: document.getElementById('stamp-upload'),
    };

    // Lecture des paramètres URL
    const params = getUrlParams();

    if (!params) {
        // Paramètres absents → masquer le formulaire, afficher l'erreur
        elements.formSection.classList.add('hidden');
        elements.errorZone.style.display = 'block';
        return;
    }

    // Affichage dynamique des informations client
    elements.clientName.textContent = params.client;
    elements.clientEmail.textContent = params.email;
    elements.devisNumber.textContent = params.devis;

    // --- Gestion de l'iframe PDF ---
    if (params.pdf) {
        elements.pdfViewerSection.style.display = 'block';
        elements.pdfIframe.src = 'https://drive.google.com/file/d/' + params.pdf + '/preview';
        elements.downloadPdfBtn.href = 'https://drive.google.com/uc?export=download&id=' + params.pdf;
    }

    // --- Révélation instantanée de la section TVA (Aucune attente réseau) ---
    if (params.tva === '1' && elements.tvaSection) {
        elements.tvaSection.classList.remove('hidden');
    }

    // --- Vérification anti-double signature (appel GET) ---
    const alreadySigned = await checkAlreadySigned(params.devis);
    if (alreadySigned) {
        showAlreadySigned(params.devis);
        return; // On arrête ici, pas besoin d'initialiser le pad
    }

    // Initialisation du pad de signature
    initSignaturePad();

    // Écoute des interactions : checkbox, bouton effacer, bouton valider
    elements.acceptCheckbox.addEventListener('change', updateSubmitButton);
    if (elements.tvaCheckbox) {
        elements.tvaCheckbox.addEventListener('change', updateSubmitButton);
    }
    elements.clearBtn.addEventListener('click', handleClear);
    elements.submitBtn.addEventListener('click', handleSubmit);

    // --- B2B : Gestion du cachet ---
    if (elements.stampBtn && elements.stampUpload) {
        elements.stampBtn.addEventListener('click', () => elements.stampUpload.click());
        elements.stampUpload.addEventListener('change', handleStampUpload);
    }

    // Mise à jour initiale de l'état du bouton
    updateSubmitButton();
}

// ============================================================
// 4. SIGNATURE PAD — Initialisation et redimensionnement
// ============================================================

/**
 * Initialise la librairie SignaturePad sur le canvas HTML,
 * en gérant le devicePixelRatio pour un tracé net sur Retina/mobile.
 */
function initSignaturePad() {
    const canvas = elements.signatureCanvas;

    // Création de l'instance SignaturePad avec un style adapté à la charte
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(0, 0, 0, 0)',  // Fond transparent (géré en CSS)
        penColor: '#0F172A',                   // Slate 900 — Couleur du tracé
        minWidth: 1,
        maxWidth: 2.5,
        velocityFilterWeight: 0.7,
    });

    // Gestion du placeholder visuel
    signaturePad.addEventListener('beginStroke', () => {
        elements.canvasPlaceholder.classList.add('is-hidden');
        // Classe visuelle pour la bordure pendant le dessin
        canvas.parentElement.classList.add('is-drawing');
        // Met à jour l'état du bouton dès qu'on commence à signer
        updateSubmitButton();
    });

    signaturePad.addEventListener('endStroke', () => {
        canvas.parentElement.classList.remove('is-drawing');
        updateSubmitButton();
    });

    // Premier dimensionnement et écoute du resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

/**
 * Redimensionne le canvas en tenant compte du devicePixelRatio.
 * Cela garantit un tracé net sur les écrans haute densité (Retina, mobiles).
 * ATTENTION : le redimensionnement efface le contenu du canvas.
 */
function resizeCanvas() {
    const canvas = elements.signatureCanvas;
    const wrapper = canvas.parentElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    // Ajuste la taille interne du canvas à la résolution réelle de l'écran
    canvas.width = wrapper.offsetWidth * ratio;
    canvas.height = wrapper.offsetHeight * ratio;

    // Ajuste la taille d'affichage CSS
    canvas.style.width = wrapper.offsetWidth + 'px';
    canvas.style.height = wrapper.offsetHeight + 'px';

    // Met à l'échelle le contexte 2D pour correspondre au ratio
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    // Nettoie le pad (le redimensionnement efface le contenu existant)
    if (signaturePad) {
        signaturePad.clear();
    }

    // Remet le placeholder visible
    elements.canvasPlaceholder.classList.remove('is-hidden');

    // Met à jour le bouton (le canvas est maintenant vide)
    updateSubmitButton();
}

// ============================================================
// 5. INTERACTIONS — Boutons et validation
// ============================================================

/**
 * Met à jour l'état du bouton "Valider et Signer".
 * Le bouton est actif UNIQUEMENT si :
 *   - La case est cochée
 *   - ET le canvas n'est pas vide
 */
function updateSubmitButton() {
    if (!signaturePad || !elements.submitBtn) return;

    // Wait until initialization is fully complete (prevents enabling during checkTvaReduced)
    if (!elements.submitBtnSpinner.classList.contains('hidden')) {
        return;
    }

    const isChecked = elements.acceptCheckbox.checked;
    const hasSigned = !signaturePad.isEmpty() || hasStamp;

    let tvaValid = true;
    if (elements.tvaSection && !elements.tvaSection.classList.contains('hidden')) {
        tvaValid = elements.tvaCheckbox && elements.tvaCheckbox.checked;
    }

    elements.submitBtn.disabled = !(isChecked && hasSigned && tvaValid);
}

/**
 * Efface le canvas de signature et réinitialise l'état.
 */
function handleClear() {
    if (signaturePad) {
        signaturePad.clear();
    }
    hasStamp = false;
    elements.canvasPlaceholder.classList.remove('is-hidden');
    updateSubmitButton();
}

/**
 * Gère l'upload et le dessin du cachet d'entreprise sur le canvas.
 */
function handleStampUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = elements.signatureCanvas;
            const ctx = canvas.getContext('2d');

            // On récupère le ratio du canvas pour dessiner proprement
            const ratio = Math.max(window.devicePixelRatio || 1, 1);

            // Dimensions cibles (max 150px de large)
            const maxWidth = 150;
            const scale = Math.min(maxWidth / img.width, 1);
            const w = img.width * scale;
            const h = img.height * scale;

            // Centrage
            const x = (canvas.width / ratio - w) / 2;
            const y = (canvas.height / ratio - h) / 2;

            // Dessin sur le canvas
            ctx.drawImage(img, x, y, w, h);

            // Flag de présence de contenu
            hasStamp = true;

            // Masquer le placeholder car le canvas n'est plus vide
            elements.canvasPlaceholder.classList.add('is-hidden');

            // Activer le bouton de validation
            updateSubmitButton();

            // Réinitialiser l'input pour permettre de ré-uploader la même image
            elements.stampUpload.value = '';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================================
// 6. GÉNÉRATION DU PDF SIGNÉ ET ENVOI
// ============================================================

/**
 * Gère le clic sur "Valider et Signer" :
 * 1. Affiche un état de chargement.
 * 2. Génère le PDF signé (si un ID de PDF est présent).
 * 3. Prépare et envoie le payload final (avec le PDF en base64 si généré).
 * 4. Gère le succès ou l'erreur.
 */
async function handleSubmit() {
    // Sécurité : double vérification
    if (signaturePad.isEmpty() || !elements.acceptCheckbox.checked) {
        return;
    }

    const params = getUrlParams();
    if (!params) return; // Ne devrait jamais arriver ici si le bouton est actif

    setLoadingState(true, 'Initialisation...');
    let signedPdfBase64 = null;

    try {
        // --- Étape 1 : Génération du PDF signé (si applicable) ---
        if (params.pdf) {
            signedPdfBase64 = await generateSignedPDF(params.pdf);
        }

        // --- Étape 2 : Préparation du payload ---
        setLoadingState(true, 'Envoi de la signature...');
        const signatureBase64 = signaturePad.toDataURL('image/png');

        // Log de débogage pour la taille du PDF
        console.log('[DEBUG] Taille de signedPdfBase64 :', signedPdfBase64 ? signedPdfBase64.length : 'null');

        const payload = {
            devis: params.devis,
            client: params.client,
            email: params.email,
            signature: signatureBase64, // Signature brute (image)
            signedPdfBase64: signedPdfBase64, // PDF complet signé (base64)
            timestamp: new Date().toISOString(),
        };

        // --- Étape 3 : Envoi via fetch() ---
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            redirect: 'follow',
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        // --- Étape 4 : Gestion de la réponse ---
        if (result.status === 'error' && result.message === 'already_signed') {
            showAlreadySigned(params.devis);
        } else if (result.status === 'success' || response.ok) {
            showSuccess(params.devis);
        } else {
            throw new Error(result.message || 'Erreur inconnue du serveur.');
        }

    } catch (error) {
        console.error('Erreur lors du processus de signature :', error);
        alert('Une erreur est survenue lors de la signature. Veuillez réessayer.\n\nDétail : ' + error.message);
        setLoadingState(false);
    }
}


/**
 * Orchestre le téléchargement, la modification et la sérialisation du PDF.
 * @param {string} pdfId - L'ID Google Drive du fichier PDF.
 * @returns {Promise<string|null>} Le PDF signé en base64, ou null en cas d'erreur.
 */
async function generateSignedPDF(pdfId) {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    try {
        // --- Étape 1: Téléchargement du PDF via Proxy GAS (Bypass CORS/Drive) ---
        setLoadingState(true, 'Téléchargement du devis (via GAS)...');
        const proxyUrl = `${API_URL}?getFile=${encodeURIComponent(pdfId)}`;

        console.log(`[DEBUG] Tentative de téléchargement via GAS : ${proxyUrl}`);
        const response = await fetch(proxyUrl);
        const result = await response.json();

        if (!response.ok || result.status !== 'success') {
            throw new Error(`Le téléchargement via GAS a échoué : ${result.message || response.status}`);
        }

        // Conversion du Base64 reçu en ArrayBuffer
        const binaryString = window.atob(result.base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const pdfArrayBuffer = bytes.buffer;

        console.log('PDF téléchargé et décodé avec succès via GAS.');

        // --- Étape 2: Repérage des coordonnées avec pdf.js ---
        setLoadingState(true, 'Analyse du document...');
        // On passe une copie du buffer à pdf.js car il le "détache" (transfert) lors de l'analyse
        const signatureCoords = await findSignatureCoords(pdfArrayBuffer.slice(0));
        if (!signatureCoords) {
            throw new Error("La zone de signature ('Signature du client :') n'a pas été trouvée dans le PDF.");
        }
        console.log('Coordonnées identifiées pour l\'incrustation:', signatureCoords);

        // --- Étape 3: Incrustation avec pdf-lib ---
        setLoadingState(true, 'Incrustation de la signature...');
        const pdfDoc = await PDFDocument.load(pdfArrayBuffer);

        // Enregistrement de fontkit pour le support des polices personnalisées
        pdfDoc.registerFontkit(window.fontkit);

        const pages = pdfDoc.getPages();
        const page = pages[signatureCoords.pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        console.log(`[DEBUG] Page Size: ${pageWidth}x${pageHeight}, Index: ${signatureCoords.pageIndex}`);

        // Préparation des contenus (Signature + Polices)
        const signatureDataUri = signaturePad.toDataURL('image/png');

        // Fix : Conversion Manuelle du Base64 en Uint8Array pour pdf-lib (plus fiable que fetch ou string direct)
        const base64DataSig = signatureDataUri.split(',')[1];
        const binaryStringSig = window.atob(base64DataSig);
        const lenSig = binaryStringSig.length;
        const bytesSig = new Uint8Array(lenSig);
        for (let i = 0; i < lenSig; i++) {
            bytesSig[i] = binaryStringSig.charCodeAt(i);
        }

        const signatureImage = await pdfDoc.embedPng(bytesSig);

        // Téléchargement et intégration d'une police manuscrite
        const fontBytes = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/indieflower/IndieFlower-Regular.ttf').then(res => res.arrayBuffer());
        const handFont = await pdfDoc.embedFont(fontBytes);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Date du jour (JJ/MM/AAAA)
        const today = new Date().toLocaleDateString('fr-FR');

        // Récupération des coordonnées (X, Y) retournées par pdf.js
        const { x, y } = signatureCoords;
        console.log(`[DEBUG] Signature Placement - X: ${x}, Y: ${y}`);

        // 1. Dessin du texte "Lu et approuvé, bon pour accord" avec la police manuscrite
        page.drawText('Lu et approuvé, bon pour accord', {
            x: x,
            y: y + 25,
            font: handFont,
            size: 15, // Taille augmentée pour la police manuscrite
            color: rgb(0.06, 0.09, 0.16), // #0f172a
        });

        // 2. Dessin de la date à côté de "Le :"
        const dateX = signatureCoords.dateX || (x - 80);
        const dateY = signatureCoords.dateY || y;
        page.drawText(today, {
            x: dateX + 25,
            y: dateY,
            font: helveticaFont,
            size: 11,
            color: rgb(0.06, 0.09, 0.16),
        });

        // 3. Dessin de l'image de la signature
        const signatureWidth = 150;
        const signatureHeight = 50;

        console.log(`[DEBUG] Drawing Image at Y: ${y - signatureHeight - 5}`);

        page.drawImage(signatureImage, {
            x: x,
            y: y - signatureHeight - 5, // Juste en-dessous du texte "Signature du client :"
            width: signatureWidth,
            height: signatureHeight,
        });

        // 4. Dessin de la croix TVA si applicable
        if (elements.tvaCheckbox && elements.tvaCheckbox.checked && signatureCoords.mentionX !== null && signatureCoords.mentionPageIndex !== -1) {
            const mentionPage = pages[signatureCoords.mentionPageIndex];
            mentionPage.drawText('X', {
                x: signatureCoords.mentionX,
                y: signatureCoords.mentionY + 0.5, // Remonté très légèrement
                font: helveticaFont,
                size: 8, // Taille 8 pour être sûr que ça ne touche aucun bord
                color: rgb(0.06, 0.09, 0.16)
            });
            console.log(`[DEBUG] Croix de TVA dessinée à X:${signatureCoords.mentionX}, Y:${signatureCoords.mentionY}`);
        }

        console.log('PDF modifié avec succès.');

        // --- Étape 4: Sérialisation ---
        setLoadingState(true, 'Préparation de l\'envoi (Base64)...');
        // On exporte le PDF en base64 pur (sans le préfixe data:application/pdf;base64,)
        const pdfBase64 = await pdfDoc.saveAsBase64();
        return pdfBase64;

    } catch (error) {
        console.error("%c[ERREUR PDF] Échec de la génération du PDF signé:", "color: red; font-weight: bold;", error);
        // Retrait de l'alert() bloquante pour fluidifier l'expérience utilisateur
        return null;
    }
}

/**
 * Utilise pdf.js pour trouver les coordonnées du texte "Signature du client :".
 * @param {ArrayBuffer} pdfArrayBuffer - Le contenu du PDF.
 * @returns {Promise<Object|null>} Un objet { pageIndex, x, y } ou null si non trouvé.
 */
async function findSignatureCoords(pdfArrayBuffer) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
        const numPages = pdf.numPages;

        // Mots-clés plus courts pour éviter les problèmes de découpage de texte (Text-Split)
        const keywordSignature = "Signature";
        const keywordDate = "Le :";
        const keywordMention = "Mention obligatoire à cocher";

        let result = {
            pageIndex: -1,
            x: 0,
            y: 0,
            dateX: null,
            dateY: null,
            mentionX: null,
            mentionY: null,
            mentionPageIndex: -1
        };

        for (let i = 0; i < numPages; i++) {
            const page = await pdf.getPage(i + 1);
            const textContent = await page.getTextContent();
            const items = textContent.items;

            for (let j = 0; j < items.length; j++) {
                const str = items[j].str.trim();
                if (!str) continue;

                // Recherche robuste de la zone "Signature"
                if (str.includes(keywordSignature) && result.pageIndex === -1) {
                    result.pageIndex = i;
                    result.x = items[j].transform[4];
                    result.y = items[j].transform[5];
                    console.log(`[DEBUG] Trouvé "Signature" à la page ${i + 1} (X:${result.x}, Y:${result.y})`);
                }

                // Recherche robuste de la zone "Le :"
                if (str.includes(keywordDate)) {
                    result.dateX = items[j].transform[4];
                    result.dateY = items[j].transform[5];
                    console.log(`[DEBUG] Trouvé "Le :" à la page ${i + 1} (X:${result.dateX}, Y:${result.dateY})`);
                }

                // Recherche de la case TVA : "[  ]" ou "[]" 
                // (Le devis a une case unique sous cette forme)
                if ((str.includes("[") && str.includes("]")) && result.mentionPageIndex === -1) {

                    // On prend la coordonnée X du caractère `[`
                    // On prend la coordonnée X du caractère `[`
                    // X à +4.5 était un poil à gauche, X à +5.25 un poil à droite. Le juste milieu est à +4.7.
                    result.mentionX = items[j].transform[4] + 4.7;
                    result.mentionY = items[j].transform[5];
                    result.mentionPageIndex = i;
                    console.log(`[DEBUG] Trouvé case TVA "[]" à la page ${i + 1} (X:${result.mentionX}, Y:${result.mentionY})`);
                }
            }
        }

        if (result.pageIndex !== -1) return result;
        return null;
    } catch (err) {
        console.error("Erreur lors de l'analyse du PDF avec pdf.js :", err);
        return null;
    }
}


/**
 * Active ou désactive l'état de chargement du bouton principal.
 * @param {boolean} isLoading - true pour afficher le spinner.
 * @param {string} [message='Envoi en cours...'] - Le message à afficher.
 */
function setLoadingState(isLoading, message = 'Envoi en cours...') {
    if (isLoading) {
        elements.submitBtn.disabled = true;
        elements.submitBtnText.textContent = message;
        elements.submitBtnSpinner.classList.remove('hidden');
        // Désactiver aussi les autres interactions
        elements.clearBtn.disabled = true;
        elements.acceptCheckbox.disabled = true;
    } else {
        elements.submitBtnText.textContent = 'Valider et Signer';
        elements.submitBtnSpinner.classList.add('hidden');
        // Réactiver les interactions
        elements.clearBtn.disabled = false;
        elements.acceptCheckbox.disabled = false;
        updateSubmitButton();
    }
}

/**
 * Affiche la zone de succès et masque le formulaire.
 * @param {string} devisId - Numéro du devis pour l'afficher dans le badge.
 */
function showSuccess(devisId) {
    // Masque le formulaire entier
    elements.formSection.classList.add('hidden');

    // Affiche la zone de succès
    elements.successZone.style.display = 'block';
    elements.successDevisId.textContent = devisId;
}

// ============================================================
// DÉMARRAGE — Lancement au chargement de la page
// ============================================================

document.addEventListener('DOMContentLoaded', initPage);
