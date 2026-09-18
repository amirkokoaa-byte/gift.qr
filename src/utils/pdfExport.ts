import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { CustomerRecord, CampaignSettings } from '../types';

/**
 * Clean helper to trigger a bulletproof PDF download that works inside
 * iframes, mobile browsers, and desktop environments alike.
 */
function downloadPdfBlob(pdf: jsPDF, filename: string) {
  try {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.warn('Blob download fallback to direct save:', err);
    pdf.save(filename);
  }
}

/**
 * Generates and downloads the Complete Campaign Customers Report PDF.
 * Uses strict inline hex colors to prevent Tailwind v4 oklch() canvas parser errors.
 */
export async function exportFullReportPDF(
  customers: CustomerRecord[],
  settings: CampaignSettings,
  stats: {
    totalCapacity: number;
    claimedCount: number;
    remainingCount: number;
    percentage: number;
    min: number;
    max: number;
  }
): Promise<void> {
  if (customers.length === 0) {
    throw new Error('لا توجد بيانات عملاء مسجلة للتصدير حالياً.');
  }

  // Create clean isolated container off-screen
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '1100px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.padding = '36px';
  container.style.direction = 'rtl';
  container.style.zIndex = '-9999';

  const rowsHtml = customers
    .map(
      (c, i) => `
      <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 14px; text-align: center; font-weight: bold; color: #64748b; font-family: monospace;">${i + 1}</td>
        <td style="padding: 12px 14px; font-weight: bold; color: #0f172a; font-size: 14px;">${escapeHtml(c.customerName)}</td>
        <td style="padding: 12px 14px; font-family: monospace; color: #334155; font-size: 13px; text-align: left;" dir="ltr">${escapeHtml(c.phoneNumber)}</td>
        <td style="padding: 12px 14px; text-align: center;">
          <span style="display: inline-block; padding: 4px 14px; border-radius: 8px; background-color: #ecfdf5; color: #065f46; font-weight: 900; font-family: monospace; font-size: 15px; border: 1px solid #a7f3d0;">
            #${c.giftNumber}
          </span>
        </td>
        <td style="padding: 12px 14px; color: #475569; font-size: 13px;">
          ${escapeHtml(c.formattedDate || new Date(c.timestamp).toLocaleString('ar-EG'))}
        </td>
      </tr>
    `
    )
    .join('');

  container.innerHTML = `
    <div style="border-bottom: 3px solid #14382c; padding-bottom: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 64px; height: 64px; border-radius: 16px; background-color: #14382c; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 30px;">
          🌹
        </div>
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #14382c;">
            ${escapeHtml(settings.companyName || 'شركة سوفت روز انترناشيونال')}
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569; font-weight: bold;">
            تقرير حملة توزيع الهدايا الرسمي • لصناعة الورق والبلاستيك
          </p>
        </div>
      </div>
      <div style="text-align: left;" dir="ltr">
        <div style="font-size: 12px; font-family: monospace; color: #64748b; font-weight: bold;">
          Export Date: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}
        </div>
        <div style="font-size: 13px; font-weight: bold; color: #047857; margin-top: 4px;">
          حالة التقرير: موثق ومعتمد رسمياً
        </div>
      </div>
    </div>

    <!-- Stats Summary -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px; text-align: center;">
      <div>
        <div style="font-size: 12px; color: #64748b; font-weight: bold;">إجمالي الهدايا المسلمة</div>
        <div style="font-size: 24px; font-weight: 900; color: #14382c; font-family: monospace; margin-top: 4px;">${stats.claimedCount}</div>
      </div>
      <div>
        <div style="font-size: 12px; color: #64748b; font-weight: bold;">نطاق الأرقام العشوائية</div>
        <div style="font-size: 24px; font-weight: 900; color: #14382c; font-family: monospace; margin-top: 4px;">[${stats.min} - ${stats.max}]</div>
      </div>
      <div>
        <div style="font-size: 12px; color: #64748b; font-weight: bold;">الأرقام المتبقية</div>
        <div style="font-size: 24px; font-weight: 900; color: #047857; font-family: monospace; margin-top: 4px;">${stats.remainingCount}</div>
      </div>
      <div>
        <div style="font-size: 12px; color: #64748b; font-weight: bold;">نسبة إنجاز الحملة</div>
        <div style="font-size: 24px; font-weight: 900; color: #14382c; font-family: monospace; margin-top: 4px;">${stats.percentage}%</div>
      </div>
    </div>

    <!-- Table -->
    <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 13px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #14382c; color: #ffffff;">
          <th style="padding: 12px 14px; text-align: center; width: 50px;">#</th>
          <th style="padding: 12px 14px;">اسم العميل</th>
          <th style="padding: 12px 14px;">رقم الهاتف</th>
          <th style="padding: 12px 14px; text-align: center;">رقم الهدية المميز</th>
          <th style="padding: 12px 14px;">تاريخ وساعة المسح</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #64748b;">
      <div>تم استخراج هذا التقرير تلقائياً من نظام إدارة هدايا سوفت روز انترناشيونال</div>
      <div dir="ltr">Soft Rose International • Confidential Report</div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const filename = `تقرير_عملاء_سوفت_روز_${Date.now()}.pdf`;
    downloadPdfBlob(pdf, filename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Generates an official Individual Gift Certificate / Voucher PDF for a specific customer.
 */
export async function exportCustomerVoucherPDF(
  customer: CustomerRecord,
  settings: CampaignSettings
): Promise<void> {
  // Generate QR code data URL for verifying the voucher
  const verifyData = `SOFTROSE-VOUCHER|${customer.giftNumber}|${customer.customerName}|${customer.phoneNumber}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verifyData, {
      width: 140,
      margin: 1,
      color: { dark: '#14382c', light: '#ffffff' },
    });
  } catch (e) {
    console.warn('Could not render QR code for voucher:', e);
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.padding = '40px';
  container.style.direction = 'rtl';
  container.style.zIndex = '-9999';

  container.innerHTML = `
    <div style="border: 4px double #14382c; border-radius: 24px; padding: 36px; background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #14382c; padding-bottom: 20px; margin-bottom: 28px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 60px; height: 60px; border-radius: 14px; background-color: #14382c; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 28px;">
            🌹
          </div>
          <div>
            <h2 style="margin: 0; font-size: 22px; font-weight: 900; color: #14382c;">
              ${escapeHtml(settings.companyName || 'شركة سوفت روز انترناشيونال')}
            </h2>
            <div style="margin: 2px 0 0 0; font-size: 13px; color: #047857; font-weight: bold;">
              بطاقة استلام هدية رسمية معتمدة • Official Gift Voucher
            </div>
          </div>
        </div>
        <div style="text-align: left;" dir="ltr">
          <span style="display: inline-block; padding: 6px 14px; background-color: #14382c; color: #ffffff; font-size: 12px; font-weight: bold; border-radius: 8px;">
            VERIFIED & AUTHENTIC
          </span>
        </div>
      </div>

      <!-- Main Voucher Body -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 14px; font-weight: bold; color: #64748b; margin-bottom: 8px;">
          رقم الهدية المخصص للعميل
        </div>
        <div style="display: inline-block; padding: 12px 36px; background-color: #14382c; color: #fbbf24; font-size: 44px; font-weight: 900; font-family: monospace; border-radius: 20px; letter-spacing: 4px; border: 3px solid #f59e0b; box-shadow: 0 8px 16px rgba(20, 56, 44, 0.2);">
          #${customer.giftNumber}
        </div>
      </div>

      <!-- Customer Details Card -->
      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: bold; margin-bottom: 4px;">اسم العميل المستلم</div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${escapeHtml(customer.customerName)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: bold; margin-bottom: 4px;">رقم الهاتف المسجل</div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace;" dir="ltr">${escapeHtml(customer.phoneNumber)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: bold; margin-bottom: 4px;">تاريخ ووقت الاستحقاق</div>
            <div style="font-size: 14px; font-weight: bold; color: #334155;">
              ${escapeHtml(customer.formattedDate || new Date(customer.timestamp).toLocaleString('ar-EG'))}
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: bold; margin-bottom: 4px;">معرف المعاملة</div>
            <div style="font-size: 12px; font-family: monospace; color: #64748b;">${escapeHtml(customer.id)}</div>
          </div>
        </div>
      </div>

      <!-- Bottom verification and QR section -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 18px; border-top: 1px solid #cbd5e1;">
        <div style="max-width: 480px;">
          <div style="font-size: 13px; font-weight: 900; color: #14382c; margin-bottom: 4px;">
            تعليمات الاستلام الرسمية:
          </div>
          <div style="font-size: 12px; color: #475569; line-height: 1.6;">
            يُرجى إبراز هذه البطاقة أو الرمز لمسؤول جناح شركة سوفت روز انترناشيونال لاستلام هديتك فوراً. هذه البطاقة صالحة لمرة واحدة فقط وموثقة إلكترونياً.
          </div>
        </div>

        ${
          qrCodeDataUrl
            ? `
          <div style="text-align: center; background-color: #ffffff; padding: 10px; border-radius: 12px; border: 1px solid #cbd5e1;">
            <img src="${qrCodeDataUrl}" style="width: 100px; height: 100px; display: block;" alt="QR Code" />
            <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-top: 4px;">رمز التحقق المعتمد</div>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 900,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, imgHeight);

    const safeName = customer.customerName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const filename = `بطاقة_هدية_${safeName}_${customer.giftNumber}.pdf`;
    downloadPdfBlob(pdf, filename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
