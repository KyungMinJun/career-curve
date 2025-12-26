import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, TableLayoutType, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { TailoredResume, Experience } from '@/types/job';

// Resume format type
export type ResumeFormat = 'consulting' | 'narrative';

// Parsed resume section structure
interface ResumeSection {
  type: 'header' | 'experience' | 'education' | 'skills' | 'other';
  title?: string;
  items: ResumeItem[];
}

interface ResumeItem {
  title?: string;
  subtitle?: string;
  period?: string;
  location?: string;
  description?: string;
  bullets: string[];
}

// Remove emojis from text
function removeEmojis(text: string): string {
  // Remove common emojis and special symbols
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Arrows
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation selectors
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[⚠️✓✔✗✘★☆●○◆◇▲△▼▽►◄→←↑↓⇒⇐⇑⇓]/g, '') // Common symbols
    .replace(/[❌✅⭐🔥💡📌📍🎯🚀💼📊📈📉🏆🎉🔑]/gu, '') // Common emojis
    .trim();
}

// Parse AI-generated resume content into structured sections
function parseResumeContent(content: string): ResumeSection[] {
  const cleanedContent = removeEmojis(content);
  const lines = cleanedContent.split('\n').filter(line => line.trim());
  const sections: ResumeSection[] = [];
  let currentSection: ResumeSection | null = null;
  let currentItem: ResumeItem | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Section headers (## or **SECTION** style)
    if (trimmed.startsWith('## ') || (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 50)) {
      if (currentItem && currentSection) {
        currentSection.items.push(currentItem);
        currentItem = null;
      }
      if (currentSection) {
        sections.push(currentSection);
      }
      
      const title = trimmed.replace(/^##\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      const sectionType = getSectionType(title);
      currentSection = { type: sectionType, title, items: [] };
      continue;
    }
    
    // Job/Experience title line (often contains company name, period, or | separator)
    if (trimmed.includes('|') || (trimmed.startsWith('**') && !trimmed.endsWith('**'))) {
      if (currentItem && currentSection) {
        currentSection.items.push(currentItem);
      }
      
      const cleanLine = trimmed.replace(/\*\*/g, '');
      const parts = cleanLine.split('|').map(p => p.trim());
      
      currentItem = {
        title: parts[0] || '',
        subtitle: parts[1] || '',
        period: parts[2] || '',
        location: parts[3] || '',
        bullets: []
      };
      continue;
    }
    
    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      const bullet = trimmed.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '').trim();
      if (currentItem && bullet) {
        currentItem.bullets.push(bullet);
      } else if (currentSection && bullet) {
        if (!currentItem) {
          currentItem = { bullets: [bullet] };
        }
      }
      continue;
    }
    
    // Regular text - could be description or title
    if (currentSection) {
      const cleanText = trimmed.replace(/\*\*/g, '').replace(/##/g, '').trim();
      if (cleanText) {
        if (!currentItem) {
          currentItem = { title: cleanText, bullets: [] };
        } else if (!currentItem.description) {
          currentItem.description = cleanText;
        } else {
          currentItem.bullets.push(cleanText);
        }
      }
    } else {
      // Text before any section - likely header info
      if (!currentSection) {
        currentSection = { type: 'header', items: [] };
      }
    }
  }

  if (currentItem && currentSection) {
    currentSection.items.push(currentItem);
  }
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function getSectionType(title: string): ResumeSection['type'] {
  const lower = title.toLowerCase();
  if (lower.includes('experience') || lower.includes('경력') || lower.includes('경험')) return 'experience';
  if (lower.includes('education') || lower.includes('학력')) return 'education';
  if (lower.includes('skill') || lower.includes('기술') || lower.includes('역량')) return 'skills';
  return 'other';
}

// Format resume for preview - Consulting style (foreign/Palantir style)
export function formatResumeForPreviewConsulting(content: string, userName: string, contactInfo?: string): string {
  const sections = parseResumeContent(content);
  const lines: string[] = [];
  
  // Header - Name prominently
  lines.push(userName.toUpperCase());
  if (contactInfo) {
    lines.push(contactInfo);
  }
  lines.push('');
  
  for (const section of sections) {
    if (section.type === 'header') continue;
    
    // Section title with line
    if (section.title) {
      lines.push('');
      lines.push(`--- ${section.title.toUpperCase()} ---`);
      lines.push('');
    }
    
    for (const item of section.items) {
      // Company/Position line
      if (item.title) {
        const titleLine = [item.title, item.subtitle, item.location].filter(Boolean).join('  |  ');
        lines.push(titleLine);
      }
      if (item.period) {
        lines.push(`   ${item.period}`);
      }
      if (item.description) {
        lines.push(`   ${item.description}`);
      }
      
      // Bullets with proper indentation
      for (const bullet of item.bullets) {
        lines.push(`   - ${removeEmojis(bullet)}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// Format resume for preview - Narrative style (Korean style)
export function formatResumeForPreviewNarrative(content: string, userName: string, coverLetter?: string): string {
  const sections = parseResumeContent(content);
  const lines: string[] = [];
  
  // Header
  lines.push(`[ ${userName} ]`);
  lines.push('');
  
  // Cover letter / introduction if provided
  if (coverLetter) {
    lines.push('-'.repeat(40));
    lines.push(coverLetter);
    lines.push('-'.repeat(40));
    lines.push('');
  }
  
  for (const section of sections) {
    if (section.type === 'header') continue;
    
    // Section title
    if (section.title) {
      lines.push('');
      lines.push(`[${section.title}]`);
      lines.push('');
    }
    
    for (const item of section.items) {
      // Company header
      if (item.title) {
        lines.push(item.title);
      }
      if (item.subtitle || item.period) {
        const subInfo = [item.subtitle, item.period].filter(Boolean).join(' | ');
        lines.push(`   ${subInfo}`);
      }
      
      // Narrative description
      if (item.description) {
        lines.push(`   ${item.description}`);
      }
      
      // Bullets as narrative points
      for (const bullet of item.bullets) {
        lines.push(`   - ${removeEmojis(bullet)}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// Main preview function - auto-detect format or use specified
export function formatResumeForPreview(content: string, userName?: string, format?: ResumeFormat): string {
  const name = userName || '이름';
  
  // Try to detect format from content
  const isEnglish = /^[a-zA-Z\s\-,.']+$/.test(name) || content.includes('EXPERIENCE') || content.includes('EDUCATION');
  const detectedFormat = format || (isEnglish ? 'consulting' : 'narrative');
  
  if (detectedFormat === 'consulting') {
    return formatResumeForPreviewConsulting(content, name);
  } else {
    return formatResumeForPreviewNarrative(content, name);
  }
}

// Export to DOCX - Consulting style
async function exportConsultingStyleDocx(resume: TailoredResume, userName: string): Promise<Blob> {
  const sections = parseResumeContent(resume.content);
  const children: Paragraph[] = [];

  // Header - Name in large font
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: userName.toUpperCase(), bold: true, size: 36 }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 },
    })
  );

  // Contact line (placeholder - could be enhanced)
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${resume.companyName} · ${resume.jobTitle}`, size: 20, color: '666666' }),
      ],
      spacing: { after: 300 },
    })
  );

  for (const section of sections) {
    if (section.type === 'header') continue;

    // Section header with border
    if (section.title) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: section.title.toUpperCase(), bold: true, size: 24 }),
          ],
          spacing: { before: 300, after: 100 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
          },
        })
      );
    }

    for (const item of section.items) {
      // Company/Position - Bold title
      if (item.title) {
        const titleParts: TextRun[] = [
          new TextRun({ text: item.title, bold: true, size: 22 }),
        ];
        if (item.subtitle) {
          titleParts.push(new TextRun({ text: ` — ${item.subtitle}`, size: 22 }));
        }
        if (item.location) {
          titleParts.push(new TextRun({ text: ` | ${item.location}`, size: 20, color: '666666' }));
        }
        
        children.push(new Paragraph({ children: titleParts, spacing: { before: 150, after: 50 } }));
      }

      // Period
      if (item.period) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: item.period, italics: true, size: 20, color: '666666' })],
            spacing: { after: 50 },
          })
        );
      }

      // Bullets
      for (const bullet of item.bullets) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${bullet}`, size: 20 })],
            spacing: { after: 40 },
            indent: { left: 360 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  });

  return Packer.toBlob(doc);
}

