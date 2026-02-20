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

/** Références aux éléments du DOM (initialisées dans initPage) */
let elements = {};

// ============================================================
// 1. URL PARSING — Lecture des paramètres de l'URL
// ============================================================

/**
 * Extrait les paramètres de l'URL courante.
 * @returns {Object|null} Objet { devis, client, email } ou null si incomplet.
 */
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const devis = params.get('devis');
    const client = params.get('client');
    const email = params.get('email');

    // Vérifie que les trois paramètres obligatoires sont présents
    if (!devis || !client || !email) {
        return null;
    }

    return { devis, client, email };
}

// ============================================================
// 2. INITIALISATION DE LA PAGE
// ============================================================

/**
 * Point d'entrée principal. Initialise la page en fonction
 * de la présence ou non des paramètres URL.
 */
function initPage() {
    // Récupération des références DOM
    elements = {
        formSection: document.getElementById('form-section'),
        errorZone: document.getElementById('error-zone'),
        successZone: document.getElementById('success-zone'),
        clientName: document.getElementById('client-name'),
        clientEmail: document.getElementById('client-email'),
        devisNumber: document.getElementById('devis-number'),
        signatureCanvas: document.getElementById('signature-canvas'),
        canvasPlaceholder: document.getElementById('canvas-placeholder'),
        acceptCheckbox: document.getElementById('accept-checkbox'),
        submitBtn: document.getElementById('submit-btn'),
        submitBtnText: document.getElementById('submit-btn-text'),
        submitBtnSpinner: document.getElementById('submit-btn-spinner'),
        clearBtn: document.getElementById('clear-btn'),
        successDevisId: document.getElementById('success-devis-id'),
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

    // Initialisation du pad de signature
    initSignaturePad();

    // Écoute des interactions : checkbox, bouton effacer, bouton valider
    elements.acceptCheckbox.addEventListener('change', updateSubmitButton);
    elements.clearBtn.addEventListener('click', handleClear);
    elements.submitBtn.addEventListener('click', handleSubmit);

    // Mise à jour initiale de l'état du bouton
    updateSubmitButton();
}

// ============================================================
// 3. SIGNATURE PAD — Initialisation et redimensionnement
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
// 4. INTERACTIONS — Boutons et validation
// ============================================================

/**
 * Met à jour l'état du bouton "Valider et Signer".
 * Le bouton est actif UNIQUEMENT si :
 *   - La case est cochée
 *   - ET le canvas n'est pas vide
 */
function updateSubmitButton() {
    if (!signaturePad || !elements.submitBtn) return;

    const isChecked = elements.acceptCheckbox.checked;
    const hasSigned = !signaturePad.isEmpty();

    elements.submitBtn.disabled = !(isChecked && hasSigned);
}

/**
 * Efface le canvas de signature et réinitialise l'état.
 */
function handleClear() {
    if (signaturePad) {
        signaturePad.clear();
    }
    elements.canvasPlaceholder.classList.remove('is-hidden');
    updateSubmitButton();
}

// ============================================================
// 5. ENVOI DES DONNÉES — Appel API vers Google Apps Script
// ============================================================

/**
 * Gère le clic sur "Valider et Signer" :
 * 1. Affiche un état de chargement
 * 2. Extrait l'image en base64
 * 3. Prépare et envoie le payload JSON
 * 4. Gère le succès ou l'erreur
 */
async function handleSubmit() {
    // Sécurité : double vérification
    if (signaturePad.isEmpty() || !elements.acceptCheckbox.checked) {
        return;
    }

    const params = getUrlParams();
    if (!params) return;

    // --- 1. État de chargement ---
    setLoadingState(true);

    // --- 2. Extraction de la signature en base64 ---
    const signatureBase64 = signaturePad.toDataURL('image/png');

    // --- 3. Préparation du payload ---
    const payload = {
        devis: params.devis,
        client: params.client,
        email: params.email,
        signature: signatureBase64,
        timestamp: new Date().toISOString(),
    };

    try {
        // --- 4. Envoi via fetch() ---
        // IMPORTANT POUR GOOGLE APPS SCRIPT :
        // - Content-Type: text/plain pour éviter les blocages CORS (preflight)
        // - redirect: "follow" pour suivre les redirections GAS
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            redirect: 'follow',
            body: JSON.stringify(payload),
        });

        // Lecture de la réponse
        const result = await response.json();

        if (result.status === 'success' || response.ok) {
            // --- 5. Succès → Affichage du message de confirmation ---
            showSuccess(params.devis);
        } else {
            throw new Error(result.message || 'Erreur inconnue du serveur.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi :', error);
        alert('Une erreur est survenue lors de l\'envoi de votre signature. Veuillez réessayer.\n\nDétail : ' + error.message);
        setLoadingState(false);
    }
}

/**
 * Active ou désactive l'état de chargement du bouton principal.
 * @param {boolean} isLoading - true pour afficher le spinner.
 */
function setLoadingState(isLoading) {
    if (isLoading) {
        elements.submitBtn.disabled = true;
        elements.submitBtnText.textContent = 'Envoi en cours...';
        elements.submitBtnSpinner.classList.remove('hidden');
    } else {
        elements.submitBtnText.textContent = 'Valider et Signer';
        elements.submitBtnSpinner.classList.add('hidden');
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
