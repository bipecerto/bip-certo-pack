/**
 * parse.ts — Parser CSV robusto com suporte a:
 * - Delimitadores: vírgula e ponto-e-vírgula (auto-detecta)
 * - Aspas duplas (RFC 4180)
 * - Encoding UTF-8 e latin1 (via TextDecoder)
 */

export interface ParsedCSV {
    headers: string[];
    rows: Record<string, string>[];
    rawHeaders: string[];
}

function detectDelimiter(sample: string): ',' | ';' | '\t' {
    const commas = (sample.match(/,/g) || []).length;
    const semicolons = (sample.match(/;/g) || []).length;
    const tabs = (sample.match(/\t/g) || []).length;
    if (tabs > commas && tabs > semicolons) return '\t';
    if (semicolons > commas) return ';';
    return ',';
}

/** Parse de uma linha CSV respeitando aspas duplas */
function parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

/** Lê File como Uint8Array e tenta UTF-8, fallback latin1 */
export async function readFileWithEncoding(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        return decoder.decode(bytes);
    } catch {
        const decoder = new TextDecoder('windows-1252');
        return decoder.decode(bytes);
    }
}

export function parseCsvText(text: string): ParsedCSV {
    // Normalizar quebras de linha
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Remover linhas vazias no início, ignorar comentários comuns
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) return { headers: [], rows: [], rawHeaders: [] };

    const sample = nonEmpty.slice(0, 3).join('\n');
    const delimiter = detectDelimiter(sample);

    const rawHeaders = parseLine(nonEmpty[0], delimiter);
    const headers = rawHeaders.map((h) =>
        h.replace(/^["'\s]+|["'\s]+$/g, '').trim()
    );

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < nonEmpty.length; i++) {
        const line = nonEmpty[i];
        if (!line.trim()) continue;
        const values = parseLine(line, delimiter);
        // Ignorar linhas onde toda coluna está vazia (linhas de rodapé de relatório)
        if (values.every((v) => !v.trim())) continue;
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] || '').trim();
        });
        rows.push(row);
    }

    return { headers, rows, rawHeaders };
}

/** Encontra um header pelo nome normalizado (tolerante a variações) */
export function findHeader(
    headers: string[],
    candidates: string[]
): string | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCandidates = candidates.map(norm);
    return headers.find((h) => normCandidates.includes(norm(h)));
}
