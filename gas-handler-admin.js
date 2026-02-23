// ============================================================
// 🚀 SARANGE - SYSTEME COMPLET SIGNATURE v2.7 (+ Admin Devis)
// ============================================================
//
// INSTRUCTIONS :
// 1. Copie-colle ce fichier ENTIER dans ton éditeur Apps Script
// 2. Redéploie : Déployer → Gérer les déploiements → ✏️ → Publier
//
// CE QUI A CHANGÉ vs v2.6 :
//   - Uniformisation parfaite de l'email de confirmation client
//   - Ajout des étapes numérotées (1. Acompte / 2. Prise de mesure)
//   - Copydesk plus vendeur, rassurant et orienté conversion
// ============================================================

const CONFIG = {
  INTERNAL_EMAIL: 'contact@sarange.fr',
  SENDER_NAME: 'SARANGE Menuiseries',
  SIGNATURE_PAGE_URL: 'https://signature.sarange.fr/',
  SHEET_SIGNATURES: 'Signatures',
  SHEET_FORM: 'Réponses au formulaire 1',
  DRIVE_FOLDER_ID: '1TslssfhTFaJ_I2-Hr2mqgtT8a7plnXZCt9_K00Zc8Nur6kjnEr8zJlC5nc8vSz-wZoBML0jb',
};

// ============================================================
// 📤 1. ENVOI DU DEVIS (déclencheur formulaire existant)
// ============================================================

function onFormSubmit(e) {
  try {
    const responses = e.values;
    const data = {
      devis: responses[1],
      name: responses[2],
      email: responses[3].trim().toLowerCase(),
      fileUrl: responses[4]
    };

    let pdfBlob = null;
    let fileId = '';

    try {
      fileId = data.fileUrl.match(/id=([a-zA-Z0-9_-]+)/)[1];
      pdfBlob = DriveApp.getFileById(fileId).getBlob();
    } catch (fError) { Logger.log('⚠️ Fichier PDF introuvable'); }

    const signatureLink = CONFIG.SIGNATURE_PAGE_URL +
      "?devis=" + encodeURIComponent(data.devis) +
      "&client=" + encodeURIComponent(data.name) +
      "&email=" + encodeURIComponent(data.email) +
      (fileId ? "&pdf=" + encodeURIComponent(fileId) : "");

    sendQuoteEmail(data, pdfBlob, signatureLink);
  } catch (error) { Logger.log('❌ ERREUR: ' + error.toString()); }
}

function sendQuoteEmail(data, pdfBlob, signatureLink) {
  const subject = `📝 Devis SARANGE n°${data.devis} – À valider`;
  const customerName = data.name;

  const htmlBody = `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(15, 23, 42, 0.05);">
    
    <div style="background-color: #0f172a; padding: 35px 20px; text-align: center; border-bottom: 4px solid #f97316;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px;">SARANGE<span style="color: #f97316;">.</span></h1>
      <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Menuiseries sur-mesure</p>
    </div>

    <div style="padding: 40px 30px;">
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Bonjour ${customerName},</h2>
      
      <p style="line-height: 1.6; color: #475569; font-size: 16px;">Veuillez trouver ci-joint votre devis <strong>n°${data.devis}</strong> concernant votre projet de menuiseries.</p>
      
      <p style="line-height: 1.6; color: #475569; font-size: 16px;">En tant que fabricant direct, notre priorité chez SARANGE est de vous garantir des menuiseries de haute qualité, sans intermédiaire, et toujours au juste prix.</p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f97316; padding: 25px; margin: 35px 0; border-radius: 8px;">
        <h3 style="margin-top: 0; margin-bottom: 20px; color: #0f172a; font-size: 16px;">
          🚀 Prochaines étapes pour valider la commande :
        </h3>
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
          <tr>
            <td width="40" valign="top">
              <div style="background-color: #f97316; color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-size: 14px; font-weight: bold;">1</div>
            </td>
            <td valign="top">
              <p style="margin: 0; color: #334155; line-height: 1.5; font-size: 15px;"><strong>Signez votre devis électroniquement</strong> sur notre plateforme 100% sécurisée en cliquant sur le bouton ci-dessous.</p>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" valign="top">
              <div style="background-color: #f97316; color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-size: 14px; font-weight: bold;">2</div>
            </td>
            <td valign="top">
              <p style="margin: 0; color: #334155; line-height: 1.5; font-size: 15px;"><strong>Procédez au règlement de l'acompte</strong> par virement bancaire pour bloquer la mise en production.</p>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${signatureLink}" style="background-color: #f97316; color: #ffffff; padding: 18px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.3);">
          🖋️ Consulter et signer mon devis en ligne
        </a>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px;">
          <h4 style="margin: 0; color: #0f172a; font-size: 16px;">💳 Coordonnées pour le virement</h4>
        </div>
        
        <p style="margin: 0 0 12px 0; color: #475569; font-size: 15px;">Bénéficiaire : <strong>SARANGE – BRED BANQUE POPULAIRE</strong></p>
        
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center; border: 1px dashed #cbd5e1;">
          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px;">IBAN</span>
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 18px; font-weight: bold; color: #0f172a; letter-spacing: 1.5px;">FR76 1010 7002 2500 0170 5433 705</span>
        </div>
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle">
              <p style="margin: 0; font-size: 15px; color: #475569;">BIC : <strong>BREDFRPPXXX</strong></p>
            </td>
            <td valign="middle" align="right" style="white-space: nowrap;">
              <span style="display: inline-block; font-size: 11px; background-color: #fff7ed; color: #c2410c; padding: 5px 8px; border-radius: 4px; font-weight: bold; border: 1px solid #fdba74; white-space: nowrap;">Réf: Devis n°${data.devis}</span>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 30px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #0f172a; font-weight: bold; font-size: 16px;">L'équipe SARANGE</p>
      <p style="margin: 0 0 15px 0; color: #64748b; font-size: 14px;">Une question ? Contactez-nous au <strong>09 86 71 34 44</strong></p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} SARANGE Menuiseries. Tous droits réservés.</p>
    </div>
  </div>`;

  let options = {
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    name: CONFIG.SENDER_NAME,
    replyTo: CONFIG.INTERNAL_EMAIL
  };

  if (pdfBlob) options.attachments = [pdfBlob];
  MailApp.sendEmail(options);
}

