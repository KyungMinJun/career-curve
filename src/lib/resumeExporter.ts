import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Experience } from '@/types/job';

interface ResumeData {
  userName: string;
  experiences: Experience[];
}

export async function exportResumeToDocx({ userName, experiences }: ResumeData): Promise<void> {
  const workExperiences = experiences.filter(e => e.type === 'work');
  const projectExperiences = experiences.filter(e => e.type === 'project');

  const children: Paragraph[] = [];

  // Header - Name
  children.push(
    new Paragraph({
      text: userName || '이름',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Work Experience Section
  if (workExperiences.length > 0) {
    children.push(
      new Paragraph({
        text: 'WORK EXPERIENCE',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        },
      })
    );

    workExperiences.forEach((exp) => {
      // Title and Company
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.title, bold: true, size: 24 }),
            exp.company ? new TextRun({ text: ` | ${exp.company}`, size: 24 }) : new TextRun(''),
          ],
          spacing: { before: 200, after: 50 },
        })
      );

      // Period
      if (exp.period) {
        children.push(
          new Paragraph({
            text: exp.period,
            spacing: { after: 100 },
            style: 'Normal',
          })
        );
      }

      // Description
      if (exp.description) {
        children.push(
          new Paragraph({
            text: exp.description,
            spacing: { after: 100 },
          })
        );
      }

      // Bullets
      exp.bullets?.forEach((bullet) => {
        if (bullet.trim()) {
          children.push(
            new Paragraph({
              text: `• ${bullet}`,
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
      });
    });
  }

  // Projects Section
  if (projectExperiences.length > 0) {
    children.push(
      new Paragraph({
        text: 'SELECTED PROJECTS',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        },
      })
    );

    projectExperiences.forEach((exp) => {
      // Title and Organization
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.title, bold: true, size: 24 }),
            exp.company ? new TextRun({ text: ` | ${exp.company}`, size: 24 }) : new TextRun(''),
          ],
          spacing: { before: 200, after: 50 },
        })
      );

      // Period
      if (exp.period) {
        children.push(
          new Paragraph({
            text: exp.period,
            spacing: { after: 100 },
          })
        );
      }

      // Description
      if (exp.description) {
        children.push(
          new Paragraph({
            text: exp.description,
            spacing: { after: 100 },
          })
        );
      }

      // Bullets
      exp.bullets?.forEach((bullet) => {
        if (bullet.trim()) {
          children.push(
            new Paragraph({
              text: `• ${bullet}`,
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
      });
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const fileName = `Resume_${userName || 'User'}_${dateStr}.docx`;
  saveAs(blob, fileName);
}
