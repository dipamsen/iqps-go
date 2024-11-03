import COURSE_CODE_MAP from "../data/courses.json";
import { Exam, IQuestionPaper, IQuestionPaperFile, Semester } from "../types/question_paper";
import * as pdfjs from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { validateCourseCode, validateExam, validateSemester, validateYear } from "./validateInput";

// Set the pdfjs worker source
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

export const sanitizeQP = async (qp: IQuestionPaperFile) => {
    const sanitizedCourseName = qp.course_name
        .replace(/[^\w\d\_]/g, "-")
        .replace(/\$+/g, "$");

    const sanitizedFilename = qp.file.name
        .replace(/[^\w\d\_]/g, "-")
        .replace(/\$+/g, "$");

    const sanitizedExam = qp.exam
        .replace(/[^\w\d\_]/g, "-")
        .replace(/\$+/g, "$");

    return {
        ...qp,
        course_name: sanitizedCourseName,
        file_name: sanitizedFilename,
        exam: sanitizedExam,
        file: qp.file,
    };
};

export function getCourseFromCode<K extends keyof typeof COURSE_CODE_MAP>(code: string): typeof COURSE_CODE_MAP[K] | null {
    if (code.toUpperCase() in COURSE_CODE_MAP) {
        return COURSE_CODE_MAP[code.toUpperCase() as keyof typeof COURSE_CODE_MAP];
    } else {
        return null;
    }
};

export function getCodeFromCourse<K extends keyof typeof COURSE_CODE_MAP>(course: string): K | null {
    const index = Object.values(COURSE_CODE_MAP).indexOf(course);

    if (index !== -1) {
        return Object.keys(COURSE_CODE_MAP)[index] as K;
    } else {
        return null;
    }
};

export interface IExtractedDetails {
    course_code: string | null,
    year: number | null,
    exam: Exam | 'ct' | null,
    semester: Semester | null
}

export function extractDetailsFromText(text: string): IExtractedDetails {
    // Extract the first 10 lines
    const lines = text.split('\n').slice(0, 10).join('\n');

    const courseCodeMatch = lines.match(/[^\w]*([A-Z]{2}\d{5})[^\w]*/);
    const courseCodeMatchWithSpace = lines.match(/[^\w]*([A-Z]{2}\s*\d{5})[^\w]*/); // Match course codes written as XX XXXXX

    const courseCode = (
        courseCodeMatch ? courseCodeMatch[1].toUpperCase() :
            (
                courseCodeMatchWithSpace ?
                    courseCodeMatchWithSpace[1].replace(/\s*/g, '').toUpperCase() : null
            )
    );

    const yearMatch = lines.match(/([^\d]|^)(2\d{3})([^\d]|$)/); // Someone change this in the year 3000
    const year = yearMatch ? Number(yearMatch[2]) : null;

    const examTypeMatch = lines.match(/[^\w]*(Mid|End|Class Test)[^\w]*/i);
    const examTypeMatchStr = examTypeMatch ? examTypeMatch[1].toLowerCase() : null;
    const examType = <IExtractedDetails['exam']>(
        examTypeMatchStr ? (
            (examTypeMatchStr == 'mid' || examTypeMatchStr == 'end') ?
                examTypeMatchStr + 'sem'
                : examTypeMatchStr === 'class test' ?
                    'ct' : null
        ) : null
    );

    const semesterMatch = lines.match(/[^\w]*(spring|autumn)[^\w]*/i);
    const semester = semesterMatch ? semesterMatch[1].toLowerCase() as Semester : null;

    return {
        course_code: courseCode,
        year,
        exam: examType,
        semester
    };
}

export async function extractTextFromPDF(pdfData: ArrayBuffer): Promise<string> {
    const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    const imageData = canvas.toDataURL('image/png');

    const { data: { text } } = await Tesseract.recognize(imageData, 'eng');

    return text;
}

async function getAutofillDataFromPDF(file: File): Promise<IExtractedDetails> {
    try {
        const pdfData = await file.arrayBuffer();
        const text = await extractTextFromPDF(pdfData);

        const { course_code, year, exam, semester } = extractDetailsFromText(text);
        return { course_code, year, exam, semester };
    } catch (e) {
        console.log("Error extracting details from PDF: ", e);

        return {
            course_code: null,
            year: null,
            exam: null,
            semester: null
        }
    }
}

export const autofillData = async (
    filename: string, file: File,
): Promise<IQuestionPaper> => {
    // Try to extract details from the PDF
    const { course_code: pdfCourseCode, year: pdfYear, exam: pdfExam, semester: pdfSemester } = await getAutofillDataFromPDF(file);
    // Try to extract details from the filename
    const dotIndex = filename.lastIndexOf("."); // Split the filename at the last `.`, ie, remove the extension
    const { course_code: filenameCourseCode, year: filenameYear, exam: filenameExam, semester: filenameSemester } = extractDetailsFromText(filename.substring(0, dotIndex));

    const filenameOrPdfFallback = <T>(
        filenameData: T | null,
        pdfData: T | null,
        validator: (data: T) => boolean,
        fallback: T
    ): T => {
        return filenameData !== null && validator(filenameData) ?
            filenameData :
            pdfData !== null && validator(pdfData) ?
                pdfData : fallback;
    }

    const course_code = filenameOrPdfFallback(filenameCourseCode, pdfCourseCode, validateCourseCode, 'Unknown Course');
    const year = filenameOrPdfFallback(filenameYear, pdfYear, validateYear, new Date().getFullYear());
    const exam = filenameOrPdfFallback(filenameExam, pdfExam, validateExam, '');
    const semester = filenameOrPdfFallback(filenameSemester, pdfSemester, validateSemester, new Date().getMonth() > 7 ? "autumn" : "spring");

    const qpDetails: IQuestionPaper = {
        course_code,
        year,
        exam,
        semester,
        course_name: getCourseFromCode(course_code) ?? "Unknown Course",
    };

    return qpDetails;
};