// ============================================================
// 📥 2. RÉCEPTION DE LA SIGNATURE
// ============================================================

function doGet(e) {
  if (e.parameter.check) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_SIGNATURES);

    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ signed: false })).setMimeType(ContentService.MimeType.JSON);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const devisList = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat();
      if (devisList.includes(e.parameter.check)) {
        return ContentService.createTextOutput(JSON.stringify({ signed: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ signed: false })).setMimeType(ContentService.MimeType.JSON);
  }

  // --- NOUVEAU : Bypass CORS pour récupérer le PDF ---
  if (e.parameter.getFile) {
    try {
      const file = DriveApp.getFileById(e.parameter.getFile);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        base64: base64,
        contentType: blob.getContentType()
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 🔍 HELPER : Retrouver le montant TTC depuis le Sheet
// ============================================================

function getTTCForDevis(devisNum) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_FORM);
    if (!sheet || sheet.getLastRow() < 2) return 0;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    for (const row of rows) {
      if (String(row[1]).trim() === String(devisNum).trim()) {
        return parseFloat(row[5]) || 0;
      }
    }
  } catch (e) {
    Logger.log('⚠️ getTTCForDevis: ' + e.toString());
  }
  return 0;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'admin_devis') {
      return ContentService
        .createTextOutput(JSON.stringify(handleAdminDevis(data)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_SIGNATURES);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_SIGNATURES);
      sheet.appendRow(['Date/Heure', 'N° Devis', 'Client', 'Email', 'Signature (Base64)', 'Timestamp Client']);
    }

    const devisAchercher = data.devis || '';
    if (devisAchercher !== '') {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const devisList = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat();
        if (devisList.includes(devisAchercher)) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'already_signed'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    sheet.appendRow([new Date(), data.devis || '', data.client || '', data.email || '', data.signature || '', data.timestamp || '']);

    // --- Traitement du PDF Signé ---
    let signedPdfBlob = null;
    if (data.signedPdfBase64) {
      try {
        let base64Data = data.signedPdfBase64;
        // Nettoyage si le préfixe data:application/pdf;base64, est présent
        if (base64Data.indexOf(',') > -1) {
          base64Data = base64Data.split(',')[1];
        }
        const decoded = Utilities.base64Decode(base64Data);
        signedPdfBlob = Utilities.newBlob(decoded, 'application/pdf', 'Devis_Signe_' + (data.devis || 'Sarange') + '.pdf');
      } catch (err) {
        Logger.log('⚠️ Erreur lors du décodage du PDF signé : ' + err.toString());
      }
    }

    // Email confirmation client
    if (data.email) {
      const clientName = data.client;

      if (!data.totalTTC) {
        data.totalTTC = getTTCForDevis(data.devis);
      }

      const ttcNum = parseFloat((data.totalTTC || '0').toString().replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
      const acompte = (ttcNum * 0.5).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const ttcFormatted = ttcNum.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Bloc dynamique : Affiche les montants si TTC connu, sinon juste le RIB pour payer l'acompte.
      const acompteBlock = ttcNum > 0 ? `
              <div style="background-color: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 18px; margin: 12px 0 20px 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
                  <div>
                    <p style="margin: 0 0 2px 0; color: #64748b; font-size: 13px;">Montant total TTC</p>
                    <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">${ttcFormatted} €</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0 0 2px 0; color: #64748b; font-size: 13px;">Acompte à verser (50%)</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 900; color: #f97316;">${acompte} €</p>
                  </div>
                </div>
                <div style="background: #ffffff; border: 1px dashed #fcd8a4; border-radius: 6px; padding: 12px; margin-bottom: 10px;">
                  <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">IBAN – BRED BANQUE POPULAIRE</span>
                  <span style="font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #0f172a; letter-spacing: 0.5px;">FR76 1010 7002 2500 0170 5433 705</span>
                  <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">BIC : <strong>BREDFRPPXXX</strong> &nbsp;·&nbsp; Bénéficiaire : <strong>SARANGE</strong></p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #f97316; font-weight: bold;">Réf. virement : Devis n°${data.devis}</p>
                </div>
                <p style="margin: 0; font-size: 11px; color: #94a3b8; font-style: italic;">
                  ✓ Si vous avez déjà effectué ce virement, merci d'ignorer ce message.
                </p>
              </div>` : `
              <div style="background-color: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 18px; margin: 12px 0 20px 0;">
                <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;"><strong>Coordonnées bancaires pour le virement de votre acompte (50%) :</strong></p>
                <div style="background: #ffffff; border: 1px dashed #fcd8a4; border-radius: 6px; padding: 12px; margin-bottom: 10px;">
                  <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">IBAN – BRED BANQUE POPULAIRE</span>
                  <span style="font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #0f172a; letter-spacing: 0.5px;">FR76 1010 7002 2500 0170 5433 705</span>
                  <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">BIC : <strong>BREDFRPPXXX</strong> &nbsp;·&nbsp; Bénéficiaire : <strong>SARANGE</strong></p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #f97316; font-weight: bold;">Réf. virement : Devis n°${data.devis}</p>
                </div>
                <p style="margin: 0; font-size: 11px; color: #94a3b8; font-style: italic;">
                  ✓ Si vous avez déjà effectué ce virement, merci d'ignorer ce message.
                </p>
              </div>`;

      const clientHtmlBody = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(15, 23, 42, 0.05);">
        
        <div style="background-color: #0f172a; padding: 30px 20px; text-align: center; border-bottom: 4px solid #22c55e;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -1px;">SARANGE<span style="color: #f97316;">.</span></h1>
        </div>
        
        <div style="padding: 40px 30px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
            <h2 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 800;">Félicitations, commande validée !</h2>
          </div>

          <p style="line-height: 1.6; color: #475569; font-size: 16px;">Bonjour <strong>${clientName}</strong>,</p>
          <p style="line-height: 1.6; color: #475569; font-size: 16px;">Nous vous confirmons la bonne réception de votre signature électronique pour le devis <strong>n°${data.devis}</strong>. Toute l'équipe SARANGE vous remercie pour votre confiance.</p>
          <p style="line-height: 1.6; color: #475569; font-size: 16px;">Votre projet de menuiseries sur-mesure est désormais officiellement lancé.</p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #22c55e; padding: 25px; margin: 35px 0; border-radius: 8px;">
            <h3 style="margin-top: 0; margin-bottom: 20px; color: #0f172a; font-size: 16px;">
              🚀 La suite de votre projet en 2 étapes :
            </h3>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
              <tr>
                <td width="40" valign="top">
                  <div style="background-color: #f97316; color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-size: 14px; font-weight: bold;">1</div>
                </td>
                <td valign="top">
                  <p style="margin: 0 0 8px 0; color: #334155; line-height: 1.5; font-size: 15px;"><strong>Règlement de l'acompte de 50%</strong></p>
                  <p style="margin: 0 0 10px 0; color: #475569; line-height: 1.5; font-size: 14px;">Afin de bloquer le planning et de lancer la mise en production, merci de procéder au virement de votre acompte.</p>
                  ${acompteBlock}
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40" valign="top">
                  <div style="background-color: #f97316; color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-size: 14px; font-weight: bold;">2</div>
                </td>
                <td valign="top">
                  <p style="margin: 0 0 8px 0; color: #334155; line-height: 1.5; font-size: 15px;"><strong>Prise de mesures (Métré)</strong></p>
                  <p style="margin: 0; color: #475569; line-height: 1.5; font-size: 14px;">Si votre projet inclut la pose par nos soins, notre expert technique vous contactera très rapidement pour fixer un rendez-vous de métré définitif à votre domicile. C'est la garantie d'une installation parfaite !</p>
                </td>
              </tr>
            </table>
          </div>

          <p style="line-height: 1.6; color: #475569; font-size: 15px;">Une question ? Contactez-nous au <strong>09 86 71 34 44</strong> ou répondez directement à cet email.</p>
          <p style="line-height: 1.6; color: #0f172a; font-size: 16px; margin: 24px 0 0 0;">À très bientôt,<br><strong>L'équipe SARANGE</strong></p>
        </div>
        
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} SARANGE Menuiseries — 28 rue Jean Rostand, Combs-la-Ville 77380</p>
        </div>
      </div>`;

      const clientMailOptions = {
        to: data.email,
        subject: `🎉 Merci ! Commande validée - Devis n°${data.devis}`,
        htmlBody: clientHtmlBody,
        name: CONFIG.SENDER_NAME
      };

      if (signedPdfBlob) {
        clientMailOptions.attachments = [signedPdfBlob];
      }

      MailApp.sendEmail(clientMailOptions);
    }

    // Email notification interne
    const internalHtmlBody = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 4px solid #3b82f6;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -1px;">SARANGE<span style="color: #f97316;">.</span> <span style="color: #64748b; font-weight: normal; font-size: 16px;">| NOTIFICATION</span></h1>
      </div>
      <div style="padding: 30px;">
        <h2 style="margin-top: 0; color: #0f172a; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;">
          ✍️ Nouvelle signature reçue
        </h2>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Client</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 16px; font-weight: bold;">${data.client}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Email</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 15px;"><a href="mailto:${data.email}" style="color: #f97316; text-decoration: none;">${data.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Devis N°</td>
              <td style="padding: 10px 0; color: #f97316; font-size: 16px; font-weight: bold;">${data.devis}</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <a href="${ss.getUrl()}" style="background-color: #0f172a; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ouvrir le Google Sheet →</a>
        </div>
      </div>
    </div>`;

    const internalMailOptions = {
      to: CONFIG.INTERNAL_EMAIL,
      subject: `🚀 CONTRAT SIGNÉ : ${data.client} (${data.devis})`,
      htmlBody: internalHtmlBody
    };

    if (signedPdfBlob) {
      internalMailOptions.attachments = [signedPdfBlob];
    }

    MailApp.sendEmail(internalMailOptions);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 📋 3. HANDLER ADMIN DEVIS (v3 — Drive upload côté navigateur)
// ============================================================

function handleAdminDevis(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const errors = [];

  const fileId = data.fileId || '';
  const driveUrl = data.driveUrl || (fileId ? 'https://drive.google.com/file/d/' + fileId + '/view' : '');

  try {
    const sheet = ss.getSheetByName(CONFIG.SHEET_FORM);
    if (sheet) {
      sheet.appendRow([
        data.horodateur || new Date().toLocaleString('fr-FR'),
        data.devis || '',
        data.client || '',
        data.email || '',
        driveUrl,
        data.totalTTC || ''
      ]);
    } else {
      errors.push('SHEET: Onglet "' + CONFIG.SHEET_FORM + '" introuvable');
    }
  } catch (e) {
    errors.push('SHEET: ' + e.toString());
  }

  try {
    let pdfBlob = null;
    if (fileId) {
      try {
        pdfBlob = DriveApp.getFileById(fileId).getBlob();
      } catch (driveErr) {
        Logger.log('⚠️ Impossible de récupérer le PDF depuis Drive : ' + driveErr.toString());
      }
    }

    const signatureLink = CONFIG.SIGNATURE_PAGE_URL +
      '?devis=' + encodeURIComponent(data.devis || '') +
      '&client=' + encodeURIComponent(data.client || '') +
      '&email=' + encodeURIComponent(data.email || '') +
      (fileId ? '&pdf=' + encodeURIComponent(fileId) : '') +
      (typeof data.tvaReduced !== 'undefined' ? (data.tvaReduced ? '&tva=1' : '&tva=0') : '');

    sendQuoteEmail({
      devis: data.devis || '',
      name: data.client || '',
      email: data.email || '',
    }, pdfBlob, signatureLink);

  } catch (e) {
    errors.push('EMAIL: ' + e.toString());
  }

  return {
    status: errors.length === 0 ? 'success' : 'partial',
    driveUrl: driveUrl,
    errors: errors,
    message: errors.length === 0
      ? 'Devis traité : Sheet ✓ | Email ✓'
      : 'Erreurs : ' + errors.join(' | ')
  };
}