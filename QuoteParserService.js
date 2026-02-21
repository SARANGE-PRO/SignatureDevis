/**
 * QuoteParserService.js — Extraction données client devis Sarange
 * Usage local : extraction du N° devis, nom, email, adresse, total TTC
 * depuis le texte brut d'un PDF (via pdf.js).
 */

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

class QuoteParserService {
    constructor() {
        this.pdfjsLib = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        if (typeof window.pdfjsLib === "undefined") {
            await this._loadScript(PDFJS_URL);
        }
        this.pdfjsLib = window.pdfjsLib;
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
        this.isInitialized = true;
    }

    _loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Extrait les informations client depuis le texte brut du PDF.
     * Retourne : { number, name, address, email, totalTTC, date }
     *
     * Structure type d'un devis Sarange :
     *   Ligne 1 : NOM CLIENT (ex: "DA TRAVAUX")
     *   Ligne 2 : ADRESSE (ex: "59 RUE DE PONTHIEU")
     *   Ligne 3 : CODE POSTAL + VILLE (ex: "75008 PARIS 08")
     *   ...
     *   "Devis N° XXXXXX"
     *   "Mail client : xxx@xxx.com"
     *   "MONTANT TOTAL T.T.C.  XX XXX,XX €"
     */
    extractClientInfo(text) {
        const info = { number: "", name: "", address: "", email: "", totalTTC: "", date: "" };

        // --- N° Devis ---
        const numberMatch = text.match(/Devis\s*N[°o.\s]*\s*0*(\d{4,6})/i);
        if (numberMatch) info.number = numberMatch[1];

        // --- Email (spécifiquement "Mail client :" pour éviter de capter les mails Sarange) ---
        const mailClientMatch = text.match(/Mail\s+client\s*:\s*([a-zA-Z0-9._\-+]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,6})/i);
        if (mailClientMatch) {
            info.email = mailClientMatch[1].trim();
        } else {
            // Fallback : premier email trouvé qui n'est PAS contact@sarange
            const allEmails = text.match(/[a-zA-Z0-9._\-+]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,6}/g) || [];
            const clientEmail = allEmails.find(e => !/contact@sarange/i.test(e));
            if (clientEmail) info.email = clientEmail;
        }

        // --- Nom Client + Adresse = lignes AVANT "Devis N°" ---
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const devisLineIdx = lines.findIndex(l => /Devis\s*N[°o.\s]*\s*\d/i.test(l));

        if (devisLineIdx > 0) {
            const headerLines = lines.slice(0, devisLineIdx);
            info.name = headerLines[0] || "";
            if (headerLines.length > 1) {
                info.address = headerLines.slice(1).join(', ');
            }
        }

        // --- Montant Total TTC ---
        const ttcMatch = text.match(/MONTANT\s+TOTAL\s+T\.?T\.?C\.?\s*([\d\s]+,\d{2})\s*€?/i);
        if (ttcMatch) {
            info.totalTTC = ttcMatch[1].replace(/\s/g, ' ').trim();
        }

        // --- Date du devis ---
        const dateMatch = text.match(/LE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (dateMatch) info.date = dateMatch[1];

        return info;
    }
}

// Export pour usage ES module (import) OU browser global (script tag)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = new QuoteParserService();
} else {
    window.quoteParser = new QuoteParserService();
}
