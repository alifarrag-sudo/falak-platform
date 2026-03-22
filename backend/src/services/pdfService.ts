import PdfPrinter from 'pdfmake';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TDocumentDefinitions = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContent = any;

const fonts = {
  Roboto: {
    normal: 'node_modules/pdfmake/build/vfs_fonts.js',
    bold: 'node_modules/pdfmake/build/vfs_fonts.js',
    italics: 'node_modules/pdfmake/build/vfs_fonts.js',
    bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
  }
};

function formatNumber(n: unknown): string {
  if (!n) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

function formatRate(rate: unknown, currency = 'SAR'): string {
  if (!rate) return '—';
  const num = Number(rate);
  if (isNaN(num)) return '—';
  return `${currency} ${num.toLocaleString()}`;
}

export async function generateProposalPdf(
  campaign: Record<string, unknown>,
  influencers: Record<string, unknown>[],
  settings: Record<string, string>
): Promise<Buffer> {
  const printer = new PdfPrinter(fonts);
  const primaryColor = settings.pdf_primary_color || '#2563eb';
  const companyName = settings.company_name || 'FALAK';
  const currency = settings.default_currency || 'SAR';

  const totalCost = influencers.reduce((sum, ci) => sum + (Number(ci.rate) || 0), 0);

  // Cover page
  const coverContent: AnyContent[] = [
    { text: '\n\n\n\n', fontSize: 12 },
    {
      canvas: [{
        type: 'rect',
        x: 0, y: 0,
        w: 515, h: 120,
        r: 8,
        color: primaryColor
      }]
    },
    { text: '\n' },
    {
      text: String(campaign.name || 'Campaign Proposal'),
      fontSize: 32,
      bold: true,
      color: primaryColor,
      alignment: 'center',
      margin: [0, 20, 0, 8]
    },
    {
      text: `Prepared for: ${campaign.client_name || '—'}`,
      fontSize: 16,
      alignment: 'center',
      color: '#374151',
      margin: [0, 0, 0, 4]
    },
    {
      text: `Date: ${campaign.start_date ? String(campaign.start_date).split('T')[0] : new Date().toLocaleDateString()}`,
      fontSize: 13,
      alignment: 'center',
      color: '#6b7280',
      margin: [0, 0, 0, 4]
    },
    {
      text: `Prepared by: ${companyName}`,
      fontSize: 13,
      alignment: 'center',
      color: '#6b7280',
      margin: [0, 0, 0, 40]
    },
    { text: '\n\n\n' },
    {
      columns: [
        {
          stack: [
            { text: String(influencers.length), fontSize: 36, bold: true, color: primaryColor, alignment: 'center' },
            { text: 'Influencers', fontSize: 12, color: '#6b7280', alignment: 'center' }
          ]
        },
        {
          stack: [
            { text: formatRate(totalCost, currency), fontSize: 36, bold: true, color: primaryColor, alignment: 'center' },
            { text: 'Total Investment', fontSize: 12, color: '#6b7280', alignment: 'center' }
          ]
        },
        {
          stack: [
            { text: String(campaign.platform_focus || 'Multi-Platform'), fontSize: 20, bold: true, color: primaryColor, alignment: 'center' },
            { text: 'Platform', fontSize: 12, color: '#6b7280', alignment: 'center' }
          ]
        }
      ],
      margin: [0, 0, 0, 40]
    }
  ];

  // Influencer pages
  const influencerContent: AnyContent[] = [];
  for (const ci of influencers) {
    influencerContent.push({ text: '', pageBreak: 'before' });

    const name = String(ci.name_english || ci.name_arabic || 'Unknown');
    const arabicName = ci.name_arabic ? String(ci.name_arabic) : null;

    // Influencer card header
    influencerContent.push({
      columns: [
        {
          stack: [
            {
              text: name,
              fontSize: 22,
              bold: true,
              color: '#111827',
              margin: [0, 0, 0, 2]
            },
            arabicName ? {
              text: arabicName,
              fontSize: 16,
              color: '#374151',
              margin: [0, 0, 0, 4]
            } : { text: '' },
            {
              text: String(ci.main_category || ci.account_tier || ''),
              fontSize: 12,
              color: primaryColor,
              bold: true
            }
          ]
        },
        ci.mawthouq_certificate ? {
          stack: [
            {
              canvas: [{
                type: 'rect',
                x: 0, y: 0,
                w: 120, h: 32,
                r: 16,
                color: '#059669'
              }]
            },
            {
              text: 'Mawthouq Certified',
              fontSize: 10,
              color: 'white',
              bold: true,
              margin: [20, -24, 0, 0]
            }
          ],
          width: 130,
          alignment: 'right'
        } : { text: '', width: 130 }
      ],
      margin: [0, 0, 0, 16]
    });

    // Divider
    influencerContent.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e5e7eb' }],
      margin: [0, 0, 0, 16]
    });

    // Social stats
    const socialData: string[][] = [['Platform', 'Handle', 'Followers']];
    if (ci.ig_handle) socialData.push(['Instagram', String(ci.ig_handle), formatNumber(ci.ig_followers)]);
    if (ci.tiktok_handle) socialData.push(['TikTok', String(ci.tiktok_handle), formatNumber(ci.tiktok_followers)]);
    if (ci.snap_handle) socialData.push(['Snapchat', String(ci.snap_handle), formatNumber(ci.snap_followers)]);
    if (ci.fb_handle) socialData.push(['Facebook', String(ci.fb_handle), formatNumber(ci.fb_followers)]);

    if (socialData.length > 1) {
      influencerContent.push({
        table: {
          headerRows: 1,
          widths: ['30%', '*', '25%'],
          body: socialData.map((row, i) => row.map(cell => ({
            text: cell,
            fontSize: i === 0 ? 10 : 11,
            bold: i === 0,
            color: i === 0 ? 'white' : '#374151',
            fillColor: i === 0 ? primaryColor : (i % 2 === 0 ? '#f9fafb' : 'white'),
            margin: [8, 6, 8, 6]
          })))
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 16]
      });
    }

    // Rate card
    const rateData: string[][] = [];
    if (ci.ig_rate) rateData.push(['Instagram Rate', formatRate(ci.ig_rate, currency)]);
    if (ci.tiktok_rate) rateData.push(['TikTok Rate', formatRate(ci.tiktok_rate, currency)]);
    if (ci.snapchat_rate) rateData.push(['Snapchat Rate', formatRate(ci.snapchat_rate, currency)]);
    if (ci.package_rate) rateData.push(['Package Rate', formatRate(ci.package_rate, currency)]);

    if (rateData.length > 0) {
      influencerContent.push({ text: 'Rate Card', fontSize: 12, bold: true, color: primaryColor, margin: [0, 0, 0, 8] });
      influencerContent.push({
        columns: rateData.map(([label, val]) => ({
          stack: [
            { text: label, fontSize: 10, color: '#6b7280' },
            { text: val, fontSize: 14, bold: true, color: '#111827' }
          ],
          margin: [0, 0, 16, 0]
        })),
        margin: [0, 0, 0, 16]
      });
    }

    // Campaign deliverables for this influencer
    influencerContent.push({
      table: {
        widths: ['30%', '25%', '25%', '*'],
        body: [
          [
            { text: 'Platform', bold: true, fontSize: 10, fillColor: '#f3f4f6', margin: [8, 6, 8, 6] },
            { text: 'Posts', bold: true, fontSize: 10, fillColor: '#f3f4f6', margin: [8, 6, 8, 6] },
            { text: 'Rate', bold: true, fontSize: 10, fillColor: '#f3f4f6', margin: [8, 6, 8, 6] },
            { text: 'Deliverables', bold: true, fontSize: 10, fillColor: '#f3f4f6', margin: [8, 6, 8, 6] }
          ],
          [
            { text: String(ci.platform || '—'), fontSize: 11, margin: [8, 6, 8, 6] },
            { text: String(ci.num_posts || 1), fontSize: 11, margin: [8, 6, 8, 6] },
            { text: formatRate(ci.rate, currency), fontSize: 11, bold: true, color: primaryColor, margin: [8, 6, 8, 6] },
            { text: String(ci.deliverables || '—'), fontSize: 10, margin: [8, 6, 8, 6] }
          ]
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 16]
    });

    if (ci.notes) {
      influencerContent.push({
        text: `Notes: ${ci.notes}`,
        fontSize: 10,
        color: '#6b7280',
        italics: true,
        margin: [0, 0, 0, 8]
      });
    }
  }

  // Summary page
  const summaryContent: AnyContent[] = [
    { text: '', pageBreak: 'before' },
    { text: 'Campaign Summary', fontSize: 24, bold: true, color: primaryColor, margin: [0, 0, 0, 24] },
    {
      table: {
        headerRows: 1,
        widths: ['*', '20%', '20%', '15%', '18%'],
        body: [
          [
            { text: 'Influencer', bold: true, fontSize: 10, fillColor: primaryColor, color: 'white', margin: [8, 6, 8, 6] },
            { text: 'Platform', bold: true, fontSize: 10, fillColor: primaryColor, color: 'white', margin: [8, 6, 8, 6] },
            { text: 'Followers', bold: true, fontSize: 10, fillColor: primaryColor, color: 'white', margin: [8, 6, 8, 6] },
            { text: 'Posts', bold: true, fontSize: 10, fillColor: primaryColor, color: 'white', margin: [8, 6, 8, 6] },
            { text: 'Rate', bold: true, fontSize: 10, fillColor: primaryColor, color: 'white', margin: [8, 6, 8, 6] }
          ],
          ...influencers.map((ci, i) => {
            const followers = ci.platform === 'TikTok' ? ci.tiktok_followers :
              ci.platform === 'Snapchat' ? ci.snap_followers : ci.ig_followers;
            return [
              { text: String(ci.name_english || ci.name_arabic || '—'), fontSize: 10, fillColor: i % 2 === 0 ? '#f9fafb' : 'white', margin: [8, 5, 8, 5] },
              { text: String(ci.platform || '—'), fontSize: 10, fillColor: i % 2 === 0 ? '#f9fafb' : 'white', margin: [8, 5, 8, 5] },
              { text: formatNumber(followers), fontSize: 10, fillColor: i % 2 === 0 ? '#f9fafb' : 'white', margin: [8, 5, 8, 5] },
              { text: String(ci.num_posts || 1), fontSize: 10, fillColor: i % 2 === 0 ? '#f9fafb' : 'white', margin: [8, 5, 8, 5] },
              { text: formatRate(ci.rate, currency), fontSize: 10, bold: true, fillColor: i % 2 === 0 ? '#f9fafb' : 'white', margin: [8, 5, 8, 5] }
            ];
          }),
          [
            { text: 'TOTAL', bold: true, fontSize: 11, colSpan: 4, fillColor: '#f3f4f6', margin: [8, 8, 8, 8] },
            {}, {}, {},
            { text: formatRate(totalCost, currency), bold: true, fontSize: 13, color: primaryColor, fillColor: '#f3f4f6', margin: [8, 8, 8, 8] }
          ]
        ]
      },
      layout: 'lightHorizontalLines'
    }
  ];

  if (campaign.brief) {
    summaryContent.push({
      stack: [
        { text: '\n\nCampaign Brief', fontSize: 14, bold: true, color: primaryColor, margin: [0, 24, 0, 8] },
        { text: String(campaign.brief), fontSize: 11, color: '#374151', lineHeight: 1.5 }
      ]
    });
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    info: {
      title: String(campaign.name || 'Proposal'),
      author: companyName,
      subject: `Campaign Proposal - ${campaign.client_name || ''}`
    },
    header: ((currentPage: number, pageCount: number): AnyContent => {
      if (currentPage === 1) return { text: '' };
      return {
        columns: [
          { text: companyName, fontSize: 9, color: '#9ca3af', margin: [40, 20, 0, 0] },
          {
            text: `${currentPage} / ${pageCount}`,
            fontSize: 9,
            color: '#9ca3af',
            alignment: 'right',
            margin: [0, 20, 40, 0]
          }
        ]
      };
    }) as AnyContent,
    footer: ((_currentPage: number): AnyContent => ({
      text: `Confidential — ${companyName}`,
      fontSize: 9,
      color: '#d1d5db',
      alignment: 'center',
      margin: [40, 0, 40, 20]
    })) as AnyContent,
    content: [...coverContent, ...influencerContent, ...summaryContent],
    styles: {
      header: { fontSize: 18, bold: true, color: primaryColor }
    }
  };

  return new Promise((resolve, reject) => {
    try {
      const printer = new PdfPrinter(fonts);
      const doc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateOfferContractPdf(
  offer: Record<string, unknown>,
  influencer: Record<string, unknown>,
  settings: Record<string, string>
): Promise<Buffer> {
  const primaryColor = settings.pdf_primary_color || '#2563eb';
  const companyName = settings.company_name || 'The Agency';
  const currency = String(offer.currency || settings.default_currency || 'SAR');

  const influencerName = String(influencer.name_english || 'Influencer');
  const handle = influencer.ig_handle
    ? `@${String(influencer.ig_handle)}`
    : influencer.tiktok_handle
    ? `@${String(influencer.tiktok_handle)}`
    : '—';

  const deadlineStr = offer.deadline
    ? String(offer.deadline).split('T')[0]
    : '—';

  const rateNum = Number(offer.rate) || 0;
  const rateFormatted = rateNum
    ? `${currency} ${rateNum.toLocaleString()}`
    : '—';

  const today = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AC = any;

  const content: AC[] = [
    // ── Header ──────────────────────────────────────────────────────────
    {
      canvas: [{
        type: 'rect',
        x: 0, y: 0,
        w: 515, h: 8,
        color: primaryColor
      }],
      margin: [0, 0, 0, 24]
    },
    {
      text: companyName,
      fontSize: 11,
      color: '#6b7280',
      margin: [0, 0, 0, 4]
    },
    {
      text: 'Influencer Collaboration Agreement',
      fontSize: 26,
      bold: true,
      color: '#111827',
      margin: [0, 0, 0, 6]
    },
    {
      text: `Date: ${today}`,
      fontSize: 11,
      color: '#6b7280',
      margin: [0, 0, 0, 32]
    },

    // ── Parties ─────────────────────────────────────────────────────────
    { text: 'PARTIES', fontSize: 11, bold: true, color: primaryColor, margin: [0, 0, 0, 8] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
      margin: [0, 0, 0, 12]
    },
    {
      columns: [
        {
          stack: [
            { text: 'Agency / Client', fontSize: 9, color: '#9ca3af', margin: [0, 0, 0, 3] },
            { text: companyName, fontSize: 13, bold: true, color: '#111827' }
          ]
        },
        {
          stack: [
            { text: 'Influencer', fontSize: 9, color: '#9ca3af', margin: [0, 0, 0, 3] },
            { text: influencerName, fontSize: 13, bold: true, color: '#111827' },
            { text: handle, fontSize: 11, color: '#6b7280', margin: [0, 2, 0, 0] }
          ]
        }
      ],
      margin: [0, 0, 0, 32]
    },

    // ── Campaign Details ─────────────────────────────────────────────────
    { text: 'CAMPAIGN DETAILS', fontSize: 11, bold: true, color: primaryColor, margin: [0, 0, 0, 8] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
      margin: [0, 0, 0, 12]
    },
    {
      table: {
        widths: ['28%', '*'],
        body: [
          [
            { text: 'Campaign Title', fontSize: 10, color: '#6b7280', fillColor: '#f9fafb', margin: [8, 7, 8, 7] },
            { text: String(offer.title || '—'), fontSize: 10, color: '#111827', margin: [8, 7, 8, 7] }
          ],
          [
            { text: 'Platform', fontSize: 10, color: '#6b7280', fillColor: '#f9fafb', margin: [8, 7, 8, 7] },
            { text: String(offer.platform || '—'), fontSize: 10, color: '#111827', margin: [8, 7, 8, 7] }
          ],
          [
            { text: 'Deliverables', fontSize: 10, color: '#6b7280', fillColor: '#f9fafb', margin: [8, 7, 8, 7] },
            { text: String(offer.deliverables || '—'), fontSize: 10, color: '#111827', margin: [8, 7, 8, 7] }
          ],
          [
            { text: 'Deadline', fontSize: 10, color: '#6b7280', fillColor: '#f9fafb', margin: [8, 7, 8, 7] },
            { text: deadlineStr, fontSize: 10, color: '#111827', margin: [8, 7, 8, 7] }
          ],
          ...(offer.brief ? [[
            { text: 'Brief', fontSize: 10, color: '#6b7280', fillColor: '#f9fafb', margin: [8, 7, 8, 7] },
            { text: String(offer.brief), fontSize: 10, color: '#111827', lineHeight: 1.4, margin: [8, 7, 8, 7] }
          ]] : [])
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 32]
    },

    // ── Compensation ─────────────────────────────────────────────────────
    { text: 'COMPENSATION', fontSize: 11, bold: true, color: primaryColor, margin: [0, 0, 0, 8] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
      margin: [0, 0, 0, 12]
    },
    {
      table: {
        widths: ['28%', '*'],
        body: [
          [
            { text: 'Rate', fontSize: 10, color: '#6b7280', fillColor: '#f9fafb', margin: [8, 7, 8, 7] },
            { text: rateFormatted, fontSize: 11, bold: true, color: primaryColor, margin: [8, 7, 8, 7] }
          ],
          [
            { text: 'Payment Terms', fontSize: 10, color: '#6b7280', fillColor: '#f9fafb', margin: [8, 7, 8, 7] },
            { text: 'Payment within 30 days of content approval', fontSize: 10, color: '#111827', margin: [8, 7, 8, 7] }
          ]
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 32]
    },

    // ── Terms ────────────────────────────────────────────────────────────
    { text: 'TERMS & CONDITIONS', fontSize: 11, bold: true, color: primaryColor, margin: [0, 0, 0, 8] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
      margin: [0, 0, 0, 12]
    },
    {
      ol: [
        'The Influencer agrees to create and publish the agreed deliverables by the deadline.',
        'Content must be original and comply with platform guidelines and local regulations.',
        'The Agency retains the right to use published content for campaign reporting.',
        'Both parties agree to maintain confidentiality regarding commercial terms.',
        'This agreement is governed by the laws of the Kingdom of Saudi Arabia.',
      ],
      fontSize: 10,
      color: '#374151',
      lineHeight: 1.6,
      margin: [0, 0, 0, 40]
    },

    // ── Signatures ───────────────────────────────────────────────────────
    { text: 'SIGNATURES', fontSize: 11, bold: true, color: primaryColor, margin: [0, 0, 0, 8] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
      margin: [0, 0, 0, 24]
    },
    {
      columns: [
        {
          stack: [
            { text: 'Agency Representative', fontSize: 10, bold: true, color: '#374151', margin: [0, 0, 0, 40] },
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: '#9ca3af' }],
              margin: [0, 0, 0, 6]
            },
            { text: companyName, fontSize: 10, color: '#374151', margin: [0, 0, 0, 4] },
            { text: `Date: ${today}`, fontSize: 9, color: '#9ca3af' }
          ]
        },
        {
          stack: [
            { text: 'Influencer', fontSize: 10, bold: true, color: '#374151', margin: [0, 0, 0, 40] },
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: '#9ca3af' }],
              margin: [0, 0, 0, 6]
            },
            { text: influencerName, fontSize: 10, color: '#374151', margin: [0, 0, 0, 4] },
            { text: `Date: _______________`, fontSize: 9, color: '#9ca3af' }
          ]
        }
      ]
    }
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 56],
    info: {
      title: `Collaboration Agreement — ${String(offer.title || 'Offer')}`,
      author: companyName,
      subject: 'Influencer Collaboration Agreement'
    },
    header: ((_currentPage: number, _pageCount: number): AnyContent => ({
      columns: [
        { text: companyName, fontSize: 9, color: '#9ca3af', margin: [48, 20, 0, 0] },
        {
          text: 'CONFIDENTIAL',
          fontSize: 9,
          color: '#9ca3af',
          alignment: 'right',
          margin: [0, 20, 48, 0]
        }
      ]
    })) as AnyContent,
    footer: ((_currentPage: number, pageCount: number): AnyContent => ({
      columns: [
        { text: `Influencer Collaboration Agreement — ${companyName}`, fontSize: 8, color: '#d1d5db', margin: [48, 0, 0, 20] },
        {
          text: `Page ${_currentPage} of ${pageCount}`,
          fontSize: 8,
          color: '#d1d5db',
          alignment: 'right',
          margin: [0, 0, 48, 20]
        }
      ]
    })) as AnyContent,
    content,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: '#111827'
    }
  };

  return new Promise((resolve, reject) => {
    try {
      const printer = new PdfPrinter(fonts);
      const doc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
