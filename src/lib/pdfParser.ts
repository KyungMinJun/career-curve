// PDF.js를 CDN에서 동적으로 로드 (번들 빌드에서 top-level await 문제 회피)
let pdfjsLib: any = null;
let pdfjsPromise: Promise<any> | null = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = (async () => {
    // 이미 로드된 경우
    const existing = (window as any).pdfjsLib;
    if (existing) {
      existing.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib = existing;
      return existing;
    }

    // Load PDF.js from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('PDF.js 스크립트 로드 실패'));
      document.head.appendChild(script);
    });

    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) throw new Error('PDF.js 로드 후 pdfjsLib를 찾을 수 없습니다');

    // NOTE: cross-origin worker 문제가 환경에 따라 발생할 수 있어,
    // 실제 parsing은 disableWorker 옵션으로 worker 없이 수행합니다.
    pdfjs.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    pdfjsLib = pdfjs;
    return pdfjs;
  })();

  return pdfjsPromise;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  // PDF 폰트(CMap) 로드 오류로 텍스트 추출이 0이 되는 케이스를 방지
  const commonOptions = {
    data: arrayBuffer,
    disableWorker: true,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
  };

  const pdf = await pdfjs.getDocument(commonOptions).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
    const pageText = (textContent.items || [])
      .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText.trim();
}

export async function renderPdfToImageDataUrls(
  file: File,
  options?: { maxPages?: number; scale?: number; quality?: number }
): Promise<string[]> {
  const { maxPages = 2, scale = 1.6, quality = 0.85 } = options ?? {};
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const commonOptions = {
    data: arrayBuffer,
    disableWorker: true,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
  };

  const pdf = await pdfjs.getDocument(commonOptions).promise;

  const pages = Math.min(pdf.numPages, maxPages);
  const urls: string[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context를 생성할 수 없습니다');

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    urls.push(canvas.toDataURL('image/jpeg', quality));

    // 메모리 해제 힌트
    canvas.width = 0;
    canvas.height = 0;
  }

  return urls;
}