// Export to DOCX - Narrative style
async function exportNarrativeStyleDocx(resume: TailoredResume, userName: string): Promise<Blob> {
  const sections = parseResumeContent(resume.content);
  const children: Paragraph[] = [];

  // Header - Name centered
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: userName, bold: true, size: 32 }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Target info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${resume.companyName} | ${resume.jobTitle}`, size: 22, color: '444444' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  for (const section of sections) {
    if (section.type === 'header') continue;

    // Section header with box style
    if (section.title) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `■ ${section.title}`, bold: true, size: 24 }),
          ],
          spacing: { before: 300, after: 150 },
          shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
        })
      );
    }

    for (const item of section.items) {
      // Company block
      if (item.title) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `▶ ${item.title}`, bold: true, size: 22 }),
            ],
            spacing: { before: 120, after: 50 },
          })
        );
      }

      if (item.subtitle || item.period) {
        const subText = [item.subtitle, item.period].filter(Boolean).join(' | ');
        children.push(
          new Paragraph({
            children: [new TextRun({ text: subText, size: 20, color: '666666' })],
            indent: { left: 240 },
            spacing: { after: 50 },
          })
        );
      }

      // Description
      if (item.description) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: item.description, size: 20 })],
            indent: { left: 240 },
            spacing: { after: 50 },
          })
        );
      }

      // Bullets as narrative
      for (const bullet of item.bullets) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `· ${bullet}`, size: 20 })],
            indent: { left: 480 },
            spacing: { after: 30 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  });

  return Packer.toBlob(doc);
}

// Main export function
export async function exportTailoredResumeToDocx(resume: TailoredResume, userName?: string, format?: ResumeFormat): Promise<void> {
  const name = userName || '이름';
  
  // Detect format from language if not specified
  const detectedFormat = format || (resume.language === 'en' ? 'consulting' : 'narrative');
  
  let blob: Blob;
  if (detectedFormat === 'consulting') {
    blob = await exportConsultingStyleDocx(resume, name);
  } else {
    blob = await exportNarrativeStyleDocx(resume, name);
  }

  const dateStr = new Date(resume.createdAt).toLocaleDateString('ko-KR', { 
    year: '2-digit', 
    month: '2-digit', 
    day: '2-digit' 
  }).replace(/\. /g, '.').replace(/\.$/, '');
  
  const formatSuffix = detectedFormat === 'consulting' ? '_consulting' : '_narrative';
  const fileName = `${resume.companyName}_${dateStr}${formatSuffix}.docx`;
  saveAs(blob, fileName);
}

// Legacy function for backwards compatibility
export { formatResumeForPreview as formatResumeForPreviewLegacy };
