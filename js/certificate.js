/**
 * HopeConnect AI - Dynamic Volunteer Certificate Generator (HTML5 Canvas)
 */

document.addEventListener('DOMContentLoaded', () => {
  initCertificateGenerator();
});

function initCertificateGenerator() {
  const canvas = document.getElementById('certificateCanvas');
  const nameInput = document.getElementById('certVolunteerName');
  const updateBtn = document.getElementById('updateCertBtn');
  const downloadBtn = document.getElementById('downloadCertBtn');

  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  function drawCertificate(recipientName = 'Aarav Sharma', hours = 48) {
    // Canvas dimensions (A4 Landscape aspect ratio)
    canvas.width = 1200;
    canvas.height = 840;

    // Background fill
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Elegant Outer Border
    ctx.strokeStyle = '#E9B949';
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    // Inner Delicate Border
    ctx.strokeStyle = '#243038';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

    // Corner Ornaments
    drawCornerRibbon(ctx, 52, 52);
    drawCornerRibbon(ctx, canvas.width - 52, 52, true);

    // Header Branding
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E27339';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('HOPECONNECT AI ECOSYSTEM', canvas.width / 2, 110);

    // Title
    ctx.fillStyle = '#243038';
    ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CERTIFICATE OF SOCIAL IMPACT', canvas.width / 2, 175);

    // Subtitle
    ctx.fillStyle = '#5C6B73';
    ctx.font = '18px "Inter", sans-serif';
    ctx.fillText('THIS PRESTIGIOUS CITATION IS PROUDLY PRESENTED TO', canvas.width / 2, 230);

    // Recipient Name
    ctx.fillStyle = '#1B262C';
    ctx.font = 'bold 48px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(recipientName.toUpperCase(), canvas.width / 2, 310);

    // Decorative underline under name
    ctx.strokeStyle = '#E9B949';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 250, 335);
    ctx.lineTo(canvas.width / 2 + 250, 335);
    ctx.stroke();

    // Body Text
    ctx.fillStyle = '#445159';
    ctx.font = '20px "Inter", sans-serif';
    const bodyText1 = `In recognition of dedicated commitment, leadership, and contributing over`;
    const bodyText2 = `${hours} Verified Hours of Community Volunteering and Social Impact Drives`;
    const bodyText3 = `organized through partner NGOs on HopeConnect AI platform.`;

    ctx.fillText(bodyText1, canvas.width / 2, 400);
    ctx.fillStyle = '#5B9A6A';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(bodyText2, canvas.width / 2, 440);
    ctx.fillStyle = '#445159';
    ctx.font = '20px "Inter", sans-serif';
    ctx.fillText(bodyText3, canvas.width / 2, 480);

    // Gold Seal
    drawGoldSeal(ctx, canvas.width / 2, 590);

    // Signatures & Date
    const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Left: Date
    ctx.textAlign = 'left';
    ctx.fillStyle = '#243038';
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(todayStr, 140, 720);
    ctx.strokeStyle = '#A0AAB0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(140, 700);
    ctx.lineTo(340, 700);
    ctx.stroke();
    ctx.font = '14px "Inter", sans-serif';
    ctx.fillStyle = '#78848C';
    ctx.fillText('DATE OF ISSUANCE', 140, 742);

    // Right: Authorized Signature
    ctx.textAlign = 'right';
    ctx.fillStyle = '#243038';
    ctx.font = 'italic bold 22px "Brush Script MT", cursive, sans-serif';
    ctx.fillText('Dr. Radhika Sen', canvas.width - 140, 690);
    ctx.strokeStyle = '#A0AAB0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(canvas.width - 340, 700);
    ctx.lineTo(canvas.width - 140, 700);
    ctx.stroke();
    ctx.font = '14px "Inter", sans-serif';
    ctx.fillStyle = '#78848C';
    ctx.fillText('DIRECTOR, HOPECONNECT AI ALLIANCE', canvas.width - 140, 742);
  }

  function drawCornerRibbon(ctx, x, y, flip = false) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.fillStyle = '#E9B949';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(40, 0);
    ctx.lineTo(0, 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGoldSeal(ctx, cx, cy) {
    ctx.save();
    // Starburst Outer
    ctx.fillStyle = '#E9B949';
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fill();

    // Inner Circle
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();

    // Text in Seal
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8C6A12';
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('OFFICIALLY', cx, cy - 8);
    ctx.fillText('VERIFIED', cx, cy + 5);
    ctx.fillText('★ ★ ★', cx, cy + 18);
    ctx.restore();
  }

  // Initial draw using active logged-in user
  const currentUser = window.HCStore ? window.HCStore.getCurrentUser() : null;
  const initialName = (currentUser && currentUser.name) ? currentUser.name : 'Aarav Sharma';
  if (nameInput) nameInput.value = initialName;

  const stats = window.HCStore ? window.HCStore.getUserStats() : { volunteerHours: 48 };
  drawCertificate(initialName, stats.volunteerHours || 48);

  window.drawCertificate = drawCertificate;

  if (updateBtn && nameInput) {
    updateBtn.addEventListener('click', () => {
      const name = nameInput.value.trim() || initialName;
      const currentStats = window.HCStore ? window.HCStore.getUserStats() : { volunteerHours: 48 };
      drawCertificate(name, currentStats.volunteerHours || 48);
      window.showToast(`Certificate customized for "${name}"`, 'info', 'fas fa-pen-nib');
    });
  }

  // Auto-update certificate when user or badge unlocks change
  window.addEventListener('hc:auth-changed', () => {
    const u = window.HCStore.getCurrentUser();
    const st = window.HCStore.getUserStats();
    const n = u ? u.name : 'Aarav Sharma';
    if (nameInput) nameInput.value = n;
    drawCertificate(n, st.volunteerHours || 48);
  });

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      const activeName = (nameInput ? nameInput.value.trim() : '') || 'HopeConnect_Volunteer';
      link.download = `HopeConnect_Certificate_${activeName.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      window.showToast('🏆 High-Resolution Volunteer Certificate downloaded successfully!', 'success', 'fas fa-download');
    });
  }
}
