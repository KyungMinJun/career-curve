// PDF.js를 CDN에서 동적으로 로드 (번들 빌드에서 top-level await 문제 회피)
let pdfjsLib: any = null;
let pdfjsPromise: Promise<any> | null = null;

const CDN_CANDIDATES = [
  // jsDelivr tends to be more reachable in KR networks than cdnjs
  {
    base: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/',
    pdf: 'build/pdf.min.js',
    worker: 'build/pdf.worker.min.js',
    cmaps: 'cmaps/',
    standardFonts: 'standard_fonts/',
  },
  {
    base: 'https://unpkg.com/pdfjs-dist@3.11.174/',
    pdf: 'build/pdf.min.js',
    worker: 'build/pdf.worker.min.js',
    cmaps: 'cmaps/',
    standardFonts: 'standard_fonts/',
  },
  {
    base: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/',
    pdf: 'pdf.min.js',
    worker: 'pdf.worker.min.js',
    cmaps: 'cmaps/',
    standardFonts: 'standard_fonts/',
  },
] as const;

type PdfCdn = (typeof CDN_CANDIDATES)[number];

async function preflight(cdn: PdfCdn) {
  // Best-effort connectivity check to catch blocked CDNs early.
  // We use a tiny request (pdf.min.js) and rely on fetch errors.
  const url = cdn.base + cdn.pdf;
  const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!resp.ok) throw new Error(`PDF CDN not reachable: ${resp.status}`);
}

async function pickWorkingCdn(): Promise<PdfCdn> {
  let lastErr: unknown = null;
  for (const cdn of CDN_CANDIDATES) {
    try {
      await preflight(cdn);
      return cdn;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No reachable PDF CDN');
}

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = (async () => {
    // 이미 로드된 경우
    const existing = (window as any).pdfjsLib;
    if (existing) {
      pdfjsLib = existing;
      return existing;
    }

    const cdn = await pickWorkingCdn();

    // Load PDF.js from CDN
    const script = document.createElement('script');
    script.src = cdn.base + cdn.pdf;

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('PDF.js 스크립트 로드 실패'));
      document.head.appendChild(script);
    });

    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) throw new Error('PDF.js 로드 후 pdfjsLib를 찾을 수 없습니다');

    // NOTE: cross-origin worker 문제가 환경에 따라 발생할 수 있어,
    // 실제 parsing은 disableWorker 옵션으로 worker 없이 수행합니다.
    pdfjs.GlobalWorkerOptions.workerSrc = cdn.base + cdn.worker;

    // Attach chosen CDN paths for later (fonts/cmaps)
    (pdfjs as any).__lovableCdn = cdn;

    pdfjsLib = pdfjs;
    return pdfjs;
  })();

  return pdfjsPromise;
}

function getPdfResourceUrls(pdfjs: any) {
  const cdn: PdfCdn | undefined = pdfjs?.__lovableCdn;
  // Fallback to cdnjs if not present
  const chosen = cdn ?? CDN_CANDIDATES[CDN_CANDIDATES.length - 1];
  return {
    cMapUrl: chosen.base + chosen.cmaps,
    standardFontDataUrl: chosen.base + chosen.standardFonts,
  };
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const { cMapUrl, standardFontDataUrl } = getPdfResourceUrls(pdfjs);

  // PDF 폰트(CMap) 로드 오류로 텍스트 추출이 0이 되는 케이스를 방지
  const commonOptions = {
    data: arrayBuffer,
    disableWorker: true,

    // IMPORTANT: avoid hard dependency on a single CDN
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,

    // These options reduce font-fetch related failures and improve render fidelity for OCR.
    // (pdf.js will still fetch when needed, but will be more tolerant)
    useSystemFonts: true,
    disableFontFace: true,
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
  options?: { maxPages?: number; scale?: number; quality?: number; format?: 'jpeg' | 'png' }
): Promise<string[]> {
  const { maxPages = 2, scale = 1.6, quality = 0.85, format = 'jpeg' } = options ?? {};
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const { cMapUrl, standardFontDataUrl } = getPdfResourceUrls(pdfjs);

  const commonOptions = {
    data: arrayBuffer,
    disableWorker: true,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    useSystemFonts: true,
    disableFontFace: true,
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

    if (format === 'png') {
      urls.push(canvas.toDataURL('image/png'));
    } else {
      urls.push(canvas.toDataURL('image/jpeg', quality));
    }

    // 메모리 해제 힌트
    canvas.width = 0;
    canvas.height = 0;
  }

  return urls;
}
