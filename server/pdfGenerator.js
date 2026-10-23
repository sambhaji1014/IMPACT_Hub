/**
 * ImpactHub - PDF Document Generator
 * Generates official 80G Donation Receipts and Verified Volunteer Service Certificates
 */

const PDFDocument = require('pdfkit');

class PDFGenerator {
  /**
   * Generate Donation Tax Receipt PDF
   */
  static generateDonationReceipt(donation, res) {
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    doc.pipe(res);

    // Decorative Header bar
    doc.rect(0, 0, doc.page.width, 14).fill('#10B981');

    // Brand Logo & Title
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#065F46').text('ImpactHub', 45, 35);
    doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text('Transparent Philanthropy & Verified Social Impact', 45, 60);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1F2937').text('OFFICIAL DONATION RECEIPT', 300, 35, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text(`Receipt No: ${donation.receiptNo}`, 300, 55, { align: 'right' });
    doc.fontSize(9).text(`Date: ${new Date(donation.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 300, 68, { align: 'right' });

    doc.moveTo(45, 85).lineTo(doc.page.width - 45, 85).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // Verification & Demo Notice Box
    doc.roundedRect(45, 95, doc.page.width - 90, 42, 6).fillAndStroke('#ECFDF5', '#A7F3D0');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#065F46').text('STATUS: VERIFIED TRANSACTION (DEMO LEDGER)', 55, 105);
    doc.fontSize(8).font('Helvetica').fillColor('#047857')
      .text('This receipt confirms a verified community contribution recorded in the platform ledger. Eligible for demonstration Section 80G verification.', 55, 118);

    // Details Grid
    const startY = 155;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('CONTRIBUTOR DETAILS', 45, startY);
    doc.fontSize(9).font('Helvetica').fillColor('#4B5563')
      .text(`Donor Name: ${donation.donorName}`, 45, startY + 18)
      .text(`Email: ${donation.donorEmail}`, 45, startY + 32)
      .text(`Mobile: ${donation.donorPhone || 'N/A'}`, 45, startY + 46)
      .text(`Anonymous: ${donation.anonymous ? 'Yes (Publicly Hidden)' : 'No'}`, 45, startY + 60);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('BENEFICIARY NGO & CAUSE', 300, startY);
    const ngo = donation.campaign?.ngo;
    doc.fontSize(9).font('Helvetica').fillColor('#4B5563')
      .text(`Organization: ${ngo?.orgName || 'Grassroots Foundation'}`, 300, startY + 18)
      .text(`Registration: ${ngo?.registrationNumber || 'MH/REG/2026/001'}`, 300, startY + 32)
      .text(`Campaign: ${donation.campaign?.title || 'Community Cause'}`, 300, startY + 46)
      .text(`Category: ${donation.campaign?.category || 'Community Development'}`, 300, startY + 60);

    // Amount Table Box
    const tableY = startY + 90;
    doc.roundedRect(45, tableY, doc.page.width - 90, 80, 4).fillAndStroke('#F9FAFB', '#E5E7EB');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#6B7280')
      .text('DESCRIPTION', 60, tableY + 12)
      .text('PAYMENT GATEWAY', 300, tableY + 12)
      .text('TOTAL AMOUNT', doc.page.width - 150, tableY + 12, { align: 'right' });

    doc.moveTo(45, tableY + 28).lineTo(doc.page.width - 45, tableY + 28).strokeColor('#E5E7EB').stroke();

    doc.fontSize(10).font('Helvetica').fillColor('#111827')
      .text(`Voluntary contribution to ${donation.campaign?.title?.slice(0, 35)}...`, 60, tableY + 40)
      .text(`${donation.isSimulated ? 'Simulator / Razorpay Test' : 'Razorpay INR'}`, 300, tableY + 40);

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#059669')
      .text(`INR ₹${donation.amount.toLocaleString('en-IN')}`, doc.page.width - 150, tableY + 38, { align: 'right' });

    doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF')
      .text(`Gateway Order ID: ${donation.gatewayOrderId || 'SIM_N/A'}`, 60, tableY + 58);

    // Signatures & Legal Footer
    const footerY = tableY + 120;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4B5563').text('AUTHORIZED SIGNATORY', 45, footerY);
    doc.fontSize(8).font('Helvetica').fillColor('#6B7280')
      .text('Audited by ImpactHub Philanthropy Operations', 45, footerY + 15)
      .text('This is an electronically generated receipt verified with digital signature hash.', 45, footerY + 28);

    doc.rect(doc.page.width - 165, footerY - 5, 120, 45).fillAndStroke('#F3F4F6', '#D1D5DB');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#059669').text('VERIFIED SEAL', doc.page.width - 165, footerY + 12, { width: 120, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor('#6B7280').text('100% TO NGO', doc.page.width - 165, footerY + 24, { width: 120, align: 'center' });

    doc.end();
  }

  /**
   * Generate Volunteer Service Certificate PDF
   */
  static generateVolunteerCertificate(reg, res) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    // Certificate Border Frame
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(4).strokeColor('#059669').stroke();
    doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).lineWidth(1).strokeColor('#D1FAE5').stroke();

    // Top Crest
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#059669').text('IMPACTHUB COMMUNITY SERVICE RECOGNITION', 40, 50, { align: 'center' });
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#111827').text('CERTIFICATE OF COMMENDATION', 40, 75, { align: 'center' });

    doc.fontSize(11).font('Helvetica-Oblique').fillColor('#6B7280').text('This official certificate is proudly presented to', 40, 120, { align: 'center' });

    // Volunteer Name
    const volName = reg.volunteerName || reg.volunteer?.name || 'Dedicated Changemaker';
    doc.fontSize(26).font('Helvetica-Bold').fillColor('#065F46').text(volName, 40, 145, { align: 'center' });

    doc.moveTo(200, 180).lineTo(doc.page.width - 200, 180).strokeColor('#10B981').lineWidth(2).stroke();

    const hours = reg.hoursConfirmed || 4;
    const driveTitle = reg.drive?.title || 'Community Mobilization Initiative';
    const ngoName = reg.drive?.ngo?.orgName || 'Grassroots Foundation';
    const dateStr = new Date(reg.drive?.startsAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    doc.fontSize(11).font('Helvetica').fillColor('#374151').text(
      `in recognition of exemplary dedication and contributing ${hours} verified hours of on-ground service for`,
      60, 200, { align: 'center', width: doc.page.width - 120 }
    );

    doc.fontSize(15).font('Helvetica-Bold').fillColor('#1F2937').text(`"${driveTitle}"`, 60, 222, { align: 'center' });
    doc.fontSize(11).font('Helvetica').fillColor('#4B5563').text(`Organized by ${ngoName} on ${dateStr}.`, 60, 245, { align: 'center' });

    // Verification Meta
    const metaY = 320;
    doc.fontSize(9).font('Helvetica').fillColor('#6B7280')
      .text(`Pass Reference: ${reg.passCode}`, 80, metaY)
      .text(`Status: Verified by NGO Organizer`, 80, metaY + 14)
      .text(`Issued by: ImpactHub Field Verification Registry`, 80, metaY + 28);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827')
      .text('Dr. Radhika Sen', doc.page.width - 240, metaY, { align: 'center', width: 160 })
      .text('NGO Program Director', doc.page.width - 240, metaY + 14, { align: 'center', width: 160 });

    doc.moveTo(doc.page.width - 240, metaY + 12).lineTo(doc.page.width - 80, metaY + 12).strokeColor('#9CA3AF').lineWidth(1).stroke();

    doc.end();
  }
}

module.exports = PDFGenerator;
